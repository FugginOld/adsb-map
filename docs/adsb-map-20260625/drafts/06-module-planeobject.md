# Module Deep-Dive: `planeObject.js`

> **Bridge note:** `script.js` receives JSON payloads from the server on each poll cycle, parses the `aircraft` array, and calls `new PlaneObject(hex)` the first time it sees a given ICAO address, then calls `plane.updateData(now, last, ac, init)` on every subsequent poll. Everything from that point forward — state storage, track building, derived math, and map integration — lives in `planeObject.js`. Once a `PlaneObject` is fully updated, `markers.js` (via `updateTick`) handles the visual rendering of the aircraft icon on the OpenLayers map.

---

## 1. What Is a `PlaneObject`?

`PlaneObject` is the single central data model for one tracked aircraft. It is a vanilla JavaScript constructor function (not an ES6 class) with all methods attached to `PlaneObject.prototype`. Every aircraft seen by the receiver becomes one `PlaneObject` instance that persists in memory until it is reaped.

### Registration in global state

```js
function PlaneObject(icao) {
    icao = `${icao}`;
    g.planes[icao] = this;          // keyed lookup by hex string
    g.planesOrdered.push(this);     // ordered array for table/sort operations
    ...
}
```

The instance is simultaneously in two global stores: `g.planes` (a dictionary for O(1) lookup by ICAO hex) and `g.planesOrdered` (an array for iteration, sorting, and rendering the aircraft table).

---

## 2. Data Model — Fields and Why They Exist

Construction calls `this.setNull()` first, which defines every volatile field (data that can go missing between updates). Stable identity fields are set afterward in the constructor body.

### 2.1 Identity fields (stable, set once)

| Field | Type | Purpose |
|---|---|---|
| `icao` | `string` | 24-bit ICAO Mode S hex address (e.g. `"a1b2c3"`) |
| `numHex` | `number` | Parsed integer form of `icao` for fast range comparisons |
| `fakeHex` | `boolean` | `true` if address > 0xFFFFFF — identifies MLAT phantom or synthetic entries |
| `country` | `string` | Derived from ICAO block lookup |
| `country_code` | `string` | 2-letter ISO code from same lookup |
| `registration` | `string\|null` | Computed from ICAO hex via `registration_from_hexid()`; may be overridden by DB |
| `icaoType` | `string\|null` | ICAO aircraft type code (e.g. `"B738"`) |
| `typeDescription` | `string\|null` | Short human label (e.g. `"Boeing 737-800"`) |
| `typeLong` | `string\|null` | Long description from the DB |
| `wtc` | `string\|null` | Wake turbulence category |
| `military` | `boolean` | Set from ICAO military range table |
| `dbinfoLoaded` | `boolean` | Guards against double-loading from the aircraft DB |

### 2.2 Volatile flight data (reset by `setNull`)

| Field | Type | Purpose |
|---|---|---|
| `flight` | `string\|null` | Callsign / flight number (e.g. `"UAL123"`) |
| `flightTs` | `number` | Timestamp when `flight` was last set (for priority arbitration) |
| `name` | `string` | Display name; defaults to `'no callsign'` |
| `squawk` | `string\|null` | 4-digit octal transponder code |
| `category` | `string\|null` | ADS-B emitter category (e.g. `"A3"` — large, `"C3"` — ground vehicle) |
| `dataSource` | `string` | Source type: `"adsb"`, `"mlat"`, `"tisb"`, `"uat"`, `"adsc"`, `"modeS"`, `"ais"` |

### 2.3 Position and motion fields

| Field | Type | Purpose |
|---|---|---|
| `altitude` | `number\|"ground"\|null` | Working altitude (baro or geom depending on availability) |
| `alt_baro` | `number\|"ground"\|null` | Raw barometric altitude |
| `alt_geom` | `number\|null` | Geometric (GPS-based) altitude |
| `alt_rounded` | `number\|null` | Altitude rounded to nearest 25 ft for trail coloring |
| `altitudeTime` | `number` | Timestamp of last altitude update |
| `bad_alt` | `number\|null` | Last altitude value that failed the rate-of-change sanity check |
| `gs` | `number\|null` | Ground speed in knots |
| `track` | `number\|null` | True track angle (0–360) |
| `rotation` | `number\|null` | Display rotation: equals `track` or falls back to `calc_track` |
| `vert_rate` | `number\|null` | Vertical rate in ft/min |
| `baro_rate` / `geom_rate` | `number\|null` | Source-specific vertical rates |
| `position` | `[lon, lat]\|null` | Current position as WGS-84 `[longitude, latitude]` |
| `position_time` | `number` | Unix timestamp of current position fix |
| `prev_position` | `[lon, lat]\|null` | Previous position (for track segment drawing) |
| `prev_time` | `number` | Timestamp of previous position |
| `seen` | `number` | Seconds since any message received |
| `seen_pos` | `number` | Seconds since a position fix |
| `sitedist` | `number\|null` | Distance in metres from the receiver site |

