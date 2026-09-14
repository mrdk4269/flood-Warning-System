# FloodGuard Application Audit Report

**Audit date:** 2026-09-14  
**Scope:** Read-only source, configuration, dataset, API-contract, and static UI/CSS review of the complete repository. No application code, database, or data file was changed. JavaScript syntax validation (`node --check`) passed for all five external JS files. The supplied automated suite was deliberately not run: it creates/deletes flood areas and invokes telemetry mutation endpoints, which would violate the requested read-only audit.

## 1. Application Overview

FloodGuard is a Flask + SQLite prototype with static HTML/JS/CSS pages and a Leaflet/OpenStreetMap map. It exposes CRUD endpoints for flood areas, alerts, rivers, shelters, and hospitals; rule-based risk calculation; a small scikit-learn prediction feature; static GeoJSON layers; and an India-wide map interface.

The project has two separate data paths:

- The original local/Kerala-oriented system stores records in SQLite and GeoJSON files.
- The nationwide system fetches Open-Meteo weather and global-flood discharge at configured station coordinates, converts discharge to an estimated water stage, assigns a rule-based risk, and writes telemetry cache rows.

The application is a prototype/decision-support UI, not a verified operational flood-warning system. The source itself contains pre-existing uncommitted modifications in `backend/flood_areas_data.py`, `backend/live_india_service.py`, and `frontend/js/map.js`; they were preserved and not assessed as audit-created changes.

## 2. Critical Issues

### FG-001 — Public, unauthenticated administration and destructive APIs

- **Priority:** CRITICAL
- **Location/File:** `frontend/admin.html`; `backend/app.py:199-528, 917-940`; `backend/database.py:165-171`
- **Description:** The Admin/GIS page is routed publicly and all operational CRUD endpoints lack authentication/authorization checks. The login endpoint returns only user data; it does not issue or validate a session, cookie, token, or role on subsequent requests. Default administrator credentials are seeded in source.
- **Current behavior:** Any browser/client can open `/admin` and POST, PUT, or DELETE flood areas and alerts, update river levels, and invoke live-sync/simulation endpoints.
- **Expected behavior:** Administrative mutation actions must require a protected authenticated session and an administrator role; seeded credentials must not be public or production defaults.
- **Possible cause:** Authentication was implemented as an isolated endpoint and never connected to route protection.
- **Recommended fix:** Add server-side authentication/authorization middleware, secure password hashing, CSRF protection for browser mutations, rate limiting, and deployment-provisioned credentials. Restrict CORS.

### FG-002 — Flood-effect polygons are primarily static reference shapes but displayed as verified/live

- **Priority:** CRITICAL
- **Location/File:** `backend/flood_areas_data.py:60-739, 741-901`; `frontend/js/map.js:2080-2083`
- **Description:** Flood-impact events and their polygons are hard-coded. On every request their timestamps are recalculated relative to the current time (`days_ago`), making old static scenarios appear current. Popup text labels every non-estimated polygon “Verified,” even when it originated in the static list.
- **Current behavior:** Today/7/30-day buttons return differently filtered static scenarios whose dates move forward on every request. Static shapes may receive current station values but their boundaries, affected area, location, and baseline severity do not originate from live inundation observations.
- **Expected behavior:** A live flood map must distinguish observed, modelled/estimated, historical, and unavailable data, and must preserve real source observation times.
- **Possible cause:** Demo data was repurposed as a live flood-effect feed without provenance enforcement.
- **Recommended fix:** Store immutable observation timestamps and explicit provenance per feature. Render static data as DEMO/HISTORICAL; only call a feature verified when it has a traceable official/remote-sensing source and acquisition timestamp.

### FG-003 — No real inundation modelling or observed flood-extent ingestion

