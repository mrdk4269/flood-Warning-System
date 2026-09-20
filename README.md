# FloodGuard: GIS-Based Flood Risk Mapping and Early Warning System

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com/)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900.svg)](https://leafletjs.com/)
[![GeoJSON](https://img.shields.io/badge/Spatial-GeoJSON-orange.svg)](https://geojson.org)
[![Scikit-Learn](https://img.shields.io/badge/ML-Scikit--Learn-F7931E.svg)](https://scikit-learn.org/)

FloodGuard is a complete, modern, responsive GIS-based web application engineered to monitor and visualize flood-prone areas, assess hydrological risks, forecast flood hazard probability with machine learning, trigger automated early warnings, and guide communities to safe shelters and evacuation routes.

> **Disclaimer:** FloodGuard is an educational and decision-support prototype. It is not an official municipal or emergency agency warning and does not replace official government disaster instructions.

---

## System Architecture

```
                          [ SPATIAL & TELEMETRY FEEDS ]
         Rainfall Gauges   •   River Water Levels   •   GeoJSON Boundaries
                                      │
                                      ▼
                        [ FLOODGUARD FLASK BACKEND ]
             ┌────────────────────────┼────────────────────────┐
             ▼                        ▼                        ▼
    [ Database & Seeding ]   [ Risk Calculator Engine ]  [ Prediction Engine ]
      SQLite / MySQL /        Rule-based multi-factor    Dual Method:
      PostgreSQL PostGIS      Hydrological scoring       • Rule Heuristic
                              (0 to 100 points scale)    • Scikit-Learn ML
                                      │                    (Random Forest & DT)
                                      ▼                        │
                         [ Automated Alert Triggers ] ◄────────┘
                                      │
                                      ▼
                         [ MODERN RESPONSIVE UI ]
          Leaflet GIS Maps • Live Telemetry HUD • Evacuation Routes
```

---

## Features & Pages

| Page | URL Route | Description |
| :--- | :--- | :--- |
| **Home Page** | `/` | Hero section, status KPI cards (Low, Med, High, Active Alerts), embedded interactive GIS map preview, and "How It Works" pipeline. |
| **Live GIS Map** | `/map` | Full-screen Leaflet.js map with OpenStreetMap tiles, 6 distinct GeoJSON layers, location search, GPS geolocation ("My Location"), telemetry HUD, and rich interactive popups. |
| **Flood Risk Analysis** | `/risk` | Rule-based multi-factor risk calculator with interactive sliders (Rainfall, River level, Elevation, River proximity, Flood history) and live recalculation. |
| **Flood Prediction** | `/prediction` | Dual-engine forecasting combining rule-based heuristics and a Scikit-Learn **Random Forest Classifier** outputting flood probability (%) and risk timeframe. |
| **Emergency Alerts** | `/alerts` | Real-time emergency bulletin board with severity filtering (Critical, High, Medium, Low), simulated telemetry spike triggers, and audio warning chimes. |
| **Safe Locations & Routes** | `/safe-locations` | Emergency shelter directory, GPS nearest shelter finder (Haversine formula), and interactive evacuation routing visualizer with estimated transit times. |
| **Historical Flood Data** | `/history` | Multi-decadal flood logs, interactive Chart.js trend charts (Peak Rainfall vs River Crests), and historical inundation zone map. |
| **Admin Operations** | `/admin` | Secure dashboard to add/edit/delete flood zones, update river stages, broadcast emergency bulletins, and manage relief camps. |

---

## 6 Interactive GIS Map Layers

1. **Layer 1: Flood Areas**: Inundation polygons color-coded by current risk level (Low, Medium, High, Critical) with telemetry popups.
2. **Layer 2: Risk Zones**: Semi-transparent boundary zones delineating hydrological danger perimeters.
3. **Layer 3: Monitored Rivers**: River polylines styled dynamically based on water stage relative to warning and danger thresholds.
4. **Layer 4: Safe Shelters**: Point markers for schools, community halls, and high-ground refuges with capacity metrics.
5. **Layer 5: Hospitals**: Point markers for emergency medical centers with available ICU beds and ambulance helplines.
6. **Layer 6: Rainfall Stations**: Point markers representing automated weather and rain gauge stations with 24h accumulations.

---

## Project Folder Structure

```
flood-Warning-System/
├── frontend/
│   ├── index.html              # Modern Homepage
│   ├── map.html                # Full-screen Interactive GIS Map
│   ├── risk.html               # Risk Analysis & Interactive Simulator
│   ├── prediction.html         # Dual-Engine Flood Prediction (Rule + ML)
│   ├── alerts.html             # Emergency Bulletins & Audio Warnings
│   ├── safe-locations.html     # Safe Shelters & Evacuation Router
│   ├── history.html            # Historical Flood Records & Chart.js Trends
│   ├── admin.html              # Admin Dashboard
│   ├── css/
│   │   ├── style.css           # Core Design System (Dark Slate Navy & Glassmorphic)
│   │   └── responsive.css      # Fluid Breakpoints (Mobile, Tablet, Desktop)
│   └── js/
│       ├── api.js              # Centralized REST API Client
│       ├── main.js             # Shared UI, Mobile Nav & Web Audio Alert Chime
│       ├── map.js              # Leaflet GIS Engine & 6 GeoJSON Layer Renderers
│       ├── risk.js             # Dynamic Risk Slider & Calculator Engine
│       └── alerts.js           # Live Alert Feeds & Telemetry Spikes
├── backend/
│   ├── app.py                  # Flask Application & Static Gateway
│   ├── database.py             # Database Connector, Schema Seeder & CRUD Helpers
│   ├── models.py               # Data Models & Dataclass Definitions
│   ├── risk_calculator.py      # Rule-Based Hydrological Scoring (0 - 100 Scale)
│   ├── prediction.py           # Machine Learning Engine (Random Forest & Decision Tree)
│   └── data_service.py         # Live Telemetry Simulation & Automated Alert Trigger
├── data/
│   ├── flood_areas.geojson     # Flood Zone Polygons & Attributes
│   ├── rivers.geojson          # River Linestrings & Danger Levels
│   ├── risk_zones.geojson      # Risk Perimeter Polygons
│   ├── shelters.geojson        # Safe Shelter Point Coordinates & Capacities
│   ├── hospitals.geojson       # Hospital Coordinates & Emergency Facilities
│   └── rainfall_stations.geojson # Rain Gauge Weather Stations
├── database/
│   ├── schema.sql              # MySQL / PostGIS Production DDL Script
│   └── floodguard.db           # Zero-Config SQLite Database (Auto-Generated)
├── tests/
│   ├── __init__.py
│   └── test_api.py             # Automated System & API Test Suite
├── run.py                      # Startup Launcher
└── README.md
```

---

## Quick Start Guide

### Prerequisites
- Python 3.9+
- Modern Web Browser (Chrome, Firefox, Edge, Safari)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/mrdk4269/flood-Warning-System.git
   cd flood-Warning-System
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the application:
   ```bash
   python run.py
   ```

4. Open your browser and navigate to:
   ```
   http://127.0.0.1:5000
   ```

*(The system will automatically initialize the local SQLite database and seed all spatial datasets upon first launch!)*

---

## Database Migration (MySQL / PostGIS)

To migrate from the default zero-config SQLite storage to a production MySQL or PostgreSQL/PostGIS cluster:
1. Open MySQL CLI or phpMyAdmin.
2. Execute the provided DDL script:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
3. Update connection parameters in `backend/database.py`.

---

## Automated Testing

Run the full automated test suite covering all REST endpoints, ML prediction models, and GeoJSON feeds:
```bash
python tests/test_api.py
```

---

## License & Acknowledgements
Built for educational research, spatial flood risk modeling, and community disaster resilience. Leaflet tiles courtesy of OpenStreetMap and CartoDB.
