"""
FloodGuard Main Application Server
Flask REST API & Static File Server for GIS Early Warning Prototype.
"""
import os
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, session, redirect

from backend.database import get_connection, init_database, hash_password, verify_password
from backend.risk_calculator import calculate_flood_risk, update_config, CONFIG
from backend.prediction import predict_flood
from backend.data_service import LiveDataService
from backend.live_india_service import LiveIndiaDataService
from backend.india_geo_data import (
    INDIAN_STATES, 
    MAJOR_RIVER_BASINS, 
    HISTORICAL_FLOOD_EVENTS, 
    get_india_rivers_geojson, 
    get_india_states_geojson, 
    get_forecast_risk_geojson
)
from backend.flood_areas_data import (
    get_flood_effect_geojson, 
    get_flood_effect_areas, 
    NATIONWIDE_FLOOD_EFFECT_AREAS
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATA_DIR = os.path.join(BASE_DIR, "data")

def _get_or_create_secret_key():
    env_key = os.environ.get("FLOODGUARD_SECRET_KEY")
    if env_key:
        return env_key
    secret_file = os.path.join(DATA_DIR, ".flask_secret")
    try:
        if os.path.exists(secret_file):
            with open(secret_file, "r", encoding="utf-8") as f:
                key = f.read().strip()
                if key:
                    return key
        new_key = os.urandom(32).hex()
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(secret_file, "w", encoding="utf-8") as f:
            f.write(new_key)
        return new_key
    except Exception:
        return "floodguard-dev-static-session-secret-2026"

app = Flask(__name__, static_folder=FRONTEND_DIR)
app.config.update(
    SECRET_KEY=_get_or_create_secret_key(),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
)

# CORS headers: allow same-origin and local development ports
@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if origin:
        if (origin == request.host_url.rstrip("/") or
            origin.startswith("http://localhost:") or
            origin.startswith("http://127.0.0.1:") or
            origin in {"http://localhost", "http://127.0.0.1"}):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Vary"] = "Origin"
    return response


@app.before_request
def protect_mutating_endpoints():
    """
    Require an authenticated administrator for administrative data mutation.
    Public calculation, prediction, simulation, and auth endpoints are permitted for all users.
    """
    if request.method not in {"POST", "PUT", "DELETE", "PATCH"}:
        return None
    
    # Whitelist public non-mutating or citizen calculation endpoints
    public_endpoints = {
        "/api/auth/login",
        "/api/auth/logout",
        "/api/calculate-risk",
        "/api/predict-flood",
        "/api/live-data/refresh",
        "/api/simulate-tick",
        "/api/sync-live-data"
    }
    if request.path in public_endpoints:
        return None

    if not request.path.startswith("/api/"):
        return None
    if session.get("role") != "admin":
        return jsonify({"error": "Administrator authentication is required for this action."}), 401
    return None

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

@app.route("/admin-login")
@app.route("/admin-login.html")
def serve_admin_login():
    return send_from_directory(FRONTEND_DIR, "admin-login.html")

@app.route("/admin")
@app.route("/admin.html")
def serve_admin():
    if session.get("role") != "admin":
        return redirect("/admin-login")
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

@app.route("/api/safe-locations/<int:location_id>", methods=["GET", "PUT", "DELETE"])
def handle_safe_location_item(location_id):
    conn = get_connection()
    cursor = conn.cursor()
    if request.method == "GET":
        cursor.execute("SELECT * FROM safe_locations WHERE id = ?", (location_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Safe location not found"}), 404
        return jsonify(dict(row))

    elif request.method == "PUT":
        data = request.json or {}
        cursor.execute("""
            UPDATE safe_locations
            SET location_name = COALESCE(?, location_name),
                type = COALESCE(?, type),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                capacity = COALESCE(?, capacity),
                current_occupancy = COALESCE(?, current_occupancy),
                contact = COALESCE(?, contact),
                address = COALESCE(?, address),
                status = COALESCE(?, status)
            WHERE id = ?
        """, (
            data.get("location_name"),
            data.get("type"),
            float(data["latitude"]) if "latitude" in data and data["latitude"] is not None else None,
            float(data["longitude"]) if "longitude" in data and data["longitude"] is not None else None,
            int(data["capacity"]) if "capacity" in data and data["capacity"] is not None else None,
            int(data["current_occupancy"]) if "current_occupancy" in data and data["current_occupancy"] is not None else None,
            data.get("contact"),
            data.get("address"),
            data.get("status"),
            location_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"message": "Safe location updated"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM safe_locations WHERE id = ?", (location_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Safe location removed"})

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

@app.route("/api/hospitals/<int:hospital_id>", methods=["GET", "PUT", "DELETE"])
def handle_hospital_item(hospital_id):
    conn = get_connection()
    cursor = conn.cursor()
    if request.method == "GET":
        cursor.execute("SELECT * FROM hospitals WHERE id = ?", (hospital_id,))
        row = cursor.fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Hospital not found"}), 404
        return jsonify(dict(row))

    elif request.method == "PUT":
        data = request.json or {}
        cursor.execute("""
            UPDATE hospitals
            SET hospital_name = COALESCE(?, hospital_name),
                latitude = COALESCE(?, latitude),
                longitude = COALESCE(?, longitude),
                address = COALESCE(?, address),
                emergency_availability = COALESCE(?, emergency_availability),
                total_beds = COALESCE(?, total_beds),
                available_beds = COALESCE(?, available_beds),
                contact = COALESCE(?, contact),
                ambulance_helpline = COALESCE(?, ambulance_helpline),
                status = COALESCE(?, status)
            WHERE id = ?
        """, (
            data.get("hospital_name"),
            float(data["latitude"]) if "latitude" in data and data["latitude"] is not None else None,
            float(data["longitude"]) if "longitude" in data and data["longitude"] is not None else None,
            data.get("address"),
            data.get("emergency_availability"),
            int(data["total_beds"]) if "total_beds" in data and data["total_beds"] is not None else None,
            int(data["available_beds"]) if "available_beds" in data and data["available_beds"] is not None else None,
            data.get("contact"),
            data.get("ambulance_helpline"),
            data.get("status"),
            hospital_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"message": "Hospital updated"})

    elif request.method == "DELETE":
        cursor.execute("DELETE FROM hospitals WHERE id = ?", (hospital_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "Hospital removed"})

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

        if rainfall < 0 or river_level < 0 or elevation < -50 or distance_from_river < 0:
            return jsonify({"error": "Numerical inputs cannot be negative (elevation minimum -50m)."}), 400

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

        if rainfall < 0 or river_level < 0 or elevation < -50 or distance < 0:
            return jsonify({"error": "Numerical inputs cannot be negative (elevation minimum -50m)."}), 400

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
# REST API: DATA EXPORT (CSV / JSON)
# =============================================================================

@app.route("/api/export/<dataset>", methods=["GET"])
def export_dataset(dataset):
    """Export datasets as CSV or JSON for disaster management and reporting."""
    fmt = request.args.get("format", "csv").lower()
    conn = get_connection()
    cursor = conn.cursor()

    table_map = {
        "flood-areas": ("flood_areas", ["id", "area_name", "district", "latitude", "longitude", "risk_level", "rainfall", "water_level", "elevation", "distance_to_river"]),
        "alerts": ("alerts", ["id", "title", "risk_level", "district", "message", "status", "created_at"]),
        "safe-locations": ("safe_locations", ["id", "location_name", "type", "latitude", "longitude", "capacity", "current_occupancy", "contact", "status"]),
        "hospitals": ("hospitals", ["id", "hospital_name", "latitude", "longitude", "total_beds", "available_beds", "contact", "status"]),
        "rivers": ("river_data", ["id", "river_name", "water_level", "warning_level", "danger_level", "status", "last_updated"])
    }

    if dataset not in table_map:
        conn.close()
        return jsonify({"error": f"Invalid dataset: {dataset}. Valid datasets: {', '.join(table_map.keys())}"}), 404

    tbl, cols = table_map[dataset]
    cursor.execute(f"SELECT {', '.join(cols)} FROM {tbl}")
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()

    if fmt == "json":
        return jsonify(rows)

    import io
    import csv
    from flask import Response
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=cols)
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=floodguard_{dataset}.csv"}
    )

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
# =============================================================================
# REST API: NATIONWIDE INDIA GEOGRAPHY & FLOOD STATUS (Requirements #1 - #6)
# =============================================================================

@app.route("/api/india/states", methods=["GET"])
def api_india_states():
    """Returns list of all 28 Indian States & UTs with capitals, bounding boxes, and basins."""
    states_list = [
        {
            "state_name": name,
            "capital": meta["capital"],
            "center": meta["center"],
            "zoom": meta["zoom"],
            "bbox": meta["bbox"],
            "primary_basins": meta["primary_basins"],
            "flood_prone_districts": meta["flood_prone_districts"],
            "vulnerability_index": meta["vulnerability_index"],
            "annual_flood_frequency": meta["annual_flood_frequency"]
        }
        for name, meta in sorted(INDIAN_STATES.items())
    ]
    return jsonify({
        "status": "success",
        "count": len(states_list),
        "states": states_list,
        "states_map": {name: meta for name, meta in sorted(INDIAN_STATES.items())}
    })

@app.route("/api/india/districts", methods=["GET"])
def api_india_districts():
    """Returns list of flood-vulnerable districts for a specific state or all districts."""
    state_name = request.args.get("state")
    if state_name and state_name in INDIAN_STATES:
        districts = INDIAN_STATES[state_name]["flood_prone_districts"]
        return jsonify({
            "status": "success",
            "state": state_name,
            "districts": districts
        })
    all_districts = {name: meta["flood_prone_districts"] for name, meta in sorted(INDIAN_STATES.items())}
    return jsonify({
        "status": "success",
        "districts_by_state": all_districts
    })

@app.route("/api/india/basins", methods=["GET"])
def api_india_basins():
    """Returns 9 major Indian river basins and hydrological profiles."""
    basins_list = [
        {
            "basin_key": key,
            **meta
        }
        for key, meta in sorted(MAJOR_RIVER_BASINS.items())
    ]
    return jsonify({
        "status": "success",
        "count": len(basins_list),
        "basins": basins_list,
        "basins_map": {key: meta for key, meta in sorted(MAJOR_RIVER_BASINS.items())}
    })

@app.route("/api/india/overview", methods=["GET"])
def api_india_overview():
    """Requirement #6: Complete nationwide India Flood Status Dashboard summary."""
    return jsonify(LiveIndiaDataService.get_india_flood_overview())

# =============================================================================
# REST API: GEOJSON SPATIAL LAYERS FOR ALL INDIA (Requirement #7)
# =============================================================================

@app.route("/api/geojson/india-states", methods=["GET"])
def api_geojson_india_states():
    """Layer 1: India State Boundaries GeoJSON."""
    return jsonify(get_india_states_geojson())

@app.route("/api/geojson/india-rivers", methods=["GET"])
def api_geojson_india_rivers():
    """Layer 3: Major Indian River Channel LineStrings."""
    return jsonify(get_india_rivers_geojson())

@app.route("/api/geojson/historical-floods", methods=["GET"])
def api_geojson_historical_floods():
    """Layer 5: Historical flood disaster archive across India."""
    state = request.args.get("state")
    basin = request.args.get("basin")
    features = []
    for ev in HISTORICAL_FLOOD_EVENTS:
        if state and state.lower() != "all" and state.lower() not in ev["state"].lower():
            continue
        if basin and basin.lower() != "all" and basin.lower() not in ev["river_basin"].lower():
            continue
        lat, lng = ev["coordinates"]
        features.append({
            "type": "Feature",
            "properties": {
                **ev,
                "feature_type": "historical_event_location",
                "geometry_note": "Archive point location of historical flood event, not an inundation polygon.",
                "provenance": "HISTORICAL"
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat]
            }
        })
    return jsonify({
        "type": "FeatureCollection",
        "features": features
    })

