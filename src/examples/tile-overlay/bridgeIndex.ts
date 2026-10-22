import type { Bridge } from './bridgeData.ts';
import { latLngToTile, tileBounds } from './tileMath.ts';

/**
 * Zoom level at which bridges are bucketed into tiles. Rendering a tile at
 * this zoom is a direct map lookup; coarser tiles aggregate several buckets,
 * and finer tiles filter one bucket down to the requested area. Either way
 * it's a handful of array operations per tile, never a scan of the full
 * dataset.
 */
export const INDEX_ZOOM = 11;

export type BridgeIndex = Map<string, Bridge[]>;

export function buildBridgeIndex(bridges: Bridge[]): BridgeIndex {
  const index: BridgeIndex = new Map();
  for (const bridge of bridges) {
    const { x, y } = latLngToTile(bridge.lat, bridge.lng, INDEX_ZOOM);
    const key = tileKey(x, y);
    const bucket = index.get(key);
    if (bucket) bucket.push(bridge);
    else index.set(key, [bridge]);
  }
  return index;
}

export function getBridgesForTile(index: BridgeIndex, x: number, y: number, z: number): Bridge[] {
  if (z === INDEX_ZOOM) {
    return index.get(tileKey(x, y)) ?? [];
  }

  if (z < INDEX_ZOOM) {
    // This tile is coarser than the index: gather every indexed child tile it covers.
    const scale = 2 ** (INDEX_ZOOM - z);
    const result: Bridge[] = [];
    for (let dx = 0; dx < scale; dx++) {
      for (let dy = 0; dy < scale; dy++) {
        const bucket = index.get(tileKey(x * scale + dx, y * scale + dy));
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }

  // This tile is finer than the index: its bucket is a single indexed parent
  // tile, which also holds bridges from sibling tiles, so filter down to bounds.
  const scale = 2 ** (z - INDEX_ZOOM);
  const parentKey = tileKey(Math.floor(x / scale), Math.floor(y / scale));
  const bucket = index.get(parentKey);
  if (!bucket) return [];

  const bounds = tileBounds(x, y, z);
  return bucket.filter(
    (bridge) =>
      bridge.lat <= bounds.north &&
      bridge.lat > bounds.south &&
      bridge.lng >= bounds.west &&
      bridge.lng < bounds.east,
  );
}

/**
 * The closest bridge to (lat, lng) among `candidates`, or null if the list
 * is empty. Distance is plain squared lat/lng difference, which is only
 * meaningful for comparing candidates that are already close together (e.g.
 * bridges from the same small tile) — it's not a real-world distance.
 */
export function nearestBridge(candidates: Bridge[], lat: number, lng: number): Bridge | null {
  let nearest: Bridge | null = null;
  let nearestDistance = Infinity;
  for (const bridge of candidates) {
    const distance = (bridge.lat - lat) ** 2 + (bridge.lng - lng) ** 2;
    if (distance < nearestDistance) {
      nearest = bridge;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function tileKey(x: number, y: number): string {
  return `${x}/${y}`;
}
