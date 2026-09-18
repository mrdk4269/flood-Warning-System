-- =============================================================================
-- FloodGuard: GIS-Based Flood Risk Mapping & Early Warning System
-- Database Schema (SQLite 3 Compatible DDL)
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_alerts_risk_status ON alerts (risk_level, status);
CREATE INDEX IF NOT EXISTS idx_flood_areas_risk ON flood_areas (risk_level);
