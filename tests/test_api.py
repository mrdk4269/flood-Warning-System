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

if __name__ == "__main__":
    unittest.main()
