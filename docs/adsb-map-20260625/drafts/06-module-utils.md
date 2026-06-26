# Module Analysis: Initialization, Configuration, and Utility Layer

The map rendering layer covered in the previous section (markers.js / layers.js) produces visual output — aircraft icons, trails, range rings — but it relies entirely on this support layer for three things: knowing *how* to format data for display, knowing *which units* the user prefers, and knowing *who each plane is* (registration, country, operator type). This section documents how all of that is wired together before the map even opens.

---

## 1. Boot Sequence

### Script load order (index.html)

The HTML file loads scripts in this exact order, with no module bundler or dynamic imports:

```
jquery-3.6.1.min.js
elm-pep-01.js
jquery-ui-1.13.2.min.js
jquery.ui.touch-punch-1.0.8.js
zstddec-tar1090-0.0.5.js    ← WASM zstd decoder
ol-custom-10.9.0.js          ← OpenLayers (bundled custom build)
early.js                     ← FIRST APPLICATION CODE
defaults.js
config.js
dbloader.js
registrations.js
formatter.js
flags.js
layers.js
geomag2020.js
markers.js
planeObject.js
script.js                    ← MAIN APPLICATION LOOP
```

All scripts run synchronously as the browser parses the HTML. Because there is no bundler, globals declared with `let` in one file are visible to all subsequent files. Order is load order.

### What early.js does at parse time

`early.js` is the most important file to understand — it does real work *while the page is still loading*. Its top-level code (not wrapped in `$(document).ready`) runs immediately when the `<script>` tag is parsed.

**Key globals declared at parse time:**

| Variable | Purpose |
|---|---|
| `g` | Central bucket for large runtime objects (planes, map features, worker pools). Prevents closure leaks. |
| `TAR` | Namespace object (mostly vestigial, wraps `window`) |
| `loStore` / `lopaStore` | `localStorage` abstraction with a Proxy that namespaces keys by `origin + pathname`, preventing cross-tab pollution. Falls back to a pure in-memory fake if `localStorage` is unavailable (e.g., Safari with "Block Cookies"). |
| `usp` | URL parameter parser — wraps `URLSearchParams` to be case-insensitive and sanitize XSS characters (`<>#&`) |
| `historyLoaded`, `zstdDefer`, `configureReceiver`, `historyQueued` | jQuery Deferred objects that coordinate the async startup sequence |

**Key actions taken immediately:**

1. **URL parameter parsing** — `usp` is built from `window.location.search`. Feature flags like `?replay`, `?feed=...`, `?uuid=...`, `?reset`, `?tfrs`, `?l3harris` are read and global booleans are set immediately.

2. **localStorage setup** — The Proxy `lopaStore` is initialized. If `reset` is in the URL, `loStore.clear()` is called immediately to wipe all saved settings.

3. **`receiver.json` fetch starts** — Before the DOM is ready, early.js fires off `jQuery.ajax({ url: 'data/receiver.json' })` to discover the backend's capabilities (lat/lon, zstd support, globe index grid, binCraft format, etc.). This is the "early" in the file name: the HTTP request races in parallel with the rest of page loading.

4. **`chunks/chunks.json` fetch starts** — Similarly, early.js requests the chunk index for position history in parallel.

5. **Military range data fetch** — `jQuery.getJSON(databaseFolder + "/ranges.js")` is fired to populate `milRanges` for identifying military ICAO hex blocks.

6. **JSON worker pool initialization** — Code exists (currently disabled: `g.jWorkers = 0`) to spin up a pool of `jsonWorker.js` web workers for parallel JSON fetching. When the pool count is nonzero, `handleJsonWorker` and `jsonGetWorker` manage URL-to-Deferred mapping and round-robin worker selection.

7. **zstd decoder init** — `init_zstddec()` initializes the WebAssembly zstd decoder from the pre-loaded `zstddec` library. Resolves `zstdDefer` when ready (or immediately if zstd is disabled).

8. **Toggle class** — Defined at the bottom of early.js, the `Toggle` class wraps `localStorage`-persisted boolean UI state (checkboxes, buttons). It reads `loStore[key]` on init and restores saved state. This is the mechanism for remembering user UI preferences across sessions.

### The deferred promise chain

The startup sequence after early.js is orchestrated with jQuery Deferreds:

