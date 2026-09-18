/**
 * FloodGuard Mission Control Main UI Engine
 * Real-time clock, incident ticker, mobile drawer, focus trap, and audio telemetry.
 */

// BUG-001: Standardized HTML Escaping Utility exported globally
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

// Real-time Mission Control Clock (UTC & District Local Time)
function initLiveClock() {
  const clockElem = document.getElementById("mission-clock");
  if (!clockElem) return;

  function updateClock() {
    const now = new Date();
    const utcStr = now.toISOString().replace("T", " ").substring(0, 19) + " UTC";
    clockElem.textContent = utcStr;
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// Live Incident Ticker updates (XSS safe)
async function initIncidentTicker() {
  const tickerContainer = document.getElementById("incident-ticker-text");
  if (!tickerContainer) return;

  try {
    const stats = await API.getStats();
    if (stats.latest_alert) {
      tickerContainer.textContent = "";
      const tagSpan = document.createElement("span");
      tagSpan.className = "ticker-tag";
      tagSpan.textContent = stats.latest_alert.risk_level || "ALERT";
      const strongEl = document.createElement("strong");
      strongEl.textContent = stats.latest_alert.title || "";
      tickerContainer.appendChild(tagSpan);
      tickerContainer.appendChild(document.createTextNode(" "));
      tickerContainer.appendChild(strongEl);
      tickerContainer.appendChild(document.createTextNode(` — ${stats.latest_alert.location || ""}`));
    }
  } catch (e) {
    // default ticker
  }
}

// Accessible Navigation Dropdown (FG-018)
function initNavDropdown() {
  const dropdownToggle = document.querySelector(".nav-dropdown-toggle");
  const dropdownMenu = document.querySelector(".nav-dropdown-menu");
  if (!dropdownToggle || !dropdownMenu) return;

  function setExpanded(val) {
    dropdownToggle.setAttribute("aria-expanded", String(val));
    if (val) {
      dropdownMenu.classList.add("show");
    } else {
      dropdownMenu.classList.remove("show");
    }
  }

  dropdownToggle.addEventListener("click", (e) => {
    e.preventDefault();
    const isOpen = dropdownMenu.classList.contains("show");
    setExpanded(!isOpen);
  });

  document.addEventListener("click", (e) => {
    if (!dropdownToggle.contains(e.target) && !dropdownMenu.contains(e.target)) {
      setExpanded(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dropdownMenu.classList.contains("show")) {
      setExpanded(false);
      dropdownToggle.focus();
    }
  });
}

// BUG-044: Enhanced Mobile Navigation with Backdrop and Outside Click
function initMobileNav() {
  const toggleBtn = document.querySelector(".mobile-toggle");
  const navLinks = document.querySelector(".nav-links");
  if (!toggleBtn || !navLinks) return;

  let backdrop = document.querySelector(".mobile-nav-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "mobile-nav-backdrop";
    document.body.appendChild(backdrop);
  }

  function closeNav() {
    navLinks.classList.remove("show");
    backdrop.classList.remove("show");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  function openNav() {
    navLinks.classList.add("show");
    backdrop.classList.add("show");
    toggleBtn.setAttribute("aria-expanded", "true");
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = navLinks.classList.contains("show");
    if (isOpen) closeNav();
    else openNav();
  });

  backdrop.addEventListener("click", closeNav);

  // Close when clicking any nav link
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeNav);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks.classList.contains("show")) {
      closeNav();
      toggleBtn.focus();
    }
  });
}

