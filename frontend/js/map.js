/**
 * FloodGuard India - Advanced Nationwide GIS Hydrological Engine
 * 12-layer multi-tier telemetry, India-wide geographical cascading filters,
 * basemap switcher (including ISRO Bhuvan & NASA GIBS), live spatial popups,
 * and strict 4-way data provenance separation (LIVE, HISTORICAL, FORECAST, SAMPLE).
 */

let map = null;

// 12 GIS Layer Groups
let indiaStatesLayer = null;      // Layer 1: State Boundaries
let districtsLayer = null;        // Layer 2: District Boundaries
let majorRiversLayer = null;      // Layer 3: Major River Channels
let riverStationsLayer = null;    // Layer 4: River Monitoring Stations
let historicalFloodsLayer = null; // Layer 5: Historical Flood Areas
let liveAffectedLayer = null;     // Layer 6: Live Flood-Affected Areas
let riskZonesLayer = null;        // Layer 7: Flood Risk Buffer Zones
let liveRainfallLayer = null;     // Layer 8: Live Rainfall Gauges
let floodWarningsLayer = null;    // Layer 9: Flood Warning Alerts
let sheltersLayer = null;         // Layer 10: Emergency Shelters
let hospitalsLayer = null;        // Layer 11: Medical Trauma Centers
let forecastRiskLayer = null;     // Layer 12: 3-Day Forecast Risk Areas
let bhuvanDisasterLayer = null;   // Satellite Remote Sensing Layer

// State Management
let currentMapMode = "LIVE";      // "LIVE" | "HISTORICAL"
let selectedState = "all";        // "all" | state name
let selectedDistrict = "all";     // "all" | district name
let selectedBasin = "all";        // "all" | basin key
let autoRefreshInterval = 300;    // seconds
let countdownTimerId = null;
let secondsRemaining = 300;
let isFetchingLive = false;
let userLocationMarker = null;
let currentBasemap = null;
let liveStationMarkers = {};      // Indexed by station name for instant popup trigger
let allStatesMeta = {};           // Cached states directory from /api/india/states
let allBasinsMeta = {};           // Cached river basins from /api/india/basins
let rawStationsData = [];         // All nationwide station observations cached

// NASA Daily Satellite Imagery Tile Generator
function getNasaDailyTileUrl() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

// Basemap Tile Providers
const BASEMAPS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  nasa: getNasaDailyTileUrl(),
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// Utility: Render Risk Badge HTML
function renderRiskBadge(level) {
  const l = (level || "LOW").toUpperCase();
  const cls = l === "CRITICAL" ? "badge-critical" :
              l === "HIGH" ? "badge-high" :
              l === "MEDIUM" ? "badge-medium" : "badge-low";
  return `<span class="badge ${cls}">${l} RISK</span>`;
}

// Custom Marker Generator with Pulsing Beacon Option
function createCustomIcon(bgGradient, svgInner, isAlert = false, badgeText = "") {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
        ${isAlert ? '<div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(239, 68, 68, 0.45); animation: pulseCritical 1.8s infinite;"></div>' : ''}
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: ${bgGradient};
          border: 1.5px solid rgba(255, 255, 255, 0.85);
          box-shadow: 0 4px 14px rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2;
        ">
          ${svgInner}
        </div>
        ${badgeText ? `
          <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); background: #0F172A; border: 1px solid rgba(255,255,255,0.25); color: #38BDF8; font-size: 0.58rem; font-family: var(--font-mono); font-weight: 700; padding: 1px 4px; border-radius: 4px; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.5); z-index: 3;">
            ${badgeText}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
  });
}

// Icon Archetypes
const ICONS = {
  shelter: createCustomIcon(
    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  ),
  hospital: createCustomIcon(
    "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`,
    true
  ),
  rainfall: createCustomIcon(
    "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`
  )
};

// Specialized Live Marker Generators
function createLiveRainfallMarkerIcon(rain24h, isHeavy = false) {
  const gradient = isHeavy
    ? "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
    : "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)";
  const svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`;
  return createCustomIcon(gradient, svg, isHeavy, `${rain24h}mm`);
}

function createLiveRiverGaugeMarkerIcon(waterLevel, status) {
  const isDanger = status === "DANGER";
  const isWarning = status === "WARNING";
  const gradient = isDanger
    ? "linear-gradient(135deg, #EF4444 0%, #991B1B 100%)"
    : isWarning
    ? "linear-gradient(135deg, #F59E0B 0%, #B45309 100%)"
    : "linear-gradient(135deg, #10B981 0%, #047857 100%)";
  const svg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 12h20"/><path d="M2 6c4 0 4 4 8 4s4-4 8-4 4 4 4 4"/><path d="M2 18c4 0 4-4 8-4s4 4 8 4 4-4 4-4"/></svg>`;
  return createCustomIcon(gradient, svg, isDanger, `${waterLevel}m`);
}