### 2.4 ADS-B quality / integrity fields

`nic`, `rc`, `nic_baro`, `nac_p`, `nac_v`, `sil`, `sil_type`, `gva`, `sda` — these mirror the ADS-B integrity/accuracy fields from the Mode S message. They are stored but primarily surfaced in the info panel, not used in rendering logic.

### 2.5 Navigation intent fields

`nav_altitude_mcp`, `nav_altitude_fms`, `nav_heading`, `nav_qnh`, `nav_modes` — MCP/FMS clearance values broadcast by the aircraft. Used in the sidebar detail panel.

### 2.6 Messaging counters

`messages` (total message count), `msgs1090` / `msgs978` (per-frequency), `rssi` (signal strength), `messageRate` / `messageRateOld` (messages/second).

---

## 3. Construction and Initialization

```
new PlaneObject(hex)
  ├── g.planes[hex] = this          // register globally
  ├── g.planesOrdered.push(this)    // register for iteration
  ├── this.setNull()                // initialize all volatile fields to null/defaults
  ├── this.elastic_feature = null   // trail "rubber band" OL feature
  ├── this.track_linesegs = []      // track history array
  ├── this.history_size = 0
  ├── this.trace = []               // rolling 30-s position buffer
  ├── this.lastTraceTs = 0
  ├── this.routeString = null
  ├── [display state: visible, selected, marker, glMarker, scale, shape ...]
  ├── this.registration = registration_from_hexid(icao)  // derived immediately
  ├── this.checkForDB()             // async: requests metadata from db.js
  └── this.military = this.milRange()
```

`setNull()` is deliberately designed to be re-callable (it is not just for construction): it resets all volatile fields to safe defaults, making it possible to reset a plane between flight legs without destroying the object.

`checkForDB()` triggers an asynchronous fetch of the aircraft database (type, registration, operator). When the DB response arrives, it calls back into `this` to set `icaoType`, `typeLong`, `registration`, `ownOp`, `year`, and `wtc`, then triggers a redraw.

---

## 4. Update Lifecycle — How New Data Is Merged

### 4.1 Entry point: `updateData(now, last, data, init)`

Called by `script.js` on every poll cycle. The `data` argument can be either:
- A plain object (standard JSON response): `data.alt_baro`, `data.gs`, `data.lat`, ...
- A compact array (chunk-format history): `[hex, alt_baro, gs, track, lat, lon, seen_pos, type, flight, messages]`

The function reads the format via `Array.isArray(data)` and extracts fields from the appropriate shape. This dual-format support is a significant source of complexity.

### 4.2 Position data path: `updatePositionData(now, last, data, init)`

After extracting position-relevant fields, `updateData` delegates to `updatePositionData`. This function:

1. **Updates `sitedist`** (distance from receiver) via `ol.sphere.getDistance(SitePosition, this.position)`.  
   In "pTracks" (persistent-track) mode it keeps the _maximum_ distance ever seen.

2. **Calls `updateTrack(now, last)`** which appends the new position to the track history (see §5).

3. **Appends to `this.trace`** — a rolling buffer of the last ~80–100 position snapshots (timestamp, position, altitude, speed, track). This is used for the 30-second "recent path" feature.

### 4.3 Info data path

Non-position fields (flight, squawk, altitude, speed, data source) are merged with overwrite semantics: the incoming value replaces the stored value with no version check. The one exception is `flight` / callsign, which has timestamp arbitration via `flightTs` — a more recently timestamped callsign wins over an older one.

### 4.4 Altitude filtering

