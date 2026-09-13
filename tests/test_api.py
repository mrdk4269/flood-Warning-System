"""
FloodGuard Comprehensive System & API Tests
Verifies all REST endpoints, ML prediction pipeline, risk calculator, and GeoJSON feeds.
"""
import sys
import os
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app
from backend.risk_calculator import calculate_flood_risk
from backend.prediction import predict_flood

class TestFloodGuard(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_static_routes(self):
        """Verify all 8 main HTML pages serve HTTP 200."""
        routes = ["/", "/map", "/risk", "/prediction", "/alerts", "/safe-locations", "/history", "/admin"]
        for r in routes:
            res = self.client.get(r)
            self.assertEqual(res.status_code, 200, f"Route {r} failed with status {res.status_code}")

    def test_stats_api(self):
        """Verify dashboard statistics endpoint."""
        res = self.client.get("/api/stats")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("total_areas", data)
        self.assertIn("active_alerts", data)
        self.assertIn("open_shelters", data)
        self.assertGreaterEqual(data["total_areas"], 5)

    def test_geojson_layers(self):
        """Verify all 6 GeoJSON layer feeds."""
        layers = ["flood_areas", "rivers", "risk_zones", "shelters", "hospitals", "rainfall_stations"]
        for lyr in layers:
            res = self.client.get(f"/api/geojson/{lyr}")
            self.assertEqual(res.status_code, 200, f"Layer {lyr} failed")
            data = res.get_json()
            self.assertEqual(data.get("type"), "FeatureCollection")
            self.assertGreater(len(data.get("features", [])), 0)

    def test_risk_calculator_logic(self):
        """Verify rule-based risk calculations for low vs critical scenarios."""
        # Low risk scenario
        low_res = calculate_flood_risk(rainfall=15.0, river_level=3.0, elevation=30.0, distance_from_river=1200.0)
        self.assertEqual(low_res["risk_level"], "LOW")
        self.assertLessEqual(low_res["risk_score"], 30.0)

        # Critical risk scenario
        crit_res = calculate_flood_risk(rainfall=180.0, river_level=10.2, elevation=2.0, distance_from_river=50.0, historical_flood_risk="Severe")
        self.assertIn(crit_res["risk_level"], ["HIGH", "CRITICAL"])
        self.assertGreaterEqual(crit_res["risk_score"], 80.0)

    def test_prediction_engine(self):
        """Verify Scikit-Learn ML and Rule-Based prediction outputs."""
        res = predict_flood(
            location="Test Flood Zone",
            rainfall=165.0,
            river_level=9.5,
            weather_forecast="Torrential Monsoonal Inflow",
            elevation=3.0,
            distance_from_river=80.0
        )
        self.assertIn("predicted_risk", res)
        self.assertIn("flood_probability", res)
        self.assertGreaterEqual(res["flood_probability"], 75)
        self.assertIn("expected_risk_time", res)
        self.assertIn("method_1_rule_based", res)
        self.assertIn("method_2_machine_learning", res)

    def test_flood_area_crud(self):
        """Verify adding, fetching, and deleting a flood area."""
        new_area = {
            "area_name": "Test Embankment Sector",
            "district": "Central Basin District",
            "latitude": 10.061,
            "longitude": 76.321,
            "risk_level": "Medium",
            "rainfall": 55.0,
            "water_level": 5.8,
            "elevation": 9.0,
            "distance_to_river": 300,
            "description": "Test automated area entry"
        }
        res = self.client.post("/api/flood-areas", json=new_area)
        self.assertEqual(res.status_code, 201)
        created_id = res.get_json()["id"]

        # Fetch
        get_res = self.client.get(f"/api/flood-areas/{created_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.get_json()["area_name"], "Test Embankment Sector")

        # Delete
        del_res = self.client.delete(f"/api/flood-areas/{created_id}")
        self.assertEqual(del_res.status_code, 200)

    def test_alert_generation_simulation(self):
        """Verify simulation telemetry trigger and alerts listing."""
        res = self.client.post("/api/simulate-tick")
        self.assertEqual(res.status_code, 200)

        alerts_res = self.client.get("/api/alerts")
        self.assertEqual(alerts_res.status_code, 200)
        self.assertIsInstance(alerts_res.get_json(), list)

    def test_live_data_sync_and_status(self):
        """Verify real-time external API sync and operational status."""
        status_res = self.client.get("/api/live-status")
        self.assertEqual(status_res.status_code, 200)
        status_data = status_res.get_json()
        self.assertEqual(status_data.get("status"), "online")
        self.assertGreaterEqual(len(status_data.get("live_sources", [])), 2)

        sync_res = self.client.post("/api/sync-live-data")
        self.assertEqual(sync_res.status_code, 200)
        sync_data = sync_res.get_json()
        self.assertEqual(sync_data.get("status"), "success")
        self.assertIn("weather", sync_data)
        self.assertIn("hydrology", sync_data)

    def test_live_india_status_endpoint(self):
        """Verify Requirement #10: Live Data Status subsystem health."""
        res = self.client.get("/api/live-data/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "operational")
        self.assertIn("subsystems", data)
        subsystems = data["subsystems"]
        self.assertIn("rainfall", subsystems)
        self.assertIn("weather", subsystems)
        self.assertIn("river_water_level", subsystems)
        self.assertIn("flood_warning_engine", subsystems)
        self.assertIn("satellite_imagery", subsystems)
        self.assertTrue(data.get("overall_operational"))

    def test_live_india_rainfall_endpoint(self):
        """Verify Requirement #11 schema on live rainfall observation feed."""
        res = self.client.get("/api/live-data/rainfall?region=odisha")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("region"), "odisha")
        self.assertGreater(data.get("count", 0), 0)
        first = data["data"][0]
        # Verify 9 core schema fields from Req #11
        for key in ["data_type", "location", "latitude", "longitude", "value", "unit", "source", "provenance", "observation_time"]:
            self.assertIn(key, first, f"Missing key {key} in Req #11 schema")
        self.assertEqual(first["data_type"], "rainfall_24h")
        self.assertEqual(first["unit"], "mm")
        self.assertIn(first["provenance"], ["LIVE", "HISTORICAL_FALLBACK"])

    def test_live_india_rivers_endpoint(self):
        """Verify Requirement #11 schema on live river gauge observation feed."""
        res = self.client.get("/api/live-data/rivers?region=odisha")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertGreater(data.get("count", 0), 0)
        first = data["data"][0]
        self.assertEqual(first["data_type"], "river_water_level")
        self.assertEqual(first["unit"], "m")
        self.assertIn(first["provenance"], ["LIVE", "HISTORICAL_FALLBACK"])
        self.assertIn("warning_level", first)
        self.assertIn("danger_level", first)
        self.assertIn("river_name", first)

    def test_live_india_dashboard_endpoint(self):
        """Verify Requirement #5: Live Data Dashboard for Odisha basin."""
        res = self.client.get("/api/live-data/dashboard?region=odisha")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data.get("region"), "odisha")
        self.assertIn("basin_summary", data)
        self.assertIn("stations", data)
        summary = data["basin_summary"]
        self.assertIn("peak_rainfall_24h_mm", summary)
        self.assertIn("critical_river_gauges", summary)
        self.assertIn("active_flood_warnings", summary)
        self.assertGreater(len(data["stations"]), 0)

    def test_live_india_refresh_endpoint(self):
        """Verify POST /api/live-data/refresh forces telemetry update."""
        res = self.client.post("/api/live-data/refresh?region=odisha")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("dashboard", data)

    def test_india_states_endpoint(self):
        """Verify GET /api/india/states returns 28+ states with capitals and centroids."""
        res = self.client.get("/api/india/states")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertGreaterEqual(data.get("count", 0), 28)
        states = data.get("states_map") or {s["state_name"]: s for s in data.get("states", [])}
        self.assertIn("Assam", states)
        self.assertIn("Bihar", states)
        self.assertIn("Odisha", states)
        self.assertIn("Kerala", states)
        self.assertIn("Maharashtra", states)
        self.assertIn("capital", states["Assam"])
        self.assertIn("center", states["Assam"])
        self.assertIn("flood_prone_districts", states["Assam"])

    def test_india_districts_endpoint(self):
        """Verify GET /api/india/districts with and without state filter."""
        res = self.client.get("/api/india/districts?state=Assam")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("districts", data)
        self.assertIn("Dibrugarh", data["districts"])

    def test_india_basins_endpoint(self):
        """Verify GET /api/india/basins returns 9 major Indian river basins."""
        res = self.client.get("/api/india/basins")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertGreaterEqual(data.get("count", 0), 9)
        basins = {k.lower(): v for k, v in (data.get("basins_map") or {}).items()} if data.get("basins_map") else {b["basin_key"].lower(): b for b in data.get("basins", [])}
        for b in ["ganga", "brahmaputra", "mahanadi", "godavari", "krishna", "narmada", "tapi", "kaveri", "indus"]:
            self.assertIn(b, basins)
            self.assertTrue("center" in basins[b])

    def test_india_overview_endpoint(self):
        """Verify GET /api/india/overview nationwide summary and macro KPIs."""
        res = self.client.get("/api/india/overview")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "success")
        self.assertIn("summary", data)
        sum_data = data["summary"]
        self.assertGreaterEqual(sum_data.get("monitored_states_count", 0), 28)
        self.assertGreaterEqual(sum_data.get("monitored_river_basins_count", 0), 9)
        self.assertIn("national_peak_rainfall_24h_mm", sum_data)
        self.assertIn("state_breakdown", data)
        self.assertGreater(len(data["state_breakdown"]), 0)

    def test_geojson_india_states(self):
        """Verify GET /api/geojson/india-states returns polygon GeoJSON for India."""
        res = self.client.get("/api/geojson/india-states")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(data.get("features", [])), 28)

    def test_geojson_india_rivers(self):
        """Verify GET /api/geojson/india-rivers returns 10 major nationwide rivers."""
        res = self.client.get("/api/geojson/india-rivers")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(data.get("features", [])), 9)
        river_names = [f["properties"]["river_name"] for f in data["features"]]
        self.assertIn("Ganga River", river_names)
        self.assertIn("Brahmaputra River", river_names)

    def test_geojson_historical_floods(self):
        """Verify GET /api/geojson/historical-floods returns archived flood perimeters."""
        res = self.client.get("/api/geojson/historical-floods")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreaterEqual(len(data.get("features", [])), 8)
        for f in data["features"]:
            self.assertEqual(f["properties"]["provenance"], "HISTORICAL")

    def test_geojson_forecast_risk(self):
        """Verify GET /api/geojson/forecast-risk returns 3-day forecast polygons."""
        res = self.client.get("/api/geojson/forecast-risk")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreater(len(data.get("features", [])), 0)
        for f in data["features"]:
            self.assertEqual(f["properties"]["provenance"], "FORECAST")

    def test_nationwide_station_schema_and_filtering(self):
        """Verify 13-field location schema and multi-dimensional filtering across states and basins."""
        # 1. State filter
        res_assam = self.client.get("/api/live-data/dashboard?state=Assam")
        self.assertEqual(res_assam.status_code, 200)
        d_assam = res_assam.get_json()
        self.assertTrue(all(s["state"] == "Assam" for s in d_assam.get("stations", [])))

        # 2. Basin filter
        res_ganga = self.client.get("/api/live-data/dashboard?basin=ganga")
        self.assertEqual(res_ganga.status_code, 200)
        d_ganga = res_ganga.get_json()
        self.assertTrue(all("Ganga" in s.get("river_basin", "") for s in d_ganga.get("stations", [])))


        # 3. 13-field schema verification on national feed
        res_all = self.client.get("/api/live-data/dashboard?region=all")
        self.assertEqual(res_all.status_code, 200)
        d_all = res_all.get_json()
        self.assertGreaterEqual(len(d_all.get("stations", [])), 35)

        required_13_fields = [
            "data_type", "country", "state", "district", "river_basin",
            "location_name", "latitude", "longitude", "value", "unit",
            "source", "observation_time", "last_updated"
        ]
        for st in d_all["stations"]:
            for f in required_13_fields:
                self.assertIn(f, st, f"Station {st.get('location_name')} missing field '{f}'")
            self.assertEqual(st["country"], "India")

    def test_flood_effect_areas_api(self):
        """Verify /api/flood-effect-areas temporal & geographic spatial GeoJSON endpoints."""
        # 1. Default (today)
        res = self.client.get("/api/flood-effect-areas?period=today")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("type"), "FeatureCollection")
        self.assertGreater(len(data.get("features", [])), 0)

        # 2. Check structure of features
        feat = data["features"][0]
        self.assertIn("id", feat)
        self.assertIn("properties", feat)
        self.assertIn("geometry", feat)
        self.assertIn(feat["geometry"]["type"], ["Polygon", "MultiPolygon"])
        props = feat["properties"]
        for field in ["id", "name", "state", "district", "severity", "rainfall", "water_level", "affected_area_sqkm", "timestamp"]:
            self.assertIn(field, props, f"Missing {field} in flood effect properties")

        # 3. Last 7 Days filter
        res_7d = self.client.get("/api/flood-effect-areas?period=7days")
        self.assertEqual(res_7d.status_code, 200)
        d_7d = res_7d.get_json()
        self.assertGreaterEqual(len(d_7d.get("features", [])), len(data.get("features", [])))

        # 4. State filter
        res_odisha = self.client.get("/api/flood-effect-areas?period=all&state=Odisha")
        self.assertEqual(res_odisha.status_code, 200)
        d_odisha = res_odisha.get_json()
        self.assertTrue(all(f["properties"]["state"].lower() == "odisha" for f in d_odisha.get("features", [])))

        # 5. District filter
        res_cuttack = self.client.get("/api/flood-effect-areas?period=all&state=Odisha&district=Cuttack")
        self.assertEqual(res_cuttack.status_code, 200)
        d_cuttack = res_cuttack.get_json()
        self.assertTrue(all(f["properties"]["district"].lower() == "cuttack" for f in d_cuttack.get("features", [])))

if __name__ == "__main__":
    unittest.main()


