/**
 * FloodGuard Emergency Alerts Module
 * Clean citizen-first alerts, strict severity sorting (Critical -> High -> Medium -> Low),
 * clear filters (All, Critical, High, Nearby), and direct emergency actions.
 */

document.addEventListener("DOMContentLoaded", () => {
  initAlertsPage();
});

let currentFilter = "ALL";
let userCoords = null;

// BUG-001: Safe HTML Escaping fallback
function escapeHtml(str) {
  if (typeof window.escapeHtml === "function") return window.escapeHtml(str);
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// BUG-004: Top-level Haversine distance calculator
function haversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// BUG-007: Geographic coordinate lookup table for Indian locations/river basins without explicit DB coordinates
const LOCATION_COORDINATES_MAP = {
  "cuttack": [20.4625, 85.8830],
  "odisha": [20.4625, 85.8830],
  "mahanadi": [20.4625, 85.8830],
  "periyar": [10.0400, 76.3400],
  "kerala": [10.0400, 76.3400],
  "kochi": [9.9312, 76.2673],
  "munneru": [16.8500, 80.2000],
  "krishna": [16.5062, 80.6480],
  "andhra": [16.5062, 80.6480],
  "vijayawada": [16.5062, 80.6480],
  "brahmaputra": [26.1445, 91.7362],
  "assam": [26.1445, 91.7362],
  "guwahati": [26.1445, 91.7362],
  "ganga": [25.5941, 85.1376],
  "patna": [25.5941, 85.1376],
  "bihar": [25.5941, 85.1376],
  "godavari": [16.9891, 81.7840],
  "rajahmundry": [16.9891, 81.7840],
  "yamuna": [28.6139, 77.2090],
  "delhi": [28.6139, 77.2090],
  "narmada": [21.7051, 72.9959],
  "bharuch": [21.7051, 72.9959],
  "cauvery": [10.7905, 78.7047],
  "tamil nadu": [10.7905, 78.7047],
  "kollidam": [11.3500, 79.7500],
  "teesta": [26.7271, 88.3953],
  "siliguri": [26.7271, 88.3953],
  "jhelum": [34.0837, 74.7973],
  "srinagar": [34.0837, 74.7973]
};

function resolveAlertCoordinates(alert) {
  if (alert.latitude != null && alert.longitude != null) {
    return [parseFloat(alert.latitude), parseFloat(alert.longitude)];
  }
  const locStr = (alert.location || "").toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDINATES_MAP)) {
    if (locStr.includes(key)) {
      return coords;
    }
  }
  return [22.9734, 78.6569]; // Default Central India geographic centroid
}

async function initAlertsPage() {
  await loadAlerts();
  setupAlertFilters();
  setupSimulationButton();
  setupLiveWeatherButton();
}

async function loadAlerts() {
  const container = document.getElementById("alerts-container");
  if (!container) return;

  container.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Fetching live emergency bulletins...</div>';

  try {
    const alerts = await API.getAlerts();
    renderAlertCards(alerts);
  } catch (err) {
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #EF4444;">Failed to load alerts from server.</div>';
  }
}

// Priority ranking: Critical (1) -> High (2) -> Medium (3) -> Low (4)
function getPriorityRank(level) {
  const l = (level || "").toUpperCase();
  if (l === "CRITICAL") return 1;
  if (l === "HIGH") return 2;
  if (l === "MEDIUM" || l === "MODERATE") return 3;
  return 4;
}