Altitude values pass through a rate-of-change sanity check before being accepted:
- If the new altitude implies a climb/descent rate > ~12,000 fpm compared to the stored value, it is placed in `bad_alt` and rejected.
- The plane must accumulate several consecutive "reliable" readings (`alt_reliable` counter) before aggressive filtering kicks in.
- Special cases: `"ground"` passes through unconditionally, and the first reading after a gap always passes.

### 4.5 Data-source labeling

After position extraction the method classifies `this.dataSource` based on flags in the message:
- `mlat`: multilateration fix
- `tisb`: TIS-B re-broadcast
- `uat`: UAT (978 MHz) ADS-B
- `adsc`: ADS-C (datalink)
- `ais`: AIS marine transponder
- `modeS`: raw Mode S without position
- `adsb`: standard ADS-B (default)

Source typing directly drives rendering decisions: color modifiers, stale timeouts, and label suppression.

---

## 5. Track History Design

The track is stored as `this.track_linesegs`: an array of **segment objects**, where each segment represents a geometrically connected portion of the flight path. A new segment is started whenever the track is interrupted (gap, crossing the 180° antimeridian, leg change, position filter rejection).

### 5.1 Segment structure

```js
{
    fixed: new ol.geom.LineString([...projectedPoints]),
    feature: null,          // ol.Feature (created lazily when drawn)
    label: null,            // ol.Feature for timestamp label
    estimated: boolean,     // true if points are interpolated
    estimatedFill: boolean, // dashed interpolation variant
    ground: boolean,        // whether aircraft was on ground
    altitude: number,       // rounded altitude for color
    alt_real: value,        // raw altitude for display
    alt_geom: number,
    position: [lon, lat],   // starting position of segment
    speed: number,
    ts: number,             // Unix timestamp
    track: number,          // heading at start
    leg: false|'start'|'end', // marks a flight leg boundary
    rId: value,             // route ID for grouping
    dataSource: string,
}
```

### 5.2 Segment lifecycle in `updateTrack(now, last)`

On each new valid position:

1. If `track_linesegs` is empty → create a brand-new first segment.
2. If a previous position exists, compute `distance` and `elapsed` between old and new position.
3. **Position filter** (if `positionFilter` enabled): derive a Mach speed from distance/time. If it exceeds the configured limit, the position is flagged as suspicious and rejected.
4. **Stale detection**: compute `time_difference = position_time - prev_time - 2`. If this exceeds `stale_timeout`, the gap is considered non-continuous:
   - Base timeout: **15 seconds** for ADS-B.
   - MLAT gets **15 seconds** (same, but comment notes it gets "more leeway").
   - On-ground gets **30 seconds**.
   - pTracks / ADS-C: **120 seconds** (or `jaeroTimeout`).
   - Replay mode: `2 * replay.ival + 1`.
   
   A stale gap triggers a new segment rather than extending the current one.
5. **Great-circle interpolation**: for long distances (> ~19,000 m), intermediate points are computed via `makeCircle()` to ensure the trail curves correctly on the map projection.
6. **Antimeridian crossing**: if the longitude sign flips across ±90°, `cross180()` is called, which splits the segment at the 180° meridian to avoid lines wrapping across the globe.
7. **Elastic feature** (`this.elastic_feature`): after all fixed segments, a "rubber band" `ol.Feature` with a `LineString` from the last fixed point to the current position is maintained. This is the "live" segment that moves each update cycle before being committed.

### 5.3 Memory management

`this.history_size` counts total points including interpolated ones. The antimeridian split adds 258 to the counter. A `trailReaper` timer (in `tempTrails` mode) periodically trims old segments from memory.

---

## 6. Stale / Missing Data Handling

### 6.1 Color-based staleness

`getMarkerColor()` applies a `ColorByAlt.stale` HSL shift when:
- `dataSource == 'adsc'` and `seen_pos > 20 * 60` (20 minutes)
- Otherwise if `seen_pos > 15` (15 seconds)

This gives a visual dim/desaturation that visually indicates the marker is not receiving fresh position data.

### 6.2 Track staleness

Track segments carry `estimated: true` when drawn through a gap. Estimated segments render as dashed lines (via `altitudeLines()` in the style cache), visually distinguishing interpolated from observed paths.

### 6.3 Plane reaping (`reaper()` in script.js)

