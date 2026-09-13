"""
FloodGuard Risk Calculator Engine
Rule-based multi-factor flood risk scoring system.
Configurable weights and thresholds as required by Section 11 of the specification.
"""
from typing import Dict, Any, Tuple

# Default Admin-Configurable Thresholds and Weights
CONFIG = {
    "weights": {
        "rainfall_max": 30.0,
        "river_level_max": 30.0,
        "historical_max": 20.0,
        "proximity_max": 20.0
    },
    "rainfall_thresholds": {
        "extreme": 120.0,   # >= 120mm gives 30 pts
        "heavy": 80.0,      # 80-120mm gives 20 pts
        "moderate": 40.0,   # 40-80mm gives 10 pts
        "light": 15.0       # <40mm gives 0-5 pts
    },
    "river_danger_ratio": {
        "critical": 1.0,    # >= danger_level (30 pts)
        "warning": 0.85,    # >= warning_level (20 pts)
        "elevated": 0.70    # approaching warning (10 pts)
    },
    "distance_thresholds_meters": {
        "immediate": 100,   # <100m: 20 pts
        "near": 300,        # 100-300m: 15 pts
        "moderate": 600     # 300-600m: 10 pts
    },
    "risk_classification": {
        "low_max": 30,
        "medium_max": 60,
        "high_max": 80
        # > 80 is CRITICAL
    }
}

def update_config(new_config: Dict[str, Any]):
    """Allow admin to update scoring thresholds."""
    global CONFIG
    CONFIG.update(new_config)

def calculate_rainfall_score(rainfall_mm: float) -> Tuple[float, str]:
    max_pts = CONFIG["weights"]["rainfall_max"]
    thresh = CONFIG["rainfall_thresholds"]

    if rainfall_mm >= thresh["extreme"]:
        score = max_pts
        detail = "Torrential precipitation (>= 120mm)"
    elif rainfall_mm >= thresh["heavy"]:
        score = max_pts * (20.0 / 30.0)
        detail = "Heavy downpour (80 - 120mm)"
    elif rainfall_mm >= thresh["moderate"]:
        score = max_pts * (10.0 / 30.0)
        detail = "Moderate steady rainfall (40 - 80mm)"
    else:
        score = max(0.0, (rainfall_mm / thresh["moderate"]) * (max_pts * 0.2))
        detail = "Light or normal precipitation (< 40mm)"
    return round(score, 1), detail

def calculate_river_score(water_level_m: float, danger_level_m: float = 9.0, warning_level_m: float = 7.5) -> Tuple[float, str]:
    max_pts = CONFIG["weights"]["river_level_max"]
    if danger_level_m <= 0:
        danger_level_m = 9.0
    if warning_level_m <= 0:
        warning_level_m = 7.5

    ratio = water_level_m / danger_level_m

    if water_level_m >= danger_level_m:
        score = max_pts
        detail = f"Danger level breached ({water_level_m}m >= {danger_level_m}m)"
    elif water_level_m >= warning_level_m:
        score = max_pts * (20.0 / 30.0)
        detail = f"Above warning stage ({water_level_m}m >= {warning_level_m}m)"
    elif ratio >= CONFIG["river_danger_ratio"]["elevated"]:
        score = max_pts * (10.0 / 30.0)
        detail = f"River stage elevated at {water_level_m}m"
    else:
        score = max(0.0, ratio * (max_pts * 0.15))
        detail = f"River stage within normal limits ({water_level_m}m)"
    return round(score, 1), detail

def calculate_historical_score(history_level: Any) -> Tuple[float, str]:
    max_pts = CONFIG["weights"]["historical_max"]
    history_str = str(history_level).lower()

    if any(k in history_str for k in ["critical", "annual", "severe", "3", "4", "5"]):
        score = max_pts
        detail = "High recurrence flood history (frequent inundations)"
    elif any(k in history_str for k in ["high", "moderate", "occasional", "2"]):
        score = max_pts * 0.65
        detail = "Moderate historical flood frequency"
    elif any(k in history_str for k in ["medium", "1"]):
        score = max_pts * 0.35
        detail = "Low to sporadic historical flood frequency"
    else:
        score = 0.0
        detail = "No significant recorded flood events"
    return round(score, 1), detail

