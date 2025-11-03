# Phase 3 – Figures package

This document describes the shared figure manifest module introduced in phase 3 of the refactor.

## Package location

The module lives at `packages/figures/src/index.js`. It exposes the measurement figure manifest together with helper utilities that were previously embedded in `figure-library/measurement.js` and `sortering.js`.

## Exports

### Measurement data

- `measurementFigureManifest` – immutable JSON manifest containing the built-in measurement figure catalog. Each category entry has the shape `{ id, label, figures }` where each figure specifies `id`, `name`, `fileName`, `dimensions`, optional `summary`, and `scaleLabel`.
- `encodeMeasureImagePath(fileName, options)` – prefixes and URI-encodes a measurement figure file name. Override the base path with `options.basePath` when needed.
- `extractRealWorldSize(helper, ...sources)` – delegates to an optional parsing helper and returns the first non-empty size extracted from the provided strings.
- `createFigureLibrary(options)` – transforms the manifest into render-friendly entries (adds computed summaries and `realWorldSize`). Accepts `extractRealWorldSizeFromText` in `options` for legacy real-world size parsing.
- `buildFigureData(options)` – builds lookup maps (`byId`, `byImage`) and appends the `CUSTOM_*` placeholder category used by the measurement app.
- `getFiguresGroupedByCategory(options)` – lightweight grouping helper for UI menus.
- `CUSTOM_CATEGORY_ID` and `CUSTOM_FIGURE_ID` – identifiers for the placeholder entry.

### Manifest loading and categorisation

- `fetchFigureManifest(url, options)` – shared loader for remote manifest files with caching and consistent error handling. Pass a custom `fetch` implementation via `options.fetch` when running in environments without a global `fetch`.
- `extractFigureLibrarySlugs(payload)` – normalises `slugs` or `files` arrays from remote manifest payloads.
- `buildFigureLibraryOptions(slugs, { categories, defaultCategoryId, locale })` – returns `{ optionsByCategory, optionsByValue }` maps, grouping slugged figures by category prefix and preparing them for selectors.
- `clearFigureManifestCache(cacheKey?)` – purge cached manifest responses (omit `cacheKey` to clear all entries).

## Legacy bridge

`figure-library/measurement.js` now re-exports the package API and exposes `measurementFigureManifest` on `globalThis.mathVisMeasurementFigures` for older integrations. Existing imports (`buildFigureData`, `createFigureLibrary`, etc.) continue to work.

## Adding or updating measurement figures

1. Update `measurementFigureManifest` in `packages/figures/src/index.js` by appending or editing entries in the relevant category. Provide the raw SVG file name, display name, and scale/dimension metadata.
2. When adding a new category, ensure the entry contains a unique `id`, human-readable `label`, and a `figures` array following the same structure.
3. If the measurement app requires custom parsing of real-world sizes, ensure the strings in `dimensions` or `summary` include the desired text – `extractRealWorldSize` checks these fields in order.
4. Run `npm run build:figures` to regenerate the static manifests. The script materialises the processed measurement catalog at `images/measure/manifest.json` and refreshes the amount slug list at `images/amounts/manifest.json`, keeping both Måling and Sortering in sync.
5. After updating the JSON, call `clearFigureManifestCache()` (exported from the figures package) without arguments to invalidate cached responses created by `fetchFigureManifest`. This ensures subsequent fetches read the freshly generated manifest.

## Using the helpers in other apps

```js
import {
  fetchFigureManifest,
  extractFigureLibrarySlugs,
  buildFigureLibraryOptions
} from '../packages/figures/src/index.js';

const manifest = await fetchFigureManifest(url, { fetch });
const slugs = extractFigureLibrarySlugs(manifest);
const { optionsByCategory } = buildFigureLibraryOptions(slugs, { categories, defaultCategoryId: categories[0].id });
```

These utilities replace the ad-hoc implementations previously scattered across apps, ensuring consistent categorisation logic and cache behaviour.
