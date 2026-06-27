# Ponytail Audit — adsb-map

Repo-wide over-engineering audit. Scope: complexity and dead code only.
Correctness, security, and performance are explicitly out of scope.
One-shot report — nothing applied.

## Core finding

`src/` is a **half-wired parallel architecture**. Only `PlaneModel` and
`normalizeAircraft` are consumed by the running app
(`html/js/planeObject.js:21`, `html/js/script.js:188`). The other four modules
are built test-first but **never imported by any app code** — grep for them
across `script.js` / `planeObject.js` / `markers.js` returns nothing. They are
speculative.

## Findings (biggest cut first)

| Tag | What to cut | Replacement | Path |
|-----|-------------|-------------|------|
| `delete:` | Saved "Architecture Review" web page + `_files` asset dump (3.6MB — mermaid.min.js, saved_resource). A browser Save-As committed to git; nothing references it. | nothing | `adsb-map — Architecture Review.html`, `adsb-map — Architecture Review_files/` |
| `delete:` | `PlaneRenderer` + its `window`/`olCreatePoint` wiring + 139-line test. Bundled into `adsb-bundle.js` and shipped to every browser, but no app code reads `window.PlaneRenderer`. | nothing | `src/PlaneRenderer.js`, `src/browser.js`, `src/__tests__/PlaneRenderer.test.js` |
| `delete:` | `AircraftUpdatePipeline` + 85-line test. Never imported, never bundled. | nothing | `src/AircraftUpdatePipeline.js`, `src/__tests__/AircraftUpdatePipeline.test.js` |
| `delete:` | `MarkerPipeline` + 45-line test. Unused parallel reimplementation of shape/color logic `markers.js` (1494 lines) already ships. | `markers.js` | `src/MarkerPipeline.js`, `src/__tests__/MarkerPipeline.test.js` |
| `delete:` | `StalenessOracle` + 53-line test. Unused. Its timeouts are a third copy of staleness logic already in `PlaneModel.staleTimeout` and `planeObject.js`. | existing `PlaneModel` logic | `src/StalenessOracle.js`, `src/__tests__/StalenessOracle.test.js` |
| `yagni:` | `MapPlaneStore` — class wrapping a `Map` with `get`/`set` that only delegate. | use `Map` directly | `src/AircraftUpdatePipeline.js` (dies with file above) |
| `shrink:` | `browser.js` drops to 2 exports once `PlaneRenderer`/`olCreatePoint` go. | keep only `normalizeAircraft` + `PlaneModel` | `src/browser.js` |

## Lower-confidence — glance before cutting

- `PlaneModel.isStale` / `staleTimeout` may also be dead — `planeObject.js`
  delegates only `setNull` / `updateData` to `_model`, not staleness. If so,
  that's a 4th copy of the timeout logic. Verify the caller first.
- `docs/adsb-map-20260625/drafts/` (148K of analysis-report drafts) — cruft if
  the report is final, but docs are plausibly intentional. Not auto-delete.

## Net

**-462 lines** (140 src + 322 test), plus **~3.6MB** committed artifact, **-0 deps**.

`vite` / `vitest` stay — still needed to bundle the surviving `PlaneModel` /
`normalizeAircraft`.
