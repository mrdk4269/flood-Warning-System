# FloodGuard Warning System - Comprehensive Bug & Issue Report

**Generated:** 2026-09-14  
**Codebase Version:** Current working directory  
**Total Issues Identified:** 53

---

## 🔴 CRITICAL ISSUES (Core Functionality Broken)

### 1. Admin Login Never Works
**Location:** `backend/database.py:183-191`  
**Impact:** Admin panel completely inaccessible; no way to manage data  
**Root Cause:** `FLOODGUARD_ADMIN_PASSWORD` env var is never set; `init_database()` only creates admin user if env var exists, but no default/fallback is provided.

```python
# Current code only creates admin if env var exists:
admin_password = os.environ.get("FLOODGUARD_ADMIN_PASSWORD")
if admin_password:
    cursor.execute(...)
```

---

### 2. Live India Data Service Crashes on First Run
**Location:** `backend/app.py:936`  
**Impact:** `/api/live-data/refresh` endpoint crashes with `KeyError`  
**Root Cause:** `LiveIndiaDataService._CACHE.get("fetch_meta")` accessed before being initialized.

```python
# Line 936 in app.py:
fetch_meta = LiveIndiaDataService._CACHE.get("fetch_meta", {})  # But _CACHE may not have this key yet
```

---

### 3. FloodDataService Not Imported in map.js
**Location:** `frontend/js/map.js:764`  
**Impact:** Flood areas layer fails to load on map  
**Root Cause:** `map.js` references `FloodDataService.loadFloodGeoJSON()` and `FloodDataService.renderFloodAreas()` but no such object exists.

```javascript
// Line 764:
FloodDataService.loadFloodGeoJSON(selectedTimePeriod).catch(() => null)
// Line 780:
if (floodAreasGeo) FloodDataService.renderFloodAreas(floodAreasGeo);
```

---

### 4. Missing API Endpoint for flood-effect-areas GeoJSON
**Location:** `backend/app.py:834-845`  
**Impact:** Map flood history timeline shows no data  
**Root Cause:** Frontend calls `/api/flood-effect-areas` (via `API.getFloodEffectAreas`) but backend only has `/api/flood-effect-areas` as GET with query params; no GeoJSON layer endpoint.

---

## 🟠 HIGH SEVERITY BUGS (Major Features Broken)

### 5. State Boundaries Are Bounding Boxes, Not Real Polygons
**Location:** `backend/india_geo_data.py:818-849`  
**Impact:** Map shows rectangles instead of real state shapes  
**Root Cause:** `get_india_states_geojson()` generates rectangular bbox polygons instead of actual state boundaries.

```python
# Current implementation creates simple rectangles:
geometry: {
    "type": "Polygon",
    "coordinates": [[
        [min_lng, min_lat],
        [max_lng, min_lat],
        [max_lng, max_lat],
        [min_lng, max_lat],
        [min_lng, min_lat]
    ]]
}
```

---

### 6. River Water Level Calculation Is Fake
**Location:** `backend/data_service.py:106-107,127`  
**Impact:** "Live" river telemetry is simulated, not real  
**Root Cause:** `LiveDataService.sync_live_external_data()` uses `random.uniform()` for river levels instead of real Open-Meteo discharge data.

```python
# Line 106-107:
station_rain_baseline = rain_val if rain_val > 5.0 else round(random.uniform(25.0, 72.0), 1)
# Line 127:
riv_level = round(calculated_river_stage * random.uniform(0.9, 1.05), 2)
```

---

### 7. Rainfall Station Updates Use Random Values
**Location:** `backend/data_service.py:114-115`  
**Impact:** Rainfall data is fabricated  
**Root Cause:** Same function generates `random.uniform(0.85, 1.25)` for each station rather than fetching real spatial data.

```python
for st in stations:
    st_rain = round(max(5.0, station_rain_baseline * random.uniform(0.85, 1.25)), 1)
```

---

### 8. LiveIndiaDataService.get_live_station_telemetry_map() Method Doesn't Exist
**Location:** `backend/flood_areas_data.py:813`  
**Impact:** Live enrichment of flood areas fails silently  
**Root Cause:** Referenced in `flood_areas_data.py` but never defined in `LiveIndiaDataService` class.

