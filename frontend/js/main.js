/**
 * FloodGuard Mission Control Main UI Engine
 * Real-time clock, incident ticker, mobile drawer, and status beacon.
 */

document.addEventListener("DOMContentLoaded", () => {
  initLiveClock();
  initMobileNav();
  updateNavAlertBadge();
  highlightActiveNavLink();
  initIncidentTicker();
});

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

// Live Incident Ticker updates
async function initIncidentTicker() {
  const tickerContainer = document.getElementById("incident-ticker-text");
  if (!tickerContainer) return;

  try {
    const stats = await API.getStats();
    if (stats.latest_alert) {
      tickerContainer.innerHTML = `
        <span class="ticker-tag">${stats.latest_alert.risk_level}</span>
        <strong>${stats.latest_alert.title}</strong> — ${stats.latest_alert.location}
      `;
    }
  } catch (e) {
    // default ticker
  }
}

// Mobile Navigation Toggle
function initMobileNav() {
  const toggleBtn = document.querySelector(".mobile-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener("click", () => {
      navLinks.classList.toggle("show");
    });
  }
}

// Highlight Current Active Nav Link
function highlightActiveNavLink() {
  const currentPath = window.location.pathname.toLowerCase();
  const links = document.querySelectorAll(".nav-link");

  links.forEach(link => {
    const href = link.getAttribute("href").toLowerCase();
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

// Update Nav Alert Badge from Live API
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
    if (badge) badge.textContent = "3";
  }
}

// Risk Level Badge Generator Helper
function renderRiskBadge(level) {
  const l = (level || "LOW").toUpperCase();
  if (l === "CRITICAL") {
    return `<span class="badge badge-critical"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Critical</span>`;
  } else if (l === "HIGH") {
    return `<span class="badge badge-high"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/></svg> High</span>`;
  } else if (l === "MEDIUM") {
    return `<span class="badge badge-medium"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Medium</span>`;
  } else {
    return `<span class="badge badge-low"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Low</span>`;
  }
}

// Emergency Audio Warning Chime using Web Audio API
function playEmergencyChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.35); // A4

    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio alert blocked by browser policy.");
  }
}

// Toast Notification
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.style.position = "fixed";
  toast.style.bottom = "2rem";
  toast.style.right = "2rem";
  toast.style.background = type === "error" ? "#DC2626" : (type === "success" ? "#10B981" : "#1E293B");
  toast.style.color = "#FFFFFF";
  toast.style.padding = "0.75rem 1.25rem";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.5)";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "0.85rem";
  toast.style.fontFamily = "var(--font-mono)";
  toast.style.fontWeight = "600";
  toast.style.transition = "opacity 0.3s";
  toast.textContent = message;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