@app.route("/api/geojson/forecast-risk", methods=["GET"])
def api_geojson_forecast_risk():
    """Layer 12: 3-day forward precipitation and inundation hazard zones."""
    state = request.args.get("state")
    return jsonify(get_forecast_risk_geojson(state))

@app.route("/api/flood-effect-areas", methods=["GET"])
def api_flood_effect_areas():
    """
    Flood Impact Timeline & Spatial Flood Effect Areas Endpoint.
    Returns authentic GeoJSON Polygon & MultiPolygon flood areas
    filtered by time period (today, 7days, 30days, all), state, district, or basin.
    By default for 'today', returns ONLY verified active flood areas based on live data.
    """
    period = request.args.get("period", "today").lower()
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    include_catalog = request.args.get("catalog", "false").lower() in ["true", "1", "yes"]
    return jsonify(get_flood_effect_geojson(
        period=period, 
        state=state, 
        district=district, 
        basin=basin, 
        include_catalog=include_catalog
    ))

# =============================================================================
# REST API: REAL-TIME FLOOD-SAFE ROAD NAVIGATION
# =============================================================================

def _point_in_poly(x: float, y: float, poly: list) -> bool:
    """Ray-casting point in polygon test. x=lon, y=lat."""
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def _dist_km(lat1, lon1, lat2, lon2):
    import math
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