def calculate_proximity_score(distance_meters: float) -> Tuple[float, str]:
    max_pts = CONFIG["weights"]["proximity_max"]
    thresh = CONFIG["distance_thresholds_meters"]

    if distance_meters <= thresh["immediate"]:
        score = max_pts
        detail = f"Immediate riverbank adjacency ({distance_meters}m <= 100m)"
    elif distance_meters <= thresh["near"]:
        score = max_pts * 0.75
        detail = f"Near river corridor ({distance_meters}m)"
    elif distance_meters <= thresh["moderate"]:
        score = max_pts * 0.50
        detail = f"Intermediate buffer zone ({distance_meters}m)"
    else:
        score = max(0.0, max_pts * 0.15 * max(0.0, (1500.0 - distance_meters) / 1000.0))
        detail = f"Distant from active watercourse ({distance_meters}m)"
    return round(score, 1), detail

def classify_risk_score(total_score: float) -> Tuple[str, str, str]:
    """Returns (RiskLevel, HexColor, RecommendedAction)"""
    cls = CONFIG["risk_classification"]
    if total_score <= cls["low_max"]:
        return (
            "LOW",
            "#10B981",
            "Conditions safe. Normal monitoring advised. Keep standard emergency preparedness supplies."
        )
    elif total_score <= cls["medium_max"]:
        return (
            "MEDIUM",
            "#F59E0B",
            "Moderate risk of localized waterlogging. Clear peripheral drains, secure low ground assets, monitor bulletins."
        )
    elif total_score <= cls["high_max"]:
        return (
            "HIGH",
            "#EF4444",
            "High probability of inundation. Prepare evacuation essentials, identify nearest shelters, move vehicles to high ground."
        )
    else:
        return (
            "CRITICAL",
            "#DC2626",
            "CRITICAL FLOOD EMERGENCY. Immediate evacuation recommended. Avoid flooded roadways and follow emergency dispatch."
        )

def calculate_flood_risk(
    rainfall: float,
    river_level: float,
    danger_level: float = 9.0,
    warning_level: float = 7.5,
    historical_flood_risk: Any = "Moderate",
    elevation: float = 8.0,
    distance_from_river: float = 200.0
) -> Dict[str, Any]:
    """
    Main rule-based calculation method as requested in Section 11 & Section 24.
    """
    rain_score, rain_desc = calculate_rainfall_score(float(rainfall))
    river_score, river_desc = calculate_river_score(float(river_level), float(danger_level), float(warning_level))
    hist_score, hist_desc = calculate_historical_score(historical_flood_risk)
    prox_score, prox_desc = calculate_proximity_score(float(distance_from_river))

    # Base raw score (0 - 100)
    raw_score = rain_score + river_score + hist_score + prox_score

    # Elevation Topography Modulation:
    # High elevation (>25m) provides runoff safety (reduces up to 10 pts)
    # Low elevation (<5m) traps water (adds up to 8 pts)
    elev = float(elevation)
    elevation_mod = 0.0
    if elev >= 25.0:
        elevation_mod = -8.0
    elif elev >= 15.0:
        elevation_mod = -4.0
    elif elev <= 3.5:
        elevation_mod = +6.0
    elif elev <= 6.0:
        elevation_mod = +3.0

    final_score = max(0.0, min(100.0, round(raw_score + elevation_mod, 1)))
    risk_level, color_code, action_msg = classify_risk_score(final_score)

    return {
        "risk_score": final_score,
        "risk_level": risk_level,
        "color": color_code,
        "action_advisory": action_msg,
        "breakdown": {
            "rainfall": {
                "input_value": f"{rainfall} mm",
                "score": rain_score,
                "max_score": CONFIG["weights"]["rainfall_max"],
                "description": rain_desc
            },
            "river_level": {
                "input_value": f"{river_level} m",
                "score": river_score,
                "max_score": CONFIG["weights"]["river_level_max"],
                "description": river_desc
            },
            "historical_frequency": {
                "input_value": str(historical_flood_risk),
                "score": hist_score,
                "max_score": CONFIG["weights"]["historical_max"],
                "description": hist_desc
            },
            "river_proximity": {
                "input_value": f"{distance_from_river} m",
                "score": prox_score,
                "max_score": CONFIG["weights"]["proximity_max"],
                "description": prox_desc
            },
            "elevation_adjustment": {
                "elevation_m": elev,
                "adjustment_pts": elevation_mod,
                "note": "Elevated topography reduces water retention" if elevation_mod < 0 else (
                    "Low depression basin traps stormwater" if elevation_mod > 0 else "Neutral terrain elevation"
                )
            }
        }
    }
