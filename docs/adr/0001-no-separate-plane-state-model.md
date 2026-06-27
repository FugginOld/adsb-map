# 0001 — No separate plane-state model

- Status: accepted
- Date: 2026-06-27

## Context

`html/js/planeObject.js` (`PlaneObject`) is a ~64-field object that owns aircraft
telemetry, derived values (altitude, track history, rotation), and its
OpenLayers feature/rendering. An extracted `src/PlaneModel.js` held a 9-field
subset of that state, intended as the start of a deeper "aircraft state" module.

In practice the seam carried no traffic: `PlaneObject` kept its own copies of all
9 fields and pushed a one-way snapshot to `_model` at one call site
(`planeObject.js:1411`), never reading it back. `PlaneModel.isStale` /
`staleTimeout` were never called — the live staleness logic lives in
`planeObject.js` (`updateTrack` L500-512, plus L721/L2722/L2753). The model was a
write-only duplicate.

## Decision

Delete `PlaneModel` and the `_model` wiring. `PlaneObject` remains the single
owner of aircraft state. We did **not** deepen `PlaneModel` into an authoritative
state module.

## Rationale

A state model is only a real seam once `PlaneObject`'s state is decoupled from its
OpenLayers rendering. While the two are intertwined, a side state-model is a fake
seam: one writer, zero readers, and a second copy of every field to keep in sync.
The honest deepening (splitting state from rendering across ~64 fields and many
read sites) is large and not currently justified; the small extraction added
duplication without leverage.

## Consequences

- `src/PlaneModel.js` and its delegation tests are removed; `src/browser.js`
  exports only `normalizeAircraft`.
- Staleness duplication in `planeObject.js` is left as-is (load-bearing,
  entangled with datasource/replay logic) — see this decision before "consolidating".

## Revisit when

`PlaneObject` is split from OpenLayers (rendering moved behind an adapter). At that
point an authoritative aircraft-state module becomes a real seam worth extracting.
Until then, do not re-suggest extracting or deepening a `PlaneModel`.