```python
# Line 813 in flood_areas_data.py:
live_map = LiveIndiaDataService.get_live_station_telemetry_map()  # Method doesn't exist!
```

---

### 9. Session Secret Is Random on Each Restart
**Location:** `backend/app.py:35`  
**Impact:** Users logged out on every deploy/restart  
**Root Cause:** `os.urandom(32)` means all sessions invalidated on server restart.

```python
app.config.update(
    SECRET_KEY=os.environ.get("FLOODGUARD_SECRET_KEY") or os.urandom(32),
)
```

---

### 10. CORS Headers Only Allow Same-Origin
**Location:** `backend/app.py:41-47`  
**Impact:** Frontend on different port/domain can't call API  
**Root Cause:** `add_cors_headers` restricts to `request.host_url` blocking cross-origin API calls.

```python
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin and origin == request.host_url.rstrip("/"):  # Too restrictive!
        response.headers["Access-Control-Allow-Origin"] = origin
```

---

## 🟡 MEDIUM SEVERITY (Features Partially Working)

### 11. Password Hash Fallback Is SHA-256 Unsalted
**Location:** `backend/database.py:42`  
**Impact:** Weak legacy hash compatibility

```python
return hmac.compare_digest(hashlib.sha256(password.encode("utf-8")).hexdigest(), stored_hash)
```

---

### 12. Historical Flood Events Only 12 Records
**Location:** `backend/india_geo_data.py:483-624`  
**Impact:** Limited historical coverage for all India

---

### 13. Forecast Risk Zones Are Static Approximations
**Location:** `backend/india_geo_data.py:855-968`  
**Impact:** Not real forecast data  
**Root Cause:** `get_forecast_risk_geojson()` uses hardcoded zones with square bounding boxes.

---

### 14. Flood Area GeoJSON Seeding Uses Polygon Centroids
**Location:** `backend/database.py:204-206`  
**Impact:** Inaccurate flood area center points  
**Root Cause:** Calculates centroid from first ring only, fails for MultiPolygons.

```python
coords = geom.get("coordinates", [[]])[0]  # Only first ring!
avg_lng = sum(pt[0] for pt in coords) / len(coords)
avg_lat = sum(pt[1] for pt in coords) / len(coords)
```

---

### 15. Database Retention Deletes Wrong Rows
**Location:** `backend/live_india_service.py:1050-1055`  
**Impact:** Mixed retention limits per data type  
**Root Cause:** `DELETE WHERE id NOT IN (SELECT id ORDER BY id DESC LIMIT 1000)` deletes oldest across ALL data_types.

```sql
DELETE FROM live_observations_cache
WHERE id NOT IN (
    SELECT id FROM live_observations_cache ORDER BY id DESC LIMIT 1000
)
```

---

### 16. Safe Locations Map Route Planner Uses Straight Lines
**Location:** `frontend/safe-locations.html:525-527`  
**Impact:** "Evacuation routes" are straight lines through floods  
**Root Cause:** `drawCurrentRoute()` creates 3-point polyline (origin, mid-offset, dest) not actual roads.

```javascript
const midLat = (oLat + dLat) / 2 + 0.003;
const midLng = (oLng + dLng) / 2 - 0.002;
const routePoints = [[oLat, oLng], [midLat, midLng], [dLat, dLng]];
```

---

### 17. Prediction Page Uses Hardcoded Location Options
**Location:** `frontend/prediction.html:124-130`  
**Impact:** Can't select arbitrary locations  
**Root Cause:** Dropdown has only 6 preset locations, not dynamic from API.

---

### 18. Alert NEARBY Filter Uses GPS But Doesn't Filter by Distance
**Location:** `frontend/js/alerts.js:67-69`  
**Impact:** "Nearby" shows wrong alerts  
**Root Cause:** `loadAlerts()` slices `sorted.slice(0,4)` instead of distance calculation.

```javascript
} else if (currentFilter === "NEARBY") {
    filtered = sorted.slice(0, 4);  // Just first 4, no GPS distance!
}
```

---

