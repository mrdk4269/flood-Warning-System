/**
 * FloodGuard Hydrological Risk Analysis & Scenario Simulator
 * Dynamic SVG tachometer gauge, preset scenarios, and multi-factor breakdown.
 */

const PRESETS = {
  monsoon: { rain: 145, river: 8.8, elev: 4, dist: 110, hist: "Severe" },
  spillway: { rain: 95, river: 9.8, elev: 3, dist: 60, hist: "Severe" },
  urban: { rain: 65, river: 6.2, elev: 8, dist: 320, hist: "Moderate" },
  nominal: { rain: 20, river: 3.5, elev: 28, dist: 1200, hist: "Nil" }
};

document.addEventListener("DOMContentLoaded", () => {
  initRiskPage();
});

async function initRiskPage() {
  await loadAreaSelector();
  setupSimulatorEvents();
  setupPresetButtons();

  // Check URL params (?area= or ?target=)
  const urlParams = new URLSearchParams(window.location.search);
  const areaParam = urlParams.get("area") || urlParams.get("target");
  if (areaParam) {
    const sel = document.getElementById("risk-area-select");
    if (sel) {
      sel.value = areaParam;
      loadSelectedAreaData(areaParam);
    }
  } else {
    // BUG-008: Ensure slider labels match the initial slider values
    syncSliderLabels();
    recalculateRisk();
  }
}

function syncSliderLabels() {
  const rainEl = document.getElementById("slider-rain");
  if (rainEl) document.getElementById("val-rain").textContent = `${rainEl.value} mm`;
  const riverEl = document.getElementById("slider-river");
  if (riverEl) document.getElementById("val-river").textContent = `${riverEl.value} m`;
  const elevEl = document.getElementById("slider-elev");
  if (elevEl) document.getElementById("val-elev").textContent = `${elevEl.value} m`;
  const distEl = document.getElementById("slider-dist");
  if (distEl) document.getElementById("val-dist").textContent = `${distEl.value} m`;
}

async function loadAreaSelector() {
  const sel = document.getElementById("risk-area-select");
  if (!sel) return;

  try {
    const areas = await API.getFloodAreas();
    sel.innerHTML = '<option value="">-- Choose Monitored Basin Area --</option>';
    areas.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.area_name;
      opt.textContent = `${a.area_name} [${a.risk_level.toUpperCase()}]`;
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
    console.error("Failed to load areas:", err);
  }
}

function loadSelectedAreaData(areaName) {
  const sel = document.getElementById("risk-area-select");
  const opt = Array.from(sel.options).find(o => o.value === areaName);
  if (!opt) return;

  setSliderValue("slider-rain", "val-rain", opt.dataset.rain || 80, "mm");
  setSliderValue("slider-river", "val-river", opt.dataset.water || 7.0, "m");
  setSliderValue("slider-elev", "val-elev", opt.dataset.elevation || 8, "m");
  setSliderValue("slider-dist", "val-dist", opt.dataset.distance || 200, "m");

  recalculateRisk();
}

function setSliderValue(sliderId, valId, value, unit) {
  const s = document.getElementById(sliderId);
  const v = document.getElementById(valId);
  if (s) s.value = value;
  if (v) v.textContent = `${value} ${unit}`;
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

function setupPresetButtons() {
  document.querySelectorAll(".preset-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const presetKey = btn.dataset.preset;
      const p = PRESETS[presetKey];
      if (p) {
        setSliderValue("slider-rain", "val-rain", p.rain, "mm");
        setSliderValue("slider-river", "val-river", p.river, "m");
        setSliderValue("slider-elev", "val-elev", p.elev, "m");
        setSliderValue("slider-dist", "val-dist", p.dist, "m");
        const histSel = document.getElementById("select-hist");
        if (histSel) histSel.value = p.hist;

        recalculateRisk();
        showToast(`Preset loaded: ${btn.textContent.trim()}`, "info");
      }
    });
  });
}

async function recalculateRisk() {
  const rain = parseFloat(document.getElementById("slider-rain")?.value || 85);
  const river = parseFloat(document.getElementById("slider-river")?.value || 7.2);
  const elev = parseFloat(document.getElementById("slider-elev")?.value || 6);
  const dist = parseFloat(document.getElementById("slider-dist")?.value || 180);
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
    console.error("Risk calculation error:", err);
  }
}

function renderRiskResult(data) {
  // Score Display
  const scoreElem = document.getElementById("risk-score-value");
  const gaugeNeedle = document.getElementById("gauge-needle");
  const badgeContainer = document.getElementById("risk-level-badge");
  const advisoryElem = document.getElementById("risk-action-advisory");

  if (scoreElem) {
    scoreElem.textContent = data.risk_score;
    scoreElem.style.color = data.color;
  }

  // Calculate needle angle on a 180-degree tachometer arc (-90deg to +90deg)
  if (gaugeNeedle) {
    const angle = -90 + (data.risk_score / 100) * 180;
    gaugeNeedle.style.transform = `rotate(${angle}deg)`;
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