- **Priority:** CRITICAL
- **Location/File:** `backend/flood_areas_data.py:10-50, 839-899`; `frontend/js/map.js:1916-1988`
- **Description:** “Dynamic” flood polygons are 16-point, fixed-orientation geometric buffers around a gauge. They use a constant 45-degree orientation, preset radius (3.2/4.8 km), sinusoidal edge variance, and a formulaic affected area. No DEM, river network geometry, floodplain, hydraulic model, SAR classification, drainage model, or official flood-extent service is used.
- **Current behavior:** A warning may create an attractive polygon near a station, but it is an estimated shape rather than a mapped flood extent. The client also independently generates similar buffers, producing two separate modelling paths.
- **Expected behavior:** Flood extent should be derived from calibrated hydrologic/hydraulic or validated remote-sensing processes and clearly qualified while estimated.
- **Possible cause:** Visualization-first implementation without spatial flood-model inputs.
- **Recommended fix:** Integrate authoritative gauges/forecasts and a documented modelling pipeline; use DEM/floodplain/river-reach constraints or ingest validated satellite/agency extents. Keep estimated buffers visually distinct and never use them for operational evacuation guidance without validation.

## 3. Bugs and Not Working Functions

### FG-004 — State-boundary click interaction does not identify the state

- **Priority:** HIGH
- **Location/File:** `backend/india_geo_data.py:get_india_states_geojson`; `frontend/js/map.js:736-748`
- **Description:** State GeoJSON publishes `properties.state_name`, while the map reads `feature.properties?.name`.
- **Current behavior:** State tooltips show “State”; clicking a boundary sets the selector to “State” and cannot match `allStatesMeta`, so no valid state focus/filter is applied.
- **Expected behavior:** Each boundary click should select and zoom to its actual state.
- **Possible cause:** Frontend/backend property-name mismatch.
- **Recommended fix:** Use the published `state_name` field consistently and test selection from both selector and polygon click.

### FG-005 — “Live” refresh can report success despite unavailable external data

- **Priority:** HIGH
- **Location/File:** `backend/live_india_service.py:666-678, 953-1031`; `backend/app.py:896-911`
- **Description:** Network errors are swallowed; `fetch_station_telemetry` emits fallback/default values and the refresh route always returns `status: success` with “refreshed from external APIs.” Database exceptions are also swallowed.
- **Current behavior:** A user can be told that live telemetry refreshed even if all external requests failed or cache persistence failed.
- **Expected behavior:** The response and UI should report partial/unavailable status, source availability, data age, and no-data cases accurately.
- **Possible cause:** Broad exception handling and a fixed successful API envelope.
- **Recommended fix:** Return per-source success/error counts, HTTP partial-failure status where appropriate, last successful observation time, and surface failures in the UI.

### FG-006 — Flood source attribution overstates what is actually connected

- **Priority:** HIGH
- **Location/File:** `backend/live_india_service.py:891, 1098-1110`; `backend/flood_areas_data.py:79-721, 835, 889`; `frontend/js/map.js:2083`
- **Description:** Strings name CWC, IMD, ISRO, NASA, NDMA, and state agencies, but the implementation shown only requests Open-Meteo endpoints. The Bhuvan/NASA entries are map tile overlays, not ingested flood observations; no CWC/IMD/NDMA/ISRO data adapter is present.
- **Current behavior:** Map popups and status labels imply agency-verified data that the code cannot substantiate.
- **Expected behavior:** Attribution must name only data actually acquired for that feature and disclose transformations.
- **Possible cause:** Placeholder/provenance text was retained after prototype expansion.
- **Recommended fix:** Implement source adapters and provenance metadata, or rename all unsupported attributions to “reference/demo” and display the actual Open-Meteo origin.

### FG-007 — Forecast and historical “areas” are not areas

- **Priority:** MEDIUM
- **Location/File:** `backend/app.py:771-797`; `backend/india_geo_data.py:get_forecast_risk_geojson`; `frontend/js/map.js:900-974`
- **Description:** Historical floods are served as Points despite the “flood footprint/area” terminology. Forecast zones are fixed square bounding boxes (`d = 0.35`) around hard-coded centres, not a forecast inundation footprint.
- **Current behavior:** Users may interpret points/squares as real affected extents.
- **Expected behavior:** Labels and geometry must make point events, alert zones, and validated inundation boundaries unmistakably different.
- **Possible cause:** Simplified placeholder geometry.
- **Recommended fix:** Rename to “event locations” and “forecast alert zones” unless real extents are integrated.

### FG-008 — Global state/district filtering is inconsistent across layers