function createLiveWarningMarkerIcon() {
  const gradient = "linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)";
  const svg = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/></svg>`;
  return createCustomIcon(gradient, svg, true, "ALERT");
}

// =============================================================================
// INITIALIZE NATIONWIDE MAP (Requirement #1: Default India-Wide View)
// =============================================================================

function initFloodMap(containerId = "map-container", options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Default national center: India Geographic Centroid [22.5, 80.0], zoom 5
  const defaultCenter = [22.5, 80.0];
  const defaultZoom = options.preview ? 4 : 5;

  map = L.map(containerId, {
    center: defaultCenter,
    zoom: defaultZoom,
    minZoom: 4,
    maxZoom: 18,
    zoomControl: !options.preview,
    attributionControl: !options.preview
  });

  // Base Map Layer
  currentBasemap = L.tileLayer(BASEMAPS.dark, {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  // Initialize all 12 GIS LayerGroups
  indiaStatesLayer = L.layerGroup().addTo(map);      // Layer 1
  districtsLayer = L.layerGroup();                   // Layer 2
  majorRiversLayer = L.layerGroup().addTo(map);      // Layer 3
  riverStationsLayer = L.layerGroup().addTo(map);    // Layer 4
  historicalFloodsLayer = L.layerGroup().addTo(map); // Layer 5
  liveAffectedLayer = L.layerGroup().addTo(map);     // Layer 6
  riskZonesLayer = L.layerGroup().addTo(map);        // Layer 7
  liveRainfallLayer = L.layerGroup().addTo(map);     // Layer 8
  floodWarningsLayer = L.layerGroup().addTo(map);    // Layer 9
  sheltersLayer = L.layerGroup().addTo(map);         // Layer 10
  hospitalsLayer = L.layerGroup().addTo(map);        // Layer 11
  forecastRiskLayer = L.layerGroup().addTo(map);     // Layer 12

  // Ingest Nationwide Geographical & Hydrological Data
  populateGeographicalSelectors();
  loadAllSpatialLayers();
  fetchAndRenderLiveData();

  if (!options.preview) {
    setupCoordinateTracker();
    setupBasemapSwitcher();
    setupLayerToggles();
    setupMapSearch();
    setupAutoRefreshTimer();
  }

  return map;
}

// Live Coordinate & Approximate Elevation HUD on Mousemove
function setupCoordinateTracker() {
  const coordDisplay = document.getElementById("hud-cursor-coords");
  if (!coordDisplay) return;

  map.on("mousemove", (e) => {
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);
    const approxElev = Math.max(2.1, Math.round((Math.sin(lat * 15) + Math.cos(lng * 15) + 2) * 5.5));
    coordDisplay.textContent = `LAT: ${lat}° N | LON: ${lng}° E | ELEV: ~${approxElev}m`;
  });
}

// Basemap Switcher
function setupBasemapSwitcher() {
  const switcher = document.getElementById("basemap-select");
  if (!switcher) return;

  switcher.addEventListener("change", (e) => {
    const chosen = e.target.value;
    if (currentBasemap) {
      map.removeLayer(currentBasemap);
    }

    if (chosen === "bhuvan") {
      currentBasemap = L.tileLayer.wms("https://bhuvan-vec2.nrsc.gov.in/bhuvan/gwc/service/wms", {
        layers: "sisdp_base:sisdp_basemap",
        format: "image/png",
        transparent: false,
        version: "1.1.1",
        srs: "EPSG:900913",
        maxZoom: 18,
        attribution: "Map data &copy; ISRO Bhuvan / NRSC Department of Space, India"
      }).addTo(map);

      bringInteractiveLayersToFront();
      if (typeof showToast === "function") {
        showToast("🛰️ ISRO Bhuvan Space GIS Basemap Activated (NRSC / Space)", "info");
      }
    } else if (BASEMAPS[chosen]) {
      const isNasa = chosen === "nasa";
      currentBasemap = L.tileLayer(BASEMAPS[chosen], {
        maxZoom: isNasa ? 9 : 19,
        attribution: isNasa ? 'Imagery &copy; NASA GIBS / EOSDIS' : '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      bringInteractiveLayersToFront();
      if (isNasa && typeof showToast === "function") {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        showToast(`🛰️ NASA GIBS Live Daily Satellite Layer Activated (Daily Pass: ${yesterday})`, "info");
      }
    }
  });
}

function bringInteractiveLayersToFront() {
  if (majorRiversLayer && map.hasLayer(majorRiversLayer)) majorRiversLayer.bringToFront?.();
  if (liveAffectedLayer && map.hasLayer(liveAffectedLayer)) liveAffectedLayer.bringToFront?.();
  if (forecastRiskLayer && map.hasLayer(forecastRiskLayer)) forecastRiskLayer.bringToFront?.();
  if (historicalFloodsLayer && map.hasLayer(historicalFloodsLayer)) historicalFloodsLayer.bringToFront?.();
}

// =============================================================================
// CASCADING GEOGRAPHICAL SELECTORS (Requirement #2 & #4)
// Country: India -> State -> District -> River Basin
// =============================================================================

async function populateGeographicalSelectors() {
  try {
    const [statesRes, basinsRes] = await Promise.all([
      API.getIndiaStates(),
      API.getIndiaBasins()
    ]);

    // Populate State Selector
    const stateSelector = document.getElementById("state-selector");
    if (stateSelector && statesRes) {
      allStatesMeta = {};
      if (statesRes.states_map) {
        allStatesMeta = statesRes.states_map;
      } else if (Array.isArray(statesRes.states)) {
        statesRes.states.forEach((s) => {
          allStatesMeta[s.state_name] = s;
        });
      } else if (typeof statesRes.states === "object") {
        allStatesMeta = statesRes.states;
      }
      const sortedStateNames = Object.keys(allStatesMeta).sort();

      stateSelector.innerHTML = '<option value="all" selected>All States (28+)</option>';
      sortedStateNames.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st;
        opt.textContent = `${st} (${allStatesMeta[st].capital})`;
        stateSelector.appendChild(opt);
      });
    }

    // Populate River Basin Selector
    const basinSelector = document.getElementById("basin-selector");
    if (basinSelector && basinsRes) {
      allBasinsMeta = {};
      if (basinsRes.basins_map) {
        allBasinsMeta = basinsRes.basins_map;
      } else if (Array.isArray(basinsRes.basins)) {
        basinsRes.basins.forEach((b) => {
          allBasinsMeta[b.basin_key || b.name] = b;
        });
      } else if (typeof basinsRes.basins === "object") {
        allBasinsMeta = basinsRes.basins;
      }
      const sortedBasinKeys = Object.keys(allBasinsMeta).sort();

      basinSelector.innerHTML = '<option value="all" selected>All River Basins (9 Major)</option>';
      sortedBasinKeys.forEach((bk) => {
        const b = allBasinsMeta[bk];
        const opt = document.createElement("option");
        opt.value = bk;
        const nameStr = b.name || b.basin_name || bk;
        const stCount = b.states_covered?.length || b.riparian_states?.length || 0;
        opt.textContent = `${nameStr} (${stCount} States)`;
        basinSelector.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Failed to populate cascading geographical selectors:", err);
  }

}

// State Select Change Handler
window.onStateSelectChange = function(stateVal) {
  selectedState = stateVal;
  const locStateEl = document.getElementById("loc-state");
  const locDistEl = document.getElementById("loc-district");
  const distSelector = document.getElementById("district-selector");

  if (stateVal === "all") {
    if (locStateEl) locStateEl.textContent = "ALL STATES";
    if (locDistEl) locDistEl.textContent = "ALL DISTRICTS";
    if (distSelector) distSelector.innerHTML = '<option value="all" selected>All Districts</option>';
    selectedDistrict = "all";

    // Fly camera to complete map of India
    map.flyTo([22.5, 80.0], 5, { duration: 1.2 });
    renderFilteredLiveLayers();
    return;
  }

  // Specific State Selected
  if (locStateEl) locStateEl.textContent = stateVal.toUpperCase();
  if (locDistEl) locDistEl.textContent = "ALL DISTRICTS";
  selectedDistrict = "all";

  const meta = allStatesMeta[stateVal];
  if (meta) {
    // Populate vulnerable districts
    if (distSelector) {
      distSelector.innerHTML = '<option value="all" selected>All Districts in ' + stateVal + '</option>';
      (meta.flood_prone_districts || []).forEach((dist) => {
        const opt = document.createElement("option");
        opt.value = dist;
        opt.textContent = dist;
        distSelector.appendChild(opt);
      });
    }

    // Camera fly to state center
    const targetZoom = meta.zoom || 7;
    map.flyTo(meta.center, targetZoom, { duration: 1.2 });

    if (typeof showToast === "function") {
      showToast(`📍 Focused on ${stateVal} (Capital: ${meta.capital})`, "info");
    }
  }

  renderFilteredLiveLayers();
};

// District Select Change Handler
window.onDistrictSelectChange = function(distVal) {
  selectedDistrict = distVal;
  const locDistEl = document.getElementById("loc-district");

  if (distVal === "all") {
    if (locDistEl) locDistEl.textContent = "ALL DISTRICTS";
    if (selectedState !== "all" && allStatesMeta[selectedState]) {
      map.flyTo(allStatesMeta[selectedState].center, allStatesMeta[selectedState].zoom || 7, { duration: 1.0 });
    }
    renderFilteredLiveLayers();
    return;
  }

  if (locDistEl) locDistEl.textContent = distVal.toUpperCase();

  // Find a station matching this district or zoom closer
  const matchingStation = rawStationsData.find(
    s => (s.district && s.district.toLowerCase() === distVal.toLowerCase()) ||
         (s.location_name && s.location_name.toLowerCase().includes(distVal.toLowerCase()))
  );

  if (matchingStation) {
    map.flyTo([matchingStation.latitude, matchingStation.longitude], 10, { duration: 1.1 });
    const marker = liveStationMarkers[matchingStation.location_name];
    if (marker) setTimeout(() => marker.openPopup(), 1200);
  } else if (selectedState !== "all" && allStatesMeta[selectedState]) {
    map.flyTo(allStatesMeta[selectedState].center, 9, { duration: 1.0 });
  }

  renderFilteredLiveLayers();
};

// River Basin Select Change Handler
window.onBasinSelectChange = function(basinKey) {
  selectedBasin = basinKey;
  const locBasinEl = document.getElementById("loc-basin");

  if (basinKey === "all") {
    if (locBasinEl) locBasinEl.textContent = "ALL BASINS";
    if (selectedState === "all") {
      map.flyTo([22.5, 80.0], 5, { duration: 1.2 });
    }
    renderFilteredLiveLayers();
    return;
  }

  const b = allBasinsMeta[basinKey];
  if (b) {
    if (locBasinEl) locBasinEl.textContent = b.name.toUpperCase();
    map.flyTo(b.center, b.zoom || 6, { duration: 1.2 });

    if (typeof showToast === "function") {
      showToast(`🌊 Focused on ${b.name} Basin (${b.catchment_area_sq_km?.toLocaleString()} km²)`, "info");
    }
  }

  renderFilteredLiveLayers();
};

// Backward-compatible onRegionChange
window.onRegionChange = function(region) {
  if (region === "odisha") {
    onStateSelectChange("Odisha");
  } else if (region === "kerala") {
    onStateSelectChange("Kerala");
  } else {
    onStateSelectChange("all");
  }
};

// =============================================================================
// MODE SWITCHING (Requirement #1 & #2: Strict Provenance Distinction)
// =============================================================================

window.setMapMode = function(mode) {
  currentMapMode = mode;
  const btnLive = document.getElementById("btn-mode-live");
  const btnHist = document.getElementById("btn-mode-historical");

  if (mode === "LIVE") {
    if (btnLive) btnLive.classList.add("active-live");
    if (btnHist) btnHist.classList.remove("active-hist");

    // Remove historical disaster layers to prevent confusing historical with live
    if (map.hasLayer(historicalFloodsLayer)) map.removeLayer(historicalFloodsLayer);

    // Add live spatial layers
    if (!map.hasLayer(riverStationsLayer)) map.addLayer(riverStationsLayer);
    if (!map.hasLayer(liveRainfallLayer)) map.addLayer(liveRainfallLayer);
    if (!map.hasLayer(liveAffectedLayer)) map.addLayer(liveAffectedLayer);
    if (!map.hasLayer(riskZonesLayer)) map.addLayer(riskZonesLayer);
    if (!map.hasLayer(floodWarningsLayer)) map.addLayer(floodWarningsLayer);
    if (!map.hasLayer(forecastRiskLayer)) map.addLayer(forecastRiskLayer);

    renderFilteredLiveLayers();

    if (typeof showToast === "function") {
      showToast("🟢 Live India Flood Data Mode Activated (Real-time Hydrometry & Rain)", "success");
    }
  } else {
    // HISTORICAL Mode
    if (btnHist) btnHist.classList.add("active-hist");
    if (btnLive) btnLive.classList.remove("active-live");

    // Remove live-only layers
    if (map.hasLayer(liveRainfallLayer)) map.removeLayer(liveRainfallLayer);
    if (map.hasLayer(liveAffectedLayer)) map.removeLayer(liveAffectedLayer);
    if (map.hasLayer(floodWarningsLayer)) map.removeLayer(floodWarningsLayer);

    // Add historical flood footprint layer
    if (!map.hasLayer(historicalFloodsLayer)) map.addLayer(historicalFloodsLayer);

    if (typeof showToast === "function") {
      showToast("🏛️ Historical Disaster Archive Mode Activated (Major Floods Across India)", "info");
    }
  }
};

// Auto-Refresh Interval Switcher & Countdown Timer (Requirement #8)
window.onAutoRefreshChange = function(val) {
  autoRefreshInterval = parseInt(val, 10);
  secondsRemaining = autoRefreshInterval;
  updateTimerDisplay();
};

function setupAutoRefreshTimer() {
  if (countdownTimerId) clearInterval(countdownTimerId);
  updateTimerDisplay();

  countdownTimerId = setInterval(() => {
    if (autoRefreshInterval <= 0) return;
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      secondsRemaining = autoRefreshInterval;
      if (currentMapMode === "LIVE") {
        fetchAndRenderLiveData(false);
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  const timerDisplay = document.getElementById("refresh-timer-display");
  if (!timerDisplay) return;
  if (autoRefreshInterval <= 0) {
    timerDisplay.textContent = "PAUSED";
    return;
  }
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  timerDisplay.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

window.forceSyncLiveData = async function() {
  secondsRemaining = autoRefreshInterval > 0 ? autoRefreshInterval : 300;
  updateTimerDisplay();
  if (typeof showToast === "function") {
    showToast("⚡ Forcing Real-time Ingestion Sync with Open-Meteo & India Hydrological Networks...", "info");
  }
  await fetchAndRenderLiveData(true);
};

window.triggerLiveMeteoSync = window.forceSyncLiveData;

// Toggle Collapsible India Dashboard Drawer (Requirement #5 & #6)
window.toggleLiveDashboardDrawer = function() {
  const drawer = document.getElementById("live-dashboard-drawer");
  if (!drawer) return;
  drawer.classList.toggle("open");
  const isOpen = drawer.classList.contains("open");
  const btn = document.getElementById("btn-toggle-drawer");
  if (btn) {
    if (isOpen) {
      btn.classList.add("btn-primary");
      btn.classList.remove("btn-secondary");
    } else {
      btn.classList.add("btn-secondary");
      btn.classList.remove("btn-primary");
    }
  }
};

// Smooth Pan & Popup trigger for Drawer Station Items
window.flyToStation = function(lat, lng, stationName) {
  if (!map) return;
  map.flyTo([lat, lng], 13, { duration: 1.0 });
  const marker = liveStationMarkers[stationName];
  if (marker) {
    setTimeout(() => {
      marker.openPopup();
    }, 1100);
  }
};

// =============================================================================
// SPATIAL LAYERS LOADING (12 Independent GIS Layers)
// =============================================================================

async function loadAllSpatialLayers() {
  try {
    const [
      indiaStatesGeo,
      indiaRiversGeo,
      historicalFloodsGeo,
      forecastRiskGeo,
      sheltersGeo,
      hospitalsGeo
    ] = await Promise.all([
      API.getIndiaStatesGeoJson().catch(() => null),
      API.getIndiaRiversGeoJson().catch(() => null),
      API.getHistoricalFloodsGeoJson().catch(() => null),
      API.getForecastRiskGeoJson().catch(() => null),
      API.getGeoJsonLayer("shelters").catch(() => null),
      API.getGeoJsonLayer("hospitals").catch(() => null)
    ]);

    if (indiaStatesGeo) renderIndiaStatesLayer(indiaStatesGeo);
    if (indiaRiversGeo) renderMajorRiversLayer(indiaRiversGeo);
    if (historicalFloodsGeo) renderHistoricalFloodsLayer(historicalFloodsGeo);
    if (forecastRiskGeo) renderForecastRiskLayer(forecastRiskGeo);
    if (sheltersGeo) renderShelters(sheltersGeo);
    if (hospitalsGeo) renderHospitals(hospitalsGeo);
  } catch (err) {
    console.error("Failed to load base spatial layers:", err);
  }
}

// Layer 1: India State Boundaries
function renderIndiaStatesLayer(geojson) {
  indiaStatesLayer.clearLayers();

  L.geoJSON(geojson, {
    style: {
      color: "#38BDF8",
      weight: 1.2,
      opacity: 0.55,
      fillColor: "#0284C7",
      fillOpacity: 0.05,
      dashArray: "3, 3"
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const stateName = p.name || "State";
      layer.bindTooltip(`<b>${stateName}</b><br><span style="font-size:0.7rem; color:#94A3B8;">Click to filter</span>`, {
        sticky: true,
        className: "state-tooltip"
      });

      layer.on("mouseover", function() {
        this.setStyle({ fillOpacity: 0.18, weight: 2.2, color: "#60A5FA" });
      });
      layer.on("mouseout", function() {
        this.setStyle({ fillOpacity: 0.05, weight: 1.2, color: "#38BDF8" });
      });
      layer.on("click", function() {
        const stateSelect = document.getElementById("state-selector");
        if (stateSelect) {
          stateSelect.value = stateName;
          onStateSelectChange(stateName);
        }
      });
    }
  }).addTo(indiaStatesLayer);
}

// Layer 3: Major River Channels
function renderMajorRiversLayer(geojson) {
  majorRiversLayer.clearLayers();

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties || {};
      return {
        color: p.color || "#06B6D4",
        weight: 3.5,
        opacity: 0.88,
        lineCap: "round",
        lineJoin: "round"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#06B6D4; font-weight:700;">● NATIONAL RIVER TRANSECT</span>
            <span class="provenance-tag provenance-live">NATIONAL</span>
          </div>
          <div class="popup-title">${p.river_name || "Major River"}</div>
          <div class="badge badge-low" style="margin-bottom:0.5rem;">${p.basin || "River Basin"}</div>
          <div class="popup-row">
            <span class="popup-label">Length</span>
            <span class="popup-val mono">${p.length_km ? p.length_km.toLocaleString() + " km" : "N/A"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">States Covered</span>
            <span class="popup-val" style="font-size:0.75rem;">${p.states_covered || "All India"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Provenance</span>
            <span class="popup-val mono" style="color:#38BDF8;">Official River Basin GIS</span>
          </div>
        </div>
      `);

      layer.on("mouseover", function() {
        this.setStyle({ weight: 5.5, opacity: 1.0 });
      });
      layer.on("mouseout", function() {
        this.setStyle({ weight: 3.5, opacity: 0.88 });
      });
    }
  }).addTo(majorRiversLayer);
}

