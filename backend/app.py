"""
FloodGuard Main Application Server
Flask REST API & Static File Server for GIS Early Warning Prototype.
"""
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, render_template_string

from backend.database import get_connection, init_database, hash_password
from backend.risk_calculator import calculate_flood_risk, update_config, CONFIG
from backend.prediction import predict_flood
from backend.data_service import LiveDataService

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATA_DIR = os.path.join(BASE_DIR, "data")

app = Flask(__name__, static_folder=FRONTEND_DIR)

# Enable CORS for all responses
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# Initialize database on module load
init_database()

# =============================================================================
# FRONTEND STATIC ROUTES
# =============================================================================

@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/map")
@app.route("/map.html")
def serve_map():
    return send_from_directory(FRONTEND_DIR, "map.html")

@app.route("/risk")
@app.route("/risk.html")
def serve_risk():
    return send_from_directory(FRONTEND_DIR, "risk.html")

@app.route("/prediction")
@app.route("/prediction.html")
def serve_prediction():
    return send_from_directory(FRONTEND_DIR, "prediction.html")

@app.route("/alerts")
@app.route("/alerts.html")
def serve_alerts():
    return send_from_directory(FRONTEND_DIR, "alerts.html")

@app.route("/safe-locations")
@app.route("/safe-locations.html")
def serve_safe_locations():
    return send_from_directory(FRONTEND_DIR, "safe-locations.html")

@app.route("/history")
@app.route("/history.html")
def serve_history():
    return send_from_directory(FRONTEND_DIR, "history.html")

@app.route("/admin")
@app.route("/admin.html")
def serve_admin():
    return send_from_directory(FRONTEND_DIR, "admin.html")

@app.route("/css/<path:filename>")
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)

@app.route("/js/<path:filename>")
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)

# =============================================================================
# REST API: GEOJSON DATASETS
# =============================================================================

@app.route("/api/geojson/<layer_name>", methods=["GET"])
def get_geojson_layer(layer_name):
    """
    Serves GeoJSON files directly from data/ directory or dynamically generates from DB.
    Valid layers: flood_areas, rivers, risk_zones, shelters, hospitals, rainfall_stations
    """
    allowed = ["flood_areas", "rivers", "risk_zones", "shelters", "hospitals", "rainfall_stations"]
    clean_name = layer_name.replace(".geojson", "")
    if clean_name not in allowed:
        return jsonify({"error": f"Invalid layer: {layer_name}"}), 404

    file_path = os.path.join(DATA_DIR, f"{clean_name}.geojson")
    if not os.path.exists(file_path):
        return jsonify({"error": "Layer file not found"}), 404

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Sync live properties from DB if layer is flood_areas or rivers
    conn = get_connection()
    cursor = conn.cursor()
    if clean_name == "flood_areas":
        cursor.execute("SELECT area_name, risk_level, rainfall, water_level, elevation, distance_to_river, last_updated FROM flood_areas")
        db_areas = {r["area_name"]: dict(r) for r in cursor.fetchall()}
        for feat in data.get("features", []):
            name = feat.get("properties", {}).get("name")
            if name in db_areas:
                feat["properties"].update(db_areas[name])
    elif clean_name == "rivers":
        cursor.execute("SELECT river_name, water_level, warning_level, danger_level, status FROM river_data")
        db_rivers = {r["river_name"]: dict(r) for r in cursor.fetchall()}
        for feat in data.get("features", []):
            name = feat.get("properties", {}).get("river_name")
            if name in db_rivers:
                feat["properties"].update(db_rivers[name])
    conn.close()

    return jsonify(data)

# =============================================================================
# REST API: DASHBOARD STATS
# =============================================================================

@app.route("/api/stats", methods=["GET"])
def get_dashboard_stats():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM flood_areas")
    total_areas = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM flood_areas WHERE UPPER(risk_level) = 'LOW'")
    low_risk = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM flood_areas WHERE UPPER(risk_level) = 'MEDIUM'")
    med_risk = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM flood_areas WHERE UPPER(risk_level) = 'HIGH'")
    high_risk = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM flood_areas WHERE UPPER(risk_level) = 'CRITICAL'")
    crit_risk = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM alerts WHERE status = 'ACTIVE'")
    active_alerts = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM safe_locations WHERE status = 'OPEN'")
    open_shelters = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM hospitals WHERE status = 'OPERATIONAL'")
    hospitals_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM river_data")
    monitored_rivers = cursor.fetchone()[0]

    # Highest alert info
    cursor.execute("SELECT title, location, risk_level FROM alerts WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1")
    latest_alert = cursor.fetchone()

    conn.close()

    return jsonify({
        "total_areas": total_areas,
        "low_risk": low_risk,
        "medium_risk": med_risk,
        "high_risk": high_risk,
        "critical_risk": crit_risk,
        "active_alerts": active_alerts,
        "open_shelters": open_shelters,
        "hospitals_count": hospitals_count,
        "monitored_rivers": monitored_rivers,
        "latest_alert": dict(latest_alert) if latest_alert else None
    })