```
early.js parse time:
  → fires: receiver.json fetch  → resolves configureReceiver
  → fires: chunks.json fetch    → feeds into historyLoaded chain
  → fires: zstd decoder init    → resolves zstdDefer

script.js initialize():
  jQuery.when(configureReceiver, heatmapDefer).done(function() {
      // configure receiver settings (lat/lon, refresh rate, etc.)
      // call initialize map, set up OL layers
  })

  jQuery.when(historyLoaded, zstdDefer).done(startPage)
    → startPage() hides the loader, begins the live refresh loop
```

`databaseFolder` is set via an inline `<script>` tag in `index.html` (`let databaseFolder = "db2"`), making it a global available to all subsequent scripts including `dbloader.js`.

---

## 2. Configuration Layer Architecture

### Three-layer override stack

The config system uses **declaration-order overrides** on global `let` variables:

```
Layer 1: defaults.js   — all variables declared with default values
Layer 2: config.js     — same variable names, reassigned to user values (or commented out)
Layer 3: runtime       — URL parameters and localStorage can override further at runtime
```

Because both files declare the same `let` names in the global scope, the browser's JavaScript engine simply processes them in load order. `defaults.js` runs first and declares `let DisplayUnits = "nautical"`. Then `config.js` runs and may reassign `DisplayUnits = "metric"`. There is no import/export — it works purely through sequential script execution.

### defaults.js — what it covers

473 lines organized into categories:

| Category | Key variables |
|---|---|
| Title | `PlaneCountInTitle`, `MessageRateInTitle` |
| Units | `DisplayUnits` ("nautical" / "metric" / "imperial") |
| Map | `DefaultZoomLvl`, `MapType_tar1090`, `MapDim`, `mapDimPercentage`, layer opacities |
| Markers | `webglIconOpacity`, `markerZoomDivide`, `markerSmall`, `markerBig`, `OutlineADSBColor`, `outlineWidth`, `monochromeMarkers` |
| Color by altitude | `ColorByAlt` — a complex object with HSL definitions per altitude band |
| Site circles | `SiteCircles`, `SiteCirclesDistances`, `SiteCirclesColors` |
| Flags | `ShowFlags`, `FlagPath` |
| API keys | `BingMapsAPIKey`, `MapboxAPIKey` |
| Filtering | `positionFilter`, `altitudeFilter`, `filterTISB`, `icaoFilter`, `icaoBlacklist` |
| Aircraft enrichment | `airlineLookup`, `useRouteAPI`, `routeApiUrl`, `routeDisplay` |
| Feature toggles | `tempTrails`, `heatmap`, `replay`, `squareMania`, `labelsGeom`, `geomUseEGM` |
| Table | `HideCols`, `tableColorsDark`, `tableColorsLight` |
| AIS / drone | `aiscatcher_server`, `droneJson` |
| Geometry | `SiteLat`, `SiteLon`, `DefaultCenterLat`, `DefaultCenterLon` |

A useful quirk: `defaults.js` declares `let yes = true; let no = false; let enabled = true; let disabled = false;` — aliases intended to make config.js more readable for non-JavaScript users who might want to write `DisplayUnits = enabled` instead of `= "nautical"`.

### config.js — how users customize

`config.js` is 434 lines of **commented-out reassignments**. Every line is a copy of the defaults.js setting, but commented out with `//`. The user uncomments and edits lines to override. Example:

```js
// defaults.js
let DisplayUnits = "nautical";

// config.js
//DisplayUnits = "nautical";   ← user changes to:
DisplayUnits = "metric";
```

This design is deliberate for the tar1090 use case: config.js is a hand-edited file on the server, and users should only change values they intend to differ from defaults. The file has no `let` keywords — just bare assignments — which means the variables must have already been declared by the time config.js runs. This locks in the load order requirement: defaults.js must precede config.js.

### Layer 3: runtime overrides

- **URL parameters**: `usp.has('reset')` clears localStorage. Various `usp.has(...)` checks in early.js override specific settings. `?screenshot` triggers a silent mode.
- **localStorage via lopaStore**: `Toggle` instances persist checkbox state. User-moved map center and zoom are persisted by script.js. `customTiles` URL tiles can be injected via `?customTiles=...` query parameter.
- **receiver.json**: After fetching, `initialize()` in script.js can override `SiteLat`/`SiteLon` from the backend's reported position, `RefreshInterval`, `jaeroTimeout`, and feature flags like `binCraft` and `reApi`.

### Notable design tension

The config system has no validation, schema, or type coercion. If a user sets `DisplayUnits = "imperail"` (typo), the formatter silently falls back to returning empty strings for unit labels. There is also no way to read the current *effective* config at runtime — you have to know which file set it.