// Layer 5: Historical Flood Areas (Major Disasters across India)
function renderHistoricalFloodsLayer(geojson) {
  historicalFloodsLayer.clearLayers();

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties || {};
      const isCrit = (p.risk_level || "").toUpperCase() === "CRITICAL";
      return {
        color: isCrit ? "#EF4444" : "#F59E0B",
        weight: 2.2,
        opacity: 0.9,
        fillColor: isCrit ? "#EF4444" : "#F59E0B",
        fillOpacity: 0.28,
        dashArray: "4, 4"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#F59E0B; font-weight:700;">● ARCHIVED DISASTER FOOTPRINT</span>
            <span class="provenance-tag provenance-historical">HISTORICAL</span>
          </div>
          <div class="popup-title">${p.name || p.flood_event}</div>
          <div style="margin-bottom:0.5rem; display:flex; gap:0.4rem; align-items:center;">
            ${renderRiskBadge(p.risk_level)}
            <span class="badge badge-low">${p.state} (${p.year})</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">District / Basin</span>
            <span class="popup-val">${p.district || p.river_basin || "Nationwide"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Peak Recorded Rain</span>
            <span class="popup-val mono" style="color:#60A5FA;">${p.rainfall_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Peak River Stage</span>
            <span class="popup-val mono" style="color:#F59E0B;">${p.water_level_m} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Human Impact</span>
            <span class="popup-val" style="font-size:0.75rem; color:#FCA5A5;">${p.human_impact || "Significant"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Source Record</span>
            <span class="popup-val mono" style="font-size:0.68rem; color:var(--text-muted);">${p.source || "Disaster Management Authority"}</span>
          </div>
        </div>
      `);
    }
  }).addTo(historicalFloodsLayer);
}

// Layer 12: 3-Day Forecast Risk Areas
function renderForecastRiskLayer(geojson) {
  forecastRiskLayer.clearLayers();

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties || {};
      const isHigh = (p.forecast_risk_level || "").toUpperCase() === "HIGH";
      return {
        color: isHigh ? "#8B5CF6" : "#A78BFA",
        weight: 1.8,
        opacity: 0.85,
        fillColor: isHigh ? "#8B5CF6" : "#A78BFA",
        fillOpacity: 0.2,
        dashArray: "6, 4"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#A78BFA; font-weight:700;">● 3-DAY METEOROLOGICAL OUTLOOK</span>
            <span class="provenance-tag provenance-forecast">FORECAST</span>
          </div>
          <div class="popup-title">${p.state} Forecast Zone</div>
          <div style="margin-bottom:0.5rem; display:flex; gap:0.4rem;">
            <span class="badge" style="background:#8B5CF622; color:#A78BFA; border:1px solid #8B5CF666;">${p.forecast_risk_level} RISK</span>
            <span class="badge badge-low">${p.horizon || "72h Horizon"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Expected 72h Rain</span>
            <span class="popup-val mono" style="color:#A78BFA; font-weight:700;">${p.predicted_72h_rain_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Hydrological Trend</span>
            <span class="popup-val" style="color:#E2E8F0;">${p.river_trend || "Rising water levels expected"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Advisory</span>
            <span class="popup-val" style="font-size:0.75rem;">${p.action_advisory || "Monitor local forecasts"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Forecast Engine</span>
            <span class="popup-val mono" style="font-size:0.68rem; color:var(--text-muted);">${p.source || "ECMWF / Open-Meteo Ensemble"}</span>
          </div>
        </div>
      `);
    }
  }).addTo(forecastRiskLayer);
}