# =============================================================================
# REST API: FLOOD AREAS (CRUD)
# =============================================================================

@app.route("/api/flood-areas", methods=["GET", "POST"])
def handle_flood_areas():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM flood_areas ORDER BY id ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        required = ["area_name", "latitude", "longitude", "risk_level"]
        for field in required:
            if field not in data:
                conn.close()
                return jsonify({"error": f"Missing field: {field}"}), 400

        cursor.execute("""
            INSERT INTO flood_areas (area_name, district, latitude, longitude, geometry_json, risk_level, rainfall, water_level, elevation, distance_to_river, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("area_name"),
            data.get("district", "Central Basin District"),
            float(data.get("latitude")),
            float(data.get("longitude")),
            json.dumps(data.get("geometry_json", {})),
            data.get("risk_level", "Medium"),
            float(data.get("rainfall", 0.0)),
            float(data.get("water_level", 0.0)),
            float(data.get("elevation", 10.0)),
            int(data.get("distance_to_river", 200)),
            data.get("description", "")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Flood area created successfully", "id": new_id}), 201

@app.route("/api/flood-areas/<int:area_id>", methods=["GET", "PUT", "DELETE"])
def handle_flood_area_by_id(area_id):
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM flood_areas WHERE id = ?", (area_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Area not found"}), 404
        return jsonify(dict(row))

    elif request.method == "PUT":
        data = request.json or {}
        cursor.execute("""
            UPDATE flood_areas SET
                area_name = COALESCE(?, area_name),
                district = COALESCE(?, district),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                risk_level = COALESCE(?, risk_level),
                rainfall = COALESCE(?, rainfall),
                water_level = COALESCE(?, water_level),
                elevation = COALESCE(?, elevation),
                distance_to_river = COALESCE(?, distance_to_river),
                description = COALESCE(?, description),
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            data.get("area_name"),
            data.get("district"),
            data.get("latitude"),
            data.get("longitude"),
            data.get("risk_level"),
            data.get("rainfall"),
            data.get("water_level"),
            data.get("elevation"),
            data.get("distance_to_river"),
            data.get("description"),
            area_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"message": "Area updated successfully"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM flood_areas WHERE id = ?", (area_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Area deleted successfully"})

# =============================================================================
# REST API: ALERTS (CRUD)
# =============================================================================