- **Priority:** MEDIUM
- **Location/File:** `frontend/js/map.js:690-721, 1013-1081, 2256-2335`
- **Description:** State/district changes rerender live markers and flood-effect polygons, but static major rivers, shelters, hospitals, risk zones, historical events, and forecast zones are initially loaded nationally and are not consistently refetched/re-filtered. Active-alert counting matches alert-location text against state names, although local alerts do not reliably include a state.
- **Current behavior:** The map can be zoomed to a selected state while unrelated national layers/summary values remain visible or counts become zero incorrectly.
- **Expected behavior:** Every displayed layer and KPI should have an explicit filter contract and show its applied scope.
- **Possible cause:** Filtering was added only to newer live/flood-effect render paths.
- **Recommended fix:** Centralize filter state and apply it to every renderer/API request; use structured state/district fields for alerts rather than string matching.

### FG-009 — Client-side location search is not a geographic/geocoding search

- **Priority:** MEDIUM
- **Location/File:** `frontend/js/map.js:1420-1644`
- **Description:** Search suggestions are built from cached application datasets, not OpenStreetMap/Nominatim or another geocoder.
- **Current behavior:** Many cities, districts, addresses, and river locations cannot be found despite the placeholder promising “Search City, District, River, Shelter.”
- **Expected behavior:** Either search all advertised geographies or limit the placeholder/help text to loaded FloodGuard records.
- **Possible cause:** UI wording exceeds the local index.
- **Recommended fix:** Add a rate-limited compliant geocoder with accessible no-result states, or accurately scope the control.

### FG-010 — Untrusted API values are interpolated into HTML

- **Priority:** HIGH
- **Location/File:** `frontend/admin.html:399-520`; `frontend/js/alerts.js:73-123`; `frontend/js/main.js:36-40`; `frontend/js/map.js` popup/search templates
- **Description:** Database/API-provided text is inserted with `innerHTML` and inline `onclick` attributes without escaping. Admin endpoints accept free-text fields.
- **Current behavior:** A malicious or malformed created record can inject markup/script into admin, alert, ticker, search, and map popup contexts.
- **Expected behavior:** Dynamic text must be safely encoded; event handlers must not be constructed from data.
- **Possible cause:** Template strings were used for convenience.
- **Recommended fix:** Use `textContent`/DOM nodes or a vetted sanitizer, pass data by event listeners/dataset with validation, and add a Content-Security-Policy.

## 4. Live Flood System Audit

### Current workflow (verified from source)

`Station registry (hard-coded coordinates/thresholds)`  
→ `Open-Meteo forecast endpoint + Open-Meteo Global Flood daily discharge endpoint`  
→ `calculated water level = station base level + discharge power curve; rainfall = current/daily Open-Meteo values`  
→ `rule-based score from rainfall, water level, elevation, river distance and static thresholds`  
→ `hard-coded flood-effect polygon list, optionally enriched with matching current station values; optional 16-point buffer around high/warning station`  
→ `Flask GeoJSON endpoint`  
→ `Leaflet layer/popup render; a 120-second in-memory cache and client countdown refresh`.

**Missing from the workflow:** real CWC/IMD/NDMA/ISRO ingestion, verified station-to-district coverage, terrain/floodplain data, rain-runoff routing, calibration, validation, observed flood extent, a real-time event store, background job/scheduler, websocket/SSE push, deduplication/expiry of alerts, and quality control.

**Flood area generated correctly?** Geometrically valid-looking, but not scientifically generated as a real flood extent. The static polygons and calculated buffers are unsuitable to claim ground-truth inundation.

**Flood effect visible/updated?** Code renders it into Leaflet and clears/reloads it on time/filter actions. The underlying static shapes do not update from live data; only selected attributes/severity can be overwritten and dynamic buffers occur only after cache population and threshold conditions.

**Real-time/live?** Open-Meteo is the only verified live fetch. Results are transformed estimates and may fall back to non-live/default values. The UI has no trustworthy source/age/error display.

**Today / 7 days / 30 days:** Buttons do request the period and replace the visible layer. They work as filters over `days_ago` demo/reference events whose timestamps are regenerated at request time, not as a true historical time-series. The “today” selected button does nothing when clicked initially due to an early return, which is harmless but prevents a manual reload.

**Core layers:** Flood Areas, Flood Risk, Rivers, and Safe Shelters have Leaflet layer-toggle wiring. Flood Area data is mixed provenance; Risk/Shelter local GeoJSON is static; Rivers are simplified static polylines. Layer visibility itself is wired, but data accuracy/selected-area correctness is not assured.