`PlaneObject` itself has no self-destruct logic — the `reaper()` function in `script.js` is responsible for removing planes that have not been seen within `reapTimeout`. The process:
1. Build `g.historyKeep` — set of hex addresses seen in history within the timeout.
2. Walk `g.planesOrdered`; any plane not in `historyKeep` is removed from `g.planes` and `g.planesOrdered`.
3. The plane's `destroy()` method cleans up OL features.

### 6.4 `destroy()` cleanup

`PlaneObject.prototype.destroy` removes all OL features (marker, trail, labels), clears `this.tr` (the table row reference), and removes the instance from `g.planes` and `g.planesOrdered`.

---

## 7. Derived / Computed Values

### 7.1 Distance from receiver: `sitedist`

```js
this.sitedist = ol.sphere.getDistance(SitePosition, this.position);
```

Uses OpenLayers' WGS-84 great-circle distance. In pTracks mode this is the running maximum ("furthest ever seen"), used for the range ring display. `sitedist` is displayed in the aircraft table and used by the `filterMaxRange` plane filter.

### 7.2 Bearing

Bearing is not directly stored as a named property, but the aircraft's `track` field serves as the displayed heading. Bearing to/from the receiver (for info panel display) is computed in helper functions using standard atan2 trigonometry on WGS-84 coordinates.

### 7.3 Altitude category: `alt_rounded`

Altitude is rounded to the nearest 25 ft for color binning:

```js
this.alt_rounded = Math.round(altitude / 25) * 25;
```

This determines which color bucket from `ColorByAlt` is used for the trail segment and marker.

### 7.4 Marker color: `getMarkerColor()`

Produces `[h, s, l]` in HSL space. The pipeline:

1. Call `altitudeColor(alt)` — returns a base HSL from the altitude color gradient table.
2. Apply **stale offset**: `+= ColorByAlt.stale.{h,s,l}` if position is old.
3. Apply **ground offset**: `+= 15` to lightness for ground traffic.
4. Apply **selected offset**: `+= ColorByAlt.selected.{h,s,l}` for highlighted planes.
5. Apply **MLAT offset**: `+= ColorByAlt.mlat.{h,s,l}` for MLAT-sourced positions.
6. Override entirely with solid red for squawks 7700/7600/7500 (in ATC style mode).
7. Clamp all values to valid HSL ranges.
8. Optionally darken by 20%/30% (if `darkerColors` is enabled).

### 7.5 Marker icon selection and scale

`updateMarker()` calls `updateIcon()`, which:
- Selects the correct SVG shape (from `getShape()` — based on category, type description, ground status).
- Computes `this.scale` = `iconSize * this.baseScale`.
- Caches icons keyed by `fillColor + '!' + shape.name + '!' + strokeWidth`.
- Builds either a Canvas `ol.style.Icon` (non-WebGL path) or sets `glMarker` properties for the WebGL sprite renderer.

### 7.6 Derived speed (position filter)

When the position filter is active:
```js
let derivedMach = (distance / (position_time - prev_time + 0.4)) / 343;
```
This on-the-fly speed estimate is compared against `positionFilterSpeed` (configured in Mach) to reject implausible jumps.

### 7.7 Route and airline lookup

`this.routeString` — fetched asynchronously if `useRouteAPI` is enabled; set on the object and displayed in labels/info panel. `getAirline()` derives the airline from the callsign and registration via `lookupAirlineForCallsign()`, with a simple keyed cache (`airlineKey` + `airline`).

---

## 8. Coupling Points with `script.js` and `markers.js`

### 8.1 With `script.js`

| Coupling | Direction | Description |
|---|---|---|
| `g.planes[hex]` / `g.planesOrdered` | PlaneObject → script.js | Registration: `PlaneObject` writes itself into script.js's global state on construction |
| `new PlaneObject(hex)` | script.js → PlaneObject | Creation: script.js owns when to instantiate |
| `plane.updateData(now, last, ac, init)` | script.js → PlaneObject | Data flow: the main poll cycle calls this with raw server data |
| `plane.updateTick(redraw)` | script.js → PlaneObject | Render trigger: `everySecond()` and the render loop call this |
| `reaper()` | script.js → PlaneObject | Lifetime: script.js decides when to destroy and calls `plane.destroy()` |
| `plane.selected` | Bidirectional | Selection state used by both sides |

### 8.2 With the map layer system

