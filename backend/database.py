"""
FloodGuard Database Abstraction Layer
Supports SQLite out-of-the-box with full schema setup and seed initialization.
Can be configured for MySQL / PostgreSQL via standard connection strings.
"""
import sqlite3
import json
import os
import hashlib
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "database", "floodguard.db")
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")

def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def init_database():
    """Create all tables and seed initial data if empty."""
    conn = get_connection()
    cursor = conn.cursor()

    # Create tables with SQLite-compatible syntax
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flood_areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_name TEXT NOT NULL,
        district TEXT DEFAULT 'Central Basin District',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        geometry_json TEXT,
        risk_level TEXT NOT NULL,
        rainfall REAL DEFAULT 0.0,
        water_level REAL DEFAULT 0.0,
        elevation REAL DEFAULT 0.0,
        distance_to_river INTEGER DEFAULT 100,
        description TEXT,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS safe_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location_name TEXT NOT NULL,
        type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        capacity INTEGER DEFAULT 500,
        current_occupancy INTEGER DEFAULT 0,
        contact TEXT,
        address TEXT,
        status TEXT DEFAULT 'OPEN',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hospitals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospital_name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT,
        emergency_availability TEXT DEFAULT '24/7 ICU & Trauma',
        total_beds INTEGER DEFAULT 100,
        available_beds INTEGER DEFAULT 20,
        contact TEXT,
        ambulance_helpline TEXT,
        status TEXT DEFAULT 'OPERATIONAL',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT NOT NULL,
        risk_level TEXT NOT NULL,
        alert_type TEXT DEFAULT 'Flood Risk Alert',
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rainfall_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        rainfall REAL NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        intensity TEXT DEFAULT 'Moderate',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS river_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        river_name TEXT NOT NULL,
        location TEXT NOT NULL,
        water_level REAL NOT NULL,
        warning_level REAL NOT NULL,
        danger_level REAL NOT NULL,
        status TEXT DEFAULT 'NORMAL',
        flow_rate_cumecs INTEGER DEFAULT 0,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS historical_flood_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL,
        district TEXT DEFAULT 'Central Basin District',
        year INTEGER NOT NULL,
        severity TEXT NOT NULL,
        duration TEXT,
        affected_area TEXT,
        peak_rainfall REAL,
        peak_river_level REAL,
        casualties INTEGER DEFAULT 0,
        evacuated_persons INTEGER DEFAULT 0,
        description TEXT
    );
    """)
    conn.commit()

    # Seed Admin User if not present
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        """, ("FloodGuard Administrator", "admin@floodguard.org", hash_password("admin123"), "admin"))
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role)
            VALUES (?, ?, ?, ?)
        """, ("Public Safety Officer", "officer@floodguard.org", hash_password("safety2026"), "user"))
        conn.commit()

    # Seed Flood Areas from GeoJSON
    cursor.execute("SELECT COUNT(*) FROM flood_areas")
    if cursor.fetchone()[0] == 0:
        flood_geojson_path = os.path.join(DATA_DIR, "flood_areas.geojson")
        if os.path.exists(flood_geojson_path):
            with open(flood_geojson_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    props = feat.get("properties", {})
                    geom = feat.get("geometry", {})
                    # Calculate center lat/lng from polygon coords
                    coords = geom.get("coordinates", [[]])[0]
                    avg_lng = sum(pt[0] for pt in coords) / len(coords) if coords else 76.33
                    avg_lat = sum(pt[1] for pt in coords) / len(coords) if coords else 10.05
                    cursor.execute("""
                        INSERT INTO flood_areas 
                        (area_name, district, latitude, longitude, geometry_json, risk_level, rainfall, water_level, elevation, distance_to_river, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        props.get("name"),
                        props.get("district", "Central Basin District"),
                        round(avg_lat, 5),
                        round(avg_lng, 5),
                        json.dumps(geom),
                        props.get("risk_level", "Medium"),
                        props.get("rainfall", 50.0),
                        props.get("water_level", 5.0),
                        props.get("elevation", 8.0),
                        props.get("distance_to_river", 150),
                        props.get("description", "")
                    ))
            conn.commit()

    # Seed Safe Locations from GeoJSON
    cursor.execute("SELECT COUNT(*) FROM safe_locations")
    if cursor.fetchone()[0] == 0:
        shelters_geojson_path = os.path.join(DATA_DIR, "shelters.geojson")
        if os.path.exists(shelters_geojson_path):
            with open(shelters_geojson_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    p = feat.get("properties", {})
                    coords = feat.get("geometry", {}).get("coordinates", [76.34, 10.0])
                    cursor.execute("""
                        INSERT INTO safe_locations (location_name, type, latitude, longitude, capacity, current_occupancy, contact, address, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        p.get("name"),
                        p.get("type", "Emergency Shelter"),
                        coords[1],
                        coords[0],
                        p.get("capacity", 500),
                        p.get("current_occupancy", 0),
                        p.get("contact", ""),
                        p.get("address", ""),
                        p.get("status", "OPEN")
                    ))
            conn.commit()

    # Seed Hospitals from GeoJSON
    cursor.execute("SELECT COUNT(*) FROM hospitals")
    if cursor.fetchone()[0] == 0:
        hospitals_geojson_path = os.path.join(DATA_DIR, "hospitals.geojson")
        if os.path.exists(hospitals_geojson_path):
            with open(hospitals_geojson_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    p = feat.get("properties", {})
                    coords = feat.get("geometry", {}).get("coordinates", [76.35, 10.0])
                    cursor.execute("""
                        INSERT INTO hospitals (hospital_name, latitude, longitude, address, emergency_availability, total_beds, available_beds, contact, ambulance_helpline, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        p.get("hospital_name"),
                        coords[1],
                        coords[0],
                        p.get("address", ""),
                        p.get("emergency_availability", "24/7 Emergency Wing"),
                        p.get("total_beds", 200),
                        p.get("available_beds", 50),
                        p.get("contact", ""),
                        p.get("ambulance_helpline", "108"),
                        p.get("status", "OPERATIONAL")
                    ))
            conn.commit()

    # Seed Rivers from GeoJSON
    cursor.execute("SELECT COUNT(*) FROM river_data")
    if cursor.fetchone()[0] == 0:
        rivers_geojson_path = os.path.join(DATA_DIR, "rivers.geojson")
        if os.path.exists(rivers_geojson_path):
            with open(rivers_geojson_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    p = feat.get("properties", {})
                    now = datetime.now()
                    cursor.execute("""
                        INSERT INTO river_data (river_name, location, water_level, warning_level, danger_level, status, flow_rate_cumecs, date, time)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        p.get("river_name"),
                        p.get("district", "Central Basin"),
                        p.get("water_level", 6.0),
                        p.get("warning_level", 7.0),
                        p.get("danger_level", 8.5),
                        p.get("status", "NORMAL"),
                        p.get("flow_rate_cumecs", 500),
                        now.strftime("%Y-%m-%d"),
                        now.strftime("%H:%M:%S")
                    ))
            conn.commit()

    # Seed Rainfall Stations
    cursor.execute("SELECT COUNT(*) FROM rainfall_data")
    if cursor.fetchone()[0] == 0:
        rain_geojson_path = os.path.join(DATA_DIR, "rainfall_stations.geojson")
        if os.path.exists(rain_geojson_path):
            with open(rain_geojson_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                for feat in data.get("features", []):
                    p = feat.get("properties", {})
                    coords = feat.get("geometry", {}).get("coordinates", [76.35, 10.0])
                    now = datetime.now()
                    cursor.execute("""
                        INSERT INTO rainfall_data (location, latitude, longitude, rainfall, date, time, intensity)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        p.get("station_name"),
                        coords[1],
                        coords[0],
                        p.get("rainfall_mm", 45.0),
                        now.strftime("%Y-%m-%d"),
                        now.strftime("%H:%M:%S"),
                        p.get("intensity", "Moderate")
                    ))
            conn.commit()

    # Seed Alerts
    cursor.execute("SELECT COUNT(*) FROM alerts")
    if cursor.fetchone()[0] == 0:
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")
        initial_alerts = [
            (
                "CRITICAL FLOOD ALERT: East Delta Embankment Breach",
                "Water level in Periyar Main Stem reached 9.8m, exceeding danger threshold (9.0m). Flash flooding in progress in Zone B. Immediate evacuation ordered.",
                "East Delta Agricultural Sector (Zone B)",
                "CRITICAL",
                "Critical Flood Alert",
                date_str,
                time_str,
                "ACTIVE"
            ),
            (
                "HIGH FLOOD RISK: North Riverdale Lowlands",
                "Cumulative rainfall reached 135.5mm in the upstream catchment. Backwater inundation expected across Zone A within next 6 hours.",
                "North Riverdale Lowlands (Zone A)",
                "HIGH",
                "Heavy Rainfall Alert",
                date_str,
                time_str,
                "ACTIVE"
            ),
            (
                "RISING RIVER MONITORING: Chalakudy North Tributary",
                "River water level currently at 7.8m, approaching Warning Level (7.0m breached, Danger at 8.5m). Sluice gates opened by 20%.",
                "Central Metro Riverside Ward (Zone C)",
                "MEDIUM",
                "Rising River Alert",
                date_str,
                time_str,
                "MONITORING"
            )
        ]
        cursor.executemany("""
            INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, initial_alerts)
        conn.commit()

    # Seed Historical Flood Data
    cursor.execute("SELECT COUNT(*) FROM historical_flood_data")
    if cursor.fetchone()[0] == 0:
        history_records = [
            ("East Delta Agricultural Sector", "Central Basin District", 2024, "Critical", "6 Days", "28.4 sq km", 215.0, 10.4, 2, 4500, "Unprecedented monsoon depression resulted in dam spillway opening and severe inundation of paddy flatlands."),
            ("North Riverdale Lowlands", "Central Basin District", 2023, "High", "3 Days", "14.2 sq km", 168.0, 8.9, 0, 1800, "Continuous 36-hour precipitation caused local drainage choke and low-lying residential flooding."),
            ("Central Metro Riverside Ward", "Central Basin District", 2021, "Medium", "2 Days", "6.8 sq km", 110.0, 7.2, 0, 420, "Culvert blockages led to stormwater backflow into secondary arterial streets."),
            ("East Delta Agricultural Sector", "Central Basin District", 2019, "Critical", "8 Days", "35.1 sq km", 240.0, 11.2, 5, 8200, "Historic regional flood event with levee collapses along tributary confluence."),
            ("West Canal Marshland", "Central Basin District", 2018, "Medium", "4 Days", "9.5 sq km", 125.0, 6.8, 0, 650, "Canal overflow caused wetland expansion and water ingress into low ground hamlets.")
        ]
        cursor.executemany("""
            INSERT INTO historical_flood_data (location, district, year, severity, duration, affected_area, peak_rainfall, peak_river_level, casualties, evacuated_persons, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, history_records)
        conn.commit()

    conn.close()

if __name__ == "__main__":
    init_database()
    print("Database initialized and seeded successfully.")
