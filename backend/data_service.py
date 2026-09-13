"""
FloodGuard Live Data Service & Alert Generation Engine
Handles data ingestion, sensor simulation, and automated threshold alerts.
Designed for clean integration with external weather & river APIs.
"""
import random
from datetime import datetime
from typing import Dict, Any, List
from backend.database import get_connection
from backend.risk_calculator import calculate_flood_risk

class LiveDataService:
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

        # 1. Check Rivers
        cursor.execute("SELECT * FROM river_data")
        rivers = cursor.fetchall()
        for r in rivers:
            r_name = r["river_name"]
            w_level = r["water_level"]
            warn_lvl = r["warning_level"]
            dang_lvl = r["danger_level"]

            if w_level >= dang_lvl:
                # Check if an active critical alert already exists
                cursor.execute("""
                    SELECT id FROM alerts 
                    WHERE location LIKE ? AND risk_level = 'CRITICAL' AND status = 'ACTIVE'
                """, (f"%{r_name}%",))
                if not cursor.fetchone():
                    title = f"CRITICAL RIVER SURGE: {r_name}"
                    desc = f"Water level at {w_level}m has exceeded the Danger Mark ({dang_lvl}m). Immediate flood overflow threatening downstream communities."
                    cursor.execute("""
                        INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (title, desc, r_name, "CRITICAL", "Critical Flood Alert", date_str, time_str, "ACTIVE"))
                    generated_alerts.append({"title": title, "level": "CRITICAL"})

            elif w_level >= warn_lvl:
                cursor.execute("""
                    SELECT id FROM alerts 
                    WHERE location LIKE ? AND risk_level IN ('MEDIUM', 'HIGH') AND status = 'ACTIVE'
                """, (f"%{r_name}%",))
                if not cursor.fetchone():
                    title = f"RIVER WARNING STAGE: {r_name}"
                    desc = f"Water level reached {w_level}m, breaching Warning Threshold ({warn_lvl}m). Sluice gates under high pressure."
                    cursor.execute("""
                        INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (title, desc, r_name, "HIGH", "Rising River Alert", date_str, time_str, "ACTIVE"))
                    generated_alerts.append({"title": title, "level": "HIGH"})

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

            # Update area risk level if changed
            cursor.execute("""
                UPDATE flood_areas 
                SET risk_level = ?, last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_level, a["id"]))

            # Auto alert generation for High and Critical
            if new_level in ["HIGH", "CRITICAL"]:
                cursor.execute("""
                    SELECT id FROM alerts 
                    WHERE location = ? AND risk_level = ? AND status = 'ACTIVE'
                """, (name, new_level))
                if not cursor.fetchone():
                    alert_type = "Critical Flood Alert" if new_level == "CRITICAL" else "Flood Risk Alert"
                    title = f"{new_level} FLOOD RISK: {name}"
                    desc = f"Calculated risk index is {risk_eval['risk_score']}/100. Rainfall: {rain}mm, River Stage: {w_level}m. {risk_eval['action_advisory']}"
                    cursor.execute("""
                        INSERT INTO alerts (title, description, location, risk_level, alert_type, date, time, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (title, desc, name, new_level, alert_type, date_str, time_str, "ACTIVE"))
                    generated_alerts.append({"title": title, "level": new_level})

        conn.commit()
        conn.close()
        return generated_alerts

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
