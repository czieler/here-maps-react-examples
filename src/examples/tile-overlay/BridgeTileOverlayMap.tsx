import mapLayout from '../../shared/maps/MapLayout.module.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import H from '@here/maps-api-for-javascript';
import { useHereMap } from '../../shared/maps/useHereMap';
import { liftGeoPoint } from '../../shared/maps/pinIcon';
import { loadBridges } from './bridgeData';
import type { Bridge } from './bridgeData';
import { buildBridgeIndex, getBridgesForTile, nearestBridge } from './bridgeIndex';
import { cellIndexForPoint, latLngToTile, tileBounds } from './tileMath';
import { aggregateCellValue, colorForValue, legendStops } from './renderModes';
import type { RenderMode } from './renderModes';
import styles from './BridgeTileOverlayMap.module.css';

type BridgeTileOverlayMapProps = {
  apiKey: string;
};

// Each tile is subdivided into a CELLS_PER_TILE x CELLS_PER_TILE grid for
// aggregation. Because tile coverage area shrinks by 4x per zoom level while
// the grid stays fixed, cells automatically get finer as you zoom in, so
// bridges aggregate into visible clusters at the state level instead of
// vanishing into mostly-empty fine-grained cells.
const TILE_SIZE = 256;
const CELLS_PER_TILE = 16;
const MIN_ZOOM = 6;
const MAX_ZOOM = 16;

// Below this zoom, a tile's cells each already aggregate many bridges, so a
// click can't point at one specific bridge. At and above it, cells are fine
// enough that most hold at most a handful, close to one-to-one.
const MIN_CLICKABLE_ZOOM = 14;
const TAP_HIT_RADIUS_PX = 20;
const BUBBLE_LIFT_PX = 14;

const mapConfiguration = {
  center: { lat: 39.9, lng: -86.4 },
  zoom: 7,
};

const MODES: { id: RenderMode; label: string }[] = [
  { id: 'condition', label: 'Condition' },
  { id: 'recency', label: 'Recency' },
  { id: 'exposure', label: 'Exposure' },
];