// Highlight Current Active Nav Link
function highlightActiveNavLink() {
  const currentPath = window.location.pathname.toLowerCase();
  const links = document.querySelectorAll(".nav-link");

  links.forEach(link => {
    const href = link.getAttribute("href") ? link.getAttribute("href").toLowerCase() : "";
    if (
      (currentPath === "/" && (href === "/" || href === "index.html" || href === "/index.html")) ||
      (currentPath.includes("map") && href.includes("map")) ||
      (currentPath.includes("risk") && href.includes("risk")) ||
      (currentPath.includes("prediction") && href.includes("prediction")) ||
      (currentPath.includes("alerts") && href.includes("alerts")) ||
      (currentPath.includes("safe-locations") && href.includes("safe-locations")) ||
      (currentPath.includes("history") && href.includes("history")) ||
      (currentPath.includes("admin") && href.includes("admin"))
    ) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
}

// BUG-031: Update Nav Alert Badge from Live API without fake fallback
async function updateNavAlertBadge() {
  try {
    const stats = await API.getStats();
    const badge = document.getElementById("nav-alert-counter");
    if (badge) {
      if (stats.active_alerts > 0) {
        badge.textContent = stats.active_alerts;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (err) {
    const badge = document.getElementById("nav-alert-counter");
    if (badge) {
      badge.style.display = "none";
    }
  }
}
window.updateNavAlertBadge = updateNavAlertBadge;

// BUG-003 & BUG-042: Unified Accessible Risk Badge with shape indicators for colorblindness
function renderRiskBadge(level) {
  const l = (level || "LOW").toUpperCase();
  if (l === "CRITICAL") {
    return `<span class="badge badge-critical" aria-label="Critical Risk"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> 🛑 Critical</span>`;
  } else if (l === "HIGH") {
    return `<span class="badge badge-high" aria-label="High Risk"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg> ⚠️ High</span>`;
  } else if (l === "MEDIUM" || l === "MODERATE") {
    return `<span class="badge badge-medium" aria-label="Medium Risk"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 22 12 12 22 2 12 12 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> 🔶 Medium</span>`;
  } else {
    return `<span class="badge badge-low" aria-label="Low Risk"><svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 🟢 Low</span>`;
  }
}
window.renderRiskBadge = renderRiskBadge;

// BUG-009 & BUG-051: Singleton AudioContext with safe user-gesture unlock
let _sharedAudioCtx = null;
function getAudioContext() {
  if (!_sharedAudioCtx && (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext))) {
    _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return _sharedAudioCtx;
}

function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("click", unlockAudioContext, { once: true });
  window.addEventListener("keydown", unlockAudioContext, { once: true });
  window.addEventListener("touchstart", unlockAudioContext, { once: true });
}

function playEmergencyChime() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio alert blocked by browser autoplay policy.");
  }
}
window.playEmergencyChime = playEmergencyChime;

// BUG-011 & BUG-045: Non-overlapping Stacking Toast Container
function getToastContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("role", "region");
    container.setAttribute("aria-live", "polite");
    container.style.position = "fixed";
    container.style.bottom = "2rem";
    container.style.right = "2rem";
    container.style.display = "flex";
    container.style.flexDirection = "column-reverse";
    container.style.gap = "0.5rem";
    container.style.zIndex = "99999";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
  }
  return container;
}

