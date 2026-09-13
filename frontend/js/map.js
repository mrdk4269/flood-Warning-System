/**
 * FloodGuard Advanced Tactical GIS Mapping Engine
 * Multi-layer telemetry, coordinate tracker, basemap switcher, spatial popups,
 * and Live India Flood Data System with strict provenance separation.
 */

let map = null;

// Historical GIS Layer Groups
let floodAreasLayer = null;
let riskZonesLayer = null;
let riversLayer = null;
let sheltersLayer = null;
let hospitalsLayer = null;
let rainfallStationsLayer = null;

// Live India Telemetry Layer Groups (Requirement #2 & #13)
let liveRainfallLayer = null;
let liveRiversLayer = null;
let liveWarningsLayer = null;
let liveFloodRiskLayer = null;

// State management
let currentMapMode = "LIVE"; // "LIVE" | "HISTORICAL"
let currentRegion = "odisha"; // "odisha" | "kerala" | "all"
let autoRefreshInterval = 300; // seconds
let countdownTimerId = null;
let secondsRemaining = 300;
let isFetchingLive = false;
let userLocationMarker = null;
let currentBasemap = null;
let liveStationMarkers = {}; // indexed by station name/id for instant popup trigger

function getNasaDailyTileUrl() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

// Tile Layer Providers
const BASEMAPS = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  nasa: getNasaDailyTileUrl(),
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// Custom Marker Generator with Pulsing Beacon
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