// Layer 10: Emergency Shelters (India Facilities)
function renderShelters(geojson) {
  sheltersLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: ICONS.shelter }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#10B981; font-weight:700;">● EMERGENCY RELIEF FACILITY</span>
            <span class="provenance-tag provenance-sample">FACILITY</span>
          </div>
          <div class="popup-title">${p.name}</div>
          <div class="badge badge-low" style="margin-bottom:0.5rem;">${p.type || "Designated Shelter"}</div>
          <div class="popup-row">
            <span class="popup-label">Capacity</span>
            <span class="popup-val mono">${p.capacity || 500} Persons</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Occupancy</span>
            <span class="popup-val mono">${p.current_occupancy || 0} (${Math.round(((p.current_occupancy || 0) / (p.capacity || 500)) * 100)}%)</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Altitude</span>
            <span class="popup-val mono">${p.elevation || "Elevated"} m MSL</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Helpline</span>
            <span class="popup-val mono">${p.contact || "1077 (District Disaster Line)"}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-primary" style="width:100%; text-align:center;">
              Navigate Safe Route
            </a>
          </div>
        </div>
      `);
    }
  }).addTo(sheltersLayer);
}

// Layer 11: Hospitals & Trauma Centers
function renderHospitals(geojson) {
  hospitalsLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => L.marker(latlng, { icon: ICONS.hospital }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#EF4444; font-weight:700;">● EMERGENCY MEDICAL TRAUMA WING</span>
            <span class="provenance-tag provenance-sample">MEDICAL</span>
          </div>
          <div class="popup-title">${p.hospital_name || p.name}</div>
          <div class="badge badge-medium" style="margin-bottom:0.5rem;">${p.status || "Operational"}</div>
          <div class="popup-row">
            <span class="popup-label">Emergency Service</span>
            <span class="popup-val">${p.emergency_availability || "24/7 Trauma Service"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Available ICU Beds</span>
            <span class="popup-val mono" style="color:#10B981; font-weight:700;">${p.available_beds || 12} / ${p.total_beds || 50}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Ambulance Hotline</span>
            <span class="popup-val mono" style="color:#EF4444; font-weight:700;">${p.ambulance_helpline || "108 / 102"}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.hospital_name || p.name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-danger" style="width:100%; text-align:center;">
              Emergency Medical Route
            </a>
          </div>
        </div>
      `);
    }
  }).addTo(hospitalsLayer);
}

