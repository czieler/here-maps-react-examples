![HERE Maps React Examples](images/here-maps-banner.png)

# HERE Maps + React Examples

A collection of working, focused examples of integrating HERE Maps with React, TypeScript, and Vite.

## Examples

| Example | Demonstrates |
| --- | --- |
| **Basic map** | HERE Maps JavaScript SDK initialization, controls, resize handling, and cleanup |
| **Marker & info bubble** | A custom teal marker with a clickable information bubble |
| **Address typeahead search** | HERE Autosuggest and Lookup APIs, keyboard-friendly suggestions, map centering, and a clickable marker |
| **Restaurant clustering** | A static list of 12 sample restaurants, custom restaurant pins, cluster counts, and zoom interactions |
| **Directions & route card** | HERE Routing API v8, multiple stops, flexible polyline rendering, and route summary |
| **Bridge condition tile overlay** | A custom `H.map.provider.ImageTileProvider` / `H.map.layer.TileLayer`, canvas-generated tiles, and a committed Indiana bridge-condition dataset |

These are **live examples**. There are no stored API responses or mock-data modes, with one exception: the bridge condition tile overlay renders entirely from a dataset committed to this repo (see below), so it makes no live service calls. Opening maps and using search or routing may consume API quota. Restaurant clustering uses a static list of 12 sample restaurants and makes no restaurant-data API requests.

### Bridge condition tile overlay

This example renders ~19,500 Indiana bridges from the Federal Highway Administration's [National Bridge Inventory](https://www.fhwa.dot.gov/bridge/nbi/ascii.cfm) (data downloaded 2026-10-22) as a custom tile layer. The dataset (`src/examples/tile-overlay/data/indiana-bridges.json`) is committed to the repo and fully client-side: tiles are drawn on an offscreen canvas and handed to the map as a data URL, with no tile server involved.

The point of the example is the mechanism, not the data volume: it demonstrates the `H.map.provider.ImageTileProvider` / `H.map.layer.TileLayer` API and the tile-indexed binning math that turns ~19,500 points into a zoom-aware grid. Nothing about this dataset's size actually *requires* tiling — ~19,500 points render just fine as plain markers or an in-memory heatmap. A production version of this same mechanism would have the provider request pre-rendered tiles from a server instead of generating them in the browser, which is what makes tiling worthwhile at real scale.

Past zoom 14, clicking a rendered cell looks up the nearest bridge in the same tile index the overlay renders from (not a per-object hit test — the overlay is a raster tile layer, so there's nothing to attach a per-bridge listener to) and opens an `H.ui.InfoBubble` with its name, condition, and inspection details.

`scripts/fetch-bridge-data.ts` downloads and trims the source data; see that file for field provenance and the Indiana-only filter. It keeps each bridge's structure number and the road/feature it carries and crosses (for the click-to-inspect popup) alongside condition, rating, year built, last inspection, and traffic. The dataset is written as tuples rather than `{key: value}` objects — seemingly minor at the per-record level, but it roughly halves the file size at ~19,500 records with 10 fields each, since none of those 10 key names ever vary. `src/examples/tile-overlay/bridgeData.ts` decodes the tuples back into typed objects on load. Re-run the script manually with `node --experimental-strip-types scripts/fetch-bridge-data.ts` to refresh the dataset — it is not part of the build.

## Setup

**Requirements:** Node.js 22.6+ and a HERE API key with access to Maps, Geocoding & Search, and Routing APIs.

```sh
npm install
cp .env.example .env.local
```

On Windows, copy `.env.example` to `.env.local` manually or run `copy .env.example .env.local` in Command Prompt.

Edit `.env.local`:

```dotenv
VITE_HERE_API_KEY=your_here_api_key
```

Then run:

```sh
npm run dev
```

HERE's scoped npm registry is configured in `.npmrc` for the JavaScript SDK. See [HERE's Vite guide](https://docs.here.com/maps-api-for-js/docs/vite-bundling).

**Security:** `.env.local` is gitignored. `VITE_` variables are embedded in the browser bundle; a client-side HERE API key is **not secret**. Restrict your key to appropriate allowed origins/services and review your usage limits before publishing a live demo. Never commit unrestricted credentials.

## Code organization

- `src/examples/basic/` — basic map
- `src/examples/marker/` — marker popup and address search
- `src/examples/clustering/` — static restaurant sample data, transformation, and clustering
- `src/examples/directions/` — live routing, response transformation, and route rendering
- `src/examples/tile-overlay/` — committed Indiana bridge data, tile-indexed spatial lookup, and a canvas-rendered custom tile layer
- `src/shared/maps/` — shared HERE map lifecycle, layout, and marker utilities
- `scripts/fetch-bridge-data.ts` — one-off script that downloads and trims the NBI dataset; not part of the build
- `src/docs/examples.ts` — sidebar example descriptions and illustrative code excerpts
- `tests/` — pure transformation tests using inline test responses (not API caches)

Examples intentionally keep their SDK interactions visible to make them easier to learn from. Shared infrastructure is limited to repeatable map setup and marker styling.

## Validation

```sh
npm test
npm run lint
npm run build
```

These commands do not make live service calls. To verify real API functionality, run the app with your key and exercise each example in the browser.