## 5. Real-Time Flood Area Generation Analysis

### FG-011 — Duplicate, uncalibrated flood-buffer generators

- **Priority:** HIGH
- **Location/File:** `backend/flood_areas_data.py:10-50, 865-894`; `frontend/js/map.js:1916-1988`
- **Description:** Backend and frontend both generate estimated polygons with different constants and logic.
- **Current behavior:** Depending on timing and data, a server-generated and/or browser-generated estimate can appear. Neither has calibration, a shared version, or a reproducible audit record.
- **Expected behavior:** One server-owned, documented modelling pipeline should generate an immutable event geometry/version.
- **Possible cause:** Progressive feature additions duplicated responsibility.
- **Recommended fix:** Remove the browser modelling path after a server model is established; preserve model version, inputs, confidence, geometry creation time, and expiry.

### FG-012 — Time filters use moving synthetic timestamps

- **Priority:** HIGH
- **Location/File:** `backend/flood_areas_data.py:741-752, 771-790`
- **Description:** `_compute_timestamps()` overwrites every event date/time relative to `datetime.utcnow()` on every call.
- **Current behavior:** The data never ages; fixed events continuously migrate between Today/7/30-day filters.
- **Expected behavior:** Observation timestamps must be immutable source facts; simulated data must say it is simulation data.
- **Possible cause:** Demo timeline implementation.
- **Recommended fix:** Persist actual event timestamps; use a separately named demo clock only in a test environment.

## 6. Map and Leaflet.js Issues

### FG-013 — Map UI overlays compete for the same top viewport space

- **Priority:** MEDIUM
- **Location/File:** `frontend/css/style.css:2184-2209, 2498-2516`; `frontend/map.html:90-315`
- **Description:** Layers button/panel is top-left, timeline is top-centre, and India-status button/drawer is top-right. On narrow desktop/tablet widths their absolute positioning can overlap; the drawer uses `z-index:1000`, panels/timeline use 500–1000.
- **Current behavior:** Controls can block each other and the map, especially with the 320px panel or 390px drawer open.
- **Expected behavior:** Controls should reflow, stack, or have a single panel manager with collision-safe breakpoints.
- **Possible cause:** Individually designed absolute overlays.
- **Recommended fix:** Add tested tablet breakpoints, a unified control rail, and reduced/condensed labels.

### FG-014 — Mobile map controls can obscure navigation and map interaction

- **Priority:** MEDIUM
- **Location/File:** `frontend/css/responsive.css:86-99, 196-207`; `frontend/css/style.css:2765-2812`
- **Description:** The mobile control panel can occupy nearly the full viewport while the timeline, risk legend, status button, Leaflet controls, and a fixed mobile bottom nav remain active. The map page disables body scrolling.
- **Current behavior:** Content can be visually crowded/blocked and users must close panels to regain map interaction; no evidence of touch/keyboard focus trapping or safe-area handling.
- **Expected behavior:** One active mobile sheet/control surface at a time, with predictable close/back behavior and safe-area spacing.
- **Possible cause:** Desktop overlays were compressed for mobile instead of redesigned.
- **Recommended fix:** Make controls a bottom sheet, hide nonessential overlays while open, and test 320–430px widths plus landscape.

### FG-015 — “District Boundaries” layer has no data/rendering implementation

- **Priority:** MEDIUM
- **Location/File:** `frontend/map.html:194-197`; `frontend/js/map.js:381, 1266-1298`
- **Description:** A checkbox is exposed and wired to an empty `districtsLayer`, but no endpoint or renderer fills it.
- **Current behavior:** Toggling District Boundaries produces no visible layer.
- **Expected behavior:** The option should render district boundaries or not be offered.
- **Possible cause:** Incomplete advanced-layer feature.
- **Recommended fix:** Add authoritative boundary data and renderer, or mark/remove the unavailable option after product review.

## 7. UI/UX Issues

### FG-016 — Public portal exposes complex, unsupported operational claims