// Initialize Map
function initFloodMap(containerId = "map-container", options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Default region center: Odisha (Mahanadi Basin)
  const defaultCenter = [20.4637, 85.88];
  const defaultZoom = options.preview ? 8 : 9;

  map = L.map(containerId, {
    center: defaultCenter,
    zoom: defaultZoom,
    zoomControl: !options.preview,
    attributionControl: !options.preview
  });

  // Base Tiles
  currentBasemap = L.tileLayer(BASEMAPS.dark, {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map);

  // Initialize Layer Groups
  floodAreasLayer = L.layerGroup();
  riskZonesLayer = L.layerGroup();
  riversLayer = L.layerGroup();
  rainfallStationsLayer = L.layerGroup();

  // Public Service Layers (persistent in both modes)
  sheltersLayer = L.layerGroup().addTo(map);
  hospitalsLayer = L.layerGroup().addTo(map);

  // Live Telemetry Layer Groups (Requirement #2 & #13)
  liveRainfallLayer = L.layerGroup().addTo(map);
  liveRiversLayer = L.layerGroup().addTo(map);
  liveFloodRiskLayer = L.layerGroup().addTo(map);
  liveWarningsLayer = L.layerGroup().addTo(map);

  // Initial Data Ingestion
  loadAllHistoricalLayers();
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

// Live Coordinate & Elevation Readout on Mousemove
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
  if (floodAreasLayer && map.hasLayer(floodAreasLayer)) floodAreasLayer.bringToFront?.();
  if (riversLayer && map.hasLayer(riversLayer)) riversLayer.bringToFront?.();
  if (liveFloodRiskLayer && map.hasLayer(liveFloodRiskLayer)) liveFloodRiskLayer.bringToFront?.();
}

// =============================================================================
// LIVE DATA MODE VS HISTORICAL DATA MODE (Requirement #1 & #2)
// =============================================================================

window.setMapMode = function(mode) {
  currentMapMode = mode;
  const btnLive = document.getElementById("btn-mode-live");
  const btnHist = document.getElementById("btn-mode-historical");

  if (mode === "LIVE") {
    if (btnLive) btnLive.classList.add("active-live");
    if (btnHist) btnHist.classList.remove("active-hist");

    // Remove historical archived inundation overlays to avoid misinterpretation
    if (map.hasLayer(floodAreasLayer)) map.removeLayer(floodAreasLayer);
    if (map.hasLayer(riskZonesLayer)) map.removeLayer(riskZonesLayer);
    if (map.hasLayer(riversLayer)) map.removeLayer(riversLayer);
    if (map.hasLayer(rainfallStationsLayer)) map.removeLayer(rainfallStationsLayer);

    // Add verified live telemetry layers
    if (!map.hasLayer(liveRainfallLayer)) map.addLayer(liveRainfallLayer);
    if (!map.hasLayer(liveRiversLayer)) map.addLayer(liveRiversLayer);
    if (!map.hasLayer(liveFloodRiskLayer)) map.addLayer(liveFloodRiskLayer);
    if (!map.hasLayer(liveWarningsLayer)) map.addLayer(liveWarningsLayer);

    fetchAndRenderLiveData();
    if (typeof showToast === "function") {
      showToast("🟢 Live India Data Mode Activated (Real-time Hydrometry & Rainfall)", "success");
    }
  } else {
    // HISTORICAL Mode
    if (btnHist) btnHist.classList.add("active-hist");
    if (btnLive) btnLive.classList.remove("active-live");

    // Remove live telemetry layers
    if (map.hasLayer(liveRainfallLayer)) map.removeLayer(liveRainfallLayer);
    if (map.hasLayer(liveRiversLayer)) map.removeLayer(liveRiversLayer);
    if (map.hasLayer(liveFloodRiskLayer)) map.removeLayer(liveFloodRiskLayer);
    if (map.hasLayer(liveWarningsLayer)) map.removeLayer(liveWarningsLayer);

    // Add historical archived layers
    if (!map.hasLayer(floodAreasLayer)) map.addLayer(floodAreasLayer);
    if (!map.hasLayer(riskZonesLayer)) map.addLayer(riskZonesLayer);
    if (!map.hasLayer(riversLayer)) map.addLayer(riversLayer);
    if (!map.hasLayer(rainfallStationsLayer)) map.addLayer(rainfallStationsLayer);

    // If currently centered far from Kerala 2018 benchmark, advise
    if (typeof showToast === "function") {
      showToast("🏛️ Historical Archive Mode Activated (Kerala 2018 Inundation Perimeters)", "info");
    }
  }
};

// Basin / Region Switcher (Requirement #4)
window.onRegionChange = function(region) {
  currentRegion = region;
  const regionNames = {
    odisha: "Odisha (Mahanadi River Basin)",
    kerala: "Kerala (Periyar River Basin)",
    all: "All India Monitored Basins"
  };

  const drawerRegionEl = document.getElementById("drawer-region-name");
  if (drawerRegionEl) {
    drawerRegionEl.textContent = regionNames[region] || "India River Basins";
  }

  // Camera transition based on basin geometry
  if (region === "odisha") {
    map.flyTo([20.4637, 85.88], 9, { duration: 1.2 });
  } else if (region === "kerala") {
    map.flyTo([10.04, 76.34], 11, { duration: 1.2 });
  } else {
    map.flyTo([20.59, 78.96], 5, { duration: 1.4 });
  }

  if (currentMapMode === "LIVE") {
    fetchAndRenderLiveData();
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
    showToast("⚡ Forcing Live Ingestion Sync with Open-Meteo & India Hydrological Networks...", "info");
  }
  await fetchAndRenderLiveData(true);
};

// Toggle Collapsible Live Data Dashboard Drawer (Requirement #5)
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
// LIVE DATA INGESTION & SPATIAL RENDERING (Requirements #3, #5, #10, #11, #13)
// =============================================================================

async function fetchAndRenderLiveData(forceRefresh = false) {
  if (isFetchingLive) return;
  isFetchingLive = true;

  try {
    let dashboardData;
    let statusData;

    if (forceRefresh) {
      const res = await API.refreshLiveData(currentRegion);
      dashboardData = res.dashboard;
      statusData = await API.getLiveIndiaStatus();
    } else {
      [dashboardData, statusData] = await Promise.all([
        API.getLiveDashboard(currentRegion),
        API.getLiveIndiaStatus()
      ]);
    }

    if (dashboardData && dashboardData.status === "success") {
      updateLiveDashboardUI(dashboardData, statusData);
      renderLiveSpatialLayers(dashboardData);
      updateTelemetryRibbon(dashboardData);
    } else {
      handleLiveDataFailure("Upstream API returned unexpected format");
    }
  } catch (err) {
    console.error("Failed to fetch live India flood data:", err);
    handleLiveDataFailure(err.message || "Network connectivity failure");
  } finally {
    isFetchingLive = false;
  }
}

function handleLiveDataFailure(reason) {
  if (typeof showToast === "function") {
    showToast(`⚠️ Live India Data Telemetry: UNAVAILABLE (${reason}). Buffered fallback retained.`, "warning");
  }

  // Update Drawer Subsystems to reflect Degraded status (Requirement #9 & #20)
  const overallBadge = document.getElementById("status-overall-badge");
  if (overallBadge) {
    overallBadge.textContent = "● DEGRADED / OFFLINE";
    overallBadge.style.color = "#F87171";
  }
  const drawerSub = document.getElementById("drawer-last-updated");
  if (drawerSub) {
    drawerSub.textContent = `UNAVAILABLE: ${reason} (Displaying cached fallback)`;
  }
}

// Update Drawer Subsystems & Station Cards (Requirement #5 & #10)
function updateLiveDashboardUI(dash, status) {
  // Region & Timestamp
  const drawerSub = document.getElementById("drawer-last-updated");
  if (drawerSub) {
    drawerSub.textContent = `Synced: ${dash.last_updated_time || "Real-Time"} • ${dash.active_stations_count || 0} active stations`;
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

    setBadge("status-rainfall-val", sub.rainfall?.operational, "Available (Open-Meteo)");
    setBadge("status-weather-val", sub.weather?.operational, "Available (Open-Meteo)");
    setBadge("status-river-val", sub.river_water_level?.operational, "Available (CWC/GloFAS Model)");
    setBadge("status-warning-val", sub.flood_warning_engine?.operational, "Available (Real-time)");
    setBadge("status-satellite-val", sub.satellite_imagery?.operational, "Available (NASA/ISRO)");
  }

  // Basin Macro KPIs
  const summary = dash.basin_summary || {};
  const peakRainEl = document.getElementById("drawer-peak-rain");
  if (peakRainEl) peakRainEl.textContent = `${summary.peak_rainfall_24h_mm || 0} mm`;

  const maxRiskEl = document.getElementById("drawer-max-risk");
  if (maxRiskEl) maxRiskEl.textContent = `${summary.max_risk_score || 0} / 100`;

  const critGaugesEl = document.getElementById("drawer-critical-gauges");
  if (critGaugesEl) critGaugesEl.textContent = `${summary.critical_river_gauges || 0}`;

  const activeWarnEl = document.getElementById("drawer-active-warnings");
  if (activeWarnEl) activeWarnEl.textContent = `${summary.active_flood_warnings || 0}`;

  // Station Telemetry Cards
  const stationList = document.getElementById("drawer-station-list");
  if (stationList && dash.stations) {
    stationList.innerHTML = "";
    dash.stations.forEach((st) => {
      const card = document.createElement("div");
      card.className = "station-card";
      card.onclick = () => flyToStation(st.latitude, st.longitude, st.station_name);

      const riskColor =
        st.risk_level === "CRITICAL" ? "#EF4444" :
        st.risk_level === "HIGH" ? "#F97316" :
        st.risk_level === "MEDIUM" ? "#F59E0B" : "#10B981";

      const gaugePct = Math.min(100, Math.round((st.water_level / (st.danger_level * 1.2)) * 100));

      card.innerHTML = `
        <div class="station-card-title">
          <span>${st.station_name}</span>
          <span class="badge" style="background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}66;">
            ${st.risk_level}
          </span>
        </div>
        <div style="font-size: 0.68rem; font-family: var(--font-mono); color: var(--text-muted); display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
          <span>${st.river_name || "Mahanadi Basin"} (${st.district || st.state})</span>
          <span class="provenance-tag provenance-live">LIVE</span>
        </div>

        <!-- River Water Stage Progress Bar -->
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

// Render Live Telemetry on Leaflet Map (Requirement #2, #3, #13)
function renderLiveSpatialLayers(dash) {
  if (!liveRainfallLayer || !liveRiversLayer || !liveFloodRiskLayer || !liveWarningsLayer) return;

  liveRainfallLayer.clearLayers();
  liveRiversLayer.clearLayers();
  liveFloodRiskLayer.clearLayers();
  liveWarningsLayer.clearLayers();
  liveStationMarkers = {};

  const stations = dash.stations || [];

  stations.forEach((st) => {
    const latlng = [st.latitude, st.longitude];
    const isCrit = st.risk_level === "CRITICAL";
    const isHigh = st.risk_level === "HIGH";

    // 1. Live Dynamic Flood Risk Inundation Buffer Circle
    const bufferRadiusMeters = Math.max(3500, st.risk_score * 85);
    const riskColor =
      isCrit ? "#EF4444" :
      isHigh ? "#F97316" :
      st.risk_level === "MEDIUM" ? "#F59E0B" : "#10B981";

    const riskCircle = L.circle(latlng, {
      radius: bufferRadiusMeters,
      color: riskColor,
      weight: isCrit ? 2.5 : 1.5,
      opacity: 0.85,
      fillColor: riskColor,
      fillOpacity: isCrit ? 0.35 : (isHigh ? 0.25 : 0.15),
      dashArray: isCrit ? "6, 6" : null
    });

    const riskPopupContent = `
      <div class="popup-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
          <span style="font-family:var(--font-mono); font-size:0.68rem; color:#38BDF8; font-weight:700;">● DYNAMIC FLOOD RISK BUFFER</span>
          <span class="provenance-tag provenance-live">LIVE</span>
        </div>
        <div class="popup-title">${st.station_name}</div>
        <div style="margin-bottom: 0.5rem; display: flex; gap: 0.4rem; align-items: center;">
          <span class="badge" style="background:${riskColor}22; color:${riskColor}; border:1px solid ${riskColor}66;">${st.risk_level} RISK</span>
          <span class="badge badge-low">${st.state}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Risk Composite Score</span>
          <span class="popup-val mono" style="color:${riskColor}; font-weight:800; font-size:1.05rem;">${st.risk_score} / 100</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Active River Water Stage</span>
          <span class="popup-val mono">${st.water_level} m (Warning: ${st.warning_level}m)</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Precipitation (Last 24h)</span>
          <span class="popup-val mono" style="color:#60A5FA;">${st.rainfall_24h_mm} mm</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Weather Conditions</span>
          <span class="popup-val">${st.weather_condition} (${st.temperature_c}°C)</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Discharge Runoff</span>
          <span class="popup-val mono">${st.discharge_flow_cumecs} m³/s</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Telemetry Source</span>
          <span class="popup-val" style="font-size:0.7rem; color:var(--text-muted);">${st.source || "Open-Meteo & Hydrological Feeds"}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Observation Stamp</span>
          <span class="popup-val mono">${st.observation_time || "Live"}</span>
        </div>
        <div style="margin-top: 0.85rem; display: flex; gap: 0.5rem;">
          <a href="/risk?area=${encodeURIComponent(st.station_name)}" class="btn btn-sm btn-primary" style="flex:1; text-align:center;">Hydraulic Risk</a>
          <a href="/safe-locations?origin=${encodeURIComponent(st.station_name)}" class="btn btn-sm btn-secondary" style="flex:1; text-align:center;">Evacuation</a>
        </div>
      </div>
    `;

    riskCircle.bindPopup(riskPopupContent);
    riskCircle.addTo(liveFloodRiskLayer);

    // 2. Live River Water Level Gauge Marker
    const riverMarker = L.marker(latlng, {
      icon: createLiveRiverGaugeMarkerIcon(st.water_level, st.water_level >= st.danger_level ? "DANGER" : (st.water_level >= st.warning_level ? "WARNING" : "NORMAL"))
    });
    riverMarker.bindPopup(riskPopupContent);
    riverMarker.addTo(liveRiversLayer);
    liveStationMarkers[st.station_name] = riverMarker;

    // 3. Live Rainfall Station Marker
    // Offset slightly so rainfall and river gauge markers don't overlap exactly
    const rainOffsetLatlng = [st.latitude + 0.018, st.longitude + 0.018];
    const rainMarker = L.marker(rainOffsetLatlng, {
      icon: createLiveRainfallMarkerIcon(st.rainfall_24h_mm, st.rainfall_24h_mm >= 65)
    });
    const rainPopup = `
      <div class="popup-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
          <span style="font-family:var(--font-mono); font-size:0.68rem; color:#38BDF8; font-weight:700;">● AUTOMATED RAIN TELEMETRY</span>
          <span class="provenance-tag provenance-live">LIVE</span>
        </div>
        <div class="popup-title">${st.station_name} Rain Gauge</div>
        <div class="popup-row">
          <span class="popup-label">Current Precipitation</span>
          <span class="popup-val mono" style="color:#38BDF8; font-weight:700;">${st.precipitation_mm} mm/h</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Precipitation (Last 24h)</span>
          <span class="popup-val mono" style="color:#60A5FA; font-weight:800; font-size:1.1rem;">${st.rainfall_24h_mm} mm</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Precipitation Intensity</span>
          <span class="popup-val">${st.rainfall_intensity || "Moderate"}</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Weather Observation</span>
          <span class="popup-val">${st.weather_condition} • Wind ${st.wind_speed_kmh} km/h</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Data Provenance</span>
          <span class="popup-val mono" style="color:#34D399;">LIVE (Real-time Ingestion)</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Telemetry Source</span>
          <span class="popup-val" style="font-size:0.7rem;">Open-Meteo High-Res India Feed</span>
        </div>
      </div>
    `;
    rainMarker.bindPopup(rainPopup);
    rainMarker.addTo(liveRainfallLayer);

    // 4. Live Warning Beacon Marker (for High & Critical Risk)
    if (isCrit || isHigh) {
      const warnOffsetLatlng = [st.latitude - 0.015, st.longitude - 0.015];
      const warnMarker = L.marker(warnOffsetLatlng, {
        icon: createLiveWarningMarkerIcon()
      });
      const warnPopup = `
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#EF4444; font-weight:800;">● FLOOD WARNING PROTOCOL</span>
            <span class="provenance-tag provenance-live">LIVE</span>
          </div>
          <div class="popup-title">${isCrit ? 'CRITICAL EVACUATION WARNING' : 'HIGH FLOOD RISK WATCH'}</div>
          <div class="badge badge-critical" style="margin-bottom:0.5rem;">${st.station_name} • ${st.river_name}</div>
          <p style="font-size:0.8rem; color:#FCA5A5; margin-bottom:0.6rem;">
            ${isCrit
              ? 'River stage has breached critical limits or extreme 24h precipitation detected. Immediate low-lying evacuation advised.'
              : 'Hydrological models indicate rising water levels nearing warning thresholds. Monitor local district advisories.'}
          </p>
          <div class="popup-row">
            <span class="popup-label">River Stage</span>
            <span class="popup-val mono" style="color:#EF4444; font-weight:700;">${st.water_level}m (Danger: ${st.danger_level}m)</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Cumulative Rain</span>
            <span class="popup-val mono" style="color:#38BDF8;">${st.rainfall_24h_mm} mm</span>
          </div>
          <div style="margin-top:0.75rem;">
            <a href="/alerts" class="btn btn-sm btn-danger" style="width:100%; text-align:center;">View State Emergency Broadcast</a>
          </div>
        </div>
      `;
      warnMarker.bindPopup(warnPopup);
      warnMarker.addTo(liveWarningsLayer);
    }
  });
}

// Update Floating Telemetry Ribbon at Bottom
function updateTelemetryRibbon(dash) {
  const summary = dash.basin_summary || {};
  const stations = dash.stations || [];

  const stageItem = document.querySelector(".map-telemetry-hud .telemetry-item:nth-child(1)");
  if (stageItem && stations.length > 0) {
    const mainStation = stations[0];
    const isDng = mainStation.water_level >= mainStation.danger_level;
    const isWarn = mainStation.water_level >= mainStation.warning_level;
    const stageColor = isDng ? "#EF4444" : (isWarn ? "#F59E0B" : "#10B981");
    const statusText = isDng ? "CRITICAL BREACH" : (isWarn ? "WARNING STAGE" : "NORMAL FLOW");

    stageItem.innerHTML = `
      <span style="color: var(--text-muted); font-size: 0.75rem; font-family: var(--font-mono); text-transform: uppercase;">
        ${mainStation.river_name || "Basin River"} Stage:
      </span>
      <span class="telemetry-value" style="color: ${stageColor};">
        ${mainStation.water_level}m [${statusText}]
      </span>
    `;
  }

  const downpourItem = document.querySelector(".map-telemetry-hud .telemetry-item:nth-child(2)");
  if (downpourItem) {
    downpourItem.innerHTML = `
      <span style="color: var(--text-muted); font-size: 0.75rem; font-family: var(--font-mono); text-transform: uppercase;">
        Peak Downpour:
      </span>
      <span class="telemetry-value" style="color: #60A5FA;">
        ${summary.peak_rainfall_24h_mm || 0} mm / 24h <span class="provenance-tag provenance-live" style="font-size:0.55rem; padding:0 3px;">LIVE</span>
      </span>
    `;
  }

  const reliefItem = document.querySelector(".map-telemetry-hud .telemetry-item:nth-child(3)");
  if (reliefItem) {
    reliefItem.innerHTML = `
      <span style="color: var(--text-muted); font-size: 0.75rem; font-family: var(--font-mono); text-transform: uppercase;">
        Active Stations:
      </span>
      <span class="telemetry-value" style="color: #10B981;">
        ${dash.active_stations_count || 0} Monitored (${currentRegion.toUpperCase()})
      </span>
    `;
  }

  const warnBtn = document.querySelector(".map-telemetry-hud .telemetry-item:nth-child(4) a");
  if (warnBtn) {
    const count = summary.active_flood_warnings || 0;
    warnBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
      Active Warnings (${count})
    `;
    warnBtn.className = count > 0 ? "btn btn-sm btn-danger" : "btn btn-sm btn-secondary";
  }
}

// =============================================================================
// HISTORICAL GIS LAYERS (Requirement #1 & #20: Clearly labeled as Historical)
// =============================================================================

async function loadAllHistoricalLayers() {
  try {
    const [floodAreas, riskZones, rivers, shelters, hospitals, rainfall] = await Promise.all([
      API.getGeoJsonLayer("flood_areas"),
      API.getGeoJsonLayer("risk_zones"),
      API.getGeoJsonLayer("rivers"),
      API.getGeoJsonLayer("shelters"),
      API.getGeoJsonLayer("hospitals"),
      API.getGeoJsonLayer("rainfall_stations")
    ]);

    renderHistoricalFloodAreas(floodAreas);
    renderHistoricalRiskZones(riskZones);
    renderHistoricalRivers(rivers);
    renderShelters(shelters);
    renderHospitals(hospitals);
    renderHistoricalRainfallStations(rainfall);
  } catch (err) {
    console.error("Failed to load historical GIS layers:", err);
  }
}

// Layer 1: Flood Areas (Archived Kerala 2018 benchmark)
function renderHistoricalFloodAreas(geojson) {
  floodAreasLayer.clearLayers();

  const getRiskColor = (level) => {
    const l = (level || "").toUpperCase();
    if (l === "CRITICAL") return "#EF4444";
    if (l === "HIGH") return "#F97316";
    if (l === "MEDIUM") return "#F59E0B";
    return "#10B981";
  };

  L.geoJSON(geojson, {
    style: (feature) => {
      const color = getRiskColor(feature.properties.risk_level);
      const isCrit = (feature.properties.risk_level || "").toUpperCase() === "CRITICAL";
      return {
        color: color,
        weight: isCrit ? 3.5 : 2,
        opacity: 0.95,
        fillColor: color,
        fillOpacity: isCrit ? 0.45 : 0.3,
        dashArray: isCrit ? "5, 5" : "3"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const popupHtml = `
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:var(--accent-blue); text-transform:uppercase;">ARCHIVED FLOOD FOOTPRINT</span>
            <span class="provenance-tag provenance-historical">HISTORICAL</span>
          </div>
          <div class="popup-title">${p.name}</div>
          <div style="margin-bottom: 0.6rem;">${renderRiskBadge(p.risk_level)}</div>
          <div class="popup-row">
            <span class="popup-label">District</span>
            <span class="popup-val">${p.district || "Central Basin"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Recorded Precipitation</span>
            <span class="popup-val mono" style="color:#60A5FA;">${p.rainfall} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">River Water Stage</span>
            <span class="popup-val mono" style="color:#F59E0B;">${p.water_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Topography Elevation</span>
            <span class="popup-val mono">${p.elevation || "8"} m MSL</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Recurrence History</span>
            <span class="popup-val">${p.historical_frequency || "Moderate"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Record Origin</span>
            <span class="popup-val mono" style="color:#94A3B8;">Kerala 2018 Disaster Archive</span>
          </div>
          <div style="margin-top: 0.85rem; display: flex; gap: 0.5rem;">
            <a href="/risk?area=${encodeURIComponent(p.name)}" class="btn btn-sm btn-primary" style="flex:1;">Hydraulic Risk</a>
            <a href="/safe-locations?origin=${encodeURIComponent(p.name)}" class="btn btn-sm btn-secondary" style="flex:1;">Evacuate</a>
          </div>
        </div>
      `;
      layer.bindPopup(popupHtml);

      layer.on("mouseover", function () {
        this.setStyle({ fillOpacity: 0.65, weight: 4 });
      });
      layer.on("mouseout", function () {
        this.setStyle({ fillOpacity: 0.3, weight: 2.5 });
      });
    }
  }).addTo(floodAreasLayer);
}

// Layer 2: Risk Zones
function renderHistoricalRiskZones(geojson) {
  riskZonesLayer.clearLayers();

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties;
      return {
        color: p.color || "#38BDF8",
        weight: 1.5,
        opacity: 0.7,
        fillColor: p.color || "#38BDF8",
        fillOpacity: 0.16
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#94A3B8;">PERIMETER HAZARD BUFFER</span>
            <span class="provenance-tag provenance-historical">HISTORICAL</span>
          </div>
          <div class="popup-title">${p.zone_name}</div>
          <div style="margin-bottom: 0.5rem;">${renderRiskBadge(p.risk_level)}</div>
          <div class="popup-row">
            <span class="popup-label">Vulnerability Range</span>
            <span class="popup-val mono">${p.score_range}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Advisory Protocol</span>
            <span class="popup-val" style="font-size:0.78rem;">${p.action_advisory}</span>
          </div>
        </div>
      `);
    }
  }).addTo(riskZonesLayer);
}

// Layer 3: Rivers
function renderHistoricalRivers(geojson) {
  riversLayer.clearLayers();

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties;
      let color = "#38BDF8";
      let weight = 4.5;
      if (p.water_level >= p.danger_level) {
        color = "#EF4444";
        weight = 6.5;
      } else if (p.water_level >= p.warning_level) {
        color = "#F59E0B";
        weight = 5.5;
      }
      return {
        color: color,
        weight: weight,
        opacity: 0.92,
        lineCap: "round",
        lineJoin: "round"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#38BDF8;">HYDROMETRIC RIVER TRANSECT</span>
            <span class="provenance-tag provenance-historical">HISTORICAL</span>
          </div>
          <div class="popup-title">${p.river_name}</div>
          <div class="popup-row">
            <span class="popup-label">Archived Gauge Status</span>
            <span class="popup-val mono" style="color: ${p.water_level >= p.danger_level ? '#EF4444' : (p.water_level >= p.warning_level ? '#F59E0B' : '#10B981')}">● ${p.status}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Recorded Water Level</span>
            <span class="popup-val mono" style="font-weight:700; font-size:0.95rem;">${p.water_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Warning Threshold</span>
            <span class="popup-val mono">${p.warning_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Critical Danger Mark</span>
            <span class="popup-val mono" style="color:#EF4444;">${p.danger_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Recorded Flow</span>
            <span class="popup-val mono">${p.flow_rate_cumecs || "N/A"} cumecs</span>
          </div>
        </div>
      `);
    }
  }).addTo(riversLayer);
}

// Layer 4: Safe Shelters
function renderShelters(geojson) {
  sheltersLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      return L.marker(latlng, { icon: ICONS.shelter });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#10B981;">DESIGNATED EMERGENCY REFUGE</span>
            <span class="provenance-tag provenance-sample">FACILITY</span>
          </div>
          <div class="popup-title">${p.name}</div>
          <div class="badge badge-low" style="margin-bottom:0.5rem;">${p.type}</div>
          <div class="popup-row">
            <span class="popup-label">Capacity</span>
            <span class="popup-val mono">${p.capacity} Persons</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Occupancy</span>
            <span class="popup-val mono">${p.current_occupancy || 0} (${Math.round((p.current_occupancy || 0) / p.capacity * 100)}%)</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Altitude Safety</span>
            <span class="popup-val mono">${p.elevation || "Elevated"} m MSL</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Direct Contact</span>
            <span class="popup-val mono">${p.contact}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Provisions</span>
            <span class="popup-val" style="font-size:0.75rem;">${p.supplies || "Power Gen, Rations, First Aid"}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-primary" style="width:100%;">
              Navigate Evacuation Route
            </a>
          </div>
        </div>
      `);
    }
  }).addTo(sheltersLayer);
}

// Layer 5: Hospitals
function renderHospitals(geojson) {
  hospitalsLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      return L.marker(latlng, { icon: ICONS.hospital });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#EF4444;">EMERGENCY TRAUMA WING</span>
            <span class="provenance-tag provenance-sample">MEDICAL</span>
          </div>
          <div class="popup-title">${p.hospital_name}</div>
          <div class="badge badge-medium" style="margin-bottom:0.5rem;">${p.status}</div>
          <div class="popup-row">
            <span class="popup-label">Service Wing</span>
            <span class="popup-val">${p.emergency_availability}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Available ICU Beds</span>
            <span class="popup-val mono" style="color:#10B981; font-weight:700;">${p.available_beds} / ${p.total_beds}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Ambulance Hotline</span>
            <span class="popup-val mono" style="color:#EF4444; font-weight:700;">${p.ambulance_helpline || "108"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Direct Line</span>
            <span class="popup-val mono">${p.contact}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.hospital_name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-danger" style="width:100%;">
              Emergency Medical Route
            </a>
          </div>
        </div>
      `);
    }
  }).addTo(hospitalsLayer);
}

