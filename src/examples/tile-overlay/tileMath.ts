export type TileBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** Standard Web Mercator slippy-map tile bounds for tile (x, y) at zoom z. */
export function tileBounds(x: number, y: number, z: number): TileBounds {
  const tilesPerAxis = 2 ** z;
  const west = (x / tilesPerAxis) * 360 - 180;
  const east = ((x + 1) / tilesPerAxis) * 360 - 180;
  return {
    west,
    east,
    north: mercatorYToLat(y / tilesPerAxis),
    south: mercatorYToLat((y + 1) / tilesPerAxis),
  };
}

/** The tile (x, y) at zoom z that contains the given point. */
export function latLngToTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const tilesPerAxis = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * tilesPerAxis);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tilesPerAxis,
  );
  return { x: clampTileIndex(x, tilesPerAxis), y: clampTileIndex(y, tilesPerAxis) };
}

/**
 * Which cell of a cellsPerAxis-by-cellsPerAxis grid over `bounds` contains
 * (lat, lng). A point exactly on the east or south edge belongs to the last
 * column/row rather than overflowing into a nonexistent next cell.
 */
export function cellIndexForPoint(
  lat: number,
  lng: number,
  bounds: TileBounds,
  cellsPerAxis: number,
): { col: number; row: number } {
  const fractionX = (lng - bounds.west) / (bounds.east - bounds.west);
  const fractionY = (bounds.north - lat) / (bounds.north - bounds.south);
  return {
    col: clamp(Math.floor(fractionX * cellsPerAxis), 0, cellsPerAxis - 1),
    row: clamp(Math.floor(fractionY * cellsPerAxis), 0, cellsPerAxis - 1),
  };
}

function mercatorYToLat(y: number): number {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function clampTileIndex(value: number, tilesPerAxis: number): number {
  return clamp(value, 0, tilesPerAxis - 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
