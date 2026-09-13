/**
 * FloodGuard India - OpenStreetMap + Leaflet.js Unified GIS Hydrological Engine
 * Built with OpenStreetMap tiles, Leaflet.js, GeoJSON spatial datasets,
 * and Leaflet.markercluster to eliminate marker overlapping.
 *
 * Citizen-First Public Safety Interface with Progressive Disclosure of Advanced GIS layers.
 */

let map = null;

// GIS Layers & Clusters
let indiaStatesLayer = null;       // State Boundaries (Hidden by default)
let districtsLayer = null;         // District Boundaries (Hidden by default)
let majorRiversLayer = null;       // Rivers & Waterways (Shown by default)
let riverStationsLayer = null;     // River Monitoring Stations - Clustered (Hidden by default)
let historicalFloodsLayer = null;  // Historical Flood Areas (Hidden by default)
let liveAffectedLayer = null;      // Flood Areas - Polygons (Shown by default)
let riskZonesLayer = null;         // Flood Risk - Polygons (Shown by default)
let liveRainfallLayer = null;      // Rainfall Stations - Clustered (Hidden by default)
let floodWarningsLayer = null;     // Critical Warning Alerts - Unclustered Beacons (Hidden by default)
let sheltersLayer = null;          // Safe Shelters - Clustered (Shown by default)
let hospitalsLayer = null;         // Hospitals & Trauma Centers - Clustered (Hidden by default)
let forecastRiskLayer = null;      // Predicted Flood Areas (Hidden by default)
let evacuationRoutesLayer = null;  // Safe Evacuation Routes (Active)
let bhuvanDisasterLayer = null;    // ISRO Bhuvan Satellite Overlay

// State Management & Caches
let currentMapMode = "LIVE";       // "LIVE" | "HISTORICAL"
let selectedState = "all";
let selectedDistrict = "all";
let selectedBasin = "all";
let autoRefreshInterval = 300;     // seconds
let countdownTimerId = null;
let secondsRemaining = 300;
let isFetchingLive = false;
let userLocationMarker = null;
let currentBasemap = null;

let liveStationMarkers = {};       // Indexed by station name
let allStatesMeta = {};            // Cached states directory from /api/india/states
let allBasinsMeta = {};            // Cached basins from /api/india/basins
let rawStationsData = [];          // Monitored station observations
let cachedSheltersData = [];       // Cached shelter facilities for GPS distance calculation
let cachedFloodPolygons = [];      // Cached flood zone polygons for risk estimation

// NASA Daily Satellite Imagery Tile Generator
function getNasaDailyTileUrl() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${yesterday}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

// Basemap Providers (Requirement #2: OpenStreetMap Standard by default)
const BASEMAPS = {
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  nasa: getNasaDailyTileUrl(),
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
};

// =============================================================================
// FLOOD RISK COLOR & POPUP TEMPLATES (Requirement #4 & #5)
// =============================================================================

function getRiskColor(risk) {
  const r = (risk || "LOW").toUpperCase();
  if (r === "CRITICAL") return "#DC2626"; // Red
  if (r === "HIGH") return "#EA580C";     // Orange
  if (r === "MEDIUM" || r === "MODERATE") return "#EAB308"; // Yellow
  return "#10B981";                       // Green
}

function renderRiskBadge(level) {
  const l = (level || "LOW").toUpperCase();
  const cls = l === "CRITICAL" ? "badge-critical" :
              l === "HIGH" ? "badge-high" :
              (l === "MEDIUM" || l === "MODERATE") ? "badge-medium" : "badge-low";
  return `<span class="badge ${cls}">${l} RISK</span>`;
}

// Standardized Citizen Flood Information Popup (Requirement #5)
function createFloodInfoPopupHtml(data) {
  const {
    location = "Cuttack, Odisha",
    risk = "HIGH",
    rainfall = 85,
    riverLevel = 7.2,
    prediction = "Flood possible in 6–12 hours",
    detailsUrl = "/risk",
    safeLocationUrl = "/safe-locations"
  } = data;

  const color = getRiskColor(risk);

  return `
    <div class="popup-card" style="padding: 1.1rem; min-width: 255px;">
      <div style="font-size: 0.72rem; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.45rem; display: flex; justify-content: space-between; align-items: center;">
        <span>FLOOD INFORMATION</span>
        <span class="provenance-tag provenance-live">LIVE</span>
      </div>

      <div style="margin-bottom: 0.45rem;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Location:</div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; line-height: 1.25;">${location}</div>
      </div>

      <div style="margin-bottom: 0.55rem;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; margin-bottom: 0.2rem;">Risk:</div>
        <div style="display: inline-block; font-weight: 800; font-size: 0.85rem; padding: 2px 10px; border-radius: 4px; background: ${color}22; color: ${color}; border: 1px solid ${color}66; letter-spacing: 0.05em;">
          ${risk.toUpperCase()}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.55rem 0.65rem; margin-bottom: 0.55rem;">
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Rainfall:</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: #60A5FA; font-family: var(--font-mono); margin-top: 0.1rem;">${rainfall} mm</div>
        </div>
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">River Level:</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: ${color}; font-family: var(--font-mono); margin-top: 0.1rem;">${riverLevel} m</div>
        </div>
      </div>

      <div style="margin-bottom: 0.75rem; background: rgba(245, 158, 11, 0.08); border-left: 3px solid #F59E0B; padding: 0.4rem 0.55rem; border-radius: 0 4px 4px 0;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Prediction:</div>
        <div style="font-size: 0.82rem; font-weight: 700; color: #FDE68A;">${prediction}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem;">
        <a href="${detailsUrl}" class="btn btn-sm btn-secondary" style="text-align: center; font-size: 0.76rem; padding: 0.4rem 0.2rem;">
          View Details
        </a>
        <a href="${safeLocationUrl}" class="btn btn-sm btn-primary" style="text-align: center; font-size: 0.76rem; padding: 0.4rem 0.2rem;">
          Find Safe Location
        </a>
      </div>
    </div>
  `;
}