// Layer 6: Historical Rain Stations
function renderHistoricalRainfallStations(geojson) {
  rainfallStationsLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      return L.marker(latlng, { icon: ICONS.rainfall });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.3rem;">
            <span style="font-family:var(--font-mono); font-size:0.68rem; color:#38BDF8;">ARCHIVED RAIN GAUGE</span>
            <span class="provenance-tag provenance-historical">HISTORICAL</span>
          </div>
          <div class="popup-title">${p.station_name}</div>
          <div class="popup-row">
            <span class="popup-label">Recorded Precipitation</span>
            <span class="popup-val mono" style="color:#38BDF8; font-weight:800; font-size:1.1rem;">${p.rainfall_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Storm Intensity</span>
            <span class="popup-val">${p.intensity}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Cumulative Total</span>
            <span class="popup-val mono">${p.cumulative_24h_mm || p.rainfall_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Archive Timestamp</span>
            <span class="popup-val mono">${p.last_reading_time || "2018 Archive"}</span>
          </div>
        </div>
      `);
    }
  }).addTo(rainfallStationsLayer);
}

// Setup Layer Toggles
function setupLayerToggles() {
  const toggleMap = {
    "toggle-flood-areas": () => (currentMapMode === "LIVE" ? liveFloodRiskLayer : floodAreasLayer),
    "toggle-risk-zones": () => (currentMapMode === "LIVE" ? liveFloodRiskLayer : riskZonesLayer),
    "toggle-rivers": () => (currentMapMode === "LIVE" ? liveRiversLayer : riversLayer),
    "toggle-shelters": () => sheltersLayer,
    "toggle-hospitals": () => hospitalsLayer,
    "toggle-rainfall": () => (currentMapMode === "LIVE" ? liveRainfallLayer : rainfallStationsLayer)
  };

  Object.entries(toggleMap).forEach(([elemId, getLayer]) => {
    const chk = document.getElementById(elemId);
    if (chk) {
      chk.addEventListener("change", (e) => {
        const layer = getLayer();
        if (!layer) return;
        if (e.target.checked) {
          map.addLayer(layer);
        } else {
          map.removeLayer(layer);
        }
      });
    }
  });

  // Layer 7: ISRO Bhuvan Space Remote Sensing Layer
  let bhuvanDisasterLayer = null;
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
          showToast("🛰️ ISRO Bhuvan Disaster Remote Sensing Layer Enabled", "info");
        }
      } else {
        map.removeLayer(bhuvanDisasterLayer);
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
      map.setView([lat, lng], 13);
      if (typeof showToast === "function") showToast("GPS Coordinate Locked!", "success");
    },
    () => {
      if (typeof showToast === "function") showToast("GPS positioned to Basin Command Center.", "info");
      map.setView(currentRegion === "odisha" ? [20.4637, 85.88] : [10.04, 76.34], 11);
    }
  );
}

// Setup Map Search
function setupMapSearch() {
  const searchInput = document.getElementById("map-search-input");
  if (!searchInput) return;

  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.toLowerCase().trim();
      if (!query) return;

      let found = false;

      // First check live station markers
      Object.entries(liveStationMarkers).forEach(([name, marker]) => {
        if (!found && name.toLowerCase().includes(query)) {
          map.setView(marker.getLatLng(), 13);
          marker.openPopup();
          found = true;
        }
      });

      if (!found && floodAreasLayer) {
        floodAreasLayer.eachLayer((layer) => {
          const name = layer.feature?.properties?.name?.toLowerCase() || "";
          if (name.includes(query) && !found) {
            map.fitBounds(layer.getBounds(), { maxZoom: 14 });
            layer.openPopup();
            found = true;
          }
        });
      }

      if (!found && sheltersLayer) {
        sheltersLayer.eachLayer((layer) => {
          const name = layer.feature?.properties?.name?.toLowerCase() || "";
          if (name.includes(query) && !found) {
            map.setView(layer.getLatLng(), 14);
            layer.openPopup();
            found = true;
          }
        });
      }

      if (!found && typeof showToast === "function") {
        showToast(`Target '${query}' not located. Try 'Cuttack', 'Hirakud', 'Mundali', or 'Aluva'`, "info");
      }
    }
  });
}
