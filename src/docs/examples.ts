export type ExampleId = 'basic' | 'marker' | 'clusters' | 'route' | 'search';
export type ExampleDefinition = { id: ExampleId; title: string; category: string; summary: string; details: string[]; features: string[]; snippet: string; };
export const examples: ExampleDefinition[] = [
  { id: 'basic', title: 'Basic map', category: 'Getting started', summary: 'Initialize a HERE map with React and TypeScript.', details: ['A reusable hook owns map initialization, resize handling, UI controls, and cleanup.', 'This demo uses HERE map tiles and requires a HERE API key.'], features: ['HERE Maps JavaScript SDK', 'React useEffect', 'ResizeObserver'], snippet: `// From src/shared/maps/useHereMap.ts\nconst platform = new H.service.Platform({ apikey: apiKey });\nconst layers = platform.createDefaultLayers();\nconst map = new H.Map(container, layers.vector.normal.map, {\n  center: { lat: 39.7684, lng: -86.1581 }, zoom: 9\n});\n// Dispose map and listeners when the component unmounts.` },
  { id: 'marker', title: 'Marker & info bubble', category: 'Getting started', summary: 'Add a single marker to the map and open an information bubble when it is clicked.', details: ['A standard HERE marker is placed on the map without clustering.', 'Click the marker to display an info bubble; clicking it again replaces the previous bubble.', 'The marker, event listener, and bubble are cleaned up when the example unmounts.'], features: ['H.map.Marker', 'H.ui.InfoBubble', 'Marker tap event'], snippet: `// From src/examples/marker/InfoBubbleMap.tsx
const marker = new H.map.Marker(location);
map.addObject(marker);
const openInfoBubble = () => {
  ui.getBubbles().forEach((bubble) => ui.removeBubble(bubble));
  ui.addBubble(new H.ui.InfoBubble(location, {
    content: '<strong>Indianapolis, Indiana</strong>'
  }));
};
marker.addEventListener('tap', openInfoBubble);` },
  { id: 'search', title: 'Address typeahead search', category: 'Getting started', summary: 'Search for an address with HERE Autosuggest, then place a marker and zoom to the selected result.', details: ['The search box calls HERE Geocoding & Search Autosuggest v1 after a 300 ms debounce and displays address suggestions.', 'Selecting a suggestion uses its coordinates or HERE Lookup v1, replaces the existing pin, and zooms the map to level 16.', 'Results are fetched live from HERE; an API key with Geocoding & Search access is required.'], features: ['HERE Autosuggest API v1', 'HERE Lookup API v1', 'H.map.Marker', 'Debounced React input'], snippet: `// From src/examples/marker/AddressSearchMap.tsx
const params = new URLSearchParams({ q: query, at: '39.7684,-86.1581', apiKey });
const results = await fetch(\`https://autosuggest.search.hereapi.com/v1/autosuggest?\${params}\`);
// When an address is selected:
const marker = new H.map.Marker(selected.position);
map.addObject(marker);
map.setCenter(selected.position, true);
map.setZoom(16, true);` },
  { id: 'clusters', title: 'Restaurant clustering', category: 'Data visualization', summary: 'Numbered clusters expand into individual restaurant pins as you zoom.', details: ['Restaurant coordinates come from a static list of 12 sample locations.', 'HERE’s clustering provider groups nearby locations, and a custom theme renders the counts.', 'Tap a cluster to zoom in; individual restaurant pins remain markers without information bubbles.'], features: ['H.clustering.Provider', 'Custom SVG marker theme', 'Cluster zoom interaction'], snippet: `// From src/examples/clustering/RestaurantMap.tsx\nconst points = restaurants.map((restaurant) =>\n  new H.clustering.DataPoint(restaurant.lat, restaurant.lng, 1, restaurant)\n);\nconst provider = new H.clustering.Provider(points, {\n  clusteringOptions: { eps: 42, minWeight: 2 },\n  theme: {\n    getClusterPresentation(cluster) {\n      // Draw a numbered SVG marker using cluster.getWeight().\n    },\n    getNoisePresentation(point) {\n      // Return an individual restaurant marker.\n    }\n  }\n});` },
  { id: 'route', title: 'Directions & route card', category: 'Routing', summary: 'Display a multi-stop route, location markers, and a route summary card.', details: ['The example requests a route from HERE Routing API v8.', 'The HERE SDK renders the route geometry and stop markers on the map.', 'The route card overlays the map with the calculated distance and duration.'], features: ['Routing API v8 response', 'Flexible polyline', 'React overlay card'], snippet: `// From src/examples/directions/RouteMap.tsx\n// Route responses are loaded by routeData.ts.\n// Route data is requested live from HERE Routing API v8.\n// Geometry and summary values are transformed before rendering.\n// Inspect RouteMap.tsx for the full polyline and marker implementation.` }
];
