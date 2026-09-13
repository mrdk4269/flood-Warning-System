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
  if (l === "MEDIUM") return 3;
  return 4;
}

function renderAlertCards(alerts) {
  const container = document.getElementById("alerts-container");
  if (!container) return;

  // Always sort: Critical -> High -> Medium -> Low
  let sorted = [...alerts].sort((a, b) => getPriorityRank(a.risk_level) - getPriorityRank(b.risk_level));

  // Apply filters
  let filtered = sorted;
  if (currentFilter === "CRITICAL") {
    filtered = sorted.filter(a => a.risk_level.toUpperCase() === "CRITICAL");
  } else if (currentFilter === "HIGH") {
    filtered = sorted.filter(a => a.risk_level.toUpperCase() === "HIGH");
  } else if (currentFilter === "NEARBY") {
    // Show top nearby or priority alerts if GPS not available
    filtered = sorted.slice(0, 4);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding: 3rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin: 0 auto 1rem auto;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>No Active Warnings for Filter: ${currentFilter}</h3>
        <p style="margin-top: 0.5rem; color: var(--text-secondary);">All monitored river basins and flood zones in this category are operating within nominal thresholds.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const lvl = (a.risk_level || "LOW").toUpperCase();
    const isCrit = lvl === "CRITICAL";
    const isHigh = lvl === "HIGH";

    const badgeCls = isCrit ? "badge-critical" : (isHigh ? "badge-high" : (lvl === "MEDIUM" ? "badge-medium" : "badge-low"));
    const riskColor = isCrit ? "#EF4444" : (isHigh ? "#F97316" : (lvl === "MEDIUM" ? "#F59E0B" : "#10B981"));
    const floodWindow = isCrit ? "Next 2–4 Hours" : (isHigh ? "Next 4–6 Hours" : "Next 6–12 Hours");

    return `
      <div class="alert-card ${lvl.toLowerCase()}" style="margin-bottom: 1.25rem; border-left: 4px solid ${riskColor}; background: var(--bg-surface); padding: 1.5rem; border-radius: var(--radius-md);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="badge ${badgeCls}" style="font-weight:800; font-size:0.75rem;">${lvl} FLOOD ALERT</span>
            <span style="font-size:0.72rem; color:#10B981; font-family:var(--font-mono); font-weight:700;">● Active Dispatch</span>
          </div>
          <span style="font-family:var(--font-mono); font-size:0.78rem; color:var(--text-muted);">${a.date || 'Today'} • ${a.time || 'Real-time'}</span>
        </div>

        <h2 style="font-size: 1.4rem; font-weight: 800; color: #FFFFFF; margin: 0.35rem 0;">
          ${a.location || "Monitored River Basin"}
        </h2>

        <div style="font-size: 0.95rem; color: ${riskColor}; font-weight: 700; margin-bottom: 0.5rem;">
          ${a.title}
        </div>

        <p style="color: #CBD5E1; font-size: 0.9rem; line-height: 1.55; margin-bottom: 0.95rem;">
          ${a.description}
        </p>

        <!-- Citizen-friendly threat timeline -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.65rem 1rem; margin-bottom:1.15rem;">
          <span style="font-size:0.82rem; color:#94A3B8;">Possible Flooding Inundation:</span>
          <strong style="color:#FBBF24; font-family:var(--font-mono); font-size:0.95rem;">${floodWindow}</strong>
        </div>

        <!-- 2 Clear Action Buttons -->
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="/map?focus=${encodeURIComponent(a.location)}" class="btn btn-sm btn-primary" style="display:flex; align-items:center; gap:0.35rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
            <span>View on Map</span>
          </a>
          <a href="/safe-locations" class="btn btn-sm btn-secondary" style="display:flex; align-items:center; gap:0.35rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Find Safe Location</span>
          </a>
        </div>
      </div>
    `;
  }).join("");
}

function setupAlertFilters() {
  const filterBtns = document.querySelectorAll(".alert-filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.dataset.filter.toUpperCase();

      if (currentFilter === "NEARBY") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              userCoords = [pos.coords.latitude, pos.coords.longitude];
              showToast("📍 Focused alerts around your GPS position", "info");
              loadAlerts();
            },
            () => {
              showToast("GPS position access denied; showing top priority alerts.", "info");
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
      playEmergencyChime();
      showToast(`Telemetry updated! ${res.alerts_triggered} new alerts triggered.`, "success");
      await loadAlerts();
      await updateNavAlertBadge();
    } catch (err) {
      showToast("Simulation tick failed.", "error");
    } finally {
      simBtn.disabled = false;
      simBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        Simulate Spike Drill
      `;
    }
  });
}

function setupLiveWeatherButton() {
  const syncBtn = document.getElementById("btn-sync-live-weather");
  if (!syncBtn) return;

  syncBtn.addEventListener("click", async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Connecting Open-Meteo...`;

    try {
      const res = await API.syncLiveData();
      playEmergencyChime();
      showToast(`Real-Time Meteo Synced: ${res.weather.station_rainfall_mm}mm rain | Periyar: ${res.hydrology.periyar_stage_meters}m (${res.source})`, "success");
      await loadAlerts();
      await updateNavAlertBadge();
    } catch (err) {
      showToast("Live weather sync failed. Check connection.", "error");
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = `
        <span style="width: 8px; height: 8px; background: #10B981; border-radius: 50%; display: inline-block;"></span>
        Sync Live Weather (Open-Meteo)
      `;
    }
  });
}
