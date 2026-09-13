/**
 * FloodGuard Central API Client
 * Clean REST API client with error handling and fallback capabilities.
 */

const API_BASE_URL = window.location.origin.includes("http") ? "" : "http://127.0.0.1:5000";

const API = {
  async fetchJson(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

  async createSafeLocation(data) {
    return this.fetchJson("/api/safe-locations", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  // Hospitals
  async getHospitals() {
    return this.fetchJson("/api/hospitals");
  },

  async createHospital(data) {
    return this.fetchJson("/api/hospitals", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },

  // Rivers
  async getRivers() {
    return this.fetchJson("/api/rivers");
  },

  async updateRiver(id, data) {
    return this.fetchJson(`/api/rivers/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
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

  // Admin Login
  async login(email, password) {
    return this.fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
  }
};
