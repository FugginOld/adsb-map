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
| `delete:` | `PlaneRenderer` + 139-line test. Bundled into `adsb-bundle.js` and shipped to every browser, but no app code reads `window.PlaneRenderer`. | nothing | `src/PlaneRenderer.js`, `src/__tests__/PlaneRenderer.test.js` |
| `delete:` | `AircraftUpdatePipeline` + 85-line test. Never imported, never bundled. | nothing | `src/AircraftUpdatePipeline.js`, `src/__tests__/AircraftUpdatePipeline.test.js` |
| `delete:` | `MarkerPipeline` + 45-line test. Unused parallel reimplementation of shape/color logic `markers.js` (1494 lines) already ships. | `markers.js` | `src/MarkerPipeline.js`, `src/__tests__/MarkerPipeline.test.js` |
| `delete:` | `StalenessOracle` + 53-line test. Unused. Its timeouts are a third copy of staleness logic already in `PlaneModel.staleTimeout` and `planeObject.js`. | existing `PlaneModel` logic | `src/StalenessOracle.js`, `src/__tests__/StalenessOracle.test.js` |
| `yagni:` | `MapPlaneStore` — class wrapping a `Map` with `get`/`set` that only delegate. | use `Map` directly | `src/AircraftUpdatePipeline.js` (dies with file above) |
| `shrink:` | `browser.js` drops to 2 exports once `PlaneRenderer`/`olCreatePoint` go. **Do not delete — it is the vite build entry (`vite.config.js`); trim it, don't remove it.** | keep only `normalizeAircraft` + `PlaneModel` | `src/browser.js` |

## Lower-confidence — glance before cutting

- `PlaneModel.isStale` / `staleTimeout` may also be dead — `planeObject.js`
  delegates only `setNull` / `updateData` to `_model`, not staleness. If so,
  that's a 4th copy of the timeout logic. Verify the caller first.
- `docs/adsb-map-20260625/drafts/` (148K of analysis-report drafts) — cruft if
  the report is final, but docs are plausibly intentional. Not auto-delete.

## Execution notes (verified against code)

Safe to execute — won't break the running app. Two things to get right:

1. **Keep `src/browser.js`** — it is the vite build entry (`vite.config.js`).
   Trim the `PlaneRenderer` import + the `window.PlaneRenderer` / `olCreatePoint`
   lines; leave the file. Deleting it breaks `npm run build`.
2. **Rebuild after trimming.** The shipped `html/js/adsb-bundle.js` is committed
   and still contains `PlaneRenderer`/`olCreatePoint`. Deleting `src/` files does
   not regenerate it — the live app keeps working off the stale bundle (the extra
   `window.PlaneRenderer` is harmless dead weight). Run `npm run build` to drop
   them from what ships. Skipping the rebuild won't break anything, just won't shrink.

Dependency graph confirms a clean cut: survivors `PlaneModel.js` /
`normalizeAircraft.js` import nothing; only `AircraftUpdatePipeline` cross-imports
`StalenessOracle`, and both die together. Deleted tests only reference deleted
modules — `vitest` stays green.

`PlaneModel.isStale` / `staleTimeout` are unused by the app but live inside a
surviving module — out of scope, leave them.

## Net

**-462 lines** (140 src + 322 test), plus **~3.6MB** committed artifact, **-0 deps**.

`vite` / `vitest` stay — still needed to bundle the surviving `PlaneModel` /
`normalizeAircraft`.