function renderAlertCards(alerts) {
  const container = document.getElementById("alerts-container");
  if (!container) return;

  // Always sort: Critical -> High -> Medium -> Low
  let sorted = [...alerts].sort((a, b) => getPriorityRank(a.risk_level) - getPriorityRank(b.risk_level));

  // Attach resolved coordinates
  sorted = sorted.map(a => {
    const coords = resolveAlertCoordinates(a);
    return { ...a, resolved_lat: coords[0], resolved_lng: coords[1] };
  });

  // Apply filters
  let filtered = sorted;
  if (currentFilter === "CRITICAL") {
    filtered = sorted.filter(a => (a.risk_level || "").toUpperCase() === "CRITICAL");
  } else if (currentFilter === "HIGH") {
    filtered = sorted.filter(a => (a.risk_level || "").toUpperCase() === "HIGH");
  } else if (currentFilter === "NEARBY") {
    if (userCoords && Array.isArray(userCoords) && userCoords.length === 2) {
      filtered = [...sorted].map(a => {
        const distKm = haversineDistKm(userCoords[0], userCoords[1], a.resolved_lat, a.resolved_lng);
        return { ...a, distance_km: Math.round(distKm) };
      }).sort((a, b) => a.distance_km - b.distance_km);
    } else {
      filtered = sorted.slice(0, 6);
    }
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding: 3rem;">
        <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin: 0 auto 1rem auto;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>No Active Warnings for Filter: ${escapeHtml(currentFilter)}</h3>
        <p style="margin-top: 0.5rem; color: var(--text-secondary);">All monitored river basins and flood zones in this category are operating within nominal thresholds.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const lvl = (a.risk_level || "LOW").toUpperCase();
    const isCrit = lvl === "CRITICAL";
    const isHigh = lvl === "HIGH";

    const badgeCls = isCrit ? "badge-critical" : (isHigh ? "badge-high" : (lvl === "MEDIUM" || lvl === "MODERATE" ? "badge-medium" : "badge-low"));
    const riskColor = isCrit ? "#EF4444" : (isHigh ? "#F97316" : (lvl === "MEDIUM" || lvl === "MODERATE" ? "#F59E0B" : "#10B981"));
    
    // BUG-035: Grounded threat horizon estimation
    const floodWindow = a.time_window || a.forecast_horizon || (isCrit ? "Immediate Watch (Estimated 2–4h)" : isHigh ? "Elevated Watch (Estimated 4–6h)" : "Advisory Watch (6–12h)");
    const distBadge = a.distance_km != null ? `<span class="badge badge-outline" style="font-family:var(--font-mono); font-size:0.72rem; color:#38BDF8; border-color:rgba(56,189,248,0.4);">📍 ~${a.distance_km} km away</span>` : "";

    // BUG-033: Dynamic alert status badge
    const statusVal = (a.status || "ACTIVE").toUpperCase();
    const statusHtml = statusVal === "RESOLVED"
      ? `<span style="font-size:0.72rem; color:#94A3B8; font-family:var(--font-mono); font-weight:700;">✓ Resolved</span>`
      : (statusVal === "MONITORING"
          ? `<span style="font-size:0.72rem; color:#F59E0B; font-family:var(--font-mono); font-weight:700;">◐ Active Monitoring</span>`
          : `<span style="font-size:0.72rem; color:#10B981; font-family:var(--font-mono); font-weight:700;">● Active Dispatch</span>`);

    const safeLocation = escapeHtml(a.location || "Monitored River Basin");
    const safeTitle = escapeHtml(a.title || "");
    const safeDesc = escapeHtml(a.description || "");
    const safeDate = escapeHtml(a.date || "Today");
    const safeTime = escapeHtml(a.time || "Real-time");

    // BUG-034: Standardized deep linking URL with latitude and longitude
    const mapHref = `/map?focus=${encodeURIComponent(a.location || '')}&lat=${a.resolved_lat}&lng=${a.resolved_lng}`;

    return `
      <div class="alert-card ${lvl.toLowerCase()}" style="margin-bottom: 1.25rem; border-left: 4px solid ${riskColor}; background: var(--bg-surface); padding: 1.5rem; border-radius: var(--radius-md);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <span class="badge ${badgeCls}" style="font-weight:800; font-size:0.75rem;">${lvl} FLOOD ALERT</span>
            ${statusHtml}
            ${distBadge}
          </div>
          <span style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-muted);">${safeDate} • ${safeTime}</span>
        </div>

        <h2 style="font-size: 1.4rem; font-weight: 800; color: #FFFFFF; margin: 0.35rem 0;">
          ${safeLocation}
        </h2>

        <div style="font-size: 0.95rem; color: ${riskColor}; font-weight: 700; margin-bottom: 0.5rem;">
          ${safeTitle}
        </div>

        <p style="color: #CBD5E1; font-size: 0.9rem; line-height: 1.55; margin-bottom: 0.95rem;">
          ${safeDesc}
        </p>

        <!-- Citizen threat timeline horizon -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.65rem 1rem; margin-bottom:1.15rem;">
          <span style="font-size:0.82rem; color:#94A3B8;">Estimated Threat Horizon (Forecast):</span>
          <strong style="color:#FBBF24; font-family:var(--font-mono); font-size:0.95rem;">${floodWindow}</strong>
        </div>

        <!-- 2 Clear Action Buttons -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="${mapHref}" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:0.35rem;">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <span>View on Map</span>
          </a>
          <a href="/safe-locations" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:0.35rem;">
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Find Safe Location</span>
          </a>
        </div>
      </div>
    `;
  }).join("");
}

