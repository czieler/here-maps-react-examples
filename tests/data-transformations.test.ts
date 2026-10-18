import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, parseRestaurants } from '../src/examples/clustering/restaurantTransform.ts';
import { parseRouteResponse } from '../src/examples/directions/routeTransform.ts';

test('normalizes node and way coordinates from an Overpass response', () => {
  const restaurants = parseRestaurants({
    elements: [
      { id: 1, lat: 39.7, lon: -86.1, tags: { name: 'Cafe', cuisine: 'coffee; bakery' } },
      { id: 2, center: { lat: 39.8, lon: -86.2 }, tags: {} },
      { id: 3, lat: '39.9', lon: -86.3 },
    ],
  });

  assert.deepEqual(restaurants, [
    { id: 1, name: 'Cafe', cuisine: 'coffee; bakery', lat: 39.7, lng: -86.1 },
    { id: 2, name: 'Restaurant', lat: 39.8, lng: -86.2 },
  ]);
});

test('rejects a malformed restaurant response', () => {
  assert.throws(() => parseRestaurants({ data: [] }), /invalid response format/);
  assert.deepEqual(
    parseRestaurants({
      elements: [
        { id: 1, lat: 91, lon: 0 },
        { id: Number.MAX_SAFE_INTEGER + 1, lat: 0, lon: 0 },
      ],
    }),
    [],
  );
});

test('escapes restaurant content before embedding it in an info bubble', () => {
  assert.equal(
    escapeHtml(`<img src="x" onerror='run()'>&`),
    '&lt;img src=&quot;x&quot; onerror=&#39;run()&#39;&gt;&amp;',
  );
});

test('validates and aggregates HERE route sections', () => {
  const route = parseRouteResponse({
    routes: [{
      sections: [
        { polyline: 'first', summary: { length: 1200, duration: 90 } },
        { polyline: 'second', summary: { length: 800, duration: 60 } },
      ],
    }],
  });

  assert.deepEqual(route, {
    sections: [
      { polyline: 'first', length: 1200, duration: 90 },
      { polyline: 'second', length: 800, duration: 60 },
    ],
    length: 2000,
    duration: 150,
  });
});

test('rejects missing or invalid route summaries', () => {
  assert.throws(() => parseRouteResponse({ routes: [] }), /does not contain a route/);
  assert.throws(
    () => parseRouteResponse({
      routes: [{
        sections: [{ polyline: 'x', summary: { length: -1, duration: 2 } }],
      }],
    }),
    /missing its distance or duration/,
  );
});

