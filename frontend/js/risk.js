/**
 * FloodGuard Flood Risk Analysis Module
 * Interactive simulator and rule-based risk evaluation.
 */

document.addEventListener("DOMContentLoaded", () => {
  initRiskPage();
});

async function initRiskPage() {
  await loadAreaSelector();
  setupSimulatorEvents();
  // Check URL params for area preselection
  const urlParams = new URLSearchParams(window.location.search);
  const areaParam = urlParams.get("area");
  if (areaParam) {
    const sel = document.getElementById("risk-area-select");
    if (sel) {
      sel.value = areaParam;
      loadSelectedAreaData(areaParam);
    }
  } else {
    // Trigger initial calculation with default sliders
    recalculateRisk();
  }
}

async function loadAreaSelector() {
  const sel = document.getElementById("risk-area-select");
  if (!sel) return;

  try {
    const areas = await API.getFloodAreas();
    sel.innerHTML = '<option value="">-- Choose Monitored Area --</option>';
    areas.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.area_name;
      opt.textContent = `${a.area_name} (${a.risk_level})`;
      opt.dataset.rain = a.rainfall;
      opt.dataset.water = a.water_level;
      opt.dataset.elevation = a.elevation;
      opt.dataset.distance = a.distance_to_river;
      sel.appendChild(opt);
    });

    sel.addEventListener("change", (e) => {
      loadSelectedAreaData(e.target.value);
    });
  } catch (err) {
    console.error("Failed to load areas for selector:", err);
  }
}

function loadSelectedAreaData(areaName) {
  const sel = document.getElementById("risk-area-select");
  const opt = Array.from(sel.options).find(o => o.value === areaName);
  if (!opt) return;

  document.getElementById("slider-rain").value = opt.dataset.rain || 80;
  document.getElementById("val-rain").textContent = `${opt.dataset.rain || 80} mm`;

  document.getElementById("slider-river").value = opt.dataset.water || 7.0;
  document.getElementById("val-river").textContent = `${opt.dataset.water || 7.0} m`;

  document.getElementById("slider-elev").value = opt.dataset.elevation || 8;
  document.getElementById("val-elev").textContent = `${opt.dataset.elevation || 8} m`;

  document.getElementById("slider-dist").value = opt.dataset.distance || 200;
  document.getElementById("val-dist").textContent = `${opt.dataset.distance || 200} m`;

  recalculateRisk();
}

function setupSimulatorEvents() {
  const sliders = [
    { id: "slider-rain", valId: "val-rain", unit: "mm" },
    { id: "slider-river", valId: "val-river", unit: "m" },
    { id: "slider-elev", valId: "val-elev", unit: "m" },
    { id: "slider-dist", valId: "val-dist", unit: "m" }
  ];

  sliders.forEach(s => {
    const sliderElem = document.getElementById(s.id);
    const valElem = document.getElementById(s.valId);
    if (sliderElem && valElem) {
      sliderElem.addEventListener("input", () => {
        valElem.textContent = `${sliderElem.value} ${s.unit}`;
        recalculateRisk();
      });
    }
  });

  const histSelect = document.getElementById("select-hist");
  if (histSelect) {
    histSelect.addEventListener("change", () => recalculateRisk());
  }
}

async function recalculateRisk() {
  const rain = parseFloat(document.getElementById("slider-rain")?.value || 60);
  const river = parseFloat(document.getElementById("slider-river")?.value || 6.5);
  const elev = parseFloat(document.getElementById("slider-elev")?.value || 8);
  const dist = parseFloat(document.getElementById("slider-dist")?.value || 250);
  const hist = document.getElementById("select-hist")?.value || "Moderate";

  try {
    const result = await API.calculateRisk({
      rainfall: rain,
      river_level: river,
      flood_history: hist,
      elevation: elev,
      distance_from_river: dist
    });

    renderRiskResult(result);
  } catch (err) {
    console.error("Risk calculation failed:", err);
  }
}

function renderRiskResult(data) {
  // Score Display
  const scoreElem = document.getElementById("risk-score-value");
  const gaugeFill = document.getElementById("risk-gauge-fill");
  const badgeContainer = document.getElementById("risk-level-badge");
  const advisoryElem = document.getElementById("risk-action-advisory");

  if (scoreElem) scoreElem.textContent = data.risk_score;
  if (gaugeFill) {
    gaugeFill.style.width = `${data.risk_score}%`;
    gaugeFill.style.backgroundColor = data.color;
  }
  if (badgeContainer) {
    badgeContainer.innerHTML = renderRiskBadge(data.risk_level);
  }
  if (advisoryElem) {
    advisoryElem.textContent = data.action_advisory;
  }

  // Factor Breakdown Points
  const b = data.breakdown;
  if (b) {
    document.getElementById("pts-rain").textContent = `${b.rainfall.score} / ${b.rainfall.max_score} pts`;
    document.getElementById("desc-rain").textContent = b.rainfall.description;

    document.getElementById("pts-river").textContent = `${b.river_level.score} / ${b.river_level.max_score} pts`;
    document.getElementById("desc-river").textContent = b.river_level.description;

    document.getElementById("pts-hist").textContent = `${b.historical_frequency.score} / ${b.historical_frequency.max_score} pts`;
    document.getElementById("desc-hist").textContent = b.historical_frequency.description;

    document.getElementById("pts-dist").textContent = `${b.river_proximity.score} / ${b.river_proximity.max_score} pts`;
    document.getElementById("desc-dist").textContent = b.river_proximity.description;

    document.getElementById("pts-elev").textContent = `${b.elevation_adjustment.adjustment_pts > 0 ? '+' : ''}${b.elevation_adjustment.adjustment_pts} pts`;
    document.getElementById("desc-elev").textContent = b.elevation_adjustment.note;
  }
}