- **Priority:** HIGH
- **Location/File:** `frontend/map.html`; `frontend/js/main.js`; `frontend/js/map.js`
- **Description:** The UI uses “Live,” “Verified,” agency labels, real-time dashboards, “safe path,” satellite remote sensing, and administration language that exceeds the demonstrated data quality and route capability.
- **Current behavior:** A citizen can mistake a decision-support prototype for official, verified emergency guidance.
- **Expected behavior:** Prominent capability, confidence, data-age, and official-source disclaimers near decisions, not just a README disclaimer.
- **Possible cause:** Presentation design outpaced operational integration.
- **Recommended fix:** Keep: map, alerts, nearest safe locations, simple risk explanation. Improve: provenance/age/status. Move: advanced GIS/technical layers behind an authenticated specialist workspace. Remove or relabel: unsupported verified/official claims and “safe route” wording.

### FG-017 — Route tools draw straight-line approximations, not safe evacuation routes

- **Priority:** HIGH
- **Location/File:** `frontend/js/map.js:1757-1807`; `frontend/safe-locations.html:468-539`
- **Description:** The visible routing feature has no routing-engine API/road-network/hazard avoidance dependency in the code.
- **Current behavior:** It visualizes a direct line and estimated travel rather than a navigable route avoiding floods/closures.
- **Expected behavior:** Clearly label as approximate direction, or integrate a road router with closure/hazard constraints before calling it “safe.”
- **Possible cause:** Demonstration route visualization presented as evacuation routing.
- **Recommended fix:** Use OSRM/GraphHopper/official road closure data, then validate route safety; otherwise rename to “direction to shelter.”

### FG-018 — Navigation’s “More” control is not an accessible explicit button

- **Priority:** LOW
- **Location/File:** all page headers, e.g. `frontend/map.html:50-70`
- **Description:** “More” is an anchor with `href="#"` and inline prevention. There is no shown ARIA expanded state or keyboard interaction management for its dropdown.
- **Current behavior:** Keyboard/screen-reader behavior and open/close state are ambiguous.
- **Expected behavior:** A semantic button with `aria-expanded`, Escape handling, focus movement, and visible state.
- **Possible cause:** CSS-hover style dropdown pattern.
- **Recommended fix:** Convert to an accessible menu-button component.

## 8. Screen Layout and Hidden Element Issues

### FG-019 — Fixed-height map page risks inaccessible overflow

- **Priority:** MEDIUM
- **Location/File:** `frontend/css/style.css:675-693`
- **Description:** `body.map-page-body` and its wrapper are constrained to viewport height with `overflow:hidden`.
- **Current behavior:** Any taller popup/panel, browser zoom, virtual keyboard, small landscape viewport, or accessibility text scaling can be clipped rather than scrollable.
- **Expected behavior:** Critical controls/panel content must remain accessible at zoom and on small devices.
- **Possible cause:** Full-screen map layout prioritization.
- **Recommended fix:** Allow panel-specific scrolling with tested height calculations, safe-area insets, and a fallback page scroll path.

### FG-020 — Timeline summary has desktop minimum width that can block the map

- **Priority:** LOW
- **Location/File:** `frontend/css/style.css:2608-2635`
- **Description:** Summary popover is at least 440px wide and overlays the map at a high z-index.
- **Current behavior:** On tablet/zoomed desktop it can dominate the viewport; only the <=768px media query reduces it.
- **Expected behavior:** Responsive width at intermediate sizes and a nonblocking summary placement.
- **Possible cause:** Desktop-first fixed layout.
- **Recommended fix:** Use clamp/max-width and test 769–1024px plus browser zoom.

## 9. Feature-by-Feature Status

