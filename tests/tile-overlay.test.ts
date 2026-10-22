import assert from 'node:assert/strict';
import test from 'node:test';
import { tileBounds, latLngToTile, cellIndexForPoint } from '../src/examples/tile-overlay/tileMath.ts';
import { buildBridgeIndex, getBridgesForTile, nearestBridge, INDEX_ZOOM } from '../src/examples/tile-overlay/bridgeIndex.ts';
import {
  aggregateCellValue,
  colorForValue,
  daysSinceInspection,
  exposureScore,
} from '../src/examples/tile-overlay/renderModes.ts';
import type { Bridge } from '../src/examples/tile-overlay/bridgeData.ts';

function approxEqual(actual: number, expected: number, tolerance = 1e-3) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function makeBridge(overrides: Partial<Bridge>): Bridge {
  return {
    lat: 39.9,
    lng: -86.4,
    structureNumber: '000001',
    facilityCarried: 'SR 1',
    featureCrossed: 'TEST CREEK',
    condition: 'G',
    lowestRating: 7,
    yearBuilt: 2000,
    lastInspected: '2024-01',
    dailyTraffic: 1000,
    ...overrides,
  };
}

test('tileBounds covers the whole world at zoom 0', () => {
  const bounds = tileBounds(0, 0, 0);
  assert.equal(bounds.west, -180);
  assert.equal(bounds.east, 180);
  approxEqual(bounds.north, 85.0511, 1e-3);
  approxEqual(bounds.south, -85.0511, 1e-3);
});

test('tileBounds splits the world into quadrants at zoom 1', () => {
  const northWest = tileBounds(0, 0, 1);
  assert.equal(northWest.west, -180);
  assert.equal(northWest.east, 0);
  approxEqual(northWest.south, 0, 1e-3);
});

test('latLngToTile finds the tile containing a point', () => {
  assert.deepEqual(latLngToTile(0, 0, 1), { x: 1, y: 1 });
  assert.deepEqual(latLngToTile(85, -179.9, 1), { x: 0, y: 0 });
});

test('cellIndexForPoint places interior points by fraction across the tile', () => {
  const bounds = { north: 10, south: 0, east: 10, west: 0 };
  assert.deepEqual(cellIndexForPoint(5, 5, bounds, 4), { col: 2, row: 2 });
  assert.deepEqual(cellIndexForPoint(10, 0, bounds, 4), { col: 0, row: 0 });
});

test('cellIndexForPoint clamps a point exactly on the east/south tile boundary', () => {
  const bounds = { north: 10, south: 0, east: 10, west: 0 };
  // lng === east and lat === south would overflow to column/row 4 of a 0-3 grid without clamping.
  assert.deepEqual(cellIndexForPoint(0, 10, bounds, 4), { col: 3, row: 3 });
});

test('buildBridgeIndex places a known bridge in its expected tile', () => {
  const bridge = makeBridge({ lat: 39.768, lng: -86.158 });
  const index = buildBridgeIndex([bridge]);
  const { x, y } = latLngToTile(bridge.lat, bridge.lng, INDEX_ZOOM);

  assert.deepEqual(getBridgesForTile(index, x, y, INDEX_ZOOM), [bridge]);
  assert.deepEqual(getBridgesForTile(index, x + 1, y, INDEX_ZOOM), []);
});

test('getBridgesForTile aggregates indexed children for a coarser tile', () => {
  const bridge = makeBridge({ lat: 39.768, lng: -86.158 });
  const index = buildBridgeIndex([bridge]);
  const { x, y } = latLngToTile(bridge.lat, bridge.lng, INDEX_ZOOM);
  const parentZoom = INDEX_ZOOM - 2;
  const parentX = Math.floor(x / 4);
  const parentY = Math.floor(y / 4);

  assert.deepEqual(getBridgesForTile(index, parentX, parentY, parentZoom), [bridge]);
});

test('getBridgesForTile filters one indexed parent down to a finer tile', () => {
  const bridge = makeBridge({ lat: 39.768, lng: -86.158 });
  const index = buildBridgeIndex([bridge]);
  const childZoom = INDEX_ZOOM + 2;
  const { x: childX, y: childY } = latLngToTile(bridge.lat, bridge.lng, childZoom);

  assert.deepEqual(getBridgesForTile(index, childX, childY, childZoom), [bridge]);
  // A sibling tile under the same indexed parent should not pick it up.
  assert.deepEqual(getBridgesForTile(index, childX + 1, childY, childZoom), []);
});

test('aggregateCellValue returns null for an empty cell', () => {
  assert.equal(aggregateCellValue([], 'condition', Date.now()), null);
});

test('aggregateCellValue picks the worst rating for condition mode', () => {
  const bridges = [makeBridge({ lowestRating: 7 }), makeBridge({ lowestRating: 3 })];
  assert.equal(aggregateCellValue(bridges, 'condition', Date.now()), 3);
});

test('aggregateCellValue picks the longest-overdue inspection for recency mode', () => {
  const now = new Date(2026, 0, 1).getTime();
  const bridges = [
    makeBridge({ lastInspected: '2025-12' }),
    makeBridge({ lastInspected: '2020-01' }),
  ];
  const value = aggregateCellValue(bridges, 'recency', now);
  assert.ok(value !== null && value > 2000);
});

test('aggregateCellValue ignores bridges with no inspection date for recency mode', () => {
  const now = Date.now();
  assert.equal(aggregateCellValue([makeBridge({ lastInspected: null })], 'recency', now), null);
});

test('aggregateCellValue picks the highest exposure score for exposure mode', () => {
  const bridges = [
    makeBridge({ lowestRating: 8, dailyTraffic: 50 }),
    makeBridge({ lowestRating: 1, dailyTraffic: 10_000 }),
  ];
  assert.equal(aggregateCellValue(bridges, 'exposure', Date.now()), exposureScore(bridges[1]));
});

test('daysSinceInspection is null without a date and clamped at 0 for future dates', () => {
  assert.equal(daysSinceInspection(null, Date.now()), null);
  const now = new Date(2024, 0, 1).getTime();
  assert.equal(daysSinceInspection('2024-06', now), 0);
});

test('condition color ramp treats both ends and out-of-range input', () => {
  const worst = colorForValue('condition', 0);
  const best = colorForValue('condition', 9);
  assert.notEqual(worst, best);
  assert.equal(colorForValue('condition', -5), worst);
  assert.equal(colorForValue('condition', 20), best);
});

test('recency color ramp treats both ends and out-of-range input', () => {
  const fresh = colorForValue('recency', 0);
  const veryOverdue = colorForValue('recency', 10_000);
  assert.notEqual(fresh, veryOverdue);
  assert.equal(colorForValue('recency', -100), fresh);
});

test('exposure color ramp treats both ends and out-of-range input', () => {
  const low = colorForValue('exposure', 0);
  const high = colorForValue('exposure', 1_000_000);
  assert.notEqual(low, high);
  assert.equal(colorForValue('exposure', -1), low);
});

test('nearestBridge returns null for an empty candidate list', () => {
  assert.equal(nearestBridge([], 39.9, -86.4), null);
});

test('nearestBridge picks the closest of several candidates', () => {
  const near = makeBridge({ structureNumber: 'near', lat: 39.901, lng: -86.401 });
  const far = makeBridge({ structureNumber: 'far', lat: 40.5, lng: -87.0 });
  assert.equal(nearestBridge([far, near], 39.9, -86.4), near);
});