// BUG-040: Alert filter buttons with ARIA tab semantics
function setupAlertFilters() {
  const filterBtns = document.querySelectorAll(".alert-filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      currentFilter = btn.dataset.filter.toUpperCase();

      if (currentFilter === "NEARBY") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              userCoords = [pos.coords.latitude, pos.coords.longitude];
              if (typeof showToast === "function") showToast("📍 Focused alerts around your GPS position", "info");
              loadAlerts();
            },
            () => {
              if (typeof showToast === "function") showToast("GPS access unavailable; displaying prioritized regional alerts.", "info");
              loadAlerts();
            }
          );
          return;
        }
      }

      loadAlerts();
    });
  });
}

function setupSimulationButton() {
  const simBtn = document.getElementById("btn-sim-alert");
  if (!simBtn) return;

  simBtn.addEventListener("click", async () => {
    simBtn.disabled = true;
    simBtn.innerHTML = "Simulating Sensor Fluctuations...";

    try {
      const res = await API.simulateTick();
      if (typeof playEmergencyChime === "function") playEmergencyChime();
      if (typeof showToast === "function") showToast(`Telemetry updated! ${res.alerts_triggered} alerts evaluated.`, "success");
      await loadAlerts();
      if (typeof updateNavAlertBadge === "function") await updateNavAlertBadge();
    } catch (err) {
      if (typeof showToast === "function") showToast("Simulation tick failed.", "error");
    } finally {
      simBtn.disabled = false;
      simBtn.innerHTML = `
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Simulate Spike Drill
      `;
    }
  });
}

// BUG-005 & BUG-015: Safe live weather sync with typeof guards and optional chaining
function setupLiveWeatherButton() {
  const syncBtn = document.getElementById("btn-sync-live-weather");
  if (!syncBtn) return;

  syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Connecting Open-Meteo...`;

    try {
      const res = await API.syncLiveData();
      if (typeof playEmergencyChime === "function") playEmergencyChime();
      const rain = res?.weather?.station_rainfall_mm ?? "N/A";
      const stage = res?.hydrology?.periyar_stage_meters ?? "N/A";
      const src = res?.source || "Telemetry";
      if (typeof showToast === "function") showToast(`Real-Time Meteo Synced: ${rain}mm rain | Periyar: ${stage}m (${src})`, "success");
      await loadAlerts();
      if (typeof updateNavAlertBadge === "function") await updateNavAlertBadge();
    } catch (err) {
      if (typeof showToast === "function") showToast("Live weather sync failed. Check connection.", "error");
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <span style="width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
        Sync Live Weather (Open-Meteo)
      `;
    }
  });
}