| Feature Name | Status | Issue / possible cause | Impact | Recommended Fix |
|---|---|---|---|---|
| Static page navigation | Partially Working | Routes exist; More menu accessibility is weak | Navigation barrier for keyboard users | Accessible menu button |
| Live Flood Map initialization | Partially Working | Leaflet initialization and base tiles wired; external CDN availability is a runtime dependency | Map unavailable offline/CDN failure | Local fallback/error UI |
| Flood Areas layer | Partially Working | Renders, but source is static/estimated and mislabelled verified | High safety/data-trust risk | Provenance + validated extents |
| Flood Risk layer | Partially Working | Static `risk_zones.geojson`; not a selected-area dynamic risk surface | Misleading context | Data-driven risk raster/vector layer |
| Rivers layer | Partially Working | Simplified static linework; not linked to realtime river geometry | Misinterpretation | Authoritative hydrography + gauge linkage |
| Safe Shelters layer | Partially Working | Static local GeoJSON; no shown availability/validation refresh | Unsafe stale destination advice | Authority-managed shelter feed/data age |
| State selector | Partially Working | Selector drives fly-to; only configured vulnerable districts exist | Incomplete district coverage | Authoritative geography directory |
| State boundary click | Not Working | `name` vs `state_name` mismatch (FG-004) | Direct map selection fails | Align schema |
| District Boundaries toggle | Not Working | Empty layer with no renderer (FG-015) | UI promise fails | Implement or remove/relabel |
| Timeline filters | Partially Working | Layer refresh works; source dates are moving static values | False history/live view | Immutable timestamps |
| Live refresh | Partially Working | Only Open-Meteo calls; broad fallback/success reporting | False operational status | Transparent failure state |
| Real-time flood polygon generation | Partially Working | Threshold buffers only, duplicated client/server | Unvalidated evacuation decisions | Server model/validated extent |
| Rain/rivers/warnings dashboard | Partially Working | Uses calculated telemetry; cache logs grow unbounded | Data quality/performance concern | Data quality checks, retention |
| Search | Partially Working | Local cached-index only | Advertised places not searchable | Geocoder or accurate copy |
| GPS location | Partially Working | Browser permission/device dependent; no external routing | May fail or not give safe route | Clear errors and route integration |
| Shelter route | Partially Working | Straight-line display, not navigation/safety routing | Potentially hazardous expectation | Real routing/rename |
| Risk calculator | Working as a rule-based simulator | Inputs are user/seed data, not local live verification | Not a predictive operational assessment | Label as calculator, validate model |
| ML prediction | Partially Working | Produces a model score, but no model monitoring/calibration evidence | False confidence | Versioning, validation, confidence bounds |
| Alert filters/list | Partially Working | CRUD-dependent and dynamic HTML injection risk | Security/trust risk | Encode output, protect admin APIs |
| Admin console | Not Working securely | Public/unprotected mutations (FG-001) | Full data integrity compromise | AuthN/AuthZ first |
| Historical chart | Partially Working | Chart uses seeded database history | Does not establish national event history | Clearly label scope/data provenance |

## 10. Data and API Analysis

- **Static datasets:** six local GeoJSON files contain only 3–5 features each; they are demonstrative, not nationwide operational coverage.
- **SQLite behaviour:** importing the Flask app initializes/seeds a local database. This is why runtime API tests were not performed in this read-only audit.
- **Live inputs actually implemented:** Open-Meteo forecast and Open-Meteo Global Flood endpoints via `urllib.request`, five-second station request timeout, 120-second memory cache, and synchronous database audit-cache writes on refresh.
- **Calculated values:** water levels are inferred from a per-station hard-coded base level and discharge curve, not sourced observed gauge stages. Risk is calculated by the application’s rule engine.
- **Data fallbacks:** the local service fabricates/randomizes station variation when weather is low/unavailable; the nationwide service uses default values when services are unavailable, while warning/risk output has a hard-coded `LIVE` provenance in one branch (`backend/live_india_service.py:900-924`).
- **API safety:** global permissive CORS (`backend/app.py:35-42`), no authorization on mutating endpoints, plain SHA-256 password hashing, default passwords, debug mode in the launcher, and verbose exception strings returned by risk/prediction endpoints are unsuitable for deployment.

## 11. Performance Issues

### FG-021 — Refresh can fan out to every station and append audit rows indefinitely

- **Priority:** MEDIUM
- **Location/File:** `backend/live_india_service.py:953-1031`
- **Description:** A forced refresh concurrently contacts every configured station then inserts rainfall/river cache rows for each, with no visible retention, uniqueness, or batch/job queue strategy.
- **Current behavior:** Repeated user refreshes can create unbounded SQLite growth and network fan-out; failures are hidden.
- **Expected behavior:** A server-scheduled ingestion pipeline, bounded retention, idempotent/upsert records, throttling and observability.
- **Possible cause:** Prototype cache logging designed for small local use.
- **Recommended fix:** Use background workers, rate limits, source cache reuse, indexed retention policy, and separate read model.

