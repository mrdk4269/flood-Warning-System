"""
FloodGuard Startup Entry Point
Run this script to boot the Flask server and open FloodGuard.
Usage: python run.py
"""
import sys
import os

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app, init_database

if __name__ == "__main__":
    init_database()
    print("===================================================================")
    print("   FLOODGUARD: GIS-Based Flood Risk Mapping & Early Warning System")
    print("   Access URL: http://127.0.0.1:5000")
    print("   Live GIS Map: http://127.0.0.1:5000/map")
    print("   Risk Analysis: http://127.0.0.1:5000/risk")
    print("   Prediction: http://127.0.0.1:5000/prediction")
    print("   Emergency Alerts: http://127.0.0.1:5000/alerts")
    print("   Safe Shelters: http://127.0.0.1:5000/safe-locations")
    print("   Admin Portal: http://127.0.0.1:5000/admin")
    print("===================================================================")
    app.run(host="127.0.0.1", port=5000, debug=True)