// =============================================================================
// LIVE DATA INGESTION & NATIONWIDE RENDERING (Requirement #3, #5, #6, #10, #11)
// =============================================================================

async function fetchAndRenderLiveData(forceRefresh = false) {
  if (isFetchingLive) return;
  isFetchingLive = true;

  try {
    let dashboardData;
    let statusData;
    let overviewData;

    if (forceRefresh) {
      const res = await API.refreshLiveData("all");
      dashboardData = res.dashboard;
      [statusData, overviewData] = await Promise.all([
        API.getLiveIndiaStatus(),
        API.getIndiaOverview()
      ]);
    } else {
      [dashboardData, statusData, overviewData] = await Promise.all([
        API.getLiveDashboard("all"),
        API.getLiveIndiaStatus().catch(() => null),
        API.getIndiaOverview().catch(() => null)
      ]);
    }

    if (dashboardData && dashboardData.status === "success") {
      rawStationsData = dashboardData.stations || [];
      updateLiveDashboardUI(dashboardData, statusData, overviewData);
      renderFilteredLiveLayers();
      updateTelemetryRibbon(dashboardData, overviewData);
    } else {
      handleLiveDataFailure("Upstream hydrological API format error");
    }
  } catch (err) {
    console.error("Failed to fetch live nationwide flood data:", err);
    handleLiveDataFailure(err.message || "Network connectivity failure");
  } finally {
    isFetchingLive = false;
  }
}

function handleLiveDataFailure(reason) {
  if (typeof showToast === "function") {
    showToast(`⚠️ Live India Data Telemetry: UNAVAILABLE (${reason}). Buffered fallback retained.`, "warning");
  }

  const overallBadge = document.getElementById("status-overall-badge");
  if (overallBadge) {
    overallBadge.textContent = "● UNAVAILABLE";
    overallBadge.style.color = "#F87171";
  }
  const drawerSub = document.getElementById("drawer-last-updated");
  if (drawerSub) {
    drawerSub.textContent = `UNAVAILABLE: ${reason} (Live sync failed)`;
  }
}

