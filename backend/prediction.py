"""
FloodGuard Prediction Engine
Implements Dual Prediction Architecture:
1. Rule-Based Heuristic Prediction
2. Scikit-Learn Machine Learning Classifier (Random Forest & Decision Tree)
Educational and Decision-Support Prototype.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from backend.risk_calculator import calculate_flood_risk

DISCLAIMER_TEXT = (
    "This prediction is generated for educational and decision-support purposes "
    "and is not an official emergency warning. Always follow official government "
    "disaster management directives."
)

# Global ML Models Cache
_rf_model = None
_dt_model = None

def _train_default_models():
    """
    Initializes and trains baseline RandomForest and DecisionTree models
    on synthetic yet hydraulically consistent hydrological training samples.
    Features:
    [rainfall_mm, river_level_m, elevation_m, distance_from_river_m, historical_freq_code]
    Target:
    0: Low, 1: Medium, 2: High, 3: Critical
    """
    global _rf_model, _dt_model

    # Generate synthetic training set representing varied hydrological scenarios
    np.random.seed(42)
    n_samples = 600

    rain = np.random.uniform(5, 250, n_samples)
    river = np.random.uniform(2.0, 11.5, n_samples)
    elevation = np.random.uniform(1.5, 45.0, n_samples)
    distance = np.random.uniform(20, 2000, n_samples)
    hist_freq = np.random.choice([0, 1, 2, 3], size=n_samples, p=[0.3, 0.3, 0.25, 0.15])

    # Hydraulic ground truth simulation rule
    danger_threshold = 9.0
    labels = []
    for i in range(n_samples):
        # Base vulnerability
        pts = 0
        if rain[i] > 130: pts += 35
        elif rain[i] > 80: pts += 22
        elif rain[i] > 40: pts += 10

        if river[i] >= danger_threshold: pts += 35
        elif river[i] >= 7.5: pts += 20
        elif river[i] >= 6.0: pts += 10

        if distance[i] < 150: pts += 18
        elif distance[i] < 400: pts += 10

        if elevation[i] < 4.0: pts += 12
        elif elevation[i] > 20.0: pts -= 10

        pts += hist_freq[i] * 6

        if pts > 75:
            labels.append(3) # Critical
        elif pts > 52:
            labels.append(2) # High
        elif pts > 28:
            labels.append(1) # Medium
        else:
            labels.append(0) # Low

    X = np.column_stack([rain, river, elevation, distance, hist_freq])
    y = np.array(labels)

    _rf_model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    _rf_model.fit(X, y)

    _dt_model = DecisionTreeClassifier(max_depth=5, random_state=42)
    _dt_model.fit(X, y)

def get_models():
    global _rf_model, _dt_model
    if _rf_model is None or _dt_model is None:
        _train_default_models()
    return _rf_model, _dt_model

def map_historical_freq_to_num(hist_val: Any) -> int:
    h = str(hist_val).lower()
    if any(k in h for k in ["severe", "critical", "annual", "3"]):
        return 3
    elif any(k in h for k in ["high", "moderate", "2"]):
        return 2
    elif any(k in h for k in ["medium", "occasional", "1"]):
        return 1
    return 0

def estimate_risk_timeline(rainfall: float, river_level: float, risk_level: str) -> str:
    """Estimates when the peak flood impact window is expected."""
    if risk_level == "CRITICAL" or river_level >= 9.0:
        return "Immediate / Next 2 - 6 Hours"
    elif risk_level == "HIGH" or rainfall >= 100.0:
        return "Next 6 - 12 Hours"
    elif risk_level == "MEDIUM" or rainfall >= 50.0:
        return "Next 12 - 24 Hours"
    else:
        return "Next 24 - 48 Hours (Low likelihood)"

def predict_flood(
    location: str,
    rainfall: float,
    river_level: float,
    weather_forecast: str = "Overcast with heavy squalls",
    elevation: float = 8.0,
    distance_from_river: float = 200.0,
    historical_flood_risk: Any = "Moderate",
    danger_level: float = 9.0
) -> Dict[str, Any]:
    """
    Dual-method prediction:
    Method 1: Rule-Based Evaluation
    Method 2: Machine Learning Probability Output (Random Forest & Decision Tree)
    """
    # 1. Rule-Based Calculation
    rule_res = calculate_flood_risk(
        rainfall=rainfall,
        river_level=river_level,
        danger_level=danger_level,
        historical_flood_risk=historical_flood_risk,
        elevation=elevation,
        distance_from_river=distance_from_river
    )

    # 2. Machine Learning Pipeline
    rf, dt = get_models()
    hist_code = map_historical_freq_to_num(historical_flood_risk)
    feature_vec = np.array([[float(rainfall), float(river_level), float(elevation), float(distance_from_river), hist_code]])

    rf_proba = rf.predict_proba(feature_vec)[0]
    # Compute combined probability of High or Critical (classes 2 and 3)
    flood_classes = rf.classes_
    class_probs = {int(c): float(p) for c, p in zip(flood_classes, rf_proba)}
    
    # Combined probability of flood event (Medium=0.4, High=0.8, Critical=1.0)
    p_med = class_probs.get(1, 0.0)
    p_high = class_probs.get(2, 0.0)
    p_crit = class_probs.get(3, 0.0)
    flood_prob_raw = (p_med * 0.35) + (p_high * 0.85) + (p_crit * 1.0)
    
    # Bound and smooth probability
    flood_probability_pct = int(min(99, max(5, round(flood_prob_raw * 100))))
    
    # If rule-based risk is critical, guarantee consistent high probability
    if rule_res["risk_level"] == "CRITICAL" and flood_probability_pct < 80:
        flood_probability_pct = 88
    elif rule_res["risk_level"] == "HIGH" and flood_probability_pct < 65:
        flood_probability_pct = 74

    expected_risk_time = estimate_risk_timeline(rainfall, river_level, rule_res["risk_level"])

    # Decision tree classification for explainability
    dt_pred = int(dt.predict(feature_vec)[0])
    label_map = {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}
    ml_predicted_level = label_map.get(dt_pred, rule_res["risk_level"])

    return {
        "location": location,
        "predicted_risk": rule_res["risk_level"],
        "flood_probability": flood_probability_pct,
        "expected_risk_time": expected_risk_time,
        "color": rule_res["color"],
        "weather_forecast": weather_forecast,
        "disclaimer": DISCLAIMER_TEXT,
        "method_1_rule_based": {
            "score": rule_res["risk_score"],
            "risk_level": rule_res["risk_level"],
            "advisory": rule_res["action_advisory"],
            "factors": rule_res["breakdown"]
        },
        "method_2_machine_learning": {
            "model_type": "Scikit-Learn Random Forest Classifier (Ensemble 100 Trees)",
            "decision_tree_level": ml_predicted_level,
            "confidence_probabilities": {
                "Low": round(class_probs.get(0, 0.0) * 100, 1),
                "Medium": round(class_probs.get(1, 0.0) * 100, 1),
                "High": round(class_probs.get(2, 0.0) * 100, 1),
                "Critical": round(class_probs.get(3, 0.0) * 100, 1)
            },
            "feature_importance": {
                name: f"{round(val * 100, 1)}%"
                for name, val in zip(
                    ["Rainfall", "River Water Level", "Elevation Topography", "Distance to River", "Historical Recurrence"],
                    getattr(rf, "feature_importances_", [0.342, 0.318, 0.154, 0.111, 0.075])
                )
            }
        }
    }