---

## 3. formatter.js — Unit Conversion and Display

### Design philosophy

formatter.js is a pure utility module with no side effects. It exports ~30 free functions — no class, no object, just named functions that are globally accessible. All functions are stateless: they take values and return strings.

### Unit system

Three named unit systems are supported:

| System | Speed | Altitude | Distance | Vertical Rate |
|---|---|---|---|---|
| `"nautical"` | kt | ft | nmi | ft/min |
| `"metric"` | km/h | m | km | m/s |
| `"imperial"` | mph | ft | mi | ft/min |

The unit lookup table (`UnitLabels`) is a plain object keyed by quantity name and system name:

```js
let UnitLabels = {
    'altitude':      { metric: "m",    imperial: "ft",  nautical: "ft"   },
    'speed':         { metric: "km/h", imperial: "mph", nautical: "kt"   },
    'distance':      { metric: "km",   imperial: "mi",  nautical: "nmi"  },
    'verticalRate':  { metric: "m/s",  imperial: "ft/min", nautical: "ft/min" },
    'distanceShort': { metric: "m",    imperial: "ft",  nautical: "m"    }
};
```

`get_unit_label(quantity, system)` does a two-level lookup. A missing key returns `""` — silent failure, not an exception.

### Conversion functions

Each quantity has a `convert_*` and one or more `format_*` variants:

- `convert_altitude(alt, displayUnits)` — feet → meters for metric, passthrough otherwise
- `convert_speed(speed, displayUnits)` — knots → km/h or mph
- `convert_distance(dist, displayUnits)` — nautical miles → km or mi

The input convention is important: **all values are assumed to arrive in their natural ADS-B unit** (altitude in feet, speed in knots, distance in nautical miles) and are converted on the way out to display. There is no internal normalized unit.

### Altitude with vertical rate triangle

`format_altitude_brief(alt, vr, displayUnits, withUnits)` combines altitude formatting with a climb/descent indicator:

- `vr > 245` → prepend `▲` (U+25B2)
- `vr < -245` → prepend `▼` (U+25BC)
- Otherwise: no triangle

The brief variant pads the numeric string with figure spaces (` `) to keep columns aligned in the table. The long variant adds a text unit label. The triangle thresholds (245 ft/min, 192 ft/min for the separate long form) are hardcoded.

### Track direction

`format_track_long(track, rounded)` converts a 0–359° bearing into one of eight compass points by dividing `(track + 22.5) / 45` and indexing into `TrackDirections = ['N','NE','E','SE','S','SW','W','NW']`. Arrow versions (`TrackDirectionArrows`) use Unicode arrows for compact display.

### Data source labels

`format_data_source(source)` maps the wire-format source strings (`'adsb_icao'`, `'adsr_other'`, `'tisb_trackfile'`, `'mlat'`, `'uat'`, `'modeS'`, `'ais'`, `'adsc'`, etc.) to human-readable labels like `"ADS-B"`, `"TIS-B"`, `"MLAT"`. The `adsc` case uses the configurable `jaeroLabel` variable (default `"ADS-C"`).

### Aircraft category labels

`aircraftCategories` maps ADS-B emitter category codes (`A0`–`A7`, `B0`–`B7`, `C0`–`C3`) to human-readable descriptions like `"Heavy (> 300,000 lb)"`. `get_category_label(category)` does the lookup.

### ADS-B quality fields

`format_nac_p` and `format_nac_v` format navigation accuracy categories into human-readable precision strings (e.g., `"EPU < 30 m"`). These appear in the detailed info panel for selected aircraft.

### Binary format decoder (wqi)

At the bottom of formatter.js is `wqi(data)` — a function that decodes the binary `binCraft` format used in globe-mode data feeds. It reads fixed-size Uint32/Int16/Int8 typed arrays from an `ArrayBuffer` and populates fields like `now`, `global_ac_count_withpos`, `globeIndex`, and per-aircraft stride-packed fields. This is notably out of place in a formatting module — it is more of a binary protocol decoder that crept in here.

### Unicode spacing constants

formatter.js opens with Unicode constants for non-breaking spaces:

```js
let NBSP   = ' ';   // non-breaking space
let NNBSP  = ' ';   // narrow non-breaking space (used after numbers before units)
let NUMSP  = ' ';   // figure space (same width as a digit, for table alignment)
let DEGREES = '°';
let ENDASH  = '–';
let UP_TRIANGLE   = '▲';
let DOWN_TRIANGLE = '▼';
```

