# 0003 — No aircraft registry module around g.planes

- Status: accepted
- Date: 2026-06-27

## Context

An architecture review proposed wrapping `g.planes` (an object map keyed by hex)
and `g.planesOrdered` (an array) in a registry module with
`add`/`get`/`remove`/`ordered`/`forEach`, citing ~86 direct accesses across
`script.js` as evidence that "no module owns the lifecycle".

On inspection the lifecycle is already concentrated:

- add: one region in `processAircraft` (~`script.js:213`)
- remove: two sites (`script.js:2540`, `script.js:3337`)
- sort/rebuild: one site (`g.planesOrdered = temp`, `script.js:3357`)

The remaining ~80 accesses are reads and iteration (`g.planes[hex]` lookups,
`for (let i in g.planesOrdered)` loops in rendering, the table, and selection).

## Decision

Do not introduce an aircraft registry module. Leave `g.planes` /
`g.planesOrdered` as globals.

## Rationale

- No locality win: the lifecycle is already in ~4 sites; there is nothing
  scattered to concentrate.
- The 80+ remaining accesses are reads. A registry only improves them by
  rewriting every call site — large churn across a 9221-line file for marginal
  gain.
- No testability win: `script.js` is a plain `<script>` with no exports, so a
  registry would have to be another global (`g.registry`), not an importable,
  unit-testable module. Same architectural blocker as ADR 0002.
- Deletion test: a wrapper that touches only the 4 lifecycle sites is shallow —
  deleting it just inlines 4 lines back. A full registry passes the test but is
  not worth the churn. The shallow-wrapper shape is the same one already removed
  as `MapPlaneStore` and `MarkerPipeline`.

## Out of scope (noted, not acted on)

The `for (let i in g.planesOrdered)` idiom (`for...in` over an array) is a
robustness footgun — route any future *correctness* pass to it, not an
architecture pass.

## Revisit when

`script.js` is converted to ES modules. At that point a registry could be a real,
testable module and the reads could migrate behind it incrementally.