### FG-022 — Repeated whole-layer clears/renders and rich HTML popups

- **Priority:** LOW
- **Location/File:** `frontend/js/map.js:1013-1081, 2041-2220`
- **Description:** Filter/refresh operations clear and rebuild layers/popup HTML. This is acceptable for the small bundled dataset but will scale poorly for real nationwide polygons/markers.
- **Current behavior:** Potential UI stalls and memory pressure with real coverage.
- **Expected behavior:** Incremental/vector-tile rendering, simplified geometry, server filtering and clustering.
- **Possible cause:** Small-demo dataset assumptions.
- **Recommended fix:** Benchmark real loads; add viewport queries, vector tiles, debounce/cancel refreshes, and geometry generalization.

## 12. Recommended Improvements

1. Establish an operational data contract: source, license, location accuracy, observation time, processing version, latency, confidence, and provenance for every displayed value.
2. Separate demo/reference data from production endpoints and visibly badge it. Never regenerate source timestamps.
3. Replace geometric buffers with either validated observed flood extent or a documented hydrologic/hydraulic model constrained by terrain, river network, and floodplain data.
4. Integrate official CWC/IMD/NDMA/state feeds only where access/terms and adapters are in place; otherwise remove their attribution.
5. Add a background ingestion architecture, cached read model, source health metrics, retry/backoff, retention and audit logging.
6. Protect every write endpoint; remove default credentials, use Argon2/bcrypt, sessions/tokens, CSRF, role checks, rate limiting, restrictive CORS, and production-safe error handling.
7. Encode all rendered API text and eliminate data-built inline handlers; deploy CSP.
8. Rework map UI for one active panel at a time on mobile; make source/age/errors prominent; reduce unsupported advanced options in citizen mode.
9. Implement actual district boundaries or remove the option; use consistent property schemas and contract tests.
10. Rename direct-line shelter routes to approximate directions until road routing and flood/closure avoidance are validated.
11. Add browser E2E testing at desktop/tablet/mobile widths, keyboard/screen-reader checks, offline/API failure cases, and contract tests that do not mutate production data.
12. Validate risk/prediction models against held-out historical events, expose accuracy/limits, and add model/data versioning.

## 13. Priority Fix List

1. **CRITICAL:** FG-001 — lock down admin and all mutating APIs.
2. **CRITICAL:** FG-002 — stop presenting static moving-timestamp polygons as verified/live.
3. **CRITICAL:** FG-003 — prevent unvalidated geometric buffers from being interpreted as actual flood extent.
4. **HIGH:** FG-005/FG-006 — truthful source, failure, and provenance handling.
5. **HIGH:** FG-017 — remove “safe route” implication until safe routing exists.
6. **HIGH:** FG-010 — remediate XSS-prone dynamic HTML rendering.
7. **HIGH:** FG-004/FG-011/FG-012 — repair state selection and unify/fix flood-area model/time semantics.
8. **MEDIUM:** FG-008/FG-015 — consistent filters and district-boundary feature completion.
9. **MEDIUM:** FG-013/FG-014/FG-019 — responsive overlay/overflow redesign.
10. **MEDIUM:** FG-021 — ingestion/cache retention and refresh control.

## 14. Suggested Development Roadmap

**Phase 0 — Safety and truthfulness (immediate):** disable/restrict public admin mutations, correct all live/verified/agency claims, label demo/static/estimated layers, make failure and data age visible, and rename approximate routes.

**Phase 1 — Correctness:** define versioned API schemas/provenance, repair the state-boundary schema mismatch, finish or remove district boundaries, unify filter semantics, and add non-mutating API/UI contract tests.

**Phase 2 — Data foundation:** obtain authorized official feeds, build scheduled ingestion with monitoring/retention, create a managed authoritative shelter/river/boundary store, and add spatial data quality checks.

**Phase 3 — Flood intelligence:** calibrate models using historical events; integrate DEM, hydrography/floodplain, rainfall forecast and validated extent observations; generate server-owned versioned forecast/extent products with uncertainty.

**Phase 4 — Usability and scale:** redesign mobile map controls around priority citizen tasks, add accessible navigation, integrate hazard-aware routing only after validation, move specialist layers to an authenticated workspace, and migrate nationwide map delivery to server-filtered/vector-tile data.