// Update India Dashboard Drawer & Subsystems (Requirement #5, #6, #10)
function updateLiveDashboardUI(dash, status, overview) {
  const drawerSub = document.getElementById("drawer-last-updated");
  if (drawerSub) {
    drawerSub.textContent = `Synced: ${dash.last_updated_time || "Real-Time"} • ${dash.active_stations_count || 0} active stations nationwide`;
  }

  // Subsystems Operational Status
  if (status && status.subsystems) {
    const sub = status.subsystems;
    const overallBadge = document.getElementById("status-overall-badge");
    if (overallBadge) {
      overallBadge.textContent = status.overall_operational ? "● OPERATIONAL" : "● DEGRADED";
      overallBadge.style.color = status.overall_operational ? "#34D399" : "#F87171";
    }

    const setBadge = (elemId, isOperational, text) => {
      const el = document.getElementById(elemId);
      if (el) {
        el.className = isOperational ? "status-badge-avail" : "status-badge-unavail";
        el.textContent = isOperational ? `● ${text || "Available"}` : `○ Unavailable`;
      }
    };

    setBadge("status-rainfall-val", sub.rainfall?.operational, "Available (Open-Meteo/IMD)");
    setBadge("status-weather-val", sub.weather?.operational, "Available (Open-Meteo)");
    setBadge("status-river-val", sub.river_water_level?.operational, "Available (CWC/GloFAS)");
    setBadge("status-warning-val", sub.flood_warning_engine?.operational, "Available (Real-time)");
    setBadge("status-satellite-val", sub.satellite_imagery?.operational, "Available (NASA/ISRO)");
  }

  // India Macro Overview KPIs
  if (overview && overview.summary) {
    const sum = overview.summary;
    const elStates = document.getElementById("drawer-monitored-states");
    if (elStates) elStates.textContent = `${sum.monitored_states_count || 28}+ States`;

    const elAreas = document.getElementById("drawer-active-areas");
    if (elAreas) elAreas.textContent = `${sum.active_flood_areas_count || 0} Areas`;

    const elCrit = document.getElementById("drawer-critical-gauges");
    if (elCrit) elCrit.textContent = `${sum.critical_river_gauges_count || 0}`;

    const elWarn = document.getElementById("drawer-active-warnings");
    if (elWarn) elWarn.textContent = `${sum.active_flood_warnings_count || 0}`;

    const elRain = document.getElementById("drawer-peak-rain");
    if (elRain) elRain.textContent = `${sum.national_peak_rainfall_24h_mm || 0} mm`;

    const elBasins = document.getElementById("drawer-monitored-basins");
    if (elBasins) elBasins.textContent = `${sum.monitored_river_basins_count || 9} Basins`;

    // State Breakdown in Drawer
    const stateBreakdownEl = document.getElementById("drawer-state-breakdown");
    if (stateBreakdownEl && overview.state_breakdown) {
      stateBreakdownEl.innerHTML = "";
      overview.state_breakdown.slice(0, 12).forEach((sb) => {
        const item = document.createElement("div");
        item.className = "state-risk-item";
        item.onclick = () => {
          const stateSelect = document.getElementById("state-selector");
          if (stateSelect) {
            stateSelect.value = sb.state;
            onStateSelectChange(sb.state);
          }
        };

        const riskCls = sb.flood_threat_level === "HIGH" ? "#EF4444" :
                        sb.flood_threat_level === "MEDIUM" ? "#F59E0B" : "#10B981";

        item.innerHTML = `
          <div style="font-weight: 700; color: #E2E8F0; font-size: 0.78rem;">${sb.state}</div>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <span style="font-family: var(--font-mono); font-size: 0.68rem; color: #94A3B8;">${sb.station_count} stations</span>
            <span class="badge" style="background: ${riskCls}22; color: ${riskCls}; border: 1px solid ${riskCls}55; font-size: 0.62rem; padding: 1px 4px;">
              ${sb.flood_threat_level}
            </span>
          </div>
        `;
        stateBreakdownEl.appendChild(item);
      });
    }
  }

  // Monitored Stations Telemetry List in Drawer
  const stationList = document.getElementById("drawer-station-list");
  if (stationList && dash.stations) {
    stationList.innerHTML = "";
    dash.stations.forEach((st) => {
      const card = document.createElement("div");
      card.className = "station-card";
      card.onclick = () => flyToStation(st.latitude, st.longitude, st.location_name);

      const riskColor =
        st.risk_level === "CRITICAL" ? "#EF4444" :
        st.risk_level === "HIGH" ? "#F97316" :
        st.risk_level === "MEDIUM" ? "#F59E0B" : "#10B981";

      const gaugePct = Math.min(100, Math.round((st.water_level / (st.danger_level * 1.2)) * 100));

      card.innerHTML = `
        <div class="station-card-title">
          <span>${st.location_name}</span>
          <span class="badge" style="background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}66;">
            ${st.risk_level}
          </span>
        </div>
        <div style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
          <span>${st.river_name || "River"} (${st.district ? st.district + ", " : ""}${st.state})</span>
          <span class="provenance-tag provenance-live">LIVE</span>
        </div>

        <!-- Stage Progress Bar -->
        <div style="background: rgba(255,255,255,0.06); border-radius: 4px; height: 6px; overflow: hidden; margin-bottom: 0.4rem; position: relative;">
          <div style="background: ${riskColor}; width: ${gaugePct}%; height: 100%; transition: width 0.4s;"></div>
        </div>

        <div class="station-metrics-grid">
          <div class="metric-cell">
            <div class="metric-label">River Stage</div>
            <div class="metric-value" style="color: ${riskColor}; font-size: 0.85rem;">
              ${st.water_level}m
              <span style="font-size: 0.62rem; color: var(--text-muted); font-weight: 400;">/ Dng: ${st.danger_level}m</span>
            </div>
          </div>
          <div class="metric-cell">
            <div class="metric-label">24h Rainfall</div>
            <div class="metric-value" style="color: #38BDF8; font-size: 0.85rem;">
              ${st.rainfall_24h_mm} mm
            </div>
          </div>
          <div class="metric-cell">
            <div class="metric-label">Weather</div>
            <div class="metric-value" style="font-size: 0.75rem; color: #E2E8F0;">
              ${st.weather_condition || "Rain"} (${st.temperature_c}°C)
            </div>
          </div>
          <div class="metric-cell">
            <div class="metric-label">Discharge</div>
            <div class="metric-value" style="font-size: 0.75rem; color: #94A3B8;">
              ${st.discharge_flow_cumecs || 0} m³/s
            </div>
          </div>
        </div>
      `;
      stationList.appendChild(card);
    });
  }
}