`PlaneObject` creates and owns its OpenLayers objects directly:
- `this.marker` — `ol.Feature` for the aircraft icon (Canvas path)
- `this.glMarker` — `ol.Feature` for WebGL rendering path
- `this.trail_features` — `ol.source.Vector` for trail line segments
- `this.layer` — `ol.layer.Vector` attached directly to `trailGroup`
- `this.trail_labels` — `ol.source.Vector` for timestamp/altitude labels on trail
- `this.elastic_feature` — the "live" rubber-band segment from last-committed point to current position

This is a tight coupling: `PlaneObject` both stores flight data _and_ creates, manages, and destroys OL layers. `markers.js` (or the marker section of script.js) primarily handles the global `PlaneIconFeatures` source into which individual `this.marker` features are added/removed, but `PlaneObject.updateMarker()` does most of the per-aircraft visual update work itself.

### 8.3 With `markers.js`

`markers.js` is expected to:
- Provide `PlaneIconFeatures` (the global `ol.source.Vector` for all aircraft icons)
- Provide `webglFeatures` (the WebGL equivalent)
- Provide `trailGroup` (the OL layer group that per-aircraft trail layers are pushed into)
- Call `plane.updateTick(redraw)` in the animation frame / timer callback

`PlaneObject` calls back into `markers.js` via the global `PlaneIconFeatures.addFeature(this.marker)` / `.removeFeature()` pattern — a publish/subscribe-style coupling through a shared mutable object.

---

## 9. Modernization Opportunities

### 9.1 ES6 Class

The file is a direct candidate for `class PlaneObject { ... }` with `constructor()` replacing the function body. All `PlaneObject.prototype.foo = function()` methods become `foo() { ... }` class methods. This is a mechanical transformation with no behavioral change but dramatically improves readability and enables proper `super` if subclassing is ever needed.

### 9.2 TypeScript type definition

A TypeScript interface or class would make the data model explicit and self-documenting. Key types to capture:

```ts
type DataSource = "adsb" | "mlat" | "tisb" | "uat" | "adsc" | "ais" | "modeS";
type AltitudeValue = number | "ground" | null;

interface TrackSegment {
  fixed: ol.geom.LineString;
  feature: ol.Feature | null;
  estimated: boolean;
  ground: boolean;
  altitude: number | null;
  ts: number;
  dataSource: DataSource;
  // ...
}

class PlaneObject {
  readonly icao: string;
  readonly numHex: number;
  readonly fakeHex: boolean;
  flight: string | null;
  altitude: AltitudeValue;
  position: [number, number] | null;
  track_linesegs: TrackSegment[];
  // ...
}
```

### 9.3 Separation of concerns

The biggest modernization opportunity is decoupling the data model from the rendering layer. Currently `PlaneObject` is responsible for both "what data does this aircraft have" and "how does this aircraft appear on the map." A cleaner split:

- **`PlaneModel`**: pure data — ICAO, fields, track history, derived values. No OL imports.
- **`PlaneRenderer`** (or a marker/trail component): consumes a `PlaneModel` and owns all `ol.Feature`, `ol.layer.Vector` objects.

This separation would enable unit-testing `PlaneModel` in Node.js without a browser, and allow swapping the map backend (e.g., from OpenLayers to MapLibre GL) without touching aircraft data logic.

### 9.4 Dual-format input handling

The `isArray` branch in `updateData` is a vestigial history-chunk format. Normalizing the input to a single shape at the boundary (in the history-loading code in `script.js`) would eliminate the `isArray ? data[1] : data.alt_baro` pattern throughout and make the update method much cleaner.

### 9.5 History size management

`history_size` is a raw integer counter incremented manually with magic numbers (e.g., `+= 258` for antimeridian splits). This would benefit from a method that encapsulates the accounting, or from using `track_linesegs.reduce((acc, seg) => acc + seg.fixed.getCoordinates().length, 0)` directly.

---

## Coverage Table

| File | Lines | Sections read | Coverage |
|------|-------|---------------|---------|
| `planeObject.js` | 3,153 | 1–150 (constructor), 150–400 (fields/OL setup), 400–800 (update/track/color), 800–1200 (icon/marker), 1200–1600 (track history/trace), 1600–2200 (marker update/trail drawing), 2200–2600 (derived calculations), 2800–3153 (DB lookup/airline/end) | ~62% |