export function BridgeTileOverlayMap({ apiKey }: BridgeTileOverlayMapProps) {
  const { containerRef, map, ui } = useHereMap(apiKey, mapConfiguration);
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.75);
  const [mode, setMode] = useState<RenderMode>('condition');

  // The committed dataset never changes, so the bridge list and its tile
  // index are computed once up front rather than inside an effect.
  const bridges = loadBridges();
  const index = useMemo(() => buildBridgeIndex(bridges), [bridges]);
  const status = `${bridges.length.toLocaleString()} Indiana bridges indexed`;

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const providerRef = useRef<H.map.provider.ImageTileProvider | null>(null);
  const layerRef = useRef<H.map.layer.TileLayer | null>(null);

  // Creates the provider and layer exactly once per map instance. Mode,
  // opacity, and visibility are applied afterward via direct calls (reload /
  // setOpacity / addLayer-removeLayer) rather than by rebuilding anything, so
  // this effect depends on [map, index] alone (index is stable) and can never
  // tear down and re-create the overlay on an unrelated re-render.
  useEffect(() => {
    if (!map) return;

    const pixelRatio = window.devicePixelRatio >= 2 ? 2 : 1;
    const tileSize = TILE_SIZE * pixelRatio;
    const cellSize = tileSize / CELLS_PER_TILE;

    const provider = new H.map.provider.ImageTileProvider({
      min: MIN_ZOOM,
      max: MAX_ZOOM,
      tileSize,
      getURL(column: number, row: number, zoom: number) {
        const bridgesInTile = getBridgesForTile(index, column, row, zoom);
        if (bridgesInTile.length === 0) return undefined;

        const bounds = tileBounds(column, row, zoom);
        const cells = new Map<string, Bridge[]>();
        for (const bridge of bridgesInTile) {
          const { col, row: cellRow } = cellIndexForPoint(bridge.lat, bridge.lng, bounds, CELLS_PER_TILE);
          const key = `${col}/${cellRow}`;
          const cell = cells.get(key);
          if (cell) cell.push(bridge);
          else cells.set(key, [bridge]);
        }

        const canvas = document.createElement('canvas');
        canvas.width = tileSize;
        canvas.height = tileSize;
        const context = canvas.getContext('2d');
        if (!context) return undefined;

        const now = Date.now();
        for (const [key, cellBridges] of cells) {
          const [col, cellRow] = key.split('/').map(Number);
          const value = aggregateCellValue(cellBridges, modeRef.current, now);
          if (value === null) continue;
          context.fillStyle = colorForValue(modeRef.current, value);
          context.fillRect(col * cellSize, cellRow * cellSize, cellSize, cellSize);
        }

        // A data URL keeps tile generation fully client-side: no tile server
        // is involved, even though the provider API is the same one used to
        // request tiles over the network.
        return canvas.toDataURL('image/png');
      },
      getCopyrights() {
        return [{ label: 'Bridge data: FHWA National Bridge Inventory', alt: 'FHWA NBI' }];
      },
    });

    const layer = new H.map.layer.TileLayer(provider, {});
    providerRef.current = provider;
    layerRef.current = layer;

    return () => {
      map.removeLayer(layer);
      provider.dispose();
      providerRef.current = null;
      layerRef.current = null;
    };
  }, [map, index]);

  // Switching modes redraws the already-cached tiles in place.
  useEffect(() => {
    providerRef.current?.reload(true);
  }, [mode]);

  // The provider itself exposes setOpacity, so opacity changes apply
  // directly without touching the layer or re-fetching any tiles.
  useEffect(() => {
    providerRef.current?.setOpacity(opacity);
  }, [opacity]);

  // Showing/hiding the overlay is just adding or removing the one persistent
  // layer instance, not recreating it.
  useEffect(() => {
    if (!map || !layerRef.current) return;
    if (visible) map.addLayer(layerRef.current);
    else map.removeLayer(layerRef.current);
  }, [map, visible]);

  // Past MIN_CLICKABLE_ZOOM, tapping the map looks up the nearest bridge to
  // the tapped point in the same tile index the overlay renders from, and
  // shows its details if it's close enough on screen to be a plausible hit.
  // There's no per-bridge object to attach a tap listener to (the overlay is
  // a raster tile layer), so this listens for taps on the map itself.
  useEffect(() => {
    if (!map || !ui) return;

    const onTap = (event: H.mapevents.Event) => {
      const zoom = map.getZoom();
      if (zoom < MIN_CLICKABLE_ZOOM) return;

      const pointer = event.currentPointer;
      const tapPosition = map.screenToGeo(pointer.viewportX, pointer.viewportY);
      if (!tapPosition) return;

      const roundedZoom = Math.round(zoom);
      const { x, y } = latLngToTile(tapPosition.lat, tapPosition.lng, roundedZoom);
      const candidates = getBridgesForTile(index, x, y, roundedZoom);
      const bridge = nearestBridge(candidates, tapPosition.lat, tapPosition.lng);
      if (!bridge) return;

      const bridgeScreen = map.geoToScreen(bridge);
      if (!bridgeScreen) return;
      const dx = bridgeScreen.x - pointer.viewportX;
      const dy = bridgeScreen.y - pointer.viewportY;
      if (dx * dx + dy * dy > TAP_HIT_RADIUS_PX ** 2) return;

      ui.getBubbles().forEach((openBubble) => ui.removeBubble(openBubble));
      const bubble = new H.ui.InfoBubble(liftGeoPoint(map, bridge, BUBBLE_LIFT_PX), {
        content: formatBridgeDetails(bridge),
      });
      ui.addBubble(bubble);
    };

    map.addEventListener('tap', onTap);
    return () => map.removeEventListener('tap', onTap);
  }, [map, ui, index]);

  return (
    <section className={mapLayout.mapRegion}>
      <div className={styles.status} role="status" aria-live="polite">{status}</div>
      <div className={styles.panel}>
        <label className={styles.visibilityRow}>
          <input type="checkbox" checked={visible} onChange={(event) => setVisible(event.target.checked)} />
          Show overlay
        </label>

        <label className={styles.opacityRow}>
          <span>Opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
            aria-label="Overlay opacity"
          />
        </label>

        <div className={styles.modeRow} role="radiogroup" aria-label="Render mode">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              className={mode === item.id ? styles.modeButtonActive : styles.modeButton}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.legend}>
          {legendStops(mode).map((stop) => (
            <div className={styles.legendRow} key={stop.label}>
              <span className={styles.legendSwatch} style={{ background: stop.color }} />
              <span>{stop.label}</span>
            </div>
          ))}
        </div>

        <p className={styles.hint}>Zoom in past level {MIN_CLICKABLE_ZOOM} and click a cell to inspect that bridge.</p>
      </div>
      <div
        ref={containerRef}
        className={mapLayout.map}
        aria-label="Indiana bridge condition tile overlay map"
      />
    </section>
  );
}

const CONDITION_LABELS: Record<Bridge['condition'], string> = { G: 'Good', F: 'Fair', P: 'Poor' };

// The facility/feature text ultimately comes from a government data file,
// not user input, but it's rendered as innerHTML (H.ui.InfoBubble applies
// string content that way) — escape it rather than assume it's always safe.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function formatBridgeDetails(bridge: Bridge): string {
  const crossing = bridge.facilityCarried
    ? `${escapeHtml(bridge.facilityCarried)} over ${escapeHtml(bridge.featureCrossed ?? 'unnamed feature')}`
    : `Structure ${escapeHtml(bridge.structureNumber)}`;
  const inspected = bridge.lastInspected
    ? new Date(`${bridge.lastInspected}-01`).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : 'unknown';
  const traffic = bridge.dailyTraffic === null ? 'not reported' : `${bridge.dailyTraffic.toLocaleString()} / day`;

  return `
    <div style="min-width:200px;max-width:280px;padding:4px;line-height:1.6">
      <strong>${crossing}</strong>
      <div>Structure no. ${escapeHtml(bridge.structureNumber)}</div>
      <div>Condition: ${CONDITION_LABELS[bridge.condition]} (lowest rating ${bridge.lowestRating}/9)</div>
      <div>Built ${bridge.yearBuilt} &middot; last inspected ${inspected}</div>
      <div>Daily traffic: ${traffic}</div>
    </div>
  `;
}