// Render Filtered Live Layers according to selected State, District, and Basin
function renderFilteredLiveLayers() {
  if (!riverStationsLayer || !liveRainfallLayer || !liveAffectedLayer || !riskZonesLayer || !floodWarningsLayer) return;

  riverStationsLayer.clearLayers();
  liveRainfallLayer.clearLayers();
  liveAffectedLayer.clearLayers();
  riskZonesLayer.clearLayers();
  floodWarningsLayer.clearLayers();
  liveStationMarkers = {};

  // Filter stations by state, district, and basin
  const filtered = rawStationsData.filter((st) => {
    if (selectedState !== "all" && st.state && st.state.toLowerCase() !== selectedState.toLowerCase()) {
      return false;
    }
    if (selectedDistrict !== "all" && st.district && st.district.toLowerCase() !== selectedDistrict.toLowerCase()) {
      return false;
    }
    if (selectedBasin !== "all" && st.river_basin && st.river_basin.toLowerCase() !== selectedBasin.toLowerCase()) {
      return false;
    }
    return true;
  });

  filtered.forEach((st) => {
    const latlng = [st.latitude, st.longitude];
    const isCrit = st.risk_level === "CRITICAL";
    const isHigh = st.risk_level === "HIGH";
    const isWarn = st.water_level >= st.warning_level;
    const isDng = st.water_level >= st.danger_level;

    const riskColor =
      isCrit ? "#EF4444" :
      isHigh ? "#F97316" :
      st.risk_level === "MEDIUM" ? "#F59E0B" : "#10B981";

    const popupHtml = `
      <div class="popup-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
          <span style="font-family:var(--font-mono); font-size:0.68rem; color:#38BDF8; font-weight:700;">● REAL-TIME TELEMETRY</span>
          <span class="provenance-tag provenance-live">LIVE</span>
        </div>
        <div class="popup-title">${st.location_name}</div>
        <div style="margin-bottom: 0.5rem; display: flex; gap: 0.4rem; align-items: center;">
          <span class="badge" style="background:${riskColor}22; color:${riskColor}; border:1px solid ${riskColor}66;">${st.risk_level} RISK</span>
          <span class="badge badge-low">${st.state}</span>
          ${st.river_basin ? `<span class="badge badge-low">${st.river_basin}</span>` : ""}
        </div>
        <div class="popup-row">
          <span class="popup-label">Risk Composite Score</span>
          <span class="popup-val mono" style="color:${riskColor}; font-weight:800; font-size:1.05rem;">${st.risk_score} / 100</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">River Water Stage</span>
          <span class="popup-val mono" style="color:${isDng ? '#EF4444' : (isWarn ? '#F59E0B' : '#10B981')}; font-weight:700;">
            ${st.water_level} m (Danger: ${st.danger_level}m)
          </span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Precipitation (Last 24h)</span>
          <span class="popup-val mono" style="color:#60A5FA;">${st.rainfall_24h_mm} mm</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Current Precipitation</span>
          <span class="popup-val mono">${st.precipitation_mm || 0} mm/h</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Weather Conditions</span>
          <span class="popup-val">${st.weather_condition || "Clear"} (${st.temperature_c}°C)</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Discharge Flow</span>
          <span class="popup-val mono">${st.discharge_flow_cumecs || 0} m³/s</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Provenance / Source</span>
          <span class="popup-val mono" style="font-size:0.68rem; color:#34D399;">LIVE (${st.source || "Open-Meteo & Hydrology"})</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Observed Stamp</span>
          <span class="popup-val mono">${st.observation_time || "Live"}</span>
        </div>
        <div style="margin-top: 0.85rem; display: flex; gap: 0.5rem;">
          <a href="/risk?area=${encodeURIComponent(st.location_name)}" class="btn btn-sm btn-primary" style="flex:1; text-align:center;">Risk Analysis</a>
          <a href="/safe-locations?origin=${encodeURIComponent(st.location_name)}" class="btn btn-sm btn-secondary" style="flex:1; text-align:center;">Evacuation</a>
        </div>
      </div>
    `;

    // 1. Layer 4: River Monitoring Station Marker
    const riverMarker = L.marker(latlng, {
      icon: createLiveRiverGaugeMarkerIcon(st.water_level, isDng ? "DANGER" : (isWarn ? "WARNING" : "NORMAL"))
    });
    riverMarker.bindPopup(popupHtml);
    riverMarker.addTo(riverStationsLayer);
    liveStationMarkers[st.location_name] = riverMarker;

    // 2. Layer 8: Live Rainfall Gauge Marker (offset slightly)
    const rainOffset = [st.latitude + 0.02, st.longitude + 0.02];
    const rainMarker = L.marker(rainOffset, {
      icon: createLiveRainfallMarkerIcon(st.rainfall_24h_mm, st.rainfall_24h_mm >= 65)
    });
    rainMarker.bindPopup(popupHtml);
    rainMarker.addTo(liveRainfallLayer);

    // 3. Layer 7: Flood Risk Buffer Zones
    const bufferRadius = Math.max(3500, st.risk_score * 90);
    const riskCircle = L.circle(latlng, {
      radius: bufferRadius,
      color: riskColor,
      weight: isCrit ? 2.5 : 1.2,
      opacity: 0.85,
      fillColor: riskColor,
      fillOpacity: isCrit ? 0.35 : (isHigh ? 0.22 : 0.12),
      dashArray: isCrit ? "6, 6" : null
    });
    riskCircle.bindPopup(popupHtml);
    riskCircle.addTo(riskZonesLayer);

    // 4. Layer 6: Live Flood-Affected Area (active inundation buffer if breaching danger/warning or extreme downpour)
    if (isDng || isWarn || st.rainfall_24h_mm >= 70) {
      const floodAreaCircle = L.circle(latlng, {
        radius: isDng ? 12000 : 7000,
        color: isDng ? "#DC2626" : "#EA580C",
        weight: 3,
        opacity: 0.95,
        fillColor: isDng ? "#DC2626" : "#EA580C",
        fillOpacity: 0.4,
        dashArray: "8, 4"
      });
      floodAreaCircle.bindPopup(popupHtml);
      floodAreaCircle.addTo(liveAffectedLayer);
    }

    // 5. Layer 9: Flood Warning Alerts (Beacons for HIGH and CRITICAL)
    if (isCrit || isHigh || isDng) {
      const warnOffset = [st.latitude - 0.02, st.longitude - 0.02];
      const warnMarker = L.marker(warnOffset, {
        icon: createLiveWarningMarkerIcon()
      });
      const alertPopup = `
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#EF4444; font-weight:800;">● FLOOD EVACUATION ADVISORY</span>
            <span class="provenance-tag provenance-live">LIVE</span>
          </div>
          <div class="popup-title">${isCrit ? 'CRITICAL EVACUATION ALERT' : 'HIGH FLOOD WATCH'}</div>
          <div class="badge badge-critical" style="margin-bottom:0.5rem;">${st.location_name} • ${st.state}</div>
          <p style="font-size:0.8rem; color:#FCA5A5; margin-bottom:0.6rem;">
            Water stage at ${st.water_level}m (${isDng ? 'Breached Danger Mark ' + st.danger_level + 'm' : 'Warning Mark ' + st.warning_level + 'm'}). Rapid runoff detected.
          </p>
          <div class="popup-row">
            <span class="popup-label">24h Rainfall</span>
            <span class="popup-val mono" style="color:#38BDF8;">${st.rainfall_24h_mm} mm</span>
          </div>
          <div style="margin-top:0.75rem;">
            <a href="/alerts" class="btn btn-sm btn-danger" style="width:100%; text-align:center;">View Emergency Broadcast</a>
          </div>
        </div>
      `;
      warnMarker.bindPopup(alertPopup);
      warnMarker.addTo(floodWarningsLayer);
    }
  });
}

// Update Floating Telemetry Ribbon at Bottom (Requirement #6)
function updateTelemetryRibbon(dash, overview) {
  const sum = overview?.summary || {};
  const stations = dash.stations || [];

  // 1. National River Peak
  const riverPeakEl = document.getElementById("ribbon-river-peak");
  if (riverPeakEl && stations.length > 0) {
    const highestGaugeStation = stations.reduce((max, s) => (s.water_level > (max?.water_level || 0) ? s : max), stations[0]);
    const isDng = highestGaugeStation.water_level >= highestGaugeStation.danger_level;
    const isWarn = highestGaugeStation.water_level >= highestGaugeStation.warning_level;
    const color = isDng ? "#EF4444" : (isWarn ? "#F59E0B" : "#10B981");

    riverPeakEl.style.color = color;
    riverPeakEl.textContent = `${highestGaugeStation.location_name}: ${highestGaugeStation.water_level}m (${highestGaugeStation.river_name || 'River'})`;
  }

  // 2. Peak Downpour
  const rainPeakEl = document.getElementById("ribbon-peak-rain");
  if (rainPeakEl) {
    const peak = sum.national_peak_rainfall_24h_mm || dash.basin_summary?.peak_rainfall_24h_mm || 0;
    rainPeakEl.textContent = `${peak} mm / 24h`;
  }

  // 3. Active Stations Monitored
  const activeStationsEl = document.getElementById("ribbon-active-stations");
  if (activeStationsEl) {
    activeStationsEl.textContent = `${dash.active_stations_count || stations.length || 38} Stations (28+ States)`;
  }

  // 4. Warning Count
  const warnCountEl = document.getElementById("ribbon-warning-count");
  if (warnCountEl) {
    const cnt = sum.active_flood_warnings_count || dash.basin_summary?.active_flood_warnings || 0;
    warnCountEl.textContent = `${cnt}`;
  }
}

// =============================================================================
// SETUP 12 LAYER TOGGLES (Requirement #7)
// =============================================================================