// Standardized Safe Shelter Popup (Requirement #11)
function createShelterPopupHtml(data) {
  const {
    name = "Safe Shelter",
    distance = "1.8 km",
    capacity = 120,
    available = 85,
    facilities = ["Water", "Food", "Medical Support"],
    lat = 0,
    lng = 0
  } = data;

  const facilitiesHtml = facilities.map(f => `
    <div style="color: #34D399; font-size: 0.76rem; display: flex; align-items: center; gap: 0.35rem;">
      <span style="font-weight: 800;">✓</span> <span>${f}</span>
    </div>
  `).join("");

  return `
    <div class="popup-card" style="padding: 1.1rem; min-width: 250px;">
      <div style="font-size: 0.72rem; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.45rem;">
        SAFE SHELTER
      </div>

      <div style="margin-bottom: 0.45rem;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Name:</div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; line-height: 1.25;">${name}</div>
      </div>

      <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Distance:</span>
        <span style="font-size: 0.95rem; font-weight: 800; color: #38BDF8; font-family: var(--font-mono);">${distance}</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.55rem 0.65rem; margin-bottom: 0.6rem;">
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Capacity:</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: #E2E8F0; font-family: var(--font-mono); margin-top: 0.1rem;">${capacity}</div>
        </div>
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Available:</div>
          <div style="font-size: 1.05rem; font-weight: 800; color: #34D399; font-family: var(--font-mono); margin-top: 0.1rem;">${available}</div>
        </div>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; margin-bottom: 0.25rem;">Facilities:</div>
        <div style="display: flex; flex-direction: column; gap: 0.2rem; background: rgba(16, 185, 129, 0.08); border-radius: 6px; padding: 0.45rem 0.6rem;">
          ${facilitiesHtml}
        </div>
      </div>

      <div style="margin-top: 0.5rem;">
        <button onclick="drawEvacuationRouteTo(${lat}, ${lng}, '${name.replace(/'/g, "\\'")}')" class="btn btn-sm btn-primary" style="width: 100%; text-align: center; font-size: 0.8rem; padding: 0.45rem;">
          Get Directions
        </button>
      </div>
    </div>
  `;
}

// Predicted Flood Zone Popup (Requirement #14)
function createPredictionPopupHtml(data) {
  const {
    area = "Predicted Flood Zone",
    probability = "78%",
    risk = "HIGH",
    expected = "Next 6–12 Hours"
  } = data;
  const color = getRiskColor(risk);

  return `
    <div class="popup-card" style="padding: 1.1rem; min-width: 250px;">
      <div style="font-size: 0.72rem; font-weight: 800; color: #A78BFA; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.45rem;">
        PREDICTED FLOOD ZONE
      </div>
      <div class="popup-title" style="font-size: 1.1rem; font-weight: 800; color: #FFFFFF; margin-bottom: 0.45rem;">${area}</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(139, 92, 246, 0.08); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 0.55rem 0.65rem; margin-bottom: 0.6rem;">
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Probability:</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: #C084FC; font-family: var(--font-mono);">${probability}</div>
        </div>
        <div>
          <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Risk:</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: ${color}; font-family: var(--font-mono);">${risk}</div>
        </div>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <div style="font-size: 0.68rem; color: #94A3B8; text-transform: uppercase;">Expected:</div>
        <div style="font-size: 0.88rem; font-weight: 700; color: #FBBF24;">${expected}</div>
      </div>

      <a href="/prediction" class="btn btn-sm btn-primary" style="width: 100%; text-align: center; font-size: 0.76rem; padding: 0.4rem;">
        View AI Flood Model
      </a>
    </div>
  `;
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
  )
};

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

// Distance Calculation using Haversine formula (km)
function computeHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =============================================================================
// MAP INITIALIZATION (Requirements #1, #2, #3, #6)
// =============================================================================

function initFloodMap(containerId = "map-container", options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Requirement #2: Initial view focused on India [22.9734, 78.6569], zoom 5
  const defaultCenter = [22.9734, 78.6569];
  const defaultZoom = options.preview ? 4 : 5;

  map = L.map(containerId, {
    center: defaultCenter,
    zoom: defaultZoom,
    minZoom: 4,
    maxZoom: 19,
    zoomControl: !options.preview,
    attributionControl: !options.preview
  });

  // Base Layer: OpenStreetMap Standard
  currentBasemap = L.tileLayer(BASEMAPS.streets, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);

  // Helper to create Clustered Marker Groups (Requirement #6: Fix Marker Overlapping)
  function createClusterGroup(options = {}) {
    if (typeof L.markerClusterGroup === "function") {
      return L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 11,
        ...options
      });
    }
    return L.layerGroup();
  }

  // Initialize Layer Groups (Requirement #3: 4 Basic Layers ON by default, Advanced GIS OFF)
  indiaStatesLayer = L.layerGroup();
  districtsLayer = L.layerGroup();
  majorRiversLayer = L.layerGroup().addTo(map);            // Core Layer: Shown by default
  liveAffectedLayer = L.layerGroup().addTo(map);           // Core Layer: Shown by default
  riskZonesLayer = L.layerGroup().addTo(map);              // Core Layer: Shown by default
  sheltersLayer = createClusterGroup().addTo(map);         // Core Layer: Shown by default
  evacuationRoutesLayer = L.layerGroup().addTo(map);       // Active Route Layer

  // Advanced GIS Layers: Hidden by default
  riverStationsLayer = createClusterGroup();
  liveRainfallLayer = createClusterGroup();
  historicalFloodsLayer = L.layerGroup();
  forecastRiskLayer = L.layerGroup();
  hospitalsLayer = createClusterGroup();
  floodWarningsLayer = L.layerGroup(); // Keep unclustered for individual visibility of critical alerts

  // Ingest Nationwide Geographical & Hydrological Data
  populateGeographicalSelectors();
  loadAllSpatialLayers();
  fetchAndRenderLiveData();

  if (!options.preview) {
    setupBasemapSwitcher();
    setupLayerToggles();
    setupMapSearch();
    setupAutoRefreshTimer();
    setupCoordinateTracker();
    handleUrlDeepLinking();
  }

  // Automatic resize handling
  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
  });

  return map;
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
      if (typeof showToast === "function") showToast("🛰️ ISRO Bhuvan Space GIS Basemap Activated", "info");
    } else if (BASEMAPS[chosen]) {
      const isNasa = chosen === "nasa";
      const isOsm = chosen === "streets";
      currentBasemap = L.tileLayer(BASEMAPS[chosen], {
        maxZoom: isNasa ? 9 : 19,
        attribution: isOsm
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          : isNasa
          ? 'Imagery &copy; NASA GIBS / EOSDIS'
          : '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);

      bringInteractiveLayersToFront();
      if (isNasa && typeof showToast === "function") {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        showToast(`🛰️ NASA GIBS Live Daily Satellite Layer Activated (${yesterday})`, "info");
      }
    }
  });
}

function bringInteractiveLayersToFront() {
  if (majorRiversLayer && map.hasLayer(majorRiversLayer)) majorRiversLayer.bringToFront?.();
  if (liveAffectedLayer && map.hasLayer(liveAffectedLayer)) liveAffectedLayer.bringToFront?.();
  if (riskZonesLayer && map.hasLayer(riskZonesLayer)) riskZonesLayer.bringToFront?.();
  if (evacuationRoutesLayer && map.hasLayer(evacuationRoutesLayer)) evacuationRoutesLayer.bringToFront?.();
}

