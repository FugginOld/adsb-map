# Cross-Validation Notes

## Confirmed cross-module findings

### Dual wire format propagation (CONFIRMED)
- script.js: `Array.isArray(ac)` branch at processAircraft boundary
- planeObject.js: `updateData()` also handles both formats internally
- Confirmed: branching propagates through ~15 functions across both files

### g object origin (CONFIRMED)
- early.js declares `g = {}` at parse time
- script.js populates it (g.planes, g.planesOrdered, g.selected_icao)
- planeObject.js reads g for config values
- Consistent: g is the shared data bus, not a module system

### PlaneObject → OL coupling (CONFIRMED)
- planeObject.js creates ol.layer.Vector, ol.source.Vector, ol.Feature
- markers.js sets styles on those features
- script.js calls plane.updateFeatures() which delegates to both
- The coupling is three-way: planeObject, markers, script all touch OL features

### WebGL path abandonment (CONFIRMED)
- markers.js has `if (true || TrackedAircraftPositions < 200)` guard
- The WebGL feature code exists but is never reached
- script.js has `webglFeatures` variable but it's never written to after init

### jsonWorker disabled (CONFIRMED)
- jsonWorker.js is fully functional (15 lines, correct postMessage protocol)
- early.js sets `g.jWorkers = 0` 
- script.js checks `g.jWorkers > 0` before using worker
- Infrastructure complete, just switched off

## Notable design decisions (validated)

### Config layer design
- defaults.js declares ALL variables; config.js reassigns some
- This means config.js must be loaded AFTER defaults.js — load order is a hard dependency
- No bundler enforcing this, just script tag order in index.html
- Risk: reordering script tags silently breaks config

### Bootstrap sequence dependencies
- early.js must run before script.js (declares g)
- defaults.js must run before config.js (declaration order)
- layers.js must run before script.js (defines createBaseLayers)
- markers.js must run before script.js (defines getBaseMarker)
- All enforced by script tag order only

## Issues found

### geomag2020.js coefficients expired
- WMM-2020 model valid through 2025
- Current date: 2026 — coefficients are already past their validity window
- Magnetic declination display will be increasingly inaccurate

### wqi() placement
- Binary decoder function at bottom of formatter.js
- Belongs in dbloader.js
- Low risk to move

### tileTransition bug
- layers.js: `tileTransition: onMobile ? 0 : 0`
- Both branches are 0 — desktop fade-in is dead code
- Likely regression from a merge

### Promise.unwrapped() polyfill
- dbloader.js has a hand-rolled polyfill
- ES2024 has `Promise.withResolvers()` natively
- Replaceable once minimum browser target allows it
