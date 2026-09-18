"""
FloodGuard Live Data Service & Alert Generation Engine
Handles real-time data ingestion from Open-Meteo Weather & Flood APIs,
sensor simulation, and automated threshold alerts.
"""
import random
import json
import urllib.request
from datetime import datetime
from typing import Dict, Any, List
from backend.database import get_connection
from backend.risk_calculator import calculate_flood_risk

class LiveDataService:
    @staticmethod
    def fetch_realtime_weather(lat: float = 10.04, lon: float = 76.34) -> Dict[str, Any]:
        """
        Fetches real-time weather and precipitation from Open-Meteo API.
        Zero-key open access provided by ECMWF / DWD weather models.
        """
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m"
            f"&daily=precipitation_sum"
            f"&timezone=auto"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "FloodGuard-GIS/2.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
            current = data.get("current", {})
            daily = data.get("daily", {})
            return {
                "time": current.get("time"),
                "temperature": current.get("temperature_2m", 28.0),
                "humidity": current.get("relative_humidity_2m", 65),
                "precipitation": current.get("precipitation", 0.0),
                "rain": current.get("rain", 0.0),
                "wind_speed": current.get("wind_speed_10m", 10.0),
                "weather_code": current.get("weather_code", 0),
                "daily_rain_sum": (daily.get("precipitation_sum", [0.0]) or [0.0])[0]
            }

    @staticmethod
    def fetch_realtime_river_discharge(lat: float = 10.04, lon: float = 76.34) -> Dict[str, Any]:
        """
        Fetches real-time river discharge (m3/s) from Open-Meteo Global Flood API.
        """
        url = (
            f"https://flood-api.open-meteo.com/v1/flood"
            f"?latitude={lat}&longitude={lon}"
            f"&daily=river_discharge,river_discharge_mean"
            f"&timezone=auto"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "FloodGuard-GIS/2.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
            daily = data.get("daily", {})
            discharges = daily.get("river_discharge", [3.5]) or [3.5]
            means = daily.get("river_discharge_mean", [4.0]) or [4.0]
            return {
                "current_discharge": round(float(discharges[0] if discharges[0] is not None else 3.5), 2),
                "mean_discharge": round(float(means[0] if means[0] is not None else 4.0), 2),
                "time": (daily.get("time", [""]) or [""])[0]
            }

    @staticmethod
    def sync_live_external_data() -> Dict[str, Any]:
        """
        Connects to Open-Meteo live APIs, updates database gauges with real-world rainfall
        and river stage calculations, and runs alert evaluation.
        Falls back safely to local telemetry buffer if internet is unreachable.
        """
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")

        source_label = "Open-Meteo Live API & ECMWF Satellite Model"

        try:
            weather_data = LiveDataService.fetch_realtime_weather()
            flood_data = LiveDataService.fetch_realtime_river_discharge()
        except Exception as exc:
            # Fallback to offline / simulated baseline
            source_label = "Local Telemetry Buffer (Offline Resilient)"
            weather_data = {
                "temperature": 29.4,
                "humidity": 78,
                "precipitation": 14.5,
                "rain": 14.5,
                "wind_speed": 12.0,
                "weather_code": 61,
                "daily_rain_sum": 38.0
            }
            flood_data = {
                "current_discharge": 7.8,
                "mean_discharge": 6.5
            }

        rain_val = max(weather_data.get("daily_rain_sum", 0.0) or 0.0, weather_data.get("precipitation", 0.0) or 0.0)
        station_rain_baseline = rain_val if rain_val > 5.0 else 25.0
        discharge_val = flood_data.get("current_discharge", 4.0)

        # Compute realistic river stage (meters) from discharge rate (m3/s)
        calculated_river_stage = round(3.5 + (discharge_val ** 0.45) * 1.8, 2)

        # Cross-reference live station observations from LiveIndiaDataService
        live_telemetry_map = {}
        try:
            from backend.live_india_service import LiveIndiaDataService
            live_telemetry_map = LiveIndiaDataService.get_live_station_telemetry_map()
        except Exception:
            live_telemetry_map = {}

        # Coordinate weather cache to avoid duplicate calls while supporting station-specific coordinates (BUG-025)
        station_weather_cache = {}
        def _get_weather_for(st_lat, st_lon):
            if st_lat is None or st_lon is None:
                return weather_data
            ckey = (round(float(st_lat), 1), round(float(st_lon), 1))
            if ckey not in station_weather_cache:
                try:
                    station_weather_cache[ckey] = LiveDataService.fetch_realtime_weather(lat=float(st_lat), lon=float(st_lon))
                except Exception:
                    station_weather_cache[ckey] = weather_data
            return station_weather_cache[ckey]

        conn = get_connection()
        cursor = conn.cursor()

        # 1. Update Rainfall Stations with Live Spatial Values
        cursor.execute("SELECT id, location, latitude, longitude FROM rainfall_data")
        stations = cursor.fetchall()
        for st in stations:
            loc_name = st["location"] or ""
            matched_live = None
            for key, val in live_telemetry_map.items():
                if loc_name and (loc_name.lower() in key[0].lower() or loc_name.lower() in key[1].lower()):
                    matched_live = val
                    break

            if matched_live and matched_live.get("rainfall") is not None:
                st_rain = round(float(matched_live["rainfall"]), 1)
            elif st["latitude"] is not None and st["longitude"] is not None:
                local_w = _get_weather_for(st["latitude"], st["longitude"])
                local_rain = max(local_w.get("daily_rain_sum", 0.0) or 0.0, local_w.get("precipitation", 0.0) or 0.0)
                st_rain = round(local_rain if local_rain > 0 else station_rain_baseline, 1)
            else:
                st_rain = round(max(5.0, station_rain_baseline), 1)

            intensity = "Extremely Heavy" if st_rain > 120 else ("Heavy" if st_rain > 75 else ("Moderate" if st_rain > 30 else "Light"))
            cursor.execute("""
                UPDATE rainfall_data 
                SET rainfall = ?, intensity = ?, date = ?, time = ?
                WHERE id = ?
            """, (st_rain, intensity, date_str, time_str, st["id"]))

        # 2. Update River Transects with Stage
        cursor.execute("SELECT id, river_name, warning_level, danger_level FROM river_data")
        rivers = cursor.fetchall()
        for riv in rivers:
            r_name = riv["river_name"] or ""
            matched_live = None
            for key, val in live_telemetry_map.items():
                if r_name and (r_name.lower() in str(val.get("river_name", "")).lower() or r_name.lower() in key[0].lower() or r_name.lower() in key[1].lower()):
                    matched_live = val
                    break

            if matched_live and matched_live.get("water_level") is not None:
                riv_level = round(float(matched_live["water_level"]), 2)
            else:
                riv_level = round(calculated_river_stage, 2)

            status = "DANGER" if riv_level >= riv["danger_level"] else ("WARNING" if riv_level >= riv["warning_level"] else "NORMAL")
            cursor.execute("""
                UPDATE river_data
                SET water_level = ?, status = ?, date = ?, time = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (riv_level, status, date_str, time_str, riv["id"]))

        # 3. Update Flood Areas
        cursor.execute("SELECT id, area_name, elevation, distance_to_river FROM flood_areas")
        areas = cursor.fetchall()
        for fa in areas:
            a_name = fa["area_name"] or ""
            matched_live = None
            for key, val in live_telemetry_map.items():
                if a_name and (a_name.lower() in key[0].lower() or a_name.lower() in key[1].lower()):
                    matched_live = val
                    break

            if matched_live and matched_live.get("rainfall") is not None:
                fa_rain = round(float(matched_live["rainfall"]), 1)
            else:
                fa_rain = round(station_rain_baseline, 1)

            if matched_live and matched_live.get("water_level") is not None:
                fa_water = round(float(matched_live["water_level"]), 2)
            else:
                fa_water = round(calculated_river_stage, 2)

            risk_eval = calculate_flood_risk(
                rainfall=fa_rain,
                river_level=fa_water,
                elevation=fa["elevation"],
                distance_from_river=fa["distance_to_river"]
            )
            cursor.execute("""
                UPDATE flood_areas
                SET rainfall = ?, water_level = ?, risk_level = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (fa_rain, fa_water, risk_eval["risk_level"], fa["id"]))

        conn.commit()
        conn.close()

        # 4. Trigger alert scan
        new_alerts = LiveDataService.evaluate_and_generate_alerts()

        return {
            "status": "success",
            "source": source_label,
            "synced_at": f"{date_str} {time_str}",
            "weather": {
                "temperature_c": weather_data.get("temperature"),
                "humidity_pct": weather_data.get("humidity"),
                "live_precipitation_mm": weather_data.get("precipitation"),
                "station_rainfall_mm": station_rain_baseline,
                "wind_speed_kmh": weather_data.get("wind_speed")
            },
            "hydrology": {
                "river_discharge_m3s": discharge_val,
                "periyar_stage_meters": calculated_river_stage
            },
            "alerts_triggered": len(new_alerts),
            "alerts": new_alerts
        }

    @staticmethod
    def evaluate_and_generate_alerts():
        """
        Scans all monitored flood areas and rivers.
        Automatically triggers alerts when thresholds are breached:
        - Rainfall > 100mm -> Heavy Rainfall Alert
        - River level >= warning level -> Rising River Alert
        - River level >= danger level -> Critical Flood Alert
        - Computed Risk Score >= 61 (High/Critical) -> Flood Risk Alert
        """
        conn = get_connection()
        cursor = conn.cursor()
        now = datetime.now()
        date_str = now.strftime("%Y-%m-%d")
        time_str = now.strftime("%H:%M:%S")

        generated_alerts = []

        try:
            # 1. Check Rivers
            cursor.execute("SELECT * FROM river_data")
            rivers = cursor.fetchall()
            for r in rivers:
                r_name = r["river_name"]
                w_level = r["water_level"]
                warn_lvl = r["warning_level"]
                dang_lvl = r["danger_level"]

                cursor.execute("SELECT id, risk_level FROM alerts WHERE location = ? AND status = 'ACTIVE'", (r_name,))
                existing = cursor.fetchone()

                if w_level >= dang_lvl:
                    title = f"CRITICAL RIVER SURGE: {r_name}"
                    desc = f"Water level at {w_level}m has exceeded the Danger Mark ({dang_lvl}m). Immediate flood overflow threatening downstream communities."
                    if not existing:
                        cursor.execute("""
                            INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (title, desc, r_name, "CRITICAL", "Critical Flood Alert", date_str, time_str, "ACTIVE"))
                        generated_alerts.append({"title": title, "level": "CRITICAL"})
                    elif existing["risk_level"] != "CRITICAL":
                        cursor.execute("""
                            UPDATE alerts SET title = ?, description = ?, risk_level = 'CRITICAL', alert_type = 'Critical Flood Alert', date = ?, time = ?
                            WHERE id = ?
                        """, (title, desc, date_str, time_str, existing["id"]))
                        generated_alerts.append({"title": title, "level": "CRITICAL"})

                elif w_level >= warn_lvl:
                    title = f"RIVER WARNING STAGE: {r_name}"
                    desc = f"Water level reached {w_level}m, breaching Warning Threshold ({warn_lvl}m). Sluice gates under high pressure."
                    if not existing:
                        cursor.execute("""
                            INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (title, desc, r_name, "HIGH", "Rising River Alert", date_str, time_str, "ACTIVE"))
                        generated_alerts.append({"title": title, "level": "HIGH"})
                    elif existing["risk_level"] not in ("HIGH", "CRITICAL"):
                        cursor.execute("""
                            UPDATE alerts SET title = ?, description = ?, risk_level = 'HIGH', alert_type = 'Rising River Alert', date = ?, time = ?
                            WHERE id = ?
                        """, (title, desc, date_str, time_str, existing["id"]))
                        generated_alerts.append({"title": title, "level": "HIGH"})
                else:
                    # Water level has receded below warning mark: auto-resolve existing active alert
                    if existing:
                        cursor.execute("UPDATE alerts SET status = 'RESOLVED' WHERE id = ?", (existing["id"],))

            # 2. Check Flood Areas & Recalculate Risk
            cursor.execute("SELECT * FROM flood_areas")
            areas = cursor.fetchall()
            for a in areas:
                rain = a["rainfall"]
                w_level = a["water_level"]
                elev = a["elevation"]
                dist = a["distance_to_river"]
                name = a["area_name"]

                risk_eval = calculate_flood_risk(
                    rainfall=rain,
                    river_level=w_level,
                    elevation=elev,
                    distance_from_river=dist
                )
                new_level = risk_eval["risk_level"]

                cursor.execute("""
                    UPDATE flood_areas 
                    SET risk_level = ?, last_updated = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (new_level, a["id"]))

                cursor.execute("SELECT id, risk_level FROM alerts WHERE location = ? AND status = 'ACTIVE'", (name,))
                existing_area_alert = cursor.fetchone()

                # Auto alert generation for High and Critical
                if new_level in ["HIGH", "CRITICAL"]:
                    alert_type = "Critical Flood Alert" if new_level == "CRITICAL" else "Flood Risk Alert"
                    title = f"{new_level} FLOOD RISK: {name}"
                    desc = f"Calculated risk index is {risk_eval['risk_score']}/100. Rainfall: {rain}mm, River Stage: {w_level}m. {risk_eval['action_advisory']}"
                    if not existing_area_alert:
                        cursor.execute("""
                            INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """, (title, desc, name, new_level, alert_type, date_str, time_str, "ACTIVE"))
                        generated_alerts.append({"title": title, "level": new_level})
                    elif existing_area_alert["risk_level"] != new_level:
                        cursor.execute("""
                            UPDATE alerts SET title = ?, description = ?, risk_level = ?, alert_type = ?, date = ?, time = ?
                            WHERE id = ?
                        """, (title, desc, new_level, alert_type, date_str, time_str, existing_area_alert["id"]))
                        generated_alerts.append({"title": title, "level": new_level})
                else:
                    if existing_area_alert:
                        cursor.execute("UPDATE alerts SET status = 'RESOLVED' WHERE id = ?", (existing_area_alert["id"],))

            conn.commit()
            return generated_alerts
        finally:
            conn.close()

    @staticmethod
    def simulate_telemetry_step() -> Dict[str, Any]:
        """
        Simulates slight fluctuation in rain and river gauges to demonstrate
        real-time telemetry and automated alert triggers.
        """
        conn = get_connection()
        cursor = conn.cursor()

        # Update random rainfall station
        cursor.execute("SELECT id, rainfall, location FROM rainfall_data ORDER BY RANDOM() LIMIT 1")
        st = cursor.fetchone()
        if st:
            delta_rain = round(random.uniform(-4.0, 12.0), 1)
            new_rain = max(5.0, min(240.0, st["rainfall"] + delta_rain))
            intensity = "Extremely Heavy" if new_rain > 120 else ("Heavy" if new_rain > 75 else "Moderate")
            cursor.execute("""
                UPDATE rainfall_data 
                SET rainfall = ?, intensity = ?, time = TIME('now')
                WHERE id = ?
            """, (new_rain, intensity, st["id"]))

        # Update random river gauge
        cursor.execute("SELECT id, water_level, warning_level, danger_level FROM river_data ORDER BY RANDOM() LIMIT 1")
        riv = cursor.fetchone()
        if riv:
            delta_level = round(random.uniform(-0.3, 0.5), 2)
            new_level = max(2.5, min(12.0, riv["water_level"] + delta_level))
            riv_status = "DANGER" if new_level >= riv["danger_level"] else ("WARNING" if new_level >= riv["warning_level"] else "NORMAL")
            cursor.execute("""
                UPDATE river_data 
                SET water_level = ?, status = ?, time = TIME('now'), last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_level, riv_status, riv["id"]))

        # Update random flood area telemetry
        cursor.execute("SELECT id, rainfall, water_level FROM flood_areas ORDER BY RANDOM() LIMIT 1")
        fa = cursor.fetchone()
        if fa:
            delta_f_rain = round(random.uniform(-5.0, 10.0), 1)
            delta_f_water = round(random.uniform(-0.2, 0.4), 2)
            cursor.execute("""
                UPDATE flood_areas
                SET rainfall = MAX(10.0, rainfall + ?),
                    water_level = MAX(2.0, water_level + ?),
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (delta_f_rain, delta_f_water, fa["id"]))

        conn.commit()
        conn.close()

        # Run alert generator
        new_alerts = LiveDataService.evaluate_and_generate_alerts()
        return {"status": "success", "alerts_triggered": len(new_alerts), "alerts": new_alerts}