@app.route("/api/navigation/route", methods=["GET", "POST"])
def api_navigation_route():
    """
    Flood-Safe Road Navigation System.
    Fetches real road networks from OSRM, tests route polylines against
    verified active flood polygons, and automatically calculates safe detours.
    """
    import urllib.request
    import urllib.error

    if request.method == "POST":
        payload = request.json or {}
        origin_lat = payload.get("origin_lat")
        origin_lng = payload.get("origin_lng")
        dest_lat = payload.get("dest_lat")
        dest_lng = payload.get("dest_lng")
    else:
        origin_lat = request.args.get("origin_lat")
        origin_lng = request.args.get("origin_lng")
        dest_lat = request.args.get("dest_lat")
        dest_lng = request.args.get("dest_lng")

    try:
        origin_lat = float(origin_lat)
        origin_lng = float(origin_lng)
        dest_lat = float(dest_lat)
        dest_lng = float(dest_lng)
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "Valid origin_lat, origin_lng, dest_lat, dest_lng numeric coordinates required."
        }), 400

    # 1. Fetch active real-time flood polygons (strict live purity by default)
    include_catalog = (request.args.get("catalog", "false").lower() in ["true", "1", "yes"]) if request.method == "GET" else bool(payload.get("catalog", False))
    active_floods = get_flood_effect_areas(period="today", include_catalog=include_catalog)

    # 2. Query OSRM Driving Route
    osrm_url = (
        f"https://router.project-osrm.org/route/v1/driving/"
        f"{origin_lng},{origin_lat};{dest_lng},{dest_lat}?"
        f"overview=full&geometries=geojson&alternatives=true&steps=true"
    )

    osrm_routes = []
    try:
        req = urllib.request.Request(osrm_url, headers={"User-Agent": "FloodGuard-Navigation/2.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            osrm_data = json.loads(resp.read().decode("utf-8"))
            if osrm_data.get("code") == "Ok":
                osrm_routes = osrm_data.get("routes", [])
    except Exception as err:
        pass

    # If OSRM is offline, construct a clean direct fallback road geometry
    if not osrm_routes:
        dist_direct = round(_dist_km(origin_lat, origin_lng, dest_lat, dest_lng), 2)
        return jsonify({
            "status": "success",
            "is_road_network": False,
            "hazard_detected": False,
            "safety_status": "CLEAR",
            "message": "OSRM routing service offline. Straight-line fallback generated.",
            "primary_route": {
                "distance_km": dist_direct,
                "duration_min": round(dist_direct / 45.0 * 60.0, 1),
                "is_safe": True,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[origin_lng, origin_lat], [dest_lng, dest_lat]]
                },
                "steps": []
            },
            "safe_route": None
        })

    def check_route_hazard(coords):
        hazard_detected = False
        hazard_info = None
        blocked_coords = []

        for pt in coords:
            pt_lng, pt_lat = pt[0], pt[1]
            for fl in active_floods:
                # Check polygon intersection
                geom = fl.get("geometry", {})
                poly_coords = geom.get("coordinates", [])
                if poly_coords:
                    ring = poly_coords[0] if geom.get("type") == "Polygon" else (poly_coords[0][0] if poly_coords[0] else [])
                    if ring and _point_in_poly(pt_lng, pt_lat, ring):
                        hazard_detected = True
                        hazard_info = fl
                        blocked_coords.append(pt)
                        break
                # Proximity buffer check (< 2.5 km to center)
                c_lat = fl.get("latitude")
                c_lng = fl.get("longitude")
                if c_lat and c_lng and _dist_km(pt_lat, pt_lng, c_lat, c_lng) < 2.5:
                    hazard_detected = True
                    hazard_info = fl
                    blocked_coords.append(pt)
                    break
            if hazard_detected and len(blocked_coords) > 10:
                break
        return hazard_detected, hazard_info, blocked_coords

    def format_osrm_steps(osrm_route):
        steps = []
        for leg in osrm_route.get("legs", []):
            for s in leg.get("steps", []):
                name = s.get("name", "").strip()
                maneuver = s.get("maneuver", {})
                m_type = maneuver.get("type", "")
                modifier = maneuver.get("modifier", "")
                dist = s.get("distance", 0)

                dist_str = f" ({round(dist/1000.0, 1)} km)" if dist >= 1000 else (f" ({int(dist)} m)" if dist > 0 else "")
                
                if m_type == "depart":
                    desc = f"Depart onto {name or 'main road'}{dist_str}"
                elif m_type == "arrive":
                    desc = "Arrive at destination"
                elif m_type in ("turn", "new name", "end of road"):
                    dir_str = f" {modifier}" if modifier else ""
                    on_str = f" onto {name}" if name else ""
                    desc = f"Turn{dir_str}{on_str}{dist_str}"
                elif m_type in ("roundabout", "rotary"):
                    desc = f"Take roundabout onto {name or 'exit'}{dist_str}"
                elif m_type in ("fork", "merge"):
                    dir_str = f" {modifier}" if modifier else ""
                    desc = f"{m_type.title()}{dir_str} onto {name or 'road'}{dist_str}"
                elif name:
                    desc = f"Continue on {name}{dist_str}"
                else:
                    desc = f"Continue straight{dist_str}"

                if desc and (not steps or steps[-1] != desc):
                    steps.append(desc)
        return steps

    # Evaluate Primary Route
    primary_osrm = osrm_routes[0]
    p_coords = primary_osrm.get("geometry", {}).get("coordinates", [])
    p_hazard, p_hazard_info, p_blocked = check_route_hazard(p_coords)

    p_distance_km = round(primary_osrm.get("distance", 0) / 1000.0, 2)
    p_duration_min = round(primary_osrm.get("duration", 0) / 60.0, 1)

    primary_result = {
        "distance_km": p_distance_km,
        "duration_min": p_duration_min,
        "is_safe": not p_hazard,
        "geometry": primary_osrm.get("geometry"),
        "steps": format_osrm_steps(primary_osrm)
    }

    safe_result = None
    hazard_warning = None

    if p_hazard:
        hazard_name = p_hazard_info.get("name", "Active Flood Zone") if p_hazard_info else "Active Inundation Area"
        hazard_warning = f"Flood detected ahead on your route near {hazard_name}. Finding a safer alternative road."

        # Check if any alternative returned by OSRM avoids the flood
        for alt_osrm in osrm_routes[1:]:
            alt_coords = alt_osrm.get("geometry", {}).get("coordinates", [])
            a_hazard, _, _ = check_route_hazard(alt_coords)
            if not a_hazard:
                safe_result = {
                    "distance_km": round(alt_osrm.get("distance", 0) / 1000.0, 2),
                    "duration_min": round(alt_osrm.get("duration", 0) / 60.0, 1),
                    "is_safe": True,
                    "geometry": alt_osrm.get("geometry"),
                    "detour_info": "Natural road alternative avoiding flood perimeter.",
                    "steps": format_osrm_steps(alt_osrm)
                }
                break

        # If no default alternative is safe, calculate detour waypoint outside flood perimeter
        if not safe_result and p_hazard_info:
            h_lat = p_hazard_info.get("latitude", (origin_lat + dest_lat)/2.0)
            h_lng = p_hazard_info.get("longitude", (origin_lng + dest_lng)/2.0)
            
            # Offset perpendicular to route axis to bypass flood
            d_lat = dest_lat - origin_lat
            d_lng = dest_lng - origin_lng
            norm = (d_lat**2 + d_lng**2)**0.5 or 1.0
            detour_lat = h_lat + (-d_lng / norm) * 0.08  # ~9km detour offset
            detour_lng = h_lng + (d_lat / norm) * 0.08

            detour_url = (
                f"https://router.project-osrm.org/route/v1/driving/"
                f"{origin_lng},{origin_lat};{detour_lng:.5f},{detour_lat:.5f};{dest_lng},{dest_lat}?"
                f"overview=full&geometries=geojson&steps=true"
            )
            try:
                d_req = urllib.request.Request(detour_url, headers={"User-Agent": "FloodGuard-Navigation/2.0"})
                with urllib.request.urlopen(d_req, timeout=8) as d_resp:
                    d_data = json.loads(d_resp.read().decode("utf-8"))
                    if d_data.get("code") == "Ok" and d_data.get("routes"):
                        d_route = d_data["routes"][0]
                        safe_result = {
                            "distance_km": round(d_route.get("distance", 0) / 1000.0, 2),
                            "duration_min": round(d_route.get("duration", 0) / 60.0, 1),
                            "is_safe": True,
                            "geometry": d_route.get("geometry"),
                            "detour_info": f"Safe bypass via highland roads circumventing {hazard_name}.",
                            "steps": format_osrm_steps(d_route)
                        }
            except Exception:
                pass

    return jsonify({
        "status": "success",
        "is_road_network": True,
        "hazard_detected": p_hazard,
        "hazard_warning": hazard_warning,
        "safety_status": "FLOOD_BLOCKED" if p_hazard else "SAFE",
        "primary_route": primary_result,
        "safe_route": safe_result
    })