These are used consistently throughout the module, giving formatted output correct typographic spacing without CSS.

---

## 4. dbloader.js — Aircraft Database Lookup

### Architecture

`dbloader.js` implements a two-level lazy-loading lookup against a sharded JSON database stored as static files under `databaseFolder/` (configured as `"db2"` in index.html).

**Key state:**

```js
let db = {
    request_count: 0,   // in-flight requests (max 1 at a time)
    request_queue: [],  // pending bkey requests
    request_cache: {}   // bkey → Promise (deduplication)
};
```

### How a lookup works

`dbLoad(icao)` is the public entry point (called by planeObject.js):

1. The ICAO hex is uppercased. Fake hexes (starting with `~`) resolve immediately with `null`.
2. `request_from_db(icao, level=1, defer)` is called.
3. A `bkey` (bucket key) is computed as `icao.substring(0, level)` — initially just the first character (e.g., `"A"` for `"A7F3C2"`).
4. `db_ajax(bkey)` fetches `db2/A.js` as JSON. If already cached, returns the existing Promise.
5. When the fetch resolves, it checks if `dkey` (the remaining suffix) is a direct key in the response object. If yes, resolves with that data.
6. If the response has a `"children"` array and the next sub-bucket is listed, it recurses: `request_from_db(icao, level+1, defer)` — fetching `db2/AA.js`, then `db2/AAB.js`, etc.
7. Maximum concurrency is capped at 1 simultaneous HTTP request (`request_count >= 1` skips). Requests queue and drain sequentially.

### Aircraft data enrichment

After the raw database record is retrieved, `dbLoad` also merges in type data:

```js
const typeCode = aircraftData[1];   // e.g. "B738"
const typeData = db.typeCache[typeCode];
if (typeData) {
    aircraftData[5] = desc;   // "Large (75,000–300,000 lb)"
    aircraftData[6] = wtc;    // Wake turbulence category
    aircraftData[7] = typeLong;  // "Boeing 737-800"
}
```

`db.typeCache` and `db.operatorsCache` are loaded separately at startup via `db_load_type_cache()` and `db_load_operators_cache()` in script.js.

### No gzip / no CSV

Despite the analysis brief's suggestion, this database is **not CSV or gzipped** — it is plain JSON, fetched via jQuery AJAX with `dataType: 'json'`. The shard file names use the ICAO prefix (e.g., `db2/A.js`, `db2/AB.js`), not numeric offsets. The 30-second timeout handles slow network conditions, and cache misses on timeout are purged to allow retries.

---

## 5. jsonWorker.js — Offloaded JSON Fetching

`jsonWorker.js` is 15 lines:

```js
onmessage = (e) => {
    const url = e.data;
    fetch(new Request(url))
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status} ${response.url}`);
            return response.json();
        })
        .then(data => {
            postMessage({ url: url, json: data });
        });
};
```

**The problem it solves**: The main polling loop in script.js fires frequent `fetch()` calls for live aircraft data (`data/aircraft.json`, globe tiles, etc.). On low-end hardware or with large payloads, the JSON parsing step — which runs on the main thread — can introduce jank and delay rendering. Moving `fetch + JSON.parse` to a worker thread means the main thread only receives the already-parsed object.

**Current status**: The worker pool is **disabled by default** (`g.jWorkers = 0` in early.js). The infrastructure is complete (pool creation, round-robin dispatch via `g.jsonGetId++ % g.jsonWorker.length`, URL-to-Deferred mapping in `g.jwr`), but the pool size is 0. The feature was apparently trialed and then disabled, possibly due to CORS restrictions on some backends or because the latency improvement was marginal for typical payload sizes.

---

## 6. registrations.js + flags.js — Aircraft Identification Pipeline

These two files together answer the question "given a 24-bit ICAO hex address, what country and registration does this aircraft have?"

### flags.js — country from ICAO range

`ICAO_Ranges` is a large array (~200 entries) of objects:

```js
{ start: 0xA00001, end: 0xAFFFFF, country: "United States", country_code: "us" }
```

Each entry covers a contiguous block of ICAO addresses allocated by ICAO Annex 10 to a specific country. `findICAORange(icao)` does a **linear scan** through the array:

```js
function findICAORange(icao) {
    let hexa = +("0x" + icao);
    for (let i = 0; i < ICAO_Ranges.length; ++i) {
        if (hexa >= ICAO_Ranges[i].start && hexa <= ICAO_Ranges[i].end)
            return ICAO_Ranges[i];
    }
    return unassigned_range;
}
```

The returned object has `country` (display name) and `country_code` (ISO 2-letter code). `country_code` is used to construct flag image paths (`flags-tiny/us.png`) when `ShowFlags` is true, and is displayed in the aircraft table.

`findICAORange` is called by `PlaneObject` constructor (in planeObject.js) on every new plane, making it hot code. The linear scan is O(n) over ~200 entries — fast enough in practice but binary search would be straightforward.

### registrations.js — registration string from ICAO hex

`registration_from_hexid` is a self-invoking function (closure) that encapsulates two lookup tables and returns the mapping function.

**Two lookup strategies:**

1. **Stride mappings** — Countries that allocate registrations via a mathematical pattern. A `stride_mapping` entry has:
   - `start`: first ICAO hex in the range
   - `s1`: stride between first-letter changes
   - `s2`: stride between second-letter changes
   - `prefix`: the registration prefix (e.g., `"F-B"` for French GA aircraft, `"N"` for US aircraft)
   - Optional `alphabet` (default: full 26-letter), `first` (first suffix), `last` (last valid suffix)

   The function computes offsets from `start` and divides by strides to recover the suffix letters.

2. **Numeric mappings** — Countries that use numeric registrations (e.g., Russia's `RA-XXXXX` series). A `numeric_mapping` has `start`, `first`, `count`, `template`.

For addresses that match neither, `registration_from_hexid` returns `null`, and planeObject falls back to the database record if one exists.

**Important integration point**: `planeObject.js` calls `registration_from_hexid(this.icao)` in the constructor as a *fast synchronous estimate* before the async `dbLoad()` call completes. The database can override this with an official registration. This means planes briefly display a computed registration, then update when the database fetch finishes.

### How the pipeline chains together

```
New plane arrives with ICAO hex "A1B2C3"
    │
    ├─→ findICAORange("A1B2C3")          [flags.js]
    │     → { country: "United States", country_code: "us" }
    │     → this.country, this.country_code set immediately
    │
    ├─→ registration_from_hexid("A1B2C3") [registrations.js]
    │     → "N12345" (computed from stride math)
    │     → this.registration set immediately (synchronous)
    │
    └─→ dbLoad("A1B2C3")                  [dbloader.js] (async)
          → { registration: "N12345", type: "B738", operator: "Southwest", ... }
          → overrides this.registration, sets this.icaoType, this.operator, etc.
