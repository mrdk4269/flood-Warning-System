/**
 * FloodGuard Advanced Tactical GIS Mapping Engine
 * Multi-layer telemetry, coordinate tracker, basemap switcher, and spatial popups.
 */

let map = null;
let floodAreasLayer = null;
let riskZonesLayer = null;
let riversLayer = null;
let sheltersLayer = null;
let hospitalsLayer = null;
let rainfallStationsLayer = null;
let userLocationMarker = null;
let currentBasemap = null;

// Tile Layer Providers
const BASEMAPS = {
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  streets: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
};

// Custom Marker Generator with Pulsing Beacon
function createCustomIcon(bgGradient, svgInner, isAlert = false) {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
        ${isAlert ? '<div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: pulseCritical 1.8s infinite;"></div>' : ''}
        <div style="
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: ${bgGradient};
          border: 1.5px solid rgba(255, 255, 255, 0.8);
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
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18]
  });
}

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

// Initialize Map
function initFloodMap(containerId = "map-container", options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const defaultCenter = [10.04, 76.34];
  const defaultZoom = options.preview ? 11 : 12;

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
  floodAreasLayer = L.layerGroup().addTo(map);
  riskZonesLayer = L.layerGroup().addTo(map);
  riversLayer = L.layerGroup().addTo(map);
  sheltersLayer = L.layerGroup().addTo(map);
  hospitalsLayer = L.layerGroup().addTo(map);
  rainfallStationsLayer = L.layerGroup().addTo(map);

  // Load GeoJSON Data
  loadAllMapLayers();

  if (!options.preview) {
    setupCoordinateTracker();
    setupBasemapSwitcher();
    setupLayerToggles();
    setupMapSearch();
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
    // Approximate elevation formula for prototype terrain
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
    if (BASEMAPS[chosen] && currentBasemap) {
      map.removeLayer(currentBasemap);
      currentBasemap = L.tileLayer(BASEMAPS[chosen], { maxZoom: 19 }).addTo(map);
      // Bring overlay layers to front
      floodAreasLayer.bringToFront?.();
      riversLayer.bringToFront?.();
    }
  });
}

// Load All 6 GeoJSON Layers
async function loadAllMapLayers() {
  try {
    const [floodAreas, riskZones, rivers, shelters, hospitals, rainfall] = await Promise.all([
      API.getGeoJsonLayer("flood_areas"),
      API.getGeoJsonLayer("risk_zones"),
      API.getGeoJsonLayer("rivers"),
      API.getGeoJsonLayer("shelters"),
      API.getGeoJsonLayer("hospitals"),
      API.getGeoJsonLayer("rainfall_stations")
    ]);

    renderFloodAreas(floodAreas);
    renderRiskZones(riskZones);
    renderRivers(rivers);
    renderShelters(shelters);
    renderHospitals(hospitals);
    renderRainfallStations(rainfall);
  } catch (err) {
    console.error("Failed to load GIS layers:", err);
  }
}

// Layer 1: Flood Areas
function renderFloodAreas(geojson) {
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
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--accent-blue); text-transform:uppercase;">● ACTIVE FLOOD MONITORING ZONE</div>
          <div class="popup-title">${p.name}</div>
          <div style="margin-bottom: 0.6rem;">${renderRiskBadge(p.risk_level)}</div>
          <div class="popup-row">
            <span class="popup-label">District</span>
            <span class="popup-val">${p.district || "Central Basin"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Precipitation (24h)</span>
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
            <span class="popup-label">Telemetry Synced</span>
            <span class="popup-val mono">${p.last_updated ? p.last_updated.split(" ")[1] : "Live"}</span>
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
function renderRiskZones(geojson) {
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
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#94A3B8;">PERIMETER HAZARD BUFFER</div>
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
function renderRivers(geojson) {
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
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#38BDF8;">HYDROMETRIC RIVER TRANSECT</div>
          <div class="popup-title">${p.river_name}</div>
          <div class="popup-row">
            <span class="popup-label">Gauge Status</span>
            <span class="popup-val mono" style="color: ${p.water_level >= p.danger_level ? '#EF4444' : (p.water_level >= p.warning_level ? '#F59E0B' : '#10B981')}">● ${p.status}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Current Water Level</span>
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
            <span class="popup-label">Discharge Flow</span>
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
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#10B981;">DESIGNATED EMERGENCY REFUGE</div>
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
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#EF4444;">EMERGENCY TRAUMA WING</div>
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

// Layer 6: Rainfall Stations
function renderRainfallStations(geojson) {
  rainfallStationsLayer.clearLayers();

  L.geoJSON(geojson, {
    pointToLayer: (feature, latlng) => {
      return L.marker(latlng, { icon: ICONS.rainfall });
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div style="font-family:var(--font-mono); font-size:0.7rem; color:#38BDF8;">AUTOMATED RAIN GAUGE</div>
          <div class="popup-title">${p.station_name}</div>
          <div class="popup-row">
            <span class="popup-label">24h Precipitation</span>
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
            <span class="popup-label">Last Transmission</span>
            <span class="popup-val mono">${p.last_reading_time ? p.last_reading_time.split(" ")[1] : "Live"}</span>
          </div>
        </div>
      `);
    }
  }).addTo(rainfallStationsLayer);
}

// Setup Layer Toggles
function setupLayerToggles() {
  const toggleMap = {
    "toggle-flood-areas": floodAreasLayer,
    "toggle-risk-zones": riskZonesLayer,
    "toggle-rivers": riversLayer,
    "toggle-shelters": sheltersLayer,
    "toggle-hospitals": hospitalsLayer,
    "toggle-rainfall": rainfallStationsLayer
  };

  Object.entries(toggleMap).forEach(([elemId, layer]) => {
    const chk = document.getElementById(elemId);
    if (chk) {
      chk.addEventListener("change", (e) => {
        if (e.target.checked) {
          map.addLayer(layer);
        } else {
          map.removeLayer(layer);
        }
      });
    }
  });
}

// Geolocation: Find My Location
function locateUser() {
  if (!map) return;
  if (!navigator.geolocation) {
    showToast("Geolocation not supported by your browser.", "error");
    return;
  }

  showToast("Scanning GPS satellite lock...", "info");

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
      showToast("GPS Coordinate Locked!", "success");
    },
    () => {
      showToast("GPS simulated to District Command Center.", "info");
      map.setView([10.04, 76.34], 13);
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
      floodAreasLayer.eachLayer((layer) => {
        const name = layer.feature?.properties?.name?.toLowerCase() || "";
        if (name.includes(query) && !found) {
          map.fitBounds(layer.getBounds(), { maxZoom: 14 });
          layer.openPopup();
          found = true;
        }
      });

      if (!found) {
        sheltersLayer.eachLayer((layer) => {
          const name = layer.feature?.properties?.name?.toLowerCase() || "";
          if (name.includes(query) && !found) {
            map.setView(layer.getLatLng(), 14);
            layer.openPopup();
            found = true;
          }
        });
      }

      if (!found) {
        showToast(`Target '${query}' not located. Try 'Zone A' or 'Delta'`, "info");
      }
    }
  });
}
