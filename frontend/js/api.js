/**
 * FloodGuard Central API Client
 * Clean REST API client with error handling and fallback capabilities.
 */

const API_BASE_URL = window.location.origin.includes("http") ? "" : "http://127.0.0.1:5000";

const API = {
  async fetchJson(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers
        },
        ...options
      });
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || errBody.message || `HTTP Error ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`API Request Failed [${endpoint}]:`, err);
      throw err;
    }
  },

  // Stats
  async getStats() {
    return this.fetchJson("/api/stats");
  },

  // GeoJSON Layers
  async getGeoJsonLayer(layerName) {
    return this.fetchJson(`/api/geojson/${layerName}`);
  },

  // Flood Areas
  async getFloodAreas() {
    return this.fetchJson("/api/flood-areas");
  },

  async getFloodArea(id) {
    return this.fetchJson(`/api/flood-areas/${id}`);
  },

  async createFloodArea(data) {
    return this.fetchJson("/api/flood-areas", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateFloodArea(id, data) {
    return this.fetchJson(`/api/flood-areas/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteFloodArea(id) {
    return this.fetchJson(`/api/flood-areas/${id}`, {
      method: "DELETE"
    });
  },

  // Alerts
  async getAlerts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJson(`/api/alerts${query ? "?" + query : ""}`);
  },

  async createAlert(data) {
    return this.fetchJson("/api/alerts", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateAlert(id, data) {
    return this.fetchJson(`/api/alerts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteAlert(id) {
    return this.fetchJson(`/api/alerts/${id}`, {
      method: "DELETE"
    });
  },

  // Safe Locations
  async getSafeLocations() {
    return this.fetchJson("/api/safe-locations");
  },

  async getSafeLocation(id) {
    return this.fetchJson(`/api/safe-locations/${id}`);
  },

  async createSafeLocation(data) {
    return this.fetchJson("/api/safe-locations", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateSafeLocation(id, data) {
    return this.fetchJson(`/api/safe-locations/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteSafeLocation(id) {
    return this.fetchJson(`/api/safe-locations/${id}`, {
      method: "DELETE"
    });
  },

  // Hospitals
  async getHospitals() {
    return this.fetchJson("/api/hospitals");
  },

  async getHospital(id) {
    return this.fetchJson(`/api/hospitals/${id}`);
  },

  async createHospital(data) {
    return this.fetchJson("/api/hospitals", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateHospital(id, data) {
    return this.fetchJson(`/api/hospitals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteHospital(id) {
    return this.fetchJson(`/api/hospitals/${id}`, {
      method: "DELETE"
    });
  },

  // Rivers
  async getRivers() {
    return this.fetchJson("/api/rivers");
  },

  async createRiver(data) {
    return this.fetchJson("/api/rivers", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  async updateRiver(id, data) {
    return this.fetchJson(`/api/rivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  },

  async deleteRiver(id) {
    return this.fetchJson(`/api/rivers/${id}`, {
      method: "DELETE"
    });
  },

  // Rainfall
  async getRainfall() {
    return this.fetchJson("/api/rainfall");
  },

  // History
  async getHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.fetchJson(`/api/history${query ? "?" + query : ""}`);
  },

  // Calculate Risk
  async calculateRisk(payload) {
    return this.fetchJson("/api/calculate-risk", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // Predict Flood
  async predictFlood(payload) {
    return this.fetchJson("/api/predict-flood", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  // Simulate Telemetry Step
  async simulateTick() {
    return this.fetchJson("/api/simulate-tick", {
      method: "POST"
    });
  },

  // Sync Live Data from Open-Meteo & Satellite
  async syncLiveData() {
    return this.fetchJson("/api/sync-live-data", {
      method: "POST"
    });
  },

  // Get Live Telemetry and Satellite System Status (Legacy route)
  async getLiveStatus() {
    return this.fetchJson("/api/live-status");
  },

  // Live India Flood Data System APIs (Requirements #5, #10, #11, #17)
  async getLiveIndiaStatus() {
    return this.fetchJson("/api/live-data/status");
  },

  async getIndiaStates() {
    return this.fetchJson("/api/india/states");
  },

  async getIndiaDistricts(state = "") {
    return this.fetchJson(`/api/india/districts${state ? "?state=" + encodeURIComponent(state) : ""}`);
  },

  async getIndiaBasins() {
    return this.fetchJson("/api/india/basins");
  },

  async getIndiaOverview() {
    return this.fetchJson("/api/india/overview");
  },

  async getIndiaStatesGeoJson() {
    return this.fetchJson("/api/geojson/india-states");
  },

  async getIndiaRiversGeoJson() {
    return this.fetchJson("/api/geojson/india-rivers");
  },

  async getHistoricalFloodsGeoJson(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.fetchJson(`/api/geojson/historical-floods${q ? "?" + q : ""}`);
  },

  async getForecastRiskGeoJson(state = "") {
    return this.fetchJson(`/api/geojson/forecast-risk${state ? "?state=" + encodeURIComponent(state) : ""}`);
  },

  async getFloodEffectAreas(params = {}) {
    const q = typeof params === "string" ? params : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/flood-effect-areas${q ? "?" + q : ""}`);
  },

  async getLiveRainfall(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/rainfall?${q}`);
  },

  async getLiveWeather(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/weather?${q}`);
  },

  async getLiveRivers(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/rivers?${q}`);
  },

  async getLiveWarnings(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/flood-warnings?${q}`);
  },

  async getLiveDashboard(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/dashboard?${q}`);
  },

  async refreshLiveData(params = {}) {
    const q = typeof params === "string" ? `region=${encodeURIComponent(params)}` : new URLSearchParams(params).toString();
    return this.fetchJson(`/api/live-data/refresh?${q}`, {
      method: "POST"
    });
  },

  // Admin Auth
  async login(email, password) {
    return this.fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  },

  async logout() {
    return this.fetchJson("/api/auth/logout", {
      method: "POST"
    });
  },

  async getAuthStatus() {
    return this.fetchJson("/api/auth/status");
  }
};
