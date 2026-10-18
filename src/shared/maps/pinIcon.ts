import H from '@here/maps-api-for-javascript';

/** Shared teal location marker used across the examples. */
export const PIN_COLOR = '#00a6b5';

export function createPinIcon(label?: string): H.map.Icon {
  const safeLabel = label?.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) ?? '';
  const center = safeLabel
    ? `<circle cx="18" cy="18" r="9" fill="white"/><text x="18" y="22" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="${PIN_COLOR}">${safeLabel}</text>`
    : '<circle cx="18" cy="18" r="6.5" fill="white"/>';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48"><path d="M18 2C9.2 2 2 9.2 2 18c0 12 16 27 16 27s16-15 16-27C34 9.2 26.8 2 18 2Z" fill="${PIN_COLOR}" stroke="#ffffff" stroke-width="2.5"/>${center}</svg>`;
  return new H.map.Icon(svg, { size: { w: 36, h: 48 }, anchor: { x: 18, y: 45 } });
}
