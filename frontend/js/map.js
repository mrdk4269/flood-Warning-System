/**
 * FloodGuard GIS Mapping Engine
 * Powered by Leaflet.js and GeoJSON Layers.
 */

let map = null;
let floodAreasLayer = null;
let riskZonesLayer = null;
let riversLayer = null;
let sheltersLayer = null;
let hospitalsLayer = null;
let rainfallStationsLayer = null;
let userLocationMarker = null;

// Custom Marker Icons
function createCustomIcon(bgGradient, svgInner) {
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: ${bgGradient};
        border: 2px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        transition: transform 0.2s;
      ">
        ${svgInner}
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
}

const ICONS = {
  shelter: createCustomIcon(
    "linear-gradient(135deg, #10B981 0%, #059669 100%)",
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
  ),
  hospital: createCustomIcon(
    "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)",
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 6v12"/><path d="M6 12h12"/></svg>`
  ),
  rainfall: createCustomIcon(
    "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`
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

  // Base Tiles (Dark Mode / OpenStreetMap)
  const cartoDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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

  // Setup Layer Toggle Listeners if present
  setupLayerToggles();

  // Setup Search Bar if present
  setupMapSearch();

  return map;
}

// Load All 6 GeoJSON Layers
async function loadAllMapLayers() {
  try {
    // 1. Flood Areas Layer (Polygons)
    const floodAreas = await API.getGeoJsonLayer("flood_areas");
    renderFloodAreas(floodAreas);

    // 2. Risk Zones Layer (Polygons)
    const riskZones = await API.getGeoJsonLayer("risk_zones");
    renderRiskZones(riskZones);

    // 3. Rivers Layer (Lines)
    const rivers = await API.getGeoJsonLayer("rivers");
    renderRivers(rivers);

    // 4. Shelters Layer (Points)
    const shelters = await API.getGeoJsonLayer("shelters");
    renderShelters(shelters);

    // 5. Hospitals Layer (Points)
    const hospitals = await API.getGeoJsonLayer("hospitals");
    renderHospitals(hospitals);

    // 6. Rainfall Stations (Points)
    const rainfall = await API.getGeoJsonLayer("rainfall_stations");
    renderRainfallStations(rainfall);

  } catch (err) {
    console.error("Failed to load map layers:", err);
  }
}

// Layer 1: Flood Areas
function renderFloodAreas(geojson) {
  floodAreasLayer.clearLayers();

  const getRiskColor = (level) => {
    const l = (level || "").toUpperCase();
    if (l === "CRITICAL") return "#DC2626";
    if (l === "HIGH") return "#EF4444";
    if (l === "MEDIUM") return "#F59E0B";
    return "#10B981";
  };

  L.geoJSON(geojson, {
    style: (feature) => {
      const color = getRiskColor(feature.properties.risk_level);
      return {
        color: color,
        weight: 2.5,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: 0.35,
        dashArray: "3"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      const popupHtml = `
        <div class="popup-card">
          <div class="popup-title">${p.name}</div>
          <div style="margin-bottom: 0.6rem;">${renderRiskBadge(p.risk_level)}</div>
          <div class="popup-row">
            <span class="popup-label">District</span>
            <span class="popup-val">${p.district || "Central Basin"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Current Rainfall</span>
            <span class="popup-val mono">${p.rainfall} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Water Level</span>
            <span class="popup-val mono">${p.water_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Elevation</span>
            <span class="popup-val mono">${p.elevation || "8"} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">History</span>
            <span class="popup-val">${p.historical_frequency || "Moderate"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Last Updated</span>
            <span class="popup-val">${p.last_updated ? p.last_updated.split(" ")[1] : "Today"}</span>
          </div>
          <div style="margin-top: 0.85rem; display: flex; gap: 0.5rem;">
            <a href="/risk?area=${encodeURIComponent(p.name)}" class="btn btn-sm btn-primary" style="flex:1;">Analyze Risk</a>
            <a href="/safe-locations?origin=${encodeURIComponent(p.name)}" class="btn btn-sm btn-secondary" style="flex:1;">Find Shelter</a>
          </div>
        </div>
      `;
      layer.bindPopup(popupHtml);

      layer.on("mouseover", function () {
        this.setStyle({ fillOpacity: 0.6, weight: 3.5 });
      });
      layer.on("mouseout", function () {
        this.setStyle({ fillOpacity: 0.35, weight: 2.5 });
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
        color: p.color || "#3B82F6",
        weight: 1.5,
        opacity: 0.6,
        fillColor: p.color || "#3B82F6",
        fillOpacity: 0.15
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div class="popup-title">${p.zone_name}</div>
          <div style="margin-bottom: 0.5rem;">${renderRiskBadge(p.risk_level)}</div>
          <div class="popup-row">
            <span class="popup-label">Score Range</span>
            <span class="popup-val mono">${p.score_range}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Advisory</span>
            <span class="popup-val">${p.action_advisory}</span>
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
      let color = "#38BDF8"; // Normal Cyan
      let weight = 4.5;
      if (p.water_level >= p.danger_level) {
        color = "#DC2626"; // Danger
        weight = 6;
      } else if (p.water_level >= p.warning_level) {
        color = "#F59E0B"; // Warning
        weight = 5;
      }
      return {
        color: color,
        weight: weight,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round"
      };
    },
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.bindPopup(`
        <div class="popup-card">
          <div class="popup-title">${p.river_name}</div>
          <div class="popup-row">
            <span class="popup-label">Status</span>
            <span class="popup-val mono" style="color: ${p.water_level >= p.danger_level ? '#EF4444' : (p.water_level >= p.warning_level ? '#F59E0B' : '#10B981')}">${p.status}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Water Level</span>
            <span class="popup-val mono">${p.water_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Warning Level</span>
            <span class="popup-val mono">${p.warning_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Danger Level</span>
            <span class="popup-val mono">${p.danger_level} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Flow Rate</span>
            <span class="popup-val mono">${p.flow_rate_cumecs || "N/A"} cumecs</span>
          </div>
        </div>
      `);
    }
  }).addTo(riversLayer);
}

// Layer 4: Safe Locations (Shelters)
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
          <div class="popup-title">${p.name}</div>
          <div class="badge badge-low" style="margin-bottom:0.5rem;">${p.type}</div>
          <div class="popup-row">
            <span class="popup-label">Capacity</span>
            <span class="popup-val mono">${p.capacity} People</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Occupancy</span>
            <span class="popup-val mono">${p.current_occupancy || 0}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Elevation</span>
            <span class="popup-val mono">${p.elevation || "Safe High Ground"} m</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Contact</span>
            <span class="popup-val">${p.contact}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Supplies</span>
            <span class="popup-val" style="font-size:0.75rem;">${p.supplies || "Rations, Medical"}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-primary" style="width:100%;">
              Navigate Route
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
          <div class="popup-title">${p.hospital_name}</div>
          <div class="badge badge-medium" style="margin-bottom:0.5rem;">${p.status}</div>
          <div class="popup-row">
            <span class="popup-label">Emergency</span>
            <span class="popup-val">${p.emergency_availability}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Available Beds</span>
            <span class="popup-val mono">${p.available_beds} / ${p.total_beds}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Ambulance</span>
            <span class="popup-val mono">${p.ambulance_helpline || "108"}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Phone</span>
            <span class="popup-val">${p.contact}</span>
          </div>
          <div style="margin-top: 0.75rem;">
            <a href="/safe-locations?target=${encodeURIComponent(p.hospital_name)}&lat=${layer.getLatLng().lat}&lng=${layer.getLatLng().lng}" class="btn btn-sm btn-danger" style="width:100%;">
              Emergency Route
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
          <div class="popup-title">${p.station_name}</div>
          <div class="popup-row">
            <span class="popup-label">Current Rainfall</span>
            <span class="popup-val mono" style="color:#60A5FA; font-weight:700;">${p.rainfall_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Intensity</span>
            <span class="popup-val">${p.intensity}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">24h Accumulation</span>
            <span class="popup-val mono">${p.cumulative_24h_mm || p.rainfall_mm} mm</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Reading Time</span>
            <span class="popup-val">${p.last_reading_time ? p.last_reading_time.split(" ")[1] : "Live"}</span>
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
    showToast("Geolocation is not supported by your browser.", "error");
    return;
  }

  showToast("Locating your position...", "info");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (userLocationMarker) {
        map.removeLayer(userLocationMarker);
      }

      userLocationMarker = L.circleMarker([lat, lng], {
        radius: 9,
        fillColor: "#3B82F6",
        color: "#FFFFFF",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      userLocationMarker.bindPopup("<b>Your Current Position</b><br>Coordinates: " + lat.toFixed(4) + ", " + lng.toFixed(4)).openPopup();
      map.setView([lat, lng], 13);
      showToast("Location locked!", "success");
    },
    (err) => {
      // If permission denied or unavailable, center on default representative point
      showToast("GPS position simulated to district center.", "info");
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
        showToast(`Location '${query}' not found. Try 'Zone A' or 'Shelter'`, "info");
      }
    }
  });
}