function showToast(message, type = "info") {
  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.background = type === "error" ? "#DC2626" : (type === "success" ? "#10B981" : "#1E293B");
  toast.style.color = "#FFFFFF";
  toast.style.padding = "0.75rem 1.25rem";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
  toast.style.fontSize = "0.85rem";
  toast.style.fontFamily = "var(--font-mono, monospace)";
  toast.style.fontWeight = "600";
  toast.style.transition = "opacity 0.3s, transform 0.3s";
  toast.style.pointerEvents = "auto";
  toast.style.maxWidth = "380px";
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
window.showToast = showToast;

// BUG-015: Global Live Meteo & Satellite Sync Trigger with safe optional chaining
window.triggerGlobalLiveSync = async function() {
  const badge = document.getElementById("ticker-live-status");
  if (badge) badge.textContent = "● SYNCING METEO...";
  try {
    const res = await API.syncLiveData();
    if (badge) badge.textContent = "● LIVE METEO SYNCED";
    const rain = res?.weather?.station_rainfall_mm ?? "N/A";
    const stage = res?.hydrology?.periyar_stage_meters ?? "N/A";
    const src = res?.source || "Telemetry";
    showToast(`⚡ Real-Time Weather Synced: ${rain}mm Rain | Periyar: ${stage}m (${src})`, "success");
    updateNavAlertBadge();
  } catch (err) {
    if (badge) badge.textContent = "● BUFFERED TELEMETRY";
  }
};

/* =============================================================================
   PUBLIC USER INTERFACE VS ADMIN / GIS INTERFACE MODE MANAGER
   ============================================================================= */

function getFloodGuardMode() {
  return localStorage.getItem("floodguard_mode") || "citizen";
}

function setFloodGuardMode(mode) {
  localStorage.setItem("floodguard_mode", mode);
  applyFloodGuardMode(mode);
}

function toggleFloodGuardMode() {
  const current = getFloodGuardMode();
  const next = current === "citizen" ? "admin" : "citizen";
  setFloodGuardMode(next);
  const msg = next === "admin" 
    ? "🛰️ Switched to Admin & Advanced GIS Interface (Full Telemetry & Layers Active)"
    : "👤 Switched to Public Citizen Mode (Simplified Safety View)";
  showToast(msg, "info");
}

function applyFloodGuardMode(mode) {
  const isCitizen = mode === "citizen";
  document.body.classList.remove("mode-citizen", "mode-admin");
  document.body.classList.add(isCitizen ? "mode-citizen" : "mode-admin");

  // Update all mode toggle buttons
  const toggleBtns = document.querySelectorAll(".mode-toggle-pill");
  toggleBtns.forEach(btn => {
    if (isCitizen) {
      btn.innerHTML = `<span class="mode-pill-dot"></span><span>Switch to Admin / GIS</span>`;
      btn.setAttribute("title", "Enable Advanced GIS layers, ML features, and telemetry controls");
    } else {
      btn.innerHTML = `<span class="mode-pill-dot"></span><span>Switch to Public User</span>`;
      btn.setAttribute("title", "Return to simplified public emergency interface");
    }
  });

  // BUG-038: Trigger map layer & workbench updates if on map page
  if (typeof window.applyModeToMap === "function") {
    window.applyModeToMap(mode);
  }
}

/* =============================================================================
   UNIVERSAL EMERGENCY HELP MODAL WITH WCAG FOCUS TRAP (BUG-032)
   ============================================================================= */

let _modalPreviousActiveElement = null;

function ensureEmergencyModal() {
  if (document.getElementById("emergency-modal")) return;

  const modalHtml = `
    <div id="emergency-modal" class="emergency-modal-backdrop" onclick="onEmergencyBackdropClick(event)">
      <div class="emergency-modal-box" role="dialog" aria-modal="true" aria-labelledby="emergency-modal-title">
        <div class="emergency-modal-header">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #EF4444; display: flex; align-items: center; justify-content: center; color: white;">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <h3 id="emergency-modal-title" style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF; margin: 0;">EMERGENCY FLOOD ASSISTANCE</h3>
              <p style="font-size: 0.75rem; color: #FCA5A5; margin: 0;">Immediate 24/7 Disaster Safety & Relief Guidance</p>
            </div>
          </div>
          <button id="emergency-modal-close-btn" onclick="closeEmergencyModal()" style="background: transparent; border: none; color: #94A3B8; font-size: 1.5rem; cursor: pointer; padding: 0.2rem 0.5rem;" aria-label="Close emergency modal">&times;</button>
        </div>

        <div class="emergency-modal-body">
          <p style="font-size: 0.85rem; color: #E2E8F0; margin-bottom: 1.15rem; line-height: 1.5;">
            What immediate emergency action do you need? Choose an option below to get directions or notify rescue teams:
          </p>

          <!-- Action 1: Nearest Shelter -->
          <a href="/safe-locations?action=nearest" class="emergency-action-card">
            <div class="emergency-action-icon" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3);">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.95rem; color: #FFFFFF;">Find Nearest Safe Shelter</div>
              <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 0.15rem;">Locate high-ground relief centers, school camps & medical centers</div>
            </div>
            <span style="color: #38BDF8; font-weight: 700;">&rarr;</span>
          </a>

          <!-- Action 2: View Safe Route -->
          <a href="/safe-locations" class="emergency-action-card">
            <div class="emergency-action-icon" style="background: rgba(56, 189, 248, 0.15); color: #38BDF8; border: 1px solid rgba(56, 189, 248, 0.3);">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.95rem; color: #FFFFFF;">View Safe Evacuation Route</div>
              <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 0.15rem;">Navigate paths avoiding submerged bridges and flood-prone roads</div>
            </div>
            <span style="color: #38BDF8; font-weight: 700;">&rarr;</span>
          </a>

          <!-- Action 3: Live Bulletins -->
          <a href="/alerts" class="emergency-action-card">
            <div class="emergency-action-icon" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3);">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.95rem; color: #FFFFFF;">View Active Flood Alerts</div>
              <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 0.15rem;">Check critical warnings, levee overflows & rainfall bursts</div>
            </div>
            <span style="color: #38BDF8; font-weight: 700;">&rarr;</span>
          </a>

          <!-- Helplines Section -->
          <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="font-size: 0.72rem; font-weight: 800; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.65rem;">
              DIRECT EMERGENCY HELPLINE NUMBERS
            </div>
            <div class="helpline-grid">
              <a href="tel:1078" class="helpline-btn">
                <span>NDRF Disaster Response</span>
                <span class="helpline-num">1078</span>
              </a>
              <a href="tel:1070" class="helpline-btn">
                <span>State Disaster Relief</span>
                <span class="helpline-num">1070</span>
              </a>
              <a href="tel:112" class="helpline-btn">
                <span>National Emergency</span>
                <span class="helpline-num">112</span>
              </a>
              <a href="tel:108" class="helpline-btn">
                <span>Ambulance & Medical</span>
                <span class="helpline-num">108</span>
              </a>
              <a href="tel:1077" class="helpline-btn" style="grid-column: span 2;">
                <span>District Flood Control Helpline</span>
                <span class="helpline-num">1077</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);

  // Focus trap event handler
  const modal = document.getElementById("emergency-modal");
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusableEls = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusableEls.length === 0) return;
    const firstEl = focusableEls[0];
    const lastEl = focusableEls[focusableEls.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === firstEl) {
        lastEl.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastEl) {
        firstEl.focus();
        e.preventDefault();
      }
    }
  });
}

window.openEmergencyModal = function() {
  ensureEmergencyModal();
  const modal = document.getElementById("emergency-modal");
  if (modal) {
    _modalPreviousActiveElement = document.activeElement;
    modal.classList.add("open");
    playEmergencyChime();
    const closeBtn = document.getElementById("emergency-modal-close-btn");
    if (closeBtn) closeBtn.focus();
  }
};

window.closeEmergencyModal = function() {
  const modal = document.getElementById("emergency-modal");
  if (modal) {
    modal.classList.remove("open");
    if (_modalPreviousActiveElement && typeof _modalPreviousActiveElement.focus === "function") {
      _modalPreviousActiveElement.focus();
    }
  }
};

window.onEmergencyBackdropClick = function(event) {
  if (event.target && event.target.id === "emergency-modal") {
    closeEmergencyModal();
  }
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEmergencyModal();
});

/* =============================================================================
   MOBILE BOTTOM NAVIGATION BAR
   ============================================================================= */

function ensureMobileBottomNav() {
  if (document.querySelector(".mobile-bottom-nav")) return;

  const currentPath = window.location.pathname.toLowerCase();
  const isHome = currentPath === "/" || currentPath.endsWith("index.html");
  const isMap = currentPath.includes("map");
  const isAlerts = currentPath.includes("alerts");
  const isSafe = currentPath.includes("safe-locations");

  const bottomNavHtml = `
    <nav class="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      <a href="/" class="mobile-bottom-nav-item ${isHome ? 'active' : ''}">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </a>
      <a href="/map" class="mobile-bottom-nav-item ${isMap ? 'active' : ''}">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
        <span>Live Map</span>
      </a>
      <a href="/alerts" class="mobile-bottom-nav-item ${isAlerts ? 'active' : ''}">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Alerts</span>
      </a>
      <a href="/safe-locations" class="mobile-bottom-nav-item ${isSafe ? 'active' : ''}">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span>Safe Places</span>
      </a>
      <button onclick="openEmergencyModal()" class="mobile-bottom-nav-item emergency-nav-item" style="background:transparent; border:none; cursor:pointer;" aria-label="Open emergency help">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
        <span>HELP</span>
      </button>
    </nav>
  `;

  document.body.insertAdjacentHTML("beforeend", bottomNavHtml);
}

/* =============================================================================
   PROGRESSIVE DISCLOSURE ACCORDIONS
   ============================================================================= */

window.toggleDisclosure = function(id) {
  const panel = document.getElementById(id);
  const btn = document.querySelector(`[data-target="${id}"]`);
  if (!panel) return;
  panel.classList.toggle("open");
  const isOpen = panel.classList.contains("open");
  if (btn) {
    const textEl = btn.querySelector(".disclosure-text") || btn;
    if (isOpen) {
      btn.setAttribute("aria-expanded", "true");
      if (btn.dataset.textOpen) textEl.textContent = btn.dataset.textOpen;
    } else {
      btn.setAttribute("aria-expanded", "false");
      if (btn.dataset.textClosed) textEl.textContent = btn.dataset.textClosed;
    }
  }
};

/* =============================================================================
   INITIALIZE GLOBAL COMMON ENHANCEMENTS (BUG-013 Unified DOMContentLoaded)
   ============================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initLiveClock();
  initMobileNav();
  initNavDropdown();
  updateNavAlertBadge();
  highlightActiveNavLink();
  initIncidentTicker();

  const currentMode = getFloodGuardMode();
  applyFloodGuardMode(currentMode);
  ensureEmergencyModal();
  ensureMobileBottomNav();

  // Attach emergency click handlers to any .btn-emergency
  document.querySelectorAll(".btn-emergency").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      openEmergencyModal();
    });
  });

  // Attach mode toggle handler to any .mode-toggle-pill
  document.querySelectorAll(".mode-toggle-pill").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      toggleFloodGuardMode();
    });
  });
});