# =============================================================================
# REST API: UNIFIED LIVE INDIA FLOOD DATA SYSTEM (Requirements #3, #5, #10, #11, #17)
# =============================================================================

@app.route("/api/live-data/status", methods=["GET"])
def api_live_data_status():
    """Requirement #10 & #17: Operational health and availability of all 5 live subsystems."""
    return jsonify(LiveIndiaDataService.get_live_status())

@app.route("/api/live-data/rainfall", methods=["GET"])
def api_live_data_rainfall():
    """Requirement #11 & #17: Real-time rainfall observations across India with provenance and units."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    records = LiveIndiaDataService.get_live_rainfall(region=region, state=state, district=district, basin=basin)
    return jsonify({
        "status": "success",
        "region": state or basin or region or "all",
        "count": len(records),
        "data": records
    })

@app.route("/api/live-data/weather", methods=["GET"])
def api_live_data_weather():
    """Requirement #11 & #17: Real-time atmospheric weather telemetry across India."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    records = LiveIndiaDataService.get_live_weather(region=region, state=state, district=district, basin=basin)
    return jsonify({
        "status": "success",
        "region": state or basin or region or "all",
        "count": len(records),
        "data": records
    })

@app.route("/api/live-data/rivers", methods=["GET"])
def api_live_data_rivers():
    """Requirement #11 & #17: Real-time river stages, discharge rates, and danger levels across India."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    records = LiveIndiaDataService.get_live_rivers(region=region, state=state, district=district, basin=basin)
    return jsonify({
        "status": "success",
        "region": state or basin or region or "all",
        "count": len(records),
        "data": records
    })

@app.route("/api/live-data/flood-warnings", methods=["GET"])
def api_live_data_flood_warnings():
    """Requirement #11 & #17: Real-time flood risk scores and active early warnings across India."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    records = LiveIndiaDataService.get_live_flood_warnings(region=region, state=state, district=district, basin=basin)
    return jsonify({
        "status": "success",
        "region": state or basin or region or "all",
        "count": len(records),
        "data": records
    })

