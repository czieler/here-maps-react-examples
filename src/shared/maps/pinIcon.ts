import H from '@here/maps-api-for-javascript';

/** Shared teal location marker used across the examples. */
export const PIN_COLOR = '#00a6b5';

// The pin SVG is 36x48 and anchored near its tip (point { x: 18, y: 45 }) so
// that tip, not the icon's bounding box, lines up with the marker's geo
// position. bubbleAnchorAbovePin (below) uses this to clear the pin's head.
const PIN_ANCHOR = { x: 18, y: 45 };
const BUBBLE_GAP_PX = 8;

export function createPinIcon(label?: string): H.map.Icon {
  const safeLabel = label?.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) ?? '';
  const center = safeLabel
    ? `<circle cx="18" cy="18" r="9" fill="white"/><text x="18" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="${PIN_COLOR}">${safeLabel}</text>`
    : '<circle cx="18" cy="18" r="6.5" fill="white"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path d="M18 2C9.2 2 2 9.2 2 18c0 12 16 27 16 27s16-15 16-27C34 9.2 26.8 2 18 2Z" fill="${PIN_COLOR}" stroke="#ffffff" stroke-width="2.5"/>${center}</svg>`;
  return new H.map.Icon(svg, { size: { w: 36, h: 48 }, anchor: PIN_ANCHOR });
}

/**
 * H.ui.InfoBubble has no offset/anchor option — it positions its own tail at
 * exactly the geo position it's given. This converts a point to screen
 * space, shifts it up by `liftPx` pixels, and converts back, so a bubble
 * placed at the result clears whatever is drawn at the original point
 * instead of overlapping it.
 *
 * Returns `position` unchanged if it can't currently be projected (e.g. the
 * map hasn't finished sizing itself yet).
 */
export function liftGeoPoint(map: H.Map, position: H.geo.IPoint, liftPx: number): H.geo.IPoint {
  const screen = map.geoToScreen(position);
  if (!screen) return position;
  const lifted = map.screenToGeo(screen.x, screen.y - liftPx);
  return lifted ?? position;
}

/**
 * Where an info bubble should be positioned to clear a pin placed at
 * `pinPosition` (the pin's own geo position is its tip, at ground level) —
 * see liftGeoPoint above.
 */
export function bubbleAnchorAbovePin(map: H.Map, pinPosition: H.geo.IPoint): H.geo.IPoint {
  return liftGeoPoint(map, pinPosition, PIN_ANCHOR.y + BUBBLE_GAP_PX);
}