@app.route("/api/alerts", methods=["GET", "POST"])
def handle_alerts():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        status_filter = request.args.get("status")
        level_filter = request.args.get("risk_level")

        query = "SELECT * FROM alerts WHERE 1=1"
        params = []
        if status_filter:
            query += " AND UPPER(status) = UPPER(?)"
            params.append(status_filter)
        if level_filter:
            query += " AND UPPER(risk_level) = UPPER(?)"
            params.append(level_filter)

        query += " ORDER BY id DESC"
        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        now = datetime.now()
        date_str = data.get("date", now.strftime("%Y-%m-%d"))
        time_str = data.get("time", now.strftime("%H:%M:%S"))

        cursor.execute("""
            INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("title", "Flood Advisory"),
            data.get("description", ""),
            data.get("location", "District Wide"),
            data.get("risk_level", "HIGH"),
            data.get("alert_type", "Flood Risk Alert"),
            date_str,
            time_str,
            data.get("status", "ACTIVE")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Alert created successfully", "id": new_id}), 201

@app.route("/api/alerts/<int:alert_id>", methods=["PUT", "DELETE"])
def handle_alert_by_id(alert_id):
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "PUT":
        data = request.json or {}
        cursor.execute("""
            UPDATE alerts SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                risk_level = COALESCE(?, risk_level),
                status = COALESCE(?, status)
            WHERE id = ?
        """, (data.get("title"), data.get("description"), data.get("risk_level"), data.get("status"), alert_id))
        conn.commit()
        conn.close()
        return jsonify({"message": "Alert updated successfully"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Alert deleted successfully"})

# =============================================================================
# REST API: SAFE LOCATIONS (CRUD)
# =============================================================================

@app.route("/api/safe-locations", methods=["GET", "POST"])
def handle_safe_locations():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM safe_locations ORDER BY capacity DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        cursor.execute("""
            INSERT INTO safe_locations (location_name, type, latitude, longitude, capacity, current_occupancy, contact, address, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("location_name"),
            data.get("type", "Emergency Shelter"),
            float(data.get("latitude", 10.0)),
            float(data.get("longitude", 76.3)),
            int(data.get("capacity", 500)),
            int(data.get("current_occupancy", 0)),
            data.get("contact", ""),
            data.get("address", ""),
            data.get("status", "OPEN")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Safe location created", "id": new_id}), 201

# =============================================================================
# REST API: HOSPITALS
# =============================================================================

@app.route("/api/hospitals", methods=["GET", "POST"])
def handle_hospitals():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM hospitals ORDER BY total_beds DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        cursor.execute("""
            INSERT INTO hospitals (hospital_name, latitude, longitude, address, emergency_availability, total_beds, available_beds, contact, ambulance_helpline, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("hospital_name"),
            float(data.get("latitude", 10.0)),
            float(data.get("longitude", 76.3)),
            data.get("address", ""),
            data.get("emergency_availability", "24/7"),
            int(data.get("total_beds", 100)),
            int(data.get("available_beds", 20)),
            data.get("contact", ""),
            data.get("ambulance_helpline", "108"),
            data.get("status", "OPERATIONAL")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Hospital recorded", "id": new_id}), 201

# =============================================================================
# REST API: RIVERS
# =============================================================================

@app.route("/api/rivers", methods=["GET", "POST", "PUT"])
def handle_rivers():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM river_data ORDER BY id ASC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        now = datetime.now()
        cursor.execute("""
            INSERT INTO river_data (river_name, location, water_level, warning_level, danger_level, status, flow_rate_cumecs, date, time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("river_name"),
            data.get("location", "Central Basin"),
            float(data.get("water_level", 5.0)),
            float(data.get("warning_level", 7.0)),
            float(data.get("danger_level", 8.5)),
            data.get("status", "NORMAL"),
            int(data.get("flow_rate_cumecs", 400)),
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "River recorded", "id": new_id}), 201

@app.route("/api/rivers/<int:river_id>", methods=["PUT", "DELETE"])
def handle_river_by_id(river_id):
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "PUT":
        data = request.json or {}
        cursor.execute("""
            UPDATE river_data SET
                water_level = COALESCE(?, water_level),
                warning_level = COALESCE(?, warning_level),
                danger_level = COALESCE(?, danger_level),
                status = COALESCE(?, status),
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (data.get("water_level"), data.get("warning_level"), data.get("danger_level"), data.get("status"), river_id))
        conn.commit()
        conn.close()
        # Trigger evaluation
        LiveDataService.evaluate_and_generate_alerts()
        return jsonify({"message": "River updated and alerts re-evaluated"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM river_data WHERE id = ?", (river_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "River removed"})

# =============================================================================
# REST API: RAINFALL STATIONS
# =============================================================================

@app.route("/api/rainfall", methods=["GET", "POST"])
def handle_rainfall():
    conn = get_connection()
    cursor = conn.cursor()

    if request.method == "GET":
        cursor.execute("SELECT * FROM rainfall_data ORDER BY rainfall DESC")
        rows = [dict(r) for r in cursor.fetchall()]
        conn.close()
        return jsonify(rows)

    elif request.method == "POST":
        data = request.json or {}
        now = datetime.now()
        cursor.execute("""
            INSERT INTO rainfall_data (location, latitude, longitude, rainfall, date, time, intensity)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("location"),
            float(data.get("latitude", 10.0)),
            float(data.get("longitude", 76.3)),
            float(data.get("rainfall", 50.0)),
            now.strftime("%Y-%m-%d"),
            now.strftime("%H:%M:%S"),
            data.get("intensity", "Moderate")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({"message": "Rainfall data recorded", "id": new_id}), 201

# =============================================================================
# REST API: HISTORICAL FLOOD DATA
# =============================================================================

@app.route("/api/history", methods=["GET"])
def get_flood_history():
    conn = get_connection()
    cursor = conn.cursor()

    year_filter = request.args.get("year")
    severity_filter = request.args.get("severity")
    district_filter = request.args.get("district")

    query = "SELECT * FROM historical_flood_data WHERE 1=1"
    params = []
    if year_filter:
        query += " AND year = ?"
        params.append(int(year_filter))
    if severity_filter:
        query += " AND UPPER(severity) = UPPER(?)"
        params.append(severity_filter)
    if district_filter:
        query += " AND UPPER(district) LIKE UPPER(?)"
        params.append(f"%{district_filter}%")

    query += " ORDER BY year DESC"
    cursor.execute(query, params)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify(rows)

# =============================================================================
# REST API: FLOOD RISK CALCULATION & SIMULATOR
# =============================================================================

@app.route("/api/calculate-risk", methods=["POST"])
def calculate_risk_api():
    """
    POST /api/calculate-risk
    Input:
      Rainfall, River Level, Flood History, Elevation, Distance From River
    Output:
      Risk Score (0-100), Risk Level (LOW, MEDIUM, HIGH, CRITICAL), Breakdown
    """
    data = request.json or {}
    try:
        rainfall = float(data.get("rainfall", 50.0))
        river_level = float(data.get("river_level", 5.0))
        historical_flood_risk = data.get("flood_history", data.get("historical_flood_risk", "Moderate"))
        elevation = float(data.get("elevation", 8.0))
        distance_from_river = float(data.get("distance_from_river", data.get("distance_to_river", 200.0)))

        result = calculate_flood_risk(
            rainfall=rainfall,
            river_level=river_level,
            historical_flood_risk=historical_flood_risk,
            elevation=elevation,
            distance_from_river=distance_from_river
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =============================================================================
# REST API: FLOOD PREDICTION (RULE-BASED + ML)
# =============================================================================

@app.route("/api/predict-flood", methods=["POST"])
def predict_flood_api():
    """
    POST /api/predict-flood
    Input:
      Location, Rainfall, River Level, Weather Data, Elevation, Distance from River
    Output:
      Predicted Risk, Flood Probability %, Expected Risk Time, Breakdown
    """
    data = request.json or {}
    try:
        location = data.get("location", "Selected Area")
        rainfall = float(data.get("rainfall", 75.0))
        river_level = float(data.get("river_level", 6.5))
        weather = data.get("weather_data", data.get("weather_forecast", "Monsoon depression warning"))
        elevation = float(data.get("elevation", 8.0))
        distance = float(data.get("distance_from_river", 250.0))
        hist = data.get("historical_flood_risk", data.get("flood_history", "Moderate"))

        res = predict_flood(
            location=location,
            rainfall=rainfall,
            river_level=river_level,
            weather_forecast=weather,
            elevation=elevation,
            distance_from_river=distance,
            historical_flood_risk=hist
        )
        return jsonify(res)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# =============================================================================
# REST API: LIVE TELEMETRY TICK & SIMULATION
# =============================================================================

@app.route("/api/simulate-tick", methods=["POST"])
def simulate_telemetry_tick():
    """Simulates live sensor changes and triggers threshold checks."""
    result = LiveDataService.simulate_telemetry_step()
    return jsonify(result)

@app.route("/api/sync-live-data", methods=["POST"])
def sync_live_data():
    """Fetches real-time weather and flood discharge from Open-Meteo and updates telemetry."""
    result = LiveDataService.sync_live_external_data()
    return jsonify(result)

@app.route("/api/live-status", methods=["GET"])
def get_live_status():
    """Returns the current telemetry mode and latest sync status."""
    return jsonify({
        "status": "online",
        "live_sources": [
            {
                "name": "Open-Meteo Weather API",
                "type": "Meteorological Telemetry",
                "status": "OPERATIONAL",
                "cadence": "Real-time ECMWF / DWD Forecast"
            },
            {
                "name": "Open-Meteo Global Flood API",
                "type": "Hydrological River Runoff",
                "status": "OPERATIONAL",
                "cadence": "Daily / Hourly Discharge"
            },
            {
                "name": "NASA GIBS Satellite (Terra / MODIS)",
                "type": "Earth Observation WMS Imagery",
                "status": "OPERATIONAL",
                "cadence": "Daily Satellite Pass"
            },
            {
                "name": "ISRO Bhuvan Space GIS (NRSC)",
                "type": "National Remote Sensing / Disaster WMS",
                "status": "OPERATIONAL",
                "cadence": "Indian Space Research Organisation"
            }
        ]
    })

# =============================================================================
# REST API: AUTHENTICATION
# =============================================================================

@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ? AND password_hash = ?", (email, hash_password(password)))
    user = cursor.fetchone()
    conn.close()

    if user:
        return jsonify({
            "status": "success",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
        })
    else:
        return jsonify({"status": "error", "message": "Invalid email or password"}), 401

if __name__ == "__main__":
    print("==================================================")
    print(" FloodGuard GIS Early Warning Server")
    print(" Running at: http://127.0.0.1:5000")
    print("==================================================")
    app.run(host="127.0.0.1", port=5000, debug=True)
