-- =============================================================================
-- FloodGuard: GIS-Based Flood Risk Mapping & Early Warning System
-- Database Schema (MySQL 8.0+ / PostgreSQL PostGIS Compatible DDL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(30) DEFAULT 'user', -- 'admin' or 'user'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS flood_areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    area_name VARCHAR(150) NOT NULL,
    district VARCHAR(100) DEFAULT 'Central Basin District',
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    geometry_json JSON NULL,
    risk_level VARCHAR(30) NOT NULL, -- 'Low', 'Medium', 'High', 'Critical'
    rainfall DECIMAL(6, 2) DEFAULT 0.00,
    water_level DECIMAL(5, 2) DEFAULT 0.00,
    elevation DECIMAL(6, 2) DEFAULT 0.00,
    distance_to_river INT DEFAULT 100,
    description TEXT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS safe_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location_name VARCHAR(150) NOT NULL,
    type VARCHAR(60) NOT NULL, -- 'Emergency Shelter', 'School', 'Community Center', 'High Ground Area'
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    capacity INT DEFAULT 500,
    current_occupancy INT DEFAULT 0,
    contact VARCHAR(80),
    address VARCHAR(255),
    status VARCHAR(30) DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospitals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_name VARCHAR(150) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    address VARCHAR(255),
    emergency_availability VARCHAR(100) DEFAULT '24/7 Emergency Wing',
    total_beds INT DEFAULT 100,
    available_beds INT DEFAULT 20,
    contact VARCHAR(80),
    ambulance_helpline VARCHAR(80),
    status VARCHAR(40) DEFAULT 'OPERATIONAL',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    location VARCHAR(150) NOT NULL,
    risk_level VARCHAR(30) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    alert_type VARCHAR(60) DEFAULT 'Flood Risk Alert', -- 'Heavy Rainfall Alert', 'Rising River Alert', 'Flood Risk Alert', 'Critical Flood Alert'
    date DATE NOT NULL,
    time TIME NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE', -- 'ACTIVE', 'MONITORING', 'RESOLVED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rainfall_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location VARCHAR(150) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    rainfall DECIMAL(6, 2) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    intensity VARCHAR(50) DEFAULT 'Moderate',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS river_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    river_name VARCHAR(150) NOT NULL,
    location VARCHAR(150) NOT NULL,
    water_level DECIMAL(5, 2) NOT NULL,
    warning_level DECIMAL(5, 2) NOT NULL,
    danger_level DECIMAL(5, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'DANGER'
    flow_rate_cumecs INT DEFAULT 0,
    date DATE NOT NULL,
    time TIME NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS historical_flood_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    location VARCHAR(150) NOT NULL,
    district VARCHAR(100) DEFAULT 'Central Basin District',
    year INT NOT NULL,
    severity VARCHAR(30) NOT NULL, -- 'Low', 'Medium', 'High', 'Critical'
    duration VARCHAR(50), -- e.g. '4 Days', '2 Weeks'
    affected_area VARCHAR(100), -- e.g. '18.5 sq km'
    peak_rainfall DECIMAL(6, 2),
    peak_river_level DECIMAL(5, 2),
    casualties INT DEFAULT 0,
    evacuated_persons INT DEFAULT 0,
    description TEXT
);