## 🔵 LOW SEVERITY / TECHNICAL DEBT

### 19. Duplicate Layer Variables
**Location:** `frontend/js/map.js:11-22`  
**Details:** `floodImpactLayer` + `liveAffectedLayer` (same), `riverLayer` + `majorRiversLayer`, etc.

---

### 20. Hardcoded Coordinates in Map Preview
**Location:** `frontend/index.html:352`  
**Details:** Uses fixed `initFloodMap("map-preview")` center.

---

### 21. Multiple `escapeHtml` Implementations
**Location:** Multiple files  
**Details:** Duplicated in `map.js`, `alerts.js`, `safe-locations.html`, `admin.html`

---

### 22. No Input Validation on `/api/calculate-risk`
**Location:** `backend/app.py:614-618`  
**Details:** Direct float conversion without bounds checking.

---

### 23. Risk Calculator Elevation Mod Can Exceed Bounds
**Location:** `backend/risk_calculator.py:174-184`  
**Details:** `elevation_mod` ±10pts but final_score clamped to 0-100 only at end.

---

### 24. ML Model Feature Importance Hardcoded
**Location:** `backend/prediction.py:193-198`  
**Details:** `predict_flood()` returns static percentages instead of actual model feature importance.

---

### 25. No Rate Limiting on API Endpoints
**Location:** `backend/app.py`  
**Details:** All endpoints open to unlimited requests.

---

### 26. No API Versioning
**Location:** `backend/app.py`  
**Details:** Breaking changes would break frontend.

---

### 27. Admin Panel Has No Edit Functionality for Rivers
**Location:** `frontend/admin.html:460-494`  
**Details:** Only update water_level, no CRUD for other fields.

---

### 28. Admin Panel Lacks Shelter/Hospital CRUD
**Location:** `frontend/admin.html:322-342`  
**Details:** Only displays, no add/edit/delete.

---

### 29. Map Search Suggestions Not Implemented
**Location:** `frontend/js/map.js:482`  
**Details:** `setupMapSearch()` in map.js references non-existent function.

---

### 30. Mobile Bottom Nav Not on All Pages
**Location:** Multiple HTML files  
**Details:** Only `index.html`, `map.html`, `safe-locations.html` have it.

---

## 📱 FRONTEND-SPECIFIC ISSUES

### 31. Missing `FloodDataService` Object
**Location:** `frontend/js/map.js:764, 780`  
**Details:** `map.js` uses `FloodDataService.loadFloodGeoJSON()` and `FloodDataService.renderFloodAreas()` but this object doesn't exist.

---

### 32. `renderFilteredStaticLayers()` Called But Caches May Be Null
**Location:** `frontend/js/map.js:88-94`  
**Details:** No null checks before render.

```javascript
function renderFilteredStaticLayers() {
    if (cachedHistoricalFloodsGeo) renderHistoricalFloodsLayer(cachedHistoricalFloodsGeo);
    if (cachedForecastRiskGeo) renderForecastRiskLayer(cachedForecastRiskGeo);
    // ... but these may be null if loadAllSpatialLayers() failed
}
```

---

### 33. Timeline Flood Events Layer Created But Never Populated
**Location:** `frontend/js/map.js:75, 474-477`  
**Details:** `timelineFloodEventsLayer` initialized but `syncTimelineFloodAreas` not fully implemented.

---

### 34. History Page Chart.js Import Via CDN But No Fallback
**Location:** `frontend/history.html:17`  
**Details:** If CDN blocked, charts fail silently.

---

### 35. Admin Login Form Doesn't Check for Existing Session
**Location:** `frontend/admin-login.html:34-46`  
**Details:** User stays on login page even if already authenticated.

---

## 🗄️ DATABASE / DATA ISSUES

### 36. No Foreign Key Constraints
**Location:** `backend/database.py:50-157`  
**Details:** Tables like `flood_areas`, `river_data`, `alerts` have no referential integrity.

---

### 37. GeoJSON Geometry Stored as TEXT
**Location:** `backend/database.py:66`  
**Details:** `geometry_json` column is TEXT not proper spatial type.

---

