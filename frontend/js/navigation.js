/**
 * FloodGuard India - Real-Time Flood-Safe Road Navigation System
 * 
 * Features:
 * 1. Road-based navigation on real road networks (via OSRM).
 * 2. Active flood intersection analysis (Turf.js & spatial math).
 * 3. Automatic safe alternative route calculation avoiding flood polygons.
 * 4. Real-time route monitoring & dynamic recalculation upon live flood changes.
 * 5. GPS tracking & click-on-map coordinate selection.
 */

const FloodNavigationSystem = {
  map: null,
  isActive: false,
  isNavigating: false,
  origin: null,         // { lat, lng, name }
  destination: null,    // { lat, lng, name }
  currentRouteData: null,
  watchId: null,
  monitorTimerId: null,
  selectingMode: null,  // "origin" | "destination" | null

  // Leaflet Layer Groups & Markers
  navLayerGroup: null,
  originMarker: null,
  destMarker: null,
  primaryPolyline: null,
  safePolyline: null,
  hazardMarkers: [],

  init(leafletMap) {
    this.map = leafletMap;
    if (!this.map) return;
    this.navLayerGroup = L.layerGroup().addTo(this.map);

    // Click on map to set origin or destination
    this.map.on("click", (e) => {
      if (this.selectingMode === "origin") {
        this.setOrigin(e.latlng.lat, e.latlng.lng, `Selected Location (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
        this.clearSelectingMode();
      } else if (this.selectingMode === "destination") {
        this.setDestination(e.latlng.lat, e.latlng.lng, `Selected Location (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
        this.clearSelectingMode();
      }
    });

    this.bindDomEvents();
  },

  bindDomEvents() {
    const destInput = document.getElementById("nav-dest-input");
    if (destInput) {
      let debounceTimer = null;
      destInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        const q = e.target.value.trim();
        if (q.length < 2) {
          this.hideSuggestions();
          return;
        }
        debounceTimer = setTimeout(() => this.searchDestinations(q), 350);
      });
    }

    const originInput = document.getElementById("nav-origin-input");
    if (originInput) {
      let debounceTimer = null;
      originInput.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        const q = e.target.value.trim();
        if (q.length < 2) {
          this.hideSuggestions();
          return;
        }
        debounceTimer = setTimeout(() => this.searchOrigins(q), 350);
      });
    }
  },

  openPanel() {
    const panel = document.getElementById("navigation-panel");
    if (panel) {
      panel.classList.remove("collapsed");
      panel.classList.add("open");
      document.body.classList.add("navigation-panel-open");
    }
    // Auto-populate origin with current GPS if available
    if (!this.origin && typeof userLocationMarker !== "undefined" && userLocationMarker) {
      const latlng = userLocationMarker.getLatLng();
      this.setOrigin(latlng.lat, latlng.lng, "My Current Location");
    }
    // Close other panels for cleanliness
    if (typeof window.closeOtherPanels === "function") {
      window.closeOtherPanels("navigation");
    }
  },

  closePanel() {
    const panel = document.getElementById("navigation-panel");
    if (panel) {
      panel.classList.add("collapsed");
      panel.classList.remove("open");
      document.body.classList.remove("navigation-panel-open");
    }
    this.clearSelectingMode();
  },

  togglePanel() {
    const panel = document.getElementById("navigation-panel");
    if (panel && panel.classList.contains("open")) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  },

  enableSelectOnMap(type) {
    this.selectingMode = type;
    const toastMsg = type === "origin" ? "📍 Click anywhere on the map to set Start Location" : "🎯 Click anywhere on the map to set Destination";
    if (typeof showToast === "function") showToast(toastMsg, "info");
    if (this.map) this.map.getContainer().style.cursor = "crosshair";
  },

  clearSelectingMode() {
    this.selectingMode = null;
    if (this.map) this.map.getContainer().style.cursor = "";
  },

  setOrigin(lat, lng, name = "Start Location") {
    this.origin = { lat: parseFloat(lat), lng: parseFloat(lng), name };
    const input = document.getElementById("nav-origin-input");
    if (input) input.value = name;

    if (this.originMarker && this.navLayerGroup) {
      this.navLayerGroup.removeLayer(this.originMarker);
    }

    const icon = L.divIcon({
      className: "nav-pin-origin",
      html: `<div style="background:#0284C7; width:22px; height:22px; border-radius:50%; border:3px solid #FFFFFF; box-shadow:0 0 10px rgba(2,132,199,0.8); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:10px; font-weight:800;">A</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    this.originMarker = L.marker([lat, lng], { icon }).addTo(this.navLayerGroup);
    this.originMarker.bindTooltip(`<b>Start:</b> ${escapeHtml(name)}`, { permanent: false, direction: "top" });

    if (this.destination) {
      this.calculateRoute();
    }
  },

  setDestination(lat, lng, name = "Destination") {
    this.openPanel();
    this.destination = { lat: parseFloat(lat), lng: parseFloat(lng), name };
    const input = document.getElementById("nav-dest-input");
    if (input) input.value = name;

    if (this.destMarker && this.navLayerGroup) {
      this.navLayerGroup.removeLayer(this.destMarker);
    }

    const icon = L.divIcon({
      className: "nav-pin-dest",
      html: `<div style="background:#10B981; width:22px; height:22px; border-radius:50%; border:3px solid #FFFFFF; box-shadow:0 0 10px rgba(16,185,129,0.8); display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-size:10px; font-weight:800;">B</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    this.destMarker = L.marker([lat, lng], { icon }).addTo(this.navLayerGroup);
    this.destMarker.bindTooltip(`<b>Destination:</b> ${escapeHtml(name)}`, { permanent: false, direction: "top" });

    // If origin is not set, try to use GPS or prompt user
    if (!this.origin) {
      this.useCurrentLocationAsOrigin();
    } else {
      this.calculateRoute();
    }
  },

  useCurrentLocationAsOrigin() {
    if (!navigator.geolocation) {
      if (typeof showToast === "function") showToast("Geolocation not supported. Please click on map to choose origin.", "error");
      return;
    }

    if (typeof showToast === "function") showToast("Acquiring GPS coordinates for route start...", "info");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.setOrigin(lat, lng, "My Current Location");
        if (typeof showToast === "function") showToast("📍 GPS Origin Locked!", "success");
      },
      (err) => {
        let errMsg = "Could not obtain GPS. Please click on map to set Start Location.";
        if (err.code === 1) errMsg = "Location permission denied. Click map to set Start Location.";
        if (typeof showToast === "function") showToast(errMsg, "info");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  },

  async calculateRoute() {
    if (!this.origin || !this.destination) return;

    this.clearRoutesFromMap();
    this.showRouteLoading(true);

    try {
      const res = await API.getNavigationRoute(
        this.origin.lat,
        this.origin.lng,
        this.destination.lat,
        this.destination.lng
      );

      this.showRouteLoading(false);

      if (res && res.status === "success") {
        this.currentRouteData = res;
        this.renderCalculatedRoutes(res);
      } else {
        if (typeof showToast === "function") showToast(res.message || "Route calculation failed.", "error");
      }
    } catch (err) {
      this.showRouteLoading(false);
      console.error("Navigation routing error:", err);
      if (typeof showToast === "function") showToast("Failed to connect to road routing service.", "error");
    }
  },

  renderCalculatedRoutes(routeData) {
    const primary = routeData.primary_route;
    const safe = routeData.safe_route;
    const hazardDetected = routeData.hazard_detected;

    const bounds = L.latLngBounds();

    if (hazardDetected && safe) {
      // 1. Render Blocked Primary Route in dashed red/amber
      if (primary && primary.geometry) {
        const pCoords = primary.geometry.coordinates.map(c => [c[1], c[0]]);
        this.primaryPolyline = L.polyline(pCoords, {
          color: "#EF4444",
          weight: 4,
          opacity: 0.75,
          dashArray: "8, 8",
          lineCap: "round",
          lineJoin: "round"
        }).addTo(this.navLayerGroup);

        this.primaryPolyline.bindTooltip("⚠️ Standard Route (FLOOD RISK DETECTED)", { sticky: true });
        pCoords.forEach(c => bounds.extend(c));
      }

      // 2. Render Safe Alternative Route in bold vibrant emerald green
      const sCoords = safe.geometry.coordinates.map(c => [c[1], c[0]]);
      this.safePolyline = L.polyline(sCoords, {
        color: "#10B981",
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
        className: "leaflet-route-safe-active"
      }).addTo(this.navLayerGroup);

      this.safePolyline.bindTooltip(`🟢 Recommended Safe Road (${safe.distance_km} km • ${safe.duration_min} min)`, { sticky: true });
      sCoords.forEach(c => bounds.extend(c));

      // Show alert banner
      this.displayHazardBanner(routeData.hazard_warning || "Flood detected ahead on your route! Safe alternative road calculated.");
      this.renderRouteSummary(safe, "SAFE_ALTERNATIVE", primary);
    } else {
      // Direct safe route
      if (primary && primary.geometry) {
        const pCoords = primary.geometry.coordinates.map(c => [c[1], c[0]]);
        this.safePolyline = L.polyline(pCoords, {
          color: "#10B981",
          weight: 5.5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
          className: "leaflet-route-safe-active"
        }).addTo(this.navLayerGroup);

        this.safePolyline.bindTooltip(`🟢 Clear Road Route (${primary.distance_km} km • ${primary.duration_min} min)`, { sticky: true });
        pCoords.forEach(c => bounds.extend(c));
      }

      this.hideHazardBanner();
      this.renderRouteSummary(primary, "CLEAR");
    }

    if (bounds.isValid() && this.map) {
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
  },

  clearRoutesFromMap() {
    if (!this.navLayerGroup) return;
    if (this.primaryPolyline) {
      this.navLayerGroup.removeLayer(this.primaryPolyline);
      this.primaryPolyline = null;
    }
    if (this.safePolyline) {
      this.navLayerGroup.removeLayer(this.safePolyline);
      this.safePolyline = null;
    }
    this.hazardMarkers.forEach(m => this.navLayerGroup.removeLayer(m));
    this.hazardMarkers = [];
  },

  resetNavigation() {
    this.stopLiveMonitoring();
    this.clearRoutesFromMap();
    if (this.originMarker) {
      this.navLayerGroup.removeLayer(this.originMarker);
      this.originMarker = null;
    }
    if (this.destMarker) {
      this.navLayerGroup.removeLayer(this.destMarker);
      this.destMarker = null;
    }
    this.origin = null;
    this.destination = null;
    this.currentRouteData = null;

    const originInput = document.getElementById("nav-origin-input");
    const destInput = document.getElementById("nav-dest-input");
    if (originInput) originInput.value = "";
    if (destInput) destInput.value = "";

    const summaryCard = document.getElementById("nav-route-summary");
    if (summaryCard) summaryCard.style.display = "none";
    this.hideHazardBanner();
    this.isNavigating = false;
  },

  startLiveNavigation() {
    if (!this.currentRouteData) {
      if (typeof showToast === "function") showToast("Please calculate a route first.", "error");
      return;
    }

    this.isNavigating = true;
    if (typeof showToast === "function") showToast("🚗 Real-time flood monitoring active along your route!", "success");

    // Close slide panels for clean driving view
    this.closePanel();

    // Start periodic 30s route monitoring against live flood data
    this.startLiveMonitoring();
  },

  startLiveMonitoring() {
    this.stopLiveMonitoring();

    // Periodically re-evaluate route against incoming telemetry
    this.monitorTimerId = setInterval(async () => {
      if (!this.isNavigating || !this.origin || !this.destination) return;
      try {
        const res = await API.getNavigationRoute(
          this.origin.lat,
          this.origin.lng,
          this.destination.lat,
          this.destination.lng
        );
        if (res && res.status === "success") {
          // If hazard status changed, alert immediately
          if (res.hazard_detected && (!this.currentRouteData || !this.currentRouteData.hazard_detected)) {
            if (typeof showToast === "function") {
              showToast("🚨 URGENT: River water level rising on your path! Route updated.", "error");
            }
            this.currentRouteData = res;
            this.clearRoutesFromMap();
            this.renderCalculatedRoutes(res);
            this.openPanel();
          }
        }
      } catch (e) {
        console.warn("Route live monitor ping failed:", e);
      }
    }, 30000);
  },

  stopLiveMonitoring() {
    if (this.monitorTimerId) {
      clearInterval(this.monitorTimerId);
      this.monitorTimerId = null;
    }
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isNavigating = false;
  },

  // Search autocomplete
  async searchDestinations(query) {
    const listEl = document.getElementById("nav-dest-suggestions");
    if (!listEl) return;

    const items = await this.queryPlaces(query);
    this.renderSuggestions(listEl, items, (item) => {
      this.setDestination(item.lat, item.lng, item.name);
      this.hideSuggestions();
    });
  },

  async searchOrigins(query) {
    const listEl = document.getElementById("nav-origin-suggestions");
    if (!listEl) return;

    const items = await this.queryPlaces(query);
    this.renderSuggestions(listEl, items, (item) => {
      this.setOrigin(item.lat, item.lng, item.name);
      this.hideSuggestions();
    });
  },

  async queryPlaces(query) {
    const qLower = query.toLowerCase();
    const results = [];

    // Search local shelters cache
    if (typeof cachedSheltersData !== "undefined" && Array.isArray(cachedSheltersData)) {
      cachedSheltersData.forEach(sh => {
        if (sh.name && sh.name.toLowerCase().includes(qLower)) {
          results.push({
            name: `🛡️ ${sh.name} (${sh.district || ''})`,
            lat: sh.latitude,
            lng: sh.longitude
          });
        }
      });
    }

    // Search monitored stations
    if (typeof rawStationsData !== "undefined" && Array.isArray(rawStationsData)) {
      rawStationsData.forEach(st => {
        if (st.location_name && st.location_name.toLowerCase().includes(qLower)) {
          results.push({
            name: `🌊 ${st.location_name} Station (${st.state || ''})`,
            lat: st.latitude,
            lng: st.longitude
          });
        }
      });
    }

    // Geocode via Nominatim if needed
    if (results.length < 3) {
      try {
        const geoResults = await API.geocodeSearch(query);
        geoResults.forEach(g => {
          results.push({
            name: `📍 ${g.display_name.split(",").slice(0, 3).join(",")}`,
            lat: parseFloat(g.lat),
            lng: parseFloat(g.lon)
          });
        });
      } catch (e) {}
    }

    return results.slice(0, 5);
  },

  renderSuggestions(containerEl, items, onSelect) {
    containerEl.innerHTML = "";
    if (items.length === 0) {
      containerEl.style.display = "none";
      return;
    }
    items.forEach(it => {
      const row = document.createElement("div");
      row.className = "nav-suggestion-item";
      row.textContent = it.name;
      row.onmousedown = () => onSelect(it);
      containerEl.appendChild(row);
    });
    containerEl.style.display = "block";
  },

  hideSuggestions() {
    const dList = document.getElementById("nav-dest-suggestions");
    const oList = document.getElementById("nav-origin-suggestions");
    if (dList) dList.style.display = "none";
    if (oList) oList.style.display = "none";
  },

  showRouteLoading(isLoading) {
    const spinner = document.getElementById("nav-loading-spinner");
    const btn = document.getElementById("btn-calc-route");
    if (spinner) spinner.style.display = isLoading ? "inline-block" : "none";
    if (btn) btn.disabled = isLoading;
  },

  displayHazardBanner(text) {
    const banner = document.getElementById("nav-hazard-banner");
    const msg = document.getElementById("nav-hazard-message");
    if (banner && msg) {
      msg.textContent = text;
      banner.style.display = "flex";
    }
  },

  hideHazardBanner() {
    const banner = document.getElementById("nav-hazard-banner");
    if (banner) banner.style.display = "none";
  },

  renderRouteSummary(route, mode, primaryRoute = null) {
    const card = document.getElementById("nav-route-summary");
    if (!card) return;

    const elDist = document.getElementById("nav-summary-dist");
    const elTime = document.getElementById("nav-summary-time");
    const elBadge = document.getElementById("nav-summary-badge");
    const elDetour = document.getElementById("nav-summary-detour");
    const elSteps = document.getElementById("nav-summary-steps");

    if (elDist) elDist.textContent = `${route.distance_km} km`;
    if (elTime) elTime.textContent = `${route.duration_min} mins`;

    if (elBadge) {
      if (mode === "SAFE_ALTERNATIVE") {
        elBadge.innerHTML = `<span style="background:rgba(16,185,129,0.2); color:#10B981; border:1px solid #10B981; padding:2px 8px; border-radius:4px; font-weight:800; font-size:0.75rem;">🟢 FLOOD-SAFE ALTERNATIVE ACTIVE</span>`;
      } else {
        elBadge.innerHTML = `<span style="background:rgba(16,185,129,0.2); color:#10B981; border:1px solid #10B981; padding:2px 8px; border-radius:4px; font-weight:800; font-size:0.75rem;">🟢 ROUTE 100% CLEAR OF FLOODS</span>`;
      }
    }

    if (elDetour) {
      if (mode === "SAFE_ALTERNATIVE" && primaryRoute) {
        const extraKm = Math.max(0, (route.distance_km - primaryRoute.distance_km)).toFixed(1);
        elDetour.textContent = `Safe bypass route: +${extraKm} km around flooded sector.`;
        elDetour.style.display = "block";
      } else {
        elDetour.style.display = "none";
      }
    }

    if (elSteps && Array.isArray(route.steps) && route.steps.length > 0) {
      elSteps.innerHTML = route.steps.slice(0, 4).map((s, i) => `
        <div style="font-size:0.75rem; color:#94A3B8; display:flex; gap:0.4rem; align-items:flex-start;">
          <span style="color:#38BDF8; font-weight:700;">${i+1}.</span>
          <span>${escapeHtml(s)}</span>
        </div>
      `).join("");
      elSteps.style.display = "flex";
    } else if (elSteps) {
      elSteps.style.display = "none";
    }

    card.style.display = "flex";
  }
};

window.FloodNavigationSystem = FloodNavigationSystem;
