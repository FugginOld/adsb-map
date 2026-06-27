# 0002 — Marker style selection is already separated; don't extract it

- Status: accepted
- Date: 2026-06-27

## Context

An architecture review proposed extracting a deep, pure
`markerStyle(aircraft) → {shape, color, scale}` module, on the premise that
shape and color selection were tangled inside `PlaneObject.updateIcon` and
untestable without OpenLayers.

On inspection the premise was largely false:

- `getBaseMarker(...)` (`html/js/markers.js`) is already a pure function returning
  `[shapeName, scale]`, called once from `updateMarker` and cached by
  `baseMarkerKey`.
- `getMarkerColor(options)` (`html/js/planeObject.js:697`) is already its own
  value-returning method (`[h,s,l]`) and touches no OpenLayers.
- The only genuinely mixed code in `updateIcon` is the SVG build + `iconCache` +
  `ol.style.Icon/Style` assembly — the irreducible rendering adapter.

## Decision

Do not extract a `markerStyle` module or wrapper. Leave shape/color selection
where it is.

## Rationale

- Selection is already two OpenLayers-free functions; a `markerStyle()` wrapper
  would be a one-caller indirection (yagni).
- The remaining tangle in `updateIcon` is the rendering adapter and must touch OL.
- The only real win — unit tests for the selection logic — is not cheaply
  reachable: `markers.js` and `planeObject.js` are plain `<script>` files with no
  exports, so the functions aren't importable by vitest. Realizing the test win
  would mean either converting those files to ES modules (large ripple through the
  globals-based architecture) or reimplementing the logic in a separate module —
  the parallel-copy trap that the removed `MarkerPipeline` already demonstrated.

## Revisit when

`markers.js` / `planeObject.js` are converted to ES modules for other reasons. At
that point `getBaseMarker` and `getMarkerColor` become importable and can be unit
tested in place — no extraction needed, just tests.