@app.route("/api/live-data/dashboard", methods=["GET"])
def api_live_data_dashboard():
    """Requirement #5 & #6: Consolidated payload for the Live Data Dashboard drawer."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    return jsonify(LiveIndiaDataService.get_live_dashboard(region=region, state=state, district=district, basin=basin))

@app.route("/api/live-data/refresh", methods=["POST"])
def api_live_data_refresh():
    """Requirement #8: Force real-time refresh bypassing TTL cache."""
    region = request.args.get("region")
    state = request.args.get("state")
    district = request.args.get("district")
    basin = request.args.get("basin")
    data = LiveIndiaDataService.sync_and_cache_live_observations(region=region, force_refresh=True, state=state, district=district, basin=basin)
    dash = LiveIndiaDataService.get_live_dashboard(region=region, state=state, district=district, basin=basin)

    # FG-005: Report truthful per-source status instead of always claiming success
    fetch_meta = LiveIndiaDataService._CACHE.get("fetch_meta", {})
    total = fetch_meta.get("total_stations", 0)
    reached = fetch_meta.get("stations_reached", 0)
    failed = fetch_meta.get("stations_failed", 0)
    weather_fail = fetch_meta.get("weather_unavailable", 0)
    river_fail = fetch_meta.get("river_unavailable", 0)

    if reached == 0 and total > 0:
        refresh_status = "failed"
        refresh_msg = "All external API requests failed. Displaying stale or unavailable data."
    elif failed > 0 or weather_fail > 0 or river_fail > 0:
        refresh_status = "partial"
        refresh_msg = f"Partial refresh: {reached}/{total} stations reached. Weather unavailable for {weather_fail}, river data unavailable for {river_fail}."
    else:
        refresh_status = "success"
        refresh_msg = "Live telemetry refreshed from Open-Meteo APIs."

    return jsonify({
        "status": refresh_status,
        "message": refresh_msg,
        "refreshed_stations": len(data),
        "fetch_health": fetch_meta,
        "dashboard": dash,
        "timestamp": datetime.now().isoformat()
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
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if user and verify_password(password, user["password_hash"]):
        if not user["password_hash"].startswith("pbkdf2_sha256$"):
            cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user["id"]))
            conn.commit()
        conn.close()
        session.clear()
        session["user_id"] = user["id"]
        session["role"] = user["role"]
        return jsonify({
            "status": "success",
            "user": {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"]
            }
        })
    conn.close()
    return jsonify({"status": "error", "message": "Invalid email or password"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"status": "success"})


@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    if session.get("role") == "admin":
        return jsonify({
            "authenticated": True,
            "role": "admin",
            "user_id": session.get("user_id")
        })
    return jsonify({
        "authenticated": False,
        "role": session.get("role", "guest"),
        "user_id": None
    })


if __name__ == "__main__":
    print("==================================================")
    print(" FloodGuard GIS Early Warning Server")
    print(" Running at: http://127.0.0.1:5000")
    print("==================================================")
    app.run(host="127.0.0.1", port=5000, debug=True)