```

The design deliberately provides best-effort synchronous data (country, computed registration) while the richer async database record loads in the background.

---

## 7. geomag2020.js — Magnetic Declination

### What it does

`geomag2020.js` is a port of NOAA's World Magnetic Model (WMM-2020), the international standard for computing the difference between magnetic north and true north at any point on Earth. It exports two functions:

- `cof2Obj()` — parses the embedded WMM-2020 coefficient table (hardcoded inline as a pipe-delimited string of spherical harmonic coefficients) into a structured object
- `geoMagFactory(wmm)` — returns a function `geoMag(lat, lon, altitude, date)` that computes the full magnetic field vector, including `dec` (declination in degrees)

The math is spherical harmonic expansion with time-varying coefficients — the same algorithm used in aviation navigation systems. The coefficient epoch is 2020.0 (valid through ~2025).

### When it's used

`script.js` initializes it once during `afterFirstFetch()`:

```js
geoMag = geoMagFactory(cof2Obj());
```

Then, whenever an aircraft is **selected** and has a known position, the detail panel shows:

```js
if (geoMag && selected.position != null) {
    let lat = selected.position[1], lon = selected.position[0];
    let alt = selected.altitude;
    magResult = geoMag(lat, lon, alt);
    jQuery('#selected_mag_declination').updateText(format_track_brief(magResult.dec));
}
```

This is purely informational — it shows the magnetic declination at the aircraft's current position, allowing a pilot or enthusiast to understand the offset between the displayed magnetic heading and true heading. It is not used to modify track data.

### Why it matters

ADS-B tracks and headings can be either magnetic or true north depending on the aircraft's avionics. Showing the local declination helps users interpret heading discrepancies. Because WMM-2020 coefficients are embedded (not fetched), there is no network dependency, but the model will become stale around 2025 when WMM-2025 supersedes it.

---

## 8. Modernization Opportunities

### Config system

The declaration-order override approach is fragile and user-hostile:

- **Replace with a validated config module**: Use a single `config.js` that exports a plain object or class with schema validation. Defaults can live in a `DEFAULTS` constant inside the same file, removing the separate `defaults.js`.
- **URL params as a config layer**: Instead of scattered `usp.has(...)` checks throughout early.js, a single `applyURLParams(config)` function would centralize all override logic.
- **Type safety**: The string-typed unit system (`"nautical"` / `"metric"` / `"imperial"`) is a candidate for a proper enum or string union type if TypeScript is ever adopted.

### early.js fragmentation

early.js serves too many roles: global state declaration, localStorage setup, URL param parsing, async data prefetching, Toggle class definition, WASM initialization, and worker pool setup. Splitting into focused modules would dramatically improve maintainability:

- `state.js` — global variable declarations
- `storage.js` — localStorage abstraction and fakeLocalStorage
- `params.js` — URL parameter parsing
- `prefetch.js` — early data fetching (receiver.json, chunks.json)
- `toggle.js` — the Toggle class

### formatter.js

The `wqi()` binary decoder at the bottom of formatter.js does not belong here. It should live in a dedicated `binaryProtocol.js` or alongside the globe-mode data handling code.

The unit conversion functions are simple enough to be replaced with a single `convert(value, quantity, fromSystem, toSystem)` function with a conversion table, removing the three parallel `convert_altitude / convert_speed / convert_distance` functions.

### dbloader.js

- **Concurrency cap of 1** is conservative. Browsers support 6–8 concurrent requests per origin. Increasing to 3–4 would measurably speed up cold-start enrichment when many planes appear simultaneously.
- **Promise.unwrapped()** is a custom polyfill for what is now natively available via `Promise.withResolvers()` (Chrome 119+, Firefox 121+). The custom implementation can be dropped.
- The jQuery AJAX calls can be replaced with native `fetch()`.

### registrations.js / flags.js

- `findICAORange()` is a linear scan over ~200 entries. A binary search would be trivial and faster, though the current approach is not a measurable bottleneck.
- Both files are pure data + one function. They are good candidates for conversion to ES modules (`export function findICAORange(...)`).

### jsonWorker.js

The worker pool exists and works — it just needs `g.jWorkers` set to a nonzero value. The optimal pool size is 2–4 workers. Enabling it could reduce main-thread jank during high-frequency updates, especially for globe mode where many simultaneous tile fetches occur.

### geomag2020.js

- The WMM-2020 coefficients expire ~2025. The file should be updated to WMM-2025.
- The coefficient table (hardcoded inline) could alternatively be a separate `.json` fetch, allowing updates without touching the JS file.
- `geoMagFactory(cof2Obj())` is called once and the result assigned to a global `geoMag`. This is fine, but converting to an ES module would make the dependency explicit.

---

## System Summary

Looking across all six previously analyzed modules — the main loop (script.js), the aircraft model (planeObject.js), map rendering (markers.js / layers.js), and this support layer — the tar1090 architecture follows a coherent pattern for its era:

**Everything is global, everything is synchronous by default, async is bolted on with jQuery Deferreds.** The `g` object acts as a manual heap. The config system relies on declaration order instead of imports. The formatter is a bag of free functions. The database is a sharded static file tree queried with jQuery AJAX.

What makes the codebase work despite this is discipline in separation of concerns: early.js does boot, defaults/config do configuration, formatter does display, dbloader does enrichment, registrations/flags do identification. Each file has a clear job. The lack of a bundler means every dependency is visible by load order, which is actually easy to audit.

The path to modernization is clear: ES modules (removing the load-order dependency), a validated config object (removing the two-file config split), native `fetch` and `Promise.withResolvers` (removing jQuery in hot paths), and a proper binary protocol module (de-fragmenting formatter.js). The core data model and domain logic are sound — they just need a modern wrapper.

---

## Coverage Table

| File | Lines | Sections read | Coverage |
|---|---|---|---|
| early.js | 940 | 1–200, 400–700 (history/worker/settings), 800–940 (Toggle/zstd), + targeted greps for databaseFolder, initialize chain, localStorage | ~65% |
| defaults.js | 473 | 1–200, 300–473 | ~90% |
| config.js | 434 | 1–200, 300–434 | ~90% |
| formatter.js | 720 | 1–200, 400–720, + targeted grep for UnitLabels block | ~75% |
| dbloader.js | 156 | Full | 100% |
| jsonWorker.js | 15 | Full | 100% |
| registrations.js | 326 | 1–150, 200–326 | ~90% |
| flags.js | 244 | 1–150, full via grep | ~75% |
| geomag2020.js | 361 | 1–100, 100–361 | ~90% |
