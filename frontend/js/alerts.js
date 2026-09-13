/**
 * FloodGuard Emergency Alerts Module
 * Live alert monitor, severity filtering, and simulation triggers.
 */

document.addEventListener("DOMContentLoaded", () => {
  initAlertsPage();
});

let currentFilter = "ALL";

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

function renderAlertCards(alerts) {
  const container = document.getElementById("alerts-container");
  if (!container) return;

  let filtered = alerts;
  if (currentFilter !== "ALL") {
    filtered = alerts.filter(a => a.risk_level.toUpperCase() === currentFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding: 3rem;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2" style="margin: 0 auto 1rem auto;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>No Active Warnings for Filter: ${currentFilter}</h3>
        <p style="margin-top: 0.5rem;">All monitored river basins and flood zones in this category are operating within nominal thresholds.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    const lvl = a.risk_level.toLowerCase();
    return `
      <div class="alert-card ${lvl}">
        <div class="alert-top">
          <div style="display:flex; align-items:center; gap: 0.75rem;">
            ${renderRiskBadge(a.risk_level)}
            <span class="badge" style="background: rgba(255,255,255,0.08); color: #CBD5E1;">${a.alert_type || "Flood Advisory"}</span>
            <span class="mono" style="font-size: 0.75rem; color: #10B981; font-weight: 700;">● ${a.status}</span>
          </div>
          <span class="mono" style="font-size: 0.8rem; color: var(--text-muted);">${a.date} | ${a.time}</span>
        </div>
        <h3 class="alert-title" style="margin: 0.5rem 0;">${a.title}</h3>
        <p style="color: #CBD5E1; font-size: 0.95rem; line-height: 1.6;">${a.description}</p>
        <div class="alert-meta">
          <span><strong>Location:</strong> ${a.location}</span>
          <span><strong>Target Sector:</strong> Central Basin District</span>
        </div>
        <div style="margin-top: 1rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <a href="/map?focus=${encodeURIComponent(a.location)}" class="btn btn-sm btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
            View on GIS Map
          </a>
          <a href="/safe-locations" class="btn btn-sm btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            Find Nearby Shelter
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