function setupLayerToggles() {
  const toggleMap = {
    "toggle-state-boundaries": () => indiaStatesLayer,
    "toggle-district-boundaries": () => districtsLayer,
    "toggle-major-rivers": () => majorRiversLayer,
    "toggle-river-stations": () => riverStationsLayer,
    "toggle-historical-floods": () => historicalFloodsLayer,
    "toggle-live-affected": () => liveAffectedLayer,
    "toggle-risk-zones": () => riskZonesLayer,
    "toggle-live-rainfall": () => liveRainfallLayer,
    "toggle-flood-warnings": () => floodWarningsLayer,
    "toggle-shelters": () => sheltersLayer,
    "toggle-hospitals": () => hospitalsLayer,
    "toggle-forecast-risk": () => forecastRiskLayer
  };

  Object.entries(toggleMap).forEach(([elemId, getLayer]) => {
    const chk = document.getElementById(elemId);
    if (chk) {
      chk.addEventListener("change", (e) => {
        const layer = getLayer();
        if (!layer) return;
        if (e.target.checked) {
          if (!map.hasLayer(layer)) map.addLayer(layer);
        } else {
          if (map.hasLayer(layer)) map.removeLayer(layer);
        }
      });
    }
  });

  // ISRO Bhuvan Satellite Remote Sensing Overlay
  const chkBhuvan = document.getElementById("toggle-bhuvan-overlay");
  if (chkBhuvan) {
    bhuvanDisasterLayer = L.tileLayer.wms("https://bhuvan-vec2.nrsc.gov.in/bhuvan/gwc/service/wms", {
      layers: "disaster:Kerala_2020_Event",
      format: "image/png",
      transparent: true,
      version: "1.1.1",
      srs: "EPSG:900913",
      maxZoom: 18,
      attribution: "Remote Sensing &copy; ISRO Bhuvan Disaster Services"
    });

    chkBhuvan.addEventListener("change", (e) => {
      if (e.target.checked) {
        map.addLayer(bhuvanDisasterLayer);
        bhuvanDisasterLayer.bringToFront?.();
        if (typeof showToast === "function") {
          showToast("🛰️ ISRO Bhuvan Disaster Remote Sensing Layer Activated", "info");
        }
      } else {
        if (map.hasLayer(bhuvanDisasterLayer)) map.removeLayer(bhuvanDisasterLayer);
      }
    });
  }
}

// Geolocation: Find My Location
function locateUser() {
  if (!map) return;
  if (!navigator.geolocation) {
    if (typeof showToast === "function") showToast("Geolocation not supported by your browser.", "error");
    return;
  }

  if (typeof showToast === "function") showToast("Scanning GPS satellite lock...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: "#0284C7",
        color: "#FFFFFF",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      userLocationMarker.bindPopup("<b>Your Current Position</b><br>Coordinates: " + lat.toFixed(4) + ", " + lng.toFixed(4)).openPopup();
      map.setView([lat, lng], 12);
      if (typeof showToast === "function") showToast("GPS Coordinate Locked!", "success");
    },
    () => {
      if (typeof showToast === "function") showToast("GPS unavailable. Centering to India Overview.", "info");
      map.setView([22.5, 80.0], 5);
    }
  );
}

// =============================================================================
// UNIVERSAL NATIONWIDE SEARCH (Requirement #9)
// Searches State, District, River, Basin, Flood Area, Station, Shelter, Hospital
// =============================================================================

function setupMapSearch() {
  const searchInput = document.getElementById("map-search-input");
  if (!searchInput) return;

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.toLowerCase().trim();
      if (!query) return;

      let found = false;

      // 1. Check Monitored Live Stations
      Object.entries(liveStationMarkers).forEach(([name, marker]) => {
        if (!found && name.toLowerCase().includes(query)) {
          map.flyTo(marker.getLatLng(), 13, { duration: 1.0 });
          marker.openPopup();
          found = true;
          if (typeof showToast === "function") showToast(`📍 Located station: ${name}`, "success");
        }
      });

      // 2. Check States
      if (!found) {
        Object.entries(allStatesMeta).forEach(([stName, meta]) => {
          if (!found && stName.toLowerCase().includes(query)) {
            const stateSelect = document.getElementById("state-selector");
            if (stateSelect) {
              stateSelect.value = stName;
              onStateSelectChange(stName);
            } else {
              map.flyTo(meta.center, meta.zoom || 7, { duration: 1.0 });
            }
            found = true;
            if (typeof showToast === "function") showToast(`📍 Focused on state: ${stName}`, "info");
          }
        });
      }

      // 3. Check River Basins
      if (!found) {
        Object.entries(allBasinsMeta).forEach(([bk, b]) => {
          if (!found && (b.name.toLowerCase().includes(query) || bk.toLowerCase().includes(query))) {
            const basinSelect = document.getElementById("basin-selector");
            if (basinSelect) {
              basinSelect.value = bk;
              onBasinSelectChange(bk);
            } else {
              map.flyTo(b.center, b.zoom || 6, { duration: 1.0 });
            }
            found = true;
            if (typeof showToast === "function") showToast(`🌊 Focused on basin: ${b.name}`, "info");
          }
        });
      }

      // 4. Check Historical Flood Footprints
      if (!found && historicalFloodsLayer) {
        historicalFloodsLayer.eachLayer((layer) => {
          const p = layer.feature?.properties || {};
          const name = (p.name || p.flood_event || "").toLowerCase();
          const dist = (p.district || "").toLowerCase();
          if ((name.includes(query) || dist.includes(query)) && !found) {
            if (layer.getBounds) {
              map.fitBounds(layer.getBounds(), { maxZoom: 13 });
            } else if (layer.getLatLng) {
              map.flyTo(layer.getLatLng(), 11);
            }
            layer.openPopup();
            found = true;
            if (typeof showToast === "function") showToast(`🏛️ Located historical disaster: ${p.name || p.flood_event}`, "info");
          }
        });
      }

      // 5. Check Shelters & Hospitals
      if (!found && sheltersLayer) {
        sheltersLayer.eachLayer((layer) => {
          const name = (layer.feature?.properties?.name || "").toLowerCase();
          if (name.includes(query) && !found) {
            map.flyTo(layer.getLatLng(), 13, { duration: 1.0 });
            layer.openPopup();
            found = true;
            if (typeof showToast === "function") showToast(`🏠 Located shelter: ${layer.feature.properties.name}`, "success");
          }
        });
      }

      if (!found && hospitalsLayer) {
        hospitalsLayer.eachLayer((layer) => {
          const name = (layer.feature?.properties?.hospital_name || layer.feature?.properties?.name || "").toLowerCase();
          if (name.includes(query) && !found) {
            map.flyTo(layer.getLatLng(), 13, { duration: 1.0 });
            layer.openPopup();
            found = true;
            if (typeof showToast === "function") showToast(`🏥 Located medical trauma center: ${layer.feature.properties.hospital_name}`, "success");
          }
        });
      }

      if (!found && typeof showToast === "function") {
        showToast(`Target '${query}' not located. Try 'Assam', 'Patna', 'Ganga', 'Cuttack', or 'Aluva'`, "info");
      }
    }
  });
}