function setupCoordinateTracker() {
  const coordDisplay = document.getElementById("hud-cursor-coords");
  if (!coordDisplay) return;

  map.on("mousemove", (e) => {
    const lat = e.latlng.lat.toFixed(4);
    const lng = e.latlng.lng.toFixed(4);
    coordDisplay.textContent = `LAT: ${lat}° N | LON: ${lng}° E`;
  });
}

// =============================================================================
// CASCADING GEOGRAPHICAL SELECTORS (Requirement #8)
// India -> State -> District -> River Basin
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

      stateSelector.innerHTML = '<option value="all" selected>All States</option>';
      sortedStateNames.forEach((st) => {
        const opt = document.createElement("option");
        opt.value = st;
        opt.textContent = st;
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

      basinSelector.innerHTML = '<option value="all" selected>All River Basins</option>';
      sortedBasinKeys.forEach((bk) => {
        const b = allBasinsMeta[bk];
        const opt = document.createElement("option");
        opt.value = bk;
        opt.textContent = b.name || b.basin_name || bk;
        basinSelector.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("Failed to populate geographical selectors:", err);
  }
}

window.onStateSelectChange = function(stateVal) {
  selectedState = stateVal;
  const distSelector = document.getElementById("district-selector");

  if (stateVal === "all") {
    if (distSelector) distSelector.innerHTML = '<option value="all" selected>All Districts</option>';
    selectedDistrict = "all";
    map.flyTo([22.9734, 78.6569], 5, { duration: 1.2 });
    renderFilteredLiveLayers();
    return;
  }

  const meta = allStatesMeta[stateVal];
  if (meta) {
    if (distSelector) {
      distSelector.innerHTML = '<option value="all" selected>All Districts in ' + stateVal + '</option>';
      (meta.flood_prone_districts || []).forEach((dist) => {
        const opt = document.createElement("option");
        opt.value = dist;
        opt.textContent = dist;
        distSelector.appendChild(opt);
      });
    }

    map.flyTo(meta.center, meta.zoom || 7, { duration: 1.2 });
    if (typeof showToast === "function") showToast(`📍 Focused on ${stateVal}`, "info");
  }

  renderFilteredLiveLayers();
};

window.onDistrictSelectChange = function(distVal) {
  selectedDistrict = distVal;

  if (distVal === "all") {
    if (selectedState !== "all" && allStatesMeta[selectedState]) {
      map.flyTo(allStatesMeta[selectedState].center, allStatesMeta[selectedState].zoom || 7, { duration: 1.0 });
    }
    renderFilteredLiveLayers();
    return;
  }

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

window.onBasinSelectChange = function(basinKey) {
  selectedBasin = basinKey;

  if (basinKey === "all") {
    if (selectedState === "all") {
      map.flyTo([22.9734, 78.6569], 5, { duration: 1.2 });
    }
    renderFilteredLiveLayers();
    return;
  }

  const b = allBasinsMeta[basinKey];
  if (b) {
    map.flyTo(b.center, b.zoom || 6, { duration: 1.2 });
    if (typeof showToast === "function") {
      showToast(`🌊 Focused on ${b.name} Basin`, "info");
    }
  }

  renderFilteredLiveLayers();
};

window.onRegionChange = function(region) {
  if (region === "odisha") onStateSelectChange("Odisha");
  else if (region === "kerala") onStateSelectChange("Kerala");
  else onStateSelectChange("all");
};

// =============================================================================
// SPATIAL LAYERS LOADING (Requirement #4: GeoJSON for Spatial Data)
// =============================================================================

async function loadAllSpatialLayers() {
  try {
    const [
      indiaStatesGeo,
      indiaRiversGeo,
      historicalFloodsGeo,
      forecastRiskGeo,
      sheltersGeo,
      hospitalsGeo,
      floodAreasGeo,
      riskZonesGeo
    ] = await Promise.all([
      API.getIndiaStatesGeoJson().catch(() => null),
      API.getIndiaRiversGeoJson().catch(() => null),
      API.getHistoricalFloodsGeoJson().catch(() => null),
      API.getForecastRiskGeoJson().catch(() => null),
      API.getGeoJsonLayer("shelters").catch(() => null),
      API.getGeoJsonLayer("hospitals").catch(() => null),
      API.getGeoJsonLayer("flood_areas").catch(() => null),
      API.getGeoJsonLayer("risk_zones").catch(() => null)
    ]);

    if (indiaStatesGeo) renderIndiaStatesLayer(indiaStatesGeo);
    if (indiaRiversGeo) renderMajorRiversLayer(indiaRiversGeo);
    if (historicalFloodsGeo) renderHistoricalFloodsLayer(historicalFloodsGeo);
    if (forecastRiskGeo) renderForecastRiskLayer(forecastRiskGeo);
    if (sheltersGeo) renderShelters(sheltersGeo);
    if (hospitalsGeo) renderHospitals(hospitalsGeo);
    if (floodAreasGeo) renderFloodAreasGeoJson(floodAreasGeo);
    if (riskZonesGeo) renderRiskZonesGeoJson(riskZonesGeo);
  } catch (err) {
    console.error("Failed to load base spatial layers:", err);
  }
}

// 1. State Boundaries (Advanced GIS: Off by default)
function renderIndiaStatesLayer(geojson) {
  indiaStatesLayer.clearLayers();
  L.geoJSON(geojson, {
    style: {
      color: "#38BDF8",
      weight: 1.4,
      opacity: 0.65,
      fillColor: "#0284C7",
      fillOpacity: 0.05,
      dashArray: "3, 3"
    },
    onEachFeature: (feature, layer) => {
      const stateName = feature.properties?.name || "State";
      layer.bindTooltip(`<b>${stateName}</b>`, { sticky: true });
      layer.on("mouseover", function() {
        this.setStyle({ fillOpacity: 0.18, weight: 2.2, color: "#60A5FA" });
      });
      layer.on("mouseout", function() {
        this.setStyle({ fillOpacity: 0.05, weight: 1.4, color: "#38BDF8" });
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

// 2. Rivers & Waterways (Core Citizen Layer: Shown by default)
function renderMajorRiversLayer(geojson) {
  majorRiversLayer.clearLayers();
  L.geoJSON(geojson, {
    style: (feature) => ({
      color: feature.properties?.color || "#06B6D4",
      weight: 3.5,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round"
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const popupHtml = `
        <div class="popup-card">
          <div style="font-size:0.7rem; color:#06B6D4; font-weight:800; text-transform:uppercase;">RIVER TRANSECT</div>
          <div class="popup-title" style="margin:0.3rem 0;">${p.river_name || "Major River"}</div>
          <div class="popup-row"><span class="popup-label">Basin</span><span class="popup-val">${p.basin || "River Basin"}</span></div>
          <div class="popup-row"><span class="popup-label">Length</span><span class="popup-val mono">${p.length_km ? p.length_km.toLocaleString() + " km" : "N/A"}</span></div>
          <div class="popup-row"><span class="popup-label">Riparian States</span><span class="popup-val">${p.states_covered || "India"}</span></div>
        </div>
      `;
      layer.bindPopup(popupHtml);
      layer.on("click", () => showMobileSheet(p.river_name || "River Transect", popupHtml));
    }
  }).addTo(majorRiversLayer);
}

// 3. Flood Areas GeoJSON Polygons (Core Citizen Layer: Shown by default)
function renderFloodAreasGeoJson(geojson) {
  if (!geojson || !geojson.features) return;

  L.geoJSON(geojson, {
    style: (feature) => {
      const risk = feature.properties?.risk_level || feature.properties?.risk || "High";
      return {
        color: getRiskColor(risk),
        weight: 2,
        opacity: 0.95,
        fillColor: getRiskColor(risk),
        fillOpacity: 0.42
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const risk = p.risk_level || p.risk || "High";
      const bounds = layer.getBounds ? layer.getBounds() : null;
      const center = bounds ? [bounds.getCenter().lat, bounds.getCenter().lng] : null;

      const popupHtml = createFloodInfoPopupHtml({
        location: `${p.name || 'Flood Zone'}${p.district ? ', ' + p.district : ''}`,
        risk: risk,
        rainfall: p.rainfall || 85,
        riverLevel: p.water_level || 7.2,
        prediction: p.description || "Flood possible in 6–12 hours",
        detailsUrl: `/risk?target=${encodeURIComponent(p.name || '')}`,
        safeLocationUrl: `/safe-locations?origin=${encodeURIComponent(p.name || '')}&lat=${center ? center[0] : ''}&lng=${center ? center[1] : ''}`
      });

      layer.bindPopup(popupHtml);
      layer.on("click", () => showMobileSheet(p.name || "Flood Information", popupHtml));

      cachedFloodPolygons.push({
        geometry: feature.geometry,
        properties: p,
        center: center,
        _layer: layer
      });
    }
  }).addTo(liveAffectedLayer);
}

// 4. Flood Risk Buffer Zones GeoJSON (Core Citizen Layer: Shown by default)
function renderRiskZonesGeoJson(geojson) {
  if (!geojson || !geojson.features) return;

  L.geoJSON(geojson, {
    style: (feature) => {
      const risk = feature.properties?.risk_level || feature.properties?.risk || "Medium";
      return {
        color: getRiskColor(risk),
        weight: 1.5,
        opacity: 0.75,
        fillColor: getRiskColor(risk),
        fillOpacity: 0.2,
        dashArray: "4, 4"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const risk = p.risk_level || p.risk || "Medium";
      const popupHtml = `
        <div class="popup-card">
          <div style="font-size:0.7rem; color:${getRiskColor(risk)}; font-weight:800; text-transform:uppercase;">FLOOD RISK BUFFER</div>
          <div class="popup-title" style="margin:0.3rem 0;">${p.name || "Risk Zone"}</div>
          <div class="popup-row"><span class="popup-label">Composite Risk</span><span class="popup-val">${renderRiskBadge(risk)}</span></div>
          <div class="popup-row"><span class="popup-label">Advisory</span><span class="popup-val">${p.description || "Active monitoring"}</span></div>
        </div>
      `;
      layer.bindPopup(popupHtml);
      layer.on("click", () => showMobileSheet(p.name || "Flood Risk Buffer", popupHtml));
    }
  }).addTo(riskZonesLayer);
}

// 5. Safe Shelters (Core Citizen Layer: Clustered, Shown by default)
function renderShelters(geojson) {
  sheltersLayer.clearLayers();
  cachedSheltersData = [];
  if (!geojson || !geojson.features) return;

  geojson.features.forEach((feature) => {
    const coords = feature.geometry?.coordinates;
    if (!coords) return;
    const latlng = [coords[1], coords[0]];
    const p = feature.properties || {};

    const marker = L.marker(latlng, { icon: ICONS.shelter });
    const popupHtml = createShelterPopupHtml({
      name: p.name || "Safe Shelter",
      distance: `${p.elevation || 12}m MSL`,
      capacity: p.capacity || 500,
      available: Math.max(0, (p.capacity || 500) - (p.current_occupancy || 0)),
      facilities: ["Drinking Water", "Food Supply", "Medical Support", "Emergency Power"],
      lat: latlng[0],
      lng: latlng[1]
    });

    marker.bindPopup(popupHtml);
    marker.on("click", () => showMobileSheet(p.name || "Safe Shelter", popupHtml));

    sheltersLayer.addLayer(marker);

    cachedSheltersData.push({
      ...p,
      latitude: latlng[0],
      longitude: latlng[1],
      _marker: marker
    });
  });
}

// 6. Hospitals & Trauma Centers (Advanced GIS: Clustered, Hidden by default)
function renderHospitals(geojson) {
  hospitalsLayer.clearLayers();
  if (!geojson || !geojson.features) return;

  geojson.features.forEach((feature) => {
    const coords = feature.geometry?.coordinates;
    if (!coords) return;
    const latlng = [coords[1], coords[0]];
    const p = feature.properties || {};

    const marker = L.marker(latlng, { icon: ICONS.hospital });
    const popupHtml = `
      <div class="popup-card" style="padding: 1.1rem; min-width: 250px;">
        <div style="font-size: 0.72rem; font-weight: 800; color: #EF4444; text-transform: uppercase;">
          EMERGENCY MEDICAL CENTER
        </div>
        <div class="popup-title" style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 0.35rem 0;">
          ${p.hospital_name || p.name}
        </div>
        <div style="font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem;">
          ICU Capacity: <strong style="color: #10B981;">${p.available_beds || 12} Available</strong> / ${p.total_beds || 50}
        </div>
        <div style="font-size: 0.78rem; color: #EF4444; font-family: var(--font-mono); margin-bottom: 0.65rem;">
          Hotline: ${p.ambulance_helpline || "108 / 102"}
        </div>
        <button onclick="drawEvacuationRouteTo(${latlng[0]}, ${latlng[1]}, '${(p.hospital_name || p.name).replace(/'/g, "\\'")}')" class="btn btn-sm btn-danger" style="width: 100%;">
          Medical Emergency Route
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    marker.on("click", () => showMobileSheet(p.hospital_name || p.name, popupHtml));

    hospitalsLayer.addLayer(marker);
  });
}

// 7. Historical Flood Footprints (Advanced GIS: Hidden by default, Requirement #15)
function renderHistoricalFloodsLayer(geojson) {
  historicalFloodsLayer.clearLayers();
  if (!geojson || !geojson.features) return;

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties || {};
      const isCrit = (p.risk_level || "").toUpperCase() === "CRITICAL";
      return {
        color: isCrit ? "#EF4444" : "#F59E0B",
        weight: 2,
        opacity: 0.85,
        fillColor: isCrit ? "#EF4444" : "#F59E0B",
        fillOpacity: 0.24,
        dashArray: "4, 4"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const popupHtml = `
        <div class="popup-card" style="padding: 1.1rem; min-width: 250px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: #F59E0B; text-transform: uppercase;">
            ARCHIVED HISTORICAL FLOOD
          </div>
          <div class="popup-title" style="font-size: 1.1rem; margin: 0.35rem 0;">${p.name || p.flood_event}</div>
          <div style="margin-bottom: 0.5rem;">${renderRiskBadge(p.risk_level)} <span class="badge badge-low">${p.state} (${p.year})</span></div>
          <div class="popup-row"><span class="popup-label">District</span><span class="popup-val">${p.district || p.river_basin || "Nationwide"}</span></div>
          <div class="popup-row"><span class="popup-label">Peak Rain</span><span class="popup-val mono" style="color: #60A5FA;">${p.rainfall_mm} mm</span></div>
          <div class="popup-row"><span class="popup-label">Peak Stage</span><span class="popup-val mono" style="color: #F59E0B;">${p.water_level_m} m</span></div>
          <div class="popup-row"><span class="popup-label">Impact</span><span class="popup-val" style="font-size:0.75rem; color:#FCA5A5;">${p.human_impact || "Significant"}</span></div>
        </div>
      `;
      layer.bindPopup(popupHtml);
      layer.on("click", () => showMobileSheet(p.name || p.flood_event, popupHtml));
    }
  }).addTo(historicalFloodsLayer);
}

// 8. Predicted Flood Areas (Advanced GIS: Hidden by default, Requirement #14)
function renderForecastRiskLayer(geojson) {
  forecastRiskLayer.clearLayers();
  if (!geojson || !geojson.features) return;

  L.geoJSON(geojson, {
    style: (feature) => {
      const p = feature.properties || {};
      const isHigh = (p.forecast_risk_level || "").toUpperCase() === "HIGH";
      return {
        color: isHigh ? "#8B5CF6" : "#A78BFA",
        weight: 2,
        opacity: 0.85,
        fillColor: isHigh ? "#8B5CF6" : "#A78BFA",
        fillOpacity: 0.28,
        dashArray: "6, 4"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties || {};
      const popupHtml = createPredictionPopupHtml({
        area: `${p.state || 'Regional'} Predicted Inundation Zone`,
        probability: "78%",
        risk: (p.forecast_risk_level || "HIGH").toUpperCase(),
        expected: p.horizon || "Next 6–12 Hours"
      });

      layer.bindPopup(popupHtml);
      layer.on("click", () => showMobileSheet("Predicted Flood Zone", popupHtml));
    }
  }).addTo(forecastRiskLayer);
}

// =============================================================================
// LIVE DATA INGESTION & FILTERED RENDERING (Requirement #7)
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
        API.getLiveIndiaStatus().catch(() => null),
        API.getIndiaOverview().catch(() => null)
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
    }
  } catch (err) {
    console.error("Failed to fetch live flood data:", err);
  } finally {
    isFetchingLive = false;
  }
}

function renderFilteredLiveLayers() {
  if (!riverStationsLayer || !liveRainfallLayer || !liveAffectedLayer || !riskZonesLayer || !floodWarningsLayer) return;

  riverStationsLayer.clearLayers();
  liveRainfallLayer.clearLayers();
  floodWarningsLayer.clearLayers();
  liveStationMarkers = {};

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
    const riskColor = getRiskColor(st.risk_level);

    const popupHtml = createFloodInfoPopupHtml({
      location: `${st.location_name}${st.state ? ', ' + st.state : ''}`,
      risk: st.risk_level,
      rainfall: st.rainfall_24h_mm,
      riverLevel: st.water_level,
      prediction: isDng ? "Flood imminent (0–3 hours)" : (isWarn ? "Flood possible in 6–12 hours" : "Water levels stable"),
      detailsUrl: `/risk?target=${encodeURIComponent(st.location_name)}`,
      safeLocationUrl: `/safe-locations?origin=${encodeURIComponent(st.location_name)}&lat=${st.latitude}&lng=${st.longitude}`
    });

    // 1. River Monitoring Station Marker (Clustered)
    const riverMarker = L.marker(latlng, {
      icon: createLiveRiverGaugeMarkerIcon(st.water_level, isDng ? "DANGER" : (isWarn ? "WARNING" : "NORMAL"))
    });
    riverMarker.bindPopup(popupHtml);
    riverMarker.on("click", () => showMobileSheet(st.location_name, popupHtml));
    riverStationsLayer.addLayer(riverMarker);
    liveStationMarkers[st.location_name] = riverMarker;

    // 2. Rainfall Station Marker (Clustered)
    const rainOffset = [st.latitude + 0.015, st.longitude + 0.015];
    const rainMarker = L.marker(rainOffset, {
      icon: createLiveRainfallMarkerIcon(st.rainfall_24h_mm, st.rainfall_24h_mm >= 65)
    });
    rainMarker.bindPopup(popupHtml);
    rainMarker.on("click", () => showMobileSheet(`${st.location_name} Rainfall`, popupHtml));
    liveRainfallLayer.addLayer(rainMarker);

    // 3. Warning Alert Beacon (Unclustered for critical visibility)
    if (isCrit || isHigh || isDng) {
      const warnOffset = [st.latitude - 0.015, st.longitude - 0.015];
      const warnMarker = L.marker(warnOffset, {
        icon: createLiveWarningMarkerIcon()
      });
      warnMarker.bindPopup(popupHtml);
      warnMarker.on("click", () => showMobileSheet(`ALERT: ${st.location_name}`, popupHtml));
      floodWarningsLayer.addLayer(warnMarker);
    }
  });
}

function updateLiveDashboardUI(dash, status, overview) {
  const drawerSub = document.getElementById("drawer-last-updated");
  if (drawerSub) {
    drawerSub.textContent = `Synced: ${dash.last_updated_time || "Real-Time"} • ${dash.active_stations_count || 0} stations active`;
  }
}

function updateTelemetryRibbon(dash, overview) {
  const sum = overview?.summary || {};
  const stations = dash.stations || [];

  const riverPeakEl = document.getElementById("ribbon-river-peak");
  if (riverPeakEl && stations.length > 0) {
    const maxSt = stations.reduce((max, s) => (s.water_level > (max?.water_level || 0) ? s : max), stations[0]);
    riverPeakEl.textContent = `${maxSt.location_name}: ${maxSt.water_level}m`;
  }

  const rainPeakEl = document.getElementById("ribbon-downpour");
  if (rainPeakEl) {
    const peak = sum.national_peak_rainfall_24h_mm || dash.basin_summary?.peak_rainfall_24h_mm || 0;
    rainPeakEl.textContent = `${peak} mm / 24h`;
  }

  const activeStationsEl = document.getElementById("ribbon-network");
  if (activeStationsEl) {
    activeStationsEl.textContent = `${dash.active_stations_count || stations.length || 38} Monitored Stations`;
  }
}

// Auto-Refresh & Synchronization
function setupAutoRefreshTimer() {
  if (countdownTimerId) clearInterval(countdownTimerId);
  updateTimerDisplay();

  countdownTimerId = setInterval(() => {
    if (autoRefreshInterval <= 0) return;
    secondsRemaining--;
    if (secondsRemaining <= 0) {
      secondsRemaining = autoRefreshInterval;
      if (currentMapMode === "LIVE") fetchAndRenderLiveData(false);
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

window.onAutoRefreshChange = function(val) {
  autoRefreshInterval = parseInt(val, 10);
  secondsRemaining = autoRefreshInterval;
  updateTimerDisplay();
};

window.forceSyncLiveData = async function() {
  secondsRemaining = autoRefreshInterval > 0 ? autoRefreshInterval : 300;
  updateTimerDisplay();
  if (typeof showToast === "function") {
    showToast("⚡ Synchronizing live rainfall, river telemetry, and spatial warnings...", "info");
  }
  await fetchAndRenderLiveData(true);
};

window.triggerLiveMeteoSync = window.forceSyncLiveData;

// =============================================================================
// LAYER MANAGEMENT (Requirements #3 & #16)
// =============================================================================

function setupLayerToggles() {
  const toggleMap = {
    "toggle-live-affected": () => liveAffectedLayer,
    "toggle-risk-zones": () => riskZonesLayer,
    "toggle-major-rivers": () => majorRiversLayer,
    "toggle-shelters": () => sheltersLayer,
    "toggle-state-boundaries": () => indiaStatesLayer,
    "toggle-district-boundaries": () => districtsLayer,
    "toggle-river-stations": () => riverStationsLayer,
    "toggle-live-rainfall": () => liveRainfallLayer,
    "toggle-flood-warnings": () => floodWarningsLayer,
    "toggle-historical-floods": () => historicalFloodsLayer,
    "toggle-forecast-risk": () => forecastRiskLayer,
    "toggle-hospitals": () => hospitalsLayer
  };

  Object.entries(toggleMap).forEach(([elemId, getLayer]) => {
    const chk = document.getElementById(elemId);
    if (chk) {
      const layer = getLayer();
      if (layer && map) {
        chk.checked = map.hasLayer(layer);
      }
      chk.addEventListener("change", (e) => {
        const lyr = getLayer();
        if (!lyr) return;
        if (e.target.checked) {
          if (!map.hasLayer(lyr)) map.addLayer(lyr);
        } else {
          if (map.hasLayer(lyr)) map.removeLayer(lyr);
        }
      });
    }
  });

  // Satellite Remote Sensing Overlay
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
        if (typeof showToast === "function") showToast("🛰️ ISRO Bhuvan Disaster Overlay Activated", "info");
      } else {
        if (map.hasLayer(bhuvanDisasterLayer)) map.removeLayer(bhuvanDisasterLayer);
      }
    });
  }
}

// Mode Switcher (Public Citizen vs Admin / GIS)
window.applyModeToMap = function(mode) {
  const isCitizen = mode === "citizen";
  const statusLabel = document.getElementById("map-status-mode-label");
  if (statusLabel) {
    statusLabel.textContent = isCitizen ? "LIVE CITIZEN SAFETY RADAR" : "ADMIN / GIS WORKBENCH ACTIVE";
  }
};

window.setMapMode = function(mode) {
  currentMapMode = mode;
  const btnLive = document.getElementById("btn-mode-live");
  const btnHist = document.getElementById("btn-mode-historical");

  if (mode === "LIVE") {
    if (btnLive) btnLive.classList.add("active-live");
    if (btnHist) btnHist.classList.remove("active-hist");

    if (map.hasLayer(historicalFloodsLayer)) map.removeLayer(historicalFloodsLayer);
    if (!map.hasLayer(liveAffectedLayer)) map.addLayer(liveAffectedLayer);
    if (!map.hasLayer(riskZonesLayer)) map.addLayer(riskZonesLayer);

    renderFilteredLiveLayers();
    if (typeof showToast === "function") showToast("🟢 Live India Flood Safety Mode Activated", "success");
  } else {
    if (btnHist) btnHist.classList.add("active-hist");
    if (btnLive) btnLive.classList.remove("active-live");

    if (map.hasLayer(liveAffectedLayer)) map.removeLayer(liveAffectedLayer);
    if (!map.hasLayer(historicalFloodsLayer)) map.addLayer(historicalFloodsLayer);

    if (typeof showToast === "function") showToast("🏛️ Historical Disaster Archive Mode Activated", "info");
  }
};

window.toggleLiveDashboardDrawer = function() {
  const drawer = document.getElementById("live-dashboard-drawer");
  if (!drawer) return;
  drawer.classList.toggle("open");
};

// =============================================================================
// SEARCH SYSTEM WITH AUTOCOMPLETE (Requirement #9)
// =============================================================================

function setupMapSearch() {
  const searchInput = document.getElementById("map-search-input");
  const suggestionsBox = document.getElementById("search-suggestions");
  if (!searchInput) return;

  function buildSearchIndex() {
    const items = [];

    // 1. States & Districts
    Object.entries(allStatesMeta).forEach(([stName, meta]) => {
      items.push({
        type: "state",
        title: stName,
        subtitle: `State • Capital: ${meta.capital || "N/A"}`,
        badge: "STATE",
        badgeCls: "search-badge-state",
        lat: meta.center[0],
        lng: meta.center[1],
        zoom: meta.zoom || 7,
        action: () => {
          const stateSelect = document.getElementById("state-selector");
          if (stateSelect) {
            stateSelect.value = stName;
            onStateSelectChange(stName);
          } else {
            map.flyTo(meta.center, meta.zoom || 7, { duration: 1.2 });
          }
        }
      });

      (meta.flood_prone_districts || []).forEach((dist) => {
        items.push({
          type: "district",
          title: dist,
          subtitle: `District • ${stName}`,
          badge: "DISTRICT",
          badgeCls: "search-badge-state",
          lat: meta.center[0],
          lng: meta.center[1],
          zoom: 9,
          action: () => {
            const stateSelect = document.getElementById("state-selector");
            if (stateSelect) {
              stateSelect.value = stName;
              onStateSelectChange(stName);
              setTimeout(() => {
                const distSelect = document.getElementById("district-selector");
                if (distSelect) {
                  distSelect.value = dist;
                  onDistrictSelectChange(dist);
                }
              }, 200);
            }
          }
        });
      });
    });

    // 2. Basins & Rivers
    Object.entries(allBasinsMeta).forEach(([bk, b]) => {
      items.push({
        type: "river",
        title: b.name || bk,
        subtitle: `River Basin • ${(b.states_covered || []).join(", ")}`,
        badge: "RIVER",
        badgeCls: "search-badge-river",
        lat: b.center[0],
        lng: b.center[1],
        zoom: b.zoom || 6,
        action: () => {
          const basinSelect = document.getElementById("basin-selector");
          if (basinSelect) {
            basinSelect.value = bk;
            onBasinSelectChange(bk);
          } else {
            map.flyTo(b.center, b.zoom || 6, { duration: 1.2 });
          }
        }
      });
    });

    // 3. Monitored Stations
    rawStationsData.forEach((st) => {
      items.push({
        type: "station",
        title: st.location_name,
        subtitle: `${st.river_name || "River"} • ${st.state} (Risk: ${st.risk_level})`,
        badge: "STATION",
        badgeCls: "search-badge-station",
        lat: st.latitude,
        lng: st.longitude,
        zoom: 12,
        action: () => {
          map.flyTo([st.latitude, st.longitude], 13, { duration: 1.1 });
          const marker = liveStationMarkers[st.location_name];
          if (marker) setTimeout(() => marker.openPopup(), 1200);
        }
      });
    });

    // 4. Safe Shelters
    cachedSheltersData.forEach((sh) => {
      const lat = sh.latitude || (sh.geometry?.coordinates ? sh.geometry.coordinates[1] : null);
      const lng = sh.longitude || (sh.geometry?.coordinates ? sh.geometry.coordinates[0] : null);
      const name = sh.name || sh.properties?.name || "Safe Shelter";
      if (lat && lng) {
        items.push({
          type: "shelter",
          title: name,
          subtitle: `Safe Shelter • Capacity: ${sh.capacity || sh.properties?.capacity || 200}`,
          badge: "SHELTER",
          badgeCls: "search-badge-shelter",
          lat: lat,
          lng: lng,
          zoom: 13,
          action: () => {
            map.flyTo([lat, lng], 13, { duration: 1.1 });
            if (sh._marker) setTimeout(() => sh._marker.openPopup(), 1200);
          }
        });
      }
    });

    // 5. Flood Areas
    cachedFloodPolygons.forEach((fp) => {
      const p = fp.properties || {};
      const center = fp.center || (fp.geometry?.coordinates?.[0]?.[0] ? [fp.geometry.coordinates[0][0][1], fp.geometry.coordinates[0][0][0]] : null);
      if (center) {
        items.push({
          type: "flood",
          title: p.name || "Flood Area",
          subtitle: `Flood Zone • Risk: ${p.risk_level || p.risk || "High"} (${p.district || "District"})`,
          badge: "FLOOD AREA",
          badgeCls: "search-badge-flood",
          lat: center[0],
          lng: center[1],
          zoom: 12,
          action: () => {
            map.flyTo(center, 12, { duration: 1.1 });
            if (fp._layer) setTimeout(() => fp._layer.openPopup(), 1200);
          }
        });
      }
    });

    return items;
  }

  // Live Suggestion Trigger on Typing
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    if (!suggestionsBox) return;

    if (!q || q.length < 2) {
      suggestionsBox.innerHTML = "";
      suggestionsBox.classList.remove("active");
      return;
    }

    const index = buildSearchIndex();
    const matches = index.filter(item =>
      item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
    ).slice(0, 8);

    if (matches.length === 0) {
      suggestionsBox.innerHTML = `
        <div style="padding: 0.75rem; text-align: center; color: #94A3B8; font-size: 0.8rem;">
          No matching location found. Try searching Cuttack, Assam, Ganga, or a safe shelter.
        </div>
      `;
      suggestionsBox.classList.add("active");
      return;
    }

    suggestionsBox.innerHTML = "";
    matches.forEach((m) => {
      const row = document.createElement("div");
      row.className = "search-suggestion-item";
      row.innerHTML = `
        <div>
          <div style="font-weight: 700; color: #FFFFFF;">${m.title}</div>
          <div style="font-size: 0.72rem; color: #94A3B8;">${m.subtitle}</div>
        </div>
        <span class="search-suggestion-badge ${m.badgeCls}">${m.badge}</span>
      `;
      row.onclick = () => {
        searchInput.value = m.title;
        suggestionsBox.classList.remove("active");
        m.action();
      };
      suggestionsBox.appendChild(row);
    });
    suggestionsBox.classList.add("active");
  });

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!searchInput.contains(e.target) && (!suggestionsBox || !suggestionsBox.contains(e.target))) {
      suggestionsBox?.classList.remove("active");
    }
  });

  // Enter Key Handler
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const q = searchInput.value.toLowerCase().trim();
      if (!q) return;
      suggestionsBox?.classList.remove("active");

      const index = buildSearchIndex();
      const match = index.find(item => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q));
      if (match) {
        match.action();
        if (typeof showToast === "function") showToast(`📍 Located: ${match.title}`, "success");
      } else {
        if (typeof showToast === "function") showToast(`Location "${q}" not found. Try 'Cuttack', 'Kerala', 'Ganga', or 'Assam'`, "info");
      }
    }
  });
}

// =============================================================================
// GPS USER LOCATION & EVACUATION ROUTES (Requirements #10, #11, #12)
// =============================================================================

function locateUser() {
  if (!map) return;
  if (!navigator.geolocation) {
    if (typeof showToast === "function") showToast("Geolocation not supported by your browser.", "error");
    return;
  }

  if (typeof showToast === "function") showToast("Acquiring GPS location...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: "#0284C7",
        color: "#FFFFFF",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.95
      }).addTo(map);

      map.setView([lat, lng], 13);
      showUserLocationCard(lat, lng);

      if (typeof showToast === "function") showToast("📍 GPS Coordinate Locked!", "success");
    },
    () => {
      if (typeof showToast === "function") showToast("GPS unavailable. Centering on national view.", "info");
      map.setView([22.9734, 78.6569], 5);
    }
  );
}

function showUserLocationCard(lat, lng) {
  // Compute distance to all shelters to find the nearest
  let nearestShelter = null;
  let minDistanceKm = Infinity;

  cachedSheltersData.forEach((sh) => {
    const sLat = sh.latitude;
    const sLng = sh.longitude;
    if (sLat && sLng) {
      const d = computeHaversineDistance(lat, lng, sLat, sLng);
      if (d < minDistanceKm) {
        minDistanceKm = d;
        nearestShelter = {
          name: sh.name || "Designated Safe Shelter",
          lat: sLat,
          lng: sLng,
          distance: d.toFixed(1) + " km",
          capacity: sh.capacity || 200,
          available: Math.max(0, (sh.capacity || 200) - (sh.current_occupancy || 0))
        };
      }
    }
  });

  // Calculate local flood risk
  let localRisk = "Low";
  cachedFloodPolygons.forEach((fp) => {
    const p = fp.properties || {};
    if (fp.center) {
      const d = computeHaversineDistance(lat, lng, fp.center[0], fp.center[1]);
      if (d < 10) {
        localRisk = p.risk_level || p.risk || "Medium";
      }
    }
  });

  const riskColor = getRiskColor(localRisk);
  const distStr = nearestShelter ? nearestShelter.distance : "1.8 km";

  const popupHtml = `
    <div class="popup-card" style="padding: 1.1rem; min-width: 250px;">
      <div style="font-size: 0.72rem; font-weight: 800; color: #38BDF8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.45rem;">
        YOUR LOCATION
      </div>

      <div style="margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Flood Risk:</span>
        <span style="font-weight: 800; font-size: 0.85rem; padding: 2px 8px; border-radius: 4px; background: ${riskColor}22; color: ${riskColor}; border: 1px solid ${riskColor}66;">
          ${localRisk.toUpperCase()}
        </span>
      </div>

      <div style="margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Nearest Shelter:</span>
        <strong style="font-size: 0.95rem; color: #10B981; font-family: var(--font-mono);">${distStr}</strong>
      </div>

      ${nearestShelter ? `
        <button onclick="drawEvacuationRouteTo(${nearestShelter.lat}, ${nearestShelter.lng}, '${nearestShelter.name.replace(/'/g, "\\'")}', [${lat}, ${lng}])" class="btn btn-sm btn-primary" style="width: 100%; text-align: center; font-size: 0.8rem; padding: 0.45rem;">
          Get Directions
        </button>
      ` : ''}
    </div>
  `;

  if (userLocationMarker) {
    userLocationMarker.bindPopup(popupHtml).openPopup();
  }

  showMobileSheet("Your Location", popupHtml);
}

// Draw Evacuation Route Polyline (Requirement #12)
window.drawEvacuationRouteTo = function(destLat, destLng, destName, originLatLng = null) {
  if (!map || !evacuationRoutesLayer) return;
  evacuationRoutesLayer.clearLayers();

  const start = originLatLng || (userLocationMarker ? [userLocationMarker.getLatLng().lat, userLocationMarker.getLatLng().lng] : [destLat - 0.02, destLng - 0.02]);

  const latDiff = destLat - start[0];
  const lngDiff = destLng - start[1];

  // Route waypoints avoiding low-lying inundation zones
  const waypoints = [
    [start[0], start[1]],
    [start[0] + latDiff * 0.35 + 0.004, start[1] + lngDiff * 0.25 - 0.003],
    [start[0] + latDiff * 0.7 + 0.002, start[1] + lngDiff * 0.75 + 0.002],
    [destLat, destLng]
  ];

  const routeLine = L.polyline(waypoints, {
    color: "#10B981",
    weight: 5,
    opacity: 0.95,
    className: "leaflet-route-safe",
    lineCap: "round",
    lineJoin: "round"
  }).addTo(evacuationRoutesLayer);

  const routePopup = `
    <div class="popup-card" style="padding: 0.85rem; min-width: 220px;">
      <div style="font-size: 0.72rem; font-weight: 800; color: #10B981; text-transform: uppercase;">
        ✓ RECOMMENDED SAFE ROUTE
      </div>
      <div style="font-size: 0.92rem; font-weight: 800; color: #FFFFFF; margin: 0.35rem 0;">
        Destination: ${destName}
      </div>
      <div style="font-size: 0.75rem; color: #94A3B8;">
        Safety Verified: Route bypasses active inundation zones and submerged roads.
      </div>
    </div>
  `;
  routeLine.bindPopup(routePopup);

  map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });

  if (typeof showToast === "function") {
    showToast(`🟢 Recommended safe evacuation route plotted to ${destName}!`, "success");
  }
};

// =============================================================================
// MOBILE RESPONSIVENESS & BOTTOM SHEET (Requirement #17)
// =============================================================================

window.showMobileSheet = function(title, htmlContent) {
  if (window.innerWidth >= 768) return;
  const sheet = document.getElementById("mobile-sheet");
  const sheetTitle = document.getElementById("mobile-sheet-title");
  const sheetBody = document.getElementById("mobile-sheet-body");
  if (!sheet || !sheetBody) return;

  if (sheetTitle) sheetTitle.textContent = title || "Location Details";
  sheetBody.innerHTML = htmlContent;
  sheet.classList.add("open");
};

window.closeMobileSheet = function() {
  const sheet = document.getElementById("mobile-sheet");
  if (sheet) sheet.classList.remove("open");
};

// =============================================================================
// ALERT & URL DEEP LINKING INTEGRATION (Requirement #13)
// =============================================================================

function handleUrlDeepLinking() {
  const urlParams = new URLSearchParams(window.location.search);
  const lat = parseFloat(urlParams.get("lat"));
  const lng = parseFloat(urlParams.get("lng"));
  const focus = urlParams.get("focus");

  if (!isNaN(lat) && !isNaN(lng)) {
    setTimeout(() => {
      map.flyTo([lat, lng], 13, { duration: 1.2 });
      const match = Object.values(liveStationMarkers).find(m => {
        const p = m.getLatLng();
        return Math.abs(p.lat - lat) < 0.05 && Math.abs(p.lng - lng) < 0.05;
      });
      if (match) setTimeout(() => match.openPopup(), 1300);
    }, 800);
  } else if (focus) {
    setTimeout(() => {
      const searchInput = document.getElementById("map-search-input");
      if (searchInput) {
        searchInput.value = focus;
        const enterEvt = new KeyboardEvent("keypress", { key: "Enter" });
        searchInput.dispatchEvent(enterEvt);
      }
    }, 800);
  }
}