### 38. No Indexes on Frequently Queried Columns
**Location:** `backend/database.py`  
**Details:** `risk_level`, `status`, `district`, `state` unindexed.

---

### 39. `live_observations_cache` Has No Composite Index
**Location:** `backend/database.py:159-177`  
**Details:** Queries filter by `data_type`, `state`, `district` but no composite index.

---

### 40. Seed Data Uses `datetime.now()` for Timestamps
**Location:** `backend/database.py:288-301`  
**Details:** Makes historical data appear "live".

```python
now = datetime.now()
cursor.execute("""
    INSERT INTO river_data ... VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
""", (..., now.strftime("%Y-%m-%d"), now.strftime("%H:%M:%S")))
```

---

## 🔒 SECURITY CONCERNS

### 41. No CSRF Protection
**Location:** `backend/app.py`  
**Impact:** All POST/PUT/DELETE endpoints vulnerable.

---

### 42. Admin Auth Only Checks `session.get("role")`
**Location:** `backend/app.py:50-61`  
**Impact:** No token validation, session fixation possible.

---

### 43. Password Reset Not Implemented
**Location:** `backend/app.py`  
**Impact:** No way to recover admin account.

---

### 44. API Errors Expose Stack Traces in Debug Mode
**Location:** `backend/app.py:1024`  
**Impact:** `app.run(debug=True)` in production.

---

### 45. No HTTPS Enforcement
**Location:** `backend/app.py:36-38`  
**Impact:** No HSTS, secure cookies only in production.

---

## 📝 MISSING FEATURES (Per Requirements)

### 46. Real Evacuation Routing
**Expected:** Uses road network (OSRM/GraphHopper)  
**Current:** Straight lines through floods.

---

### 47. Satellite Imagery Ingestion
**Expected:** Actual flood extent processing  
**Current:** Only tile overlays (NASA GIBS, Bhuvan).

---

### 48. WebSocket Live Updates
**Expected:** Real-time push updates  
**Current:** All data polling-based (300s interval).

---

### 49. Multi-Language Support
**Expected:** i18n support  
**Current:** English only.

---

### 50. Offline PWA Capability
**Expected:** Service worker, offline caching  
**Current:** No PWA features.

---

### 51. Export/Download Data
**Expected:** CSV/GeoJSON export from admin or map  
**Current:** No export functionality.

---

### 52. User Management UI
**Expected:** Admin can create/edit users  
**Current:** No user management interface.

---

### 53. Audit Logging
**Expected:** Audit trail for admin actions  
**Current:** No audit logging in `backend/app.py`.

---

## 🎯 TOP 5 PRIORITY FIXES

| Priority | Issue | File(s) to Fix |
|----------|-------|----------------|
| 1 | Set `FLOODGUARD_ADMIN_PASSWORD` env var or add fallback admin creation | `backend/database.py`, `.env` |
| 2 | Fix `LiveIndiaDataService._CACHE["fetch_meta"]` initialization | `backend/app.py:936`, `backend/live_india_service.py` |
| 3 | Implement `FloodDataService` in map.js or replace with `API.getGeoJsonLayer()` calls | `frontend/js/map.js` |
| 4 | Add `/api/geojson/flood-effect-areas` endpoint for map timeline layer | `backend/app.py` |
| 5 | Replace random telemetry with real Open-Meteo spatial queries | `backend/data_service.py` |

---

## Summary Statistics

| Severity | Count |
|----------|-------|
| 🔴 Critical | 4 |
| 🟠 High | 6 |
| 🟡 Medium | 8 |
| 🔵 Low / Tech Debt | 11 |
| 📱 Frontend-Specific | 5 |
| 🗄️ Database / Data | 5 |
| 🔒 Security | 5 |
| 📝 Missing Features | 8 |
| **Total** | **52** |

---

## Notes

The system has a solid architectural foundation but suffers from:
1. **Simulated data masquerading as live data** (issues 6, 7)
2. **Missing admin provisioning** (issue 1)
3. **Frontend-backend integration gaps** (issues 3, 4, 31)
4. **Security hardening needed** (issues 41-45)
5. **Real geospatial data needed** (issues 5, 13, 46, 47)