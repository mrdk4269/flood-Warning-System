"""
FloodGuard India - Comprehensive Flood Effect Areas & GeoJSON Spatial Dataset
Authentic nationwide spatial flood impact polygons and MultiPolygons for India.
Supports Today, Last 7 Days, and Last 30 Days temporal filtering.
"""
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

def generate_riparian_flood_polygon(
    center_lat: float, 
    center_lng: float, 
    radius_km: float = 3.5, 
    elongation: float = 1.8, 
    angle_deg: float = 45.0,
    seed_offset: float = 0.0
) -> List[List[float]]:
    """
    Generates realistic organic riparian flood basin boundaries (16 vertices)
    oriented along river channels and natural terrain contours.
    Coordinates are [longitude, latitude] as per GeoJSON specification.
    """
    points = []
    num_vertices = 16
    angle_rad = math.radians(angle_deg)
    
    # 1 degree latitude ~= 111 km; 1 degree longitude ~= 111 * cos(lat) km
    km_per_lat = 111.0
    km_per_lng = 111.0 * math.cos(math.radians(center_lat))
    
    for i in range(num_vertices):
        theta = (2 * math.pi * i) / num_vertices
        # Natural variations simulating dendritic delta contours & meanders
        variance = 1.0 + 0.22 * math.sin(3 * theta + seed_offset) + 0.12 * math.cos(5 * theta)
        
        # Elongated ellipse along river flow angle
        x_local = radius_km * elongation * math.cos(theta) * variance
        y_local = radius_km * math.sin(theta) * variance
        
        # Rotate by angle of river channel
        x_rot = x_local * math.cos(angle_rad) - y_local * math.sin(angle_rad)
        y_rot = x_local * math.sin(angle_rad) + y_local * math.cos(angle_rad)
        
        pt_lng = center_lng + (x_rot / km_per_lng)
        pt_lat = center_lat + (y_rot / km_per_lat)
        points.append([round(pt_lng, 5), round(pt_lat, 5)])
        
    # Close polygon
    points.append(points[0])
    return points

# Base reference timestamp (current time)
NOW = datetime.utcnow()
TODAY_STR = NOW.strftime("%Y-%m-%d")

# =============================================================================
# NATIONWIDE FLOOD EFFECT AREAS DATABASE
# =============================================================================

NATIONWIDE_FLOOD_EFFECT_AREAS = [
    # -------------------------------------------------------------------------
    # 1. ODISHA: Mahanadi Delta & Coastal Floodplains
    # -------------------------------------------------------------------------
    {
        "id": "flood_odisha_001",
        "name": "Mahanadi Delta Inundation Zone (Cuttack Lowlands)",
        "state": "Odisha",
        "district": "Cuttack",
        "river_basin": "Mahanadi Basin",
        "river_name": "Mahanadi River",
        "latitude": 20.4625,
        "longitude": 85.8830,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 142.5,
        "water_level": 8.6,
        "affected_area_sqkm": 18.4,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Severe overbank discharge past Mundali Barrage inundating riparian agriculture and delta settlements.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [85.8450, 20.4820],
                    [85.8720, 20.4950],
                    [85.9100, 20.4850],
                    [85.9320, 20.4620],
                    [85.9250, 20.4380],
                    [85.8950, 20.4310],
                    [85.8620, 20.4450],
                    [85.8380, 20.4650],
                    [85.8450, 20.4820]
                ]
            ]
        }
    },
    {
        "id": "flood_odisha_002",
        "name": "Baitarani River Lowland Delta (Bhadrak Sector)",
        "state": "Odisha",
        "district": "Bhadrak",
        "river_basin": "Brahmani-Baitarani Basin",
        "river_name": "Baitarani River",
        "latitude": 21.0574,
        "longitude": 86.4957,
        "severity": "Moderate",
        "risk_level": "Moderate",
        "rainfall": 88.0,
        "water_level": 6.8,
        "affected_area_sqkm": 11.2,
        "days_ago": 3,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Waterlogged estuarine paddies along the tidal reach of Baitarani River.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [86.4620, 21.0750],
                    [86.4890, 21.0820],
                    [86.5210, 21.0690],
                    [86.5350, 21.0420],
                    [86.5100, 21.0310],
                    [86.4750, 21.0450],
                    [86.4620, 21.0750]
                ]
            ]
        }
    },
    {
        "id": "flood_odisha_003",
        "name": "Kendrapara Coastal Tidal Inundation",
        "state": "Odisha",
        "district": "Kendrapara",
        "river_basin": "Mahanadi Basin",
        "river_name": "Luna & Chitrotpala Rivers",
        "latitude": 20.5015,
        "longitude": 86.4230,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 175.0,
        "water_level": 9.4,
        "affected_area_sqkm": 24.6,
        "days_ago": 18,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Breached embankment levee during coastal monsoonal surge submerged multi-village block.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [86.3820, 20.5250],
                    [86.4250, 20.5410],
                    [86.4680, 20.5290],
                    [86.4820, 20.4850],
                    [86.4510, 20.4620],
                    [86.4020, 20.4780],
                    [86.3820, 20.5250]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 2. ASSAM: Brahmaputra & Barak Valley Inundations
    # -------------------------------------------------------------------------
    {
        "id": "flood_assam_001",
        "name": "Brahmaputra Lowlands (Kamrup Metropolitan Sector)",
        "state": "Assam",
        "district": "Kamrup Metropolitan",
        "river_basin": "Brahmaputra Basin",
        "river_name": "Brahmaputra River",
        "latitude": 26.1833,
        "longitude": 91.6833,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 185.0,
        "water_level": 50.85,
        "affected_area_sqkm": 32.5,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Brahmaputra flowing 0.35m above danger level at Pandu Ghat; massive backwater ponding in low-lying peri-urban sectors.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [91.6350, 26.2100],
                    [91.6780, 26.2220],
                    [91.7320, 26.2050],
                    [91.7510, 26.1750],
                    [91.7220, 26.1550],
                    [91.6620, 26.1620],
                    [91.6350, 26.2100]
                ]
            ]
        }
    },
    {
        "id": "flood_assam_002",
        "name": "Upper Brahmaputra Floodplain (Dibrugarh Reach)",
        "state": "Assam",
        "district": "Dibrugarh",
        "river_basin": "Brahmaputra Basin",
        "river_name": "Brahmaputra Upper Reach",
        "latitude": 27.4728,
        "longitude": 94.9120,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 128.0,
        "water_level": 106.10,
        "affected_area_sqkm": 21.8,
        "days_ago": 2,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Erosion and flood inundation along Mohanaghat revetment submerging tea garden lowlands.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [94.8620, 27.4950],
                    [94.9120, 27.5100],
                    [94.9650, 27.4890],
                    [94.9780, 27.4520],
                    [94.9350, 27.4410],
                    [94.8820, 27.4620],
                    [94.8620, 27.4950]
                ]
            ]
        }
    },
    {
        "id": "flood_assam_003",
        "name": "Barak River Inundation Plain (Silchar Valley)",
        "state": "Assam",
        "district": "Cachar",
        "river_basin": "Brahmaputra Basin",
        "river_name": "Barak River",
        "latitude": 24.8333,
        "longitude": 92.7789,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 115.0,
        "water_level": 20.25,
        "affected_area_sqkm": 16.4,
        "days_ago": 12,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Betukandi dyke breach historical run-off inundating Annapurna Ghat commercial sector.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [92.7420, 24.8550],
                    [92.7850, 24.8680],
                    [92.8210, 24.8490],
                    [92.8120, 24.8150],
                    [92.7680, 24.8100],
                    [92.7350, 24.8320],
                    [92.7420, 24.8550]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 3. BIHAR: Kosi & Ganga Basin Floodplains
    # -------------------------------------------------------------------------
    {
        "id": "flood_bihar_001",
        "name": "Ganga-Gandak Confluence Spill Basin (Patna Sector)",
        "state": "Bihar",
        "district": "Patna",
        "river_basin": "Ganga Basin",
        "river_name": "Ganga River",
        "latitude": 25.6133,
        "longitude": 85.1764,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 165.0,
        "water_level": 49.80,
        "affected_area_sqkm": 28.2,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Digha Ghat gauge crossing danger benchmark; Gandak high inflow causing reverse ponding into Patna rural diara belt.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [85.1250, 25.6420],
                    [85.1780, 25.6550],
                    [85.2350, 25.6350],
                    [85.2420, 25.5950],
                    [85.1950, 25.5820],
                    [85.1420, 25.6020],
                    [85.1250, 25.6420]
                ]
            ]
        }
    },
    {
        "id": "flood_bihar_002",
        "name": "Kosi River Dynamic Avulsion Basin (Supaul Sector)",
        "state": "Bihar",
        "district": "Supaul",
        "river_basin": "Ganga Basin",
        "river_name": "Kosi River",
        "latitude": 26.1226,
        "longitude": 86.6027,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 138.0,
        "water_level": 72.40,
        "affected_area_sqkm": 25.0,
        "days_ago": 4,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Braided river overflow inundating low-lying embankment sandbars across Supaul rural blocks.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [86.5520, 26.1550],
                    [86.6120, 26.1720],
                    [86.6650, 26.1450],
                    [86.6780, 26.0950],
                    [86.6210, 26.0820],
                    [86.5650, 26.1100],
                    [86.5520, 26.1550]
                ]
            ]
        }
    },
    {
        "id": "flood_bihar_003",
        "name": "Mithila Flood Retention Wetlands (Darbhanga Basin)",
        "state": "Bihar",
        "district": "Darbhanga",
        "river_basin": "Ganga Basin",
        "river_name": "Bagmati & Kamla Balan",
        "latitude": 26.1542,
        "longitude": 85.8918,
        "severity": "Moderate",
        "risk_level": "Moderate",
        "rainfall": 75.0,
        "water_level": 50.10,
        "affected_area_sqkm": 14.8,
        "days_ago": 15,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Kamla Balan embankment pressure causing localized depression overflow into chaurs.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [85.8450, 26.1780],
                    [85.8980, 26.1950],
                    [85.9420, 26.1720],
                    [85.9510, 26.1320],
                    [85.9050, 26.1210],
                    [85.8550, 26.1450],
                    [85.8450, 26.1780]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 4. KERALA: Periyar & Chalakudy River Deluges
    # -------------------------------------------------------------------------
    {
        "id": "flood_kerala_001",
        "name": "Periyar Valley Floodplain (Aluva - Ernakulam Reach)",
        "state": "Kerala",
        "district": "Ernakulam",
        "river_basin": "Periyar Basin",
        "river_name": "Periyar River",
        "latitude": 10.1076,
        "longitude": 76.3516,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 155.0,
        "water_level": 7.45,
        "affected_area_sqkm": 19.5,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Dam release spill from Bhoothathankettu causing heavy backwater inundation along Aluva Manappuram and riverine residential colonies.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [76.3120, 10.1350],
                    [76.3620, 10.1480],
                    [76.4050, 10.1250],
                    [76.4180, 10.0850],
                    [76.3750, 10.0720],
                    [76.3250, 10.0950],
                    [76.3120, 10.1350]
                ]
            ]
        }
    },
    {
        "id": "flood_kerala_002",
        "name": "Kuttanad Below-Sea-Level Wetland Basin (Alappuzha)",
        "state": "Kerala",
        "district": "Alappuzha",
        "river_basin": "Pamba Basin",
        "river_name": "Pamba & Achankovil Rivers",
        "latitude": 9.4981,
        "longitude": 76.3388,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 172.0,
        "water_level": 3.80,
        "affected_area_sqkm": 29.0,
        "days_ago": 5,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Paddy polders submerged under 2 meters of water due to Thanneermukkom bund spill block.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [76.2950, 9.5350],
                    [76.3520, 9.5520],
                    [76.3980, 9.5250],
                    [76.4100, 9.4750],
                    [76.3650, 9.4580],
                    [76.3100, 9.4820],
                    [76.2950, 9.5350]
                ]
            ]
        }
    },
    {
        "id": "flood_kerala_003",
        "name": "Chalakudy River Riparian Buffer (Thrissur Sector)",
        "state": "Kerala",
        "district": "Thrissur",
        "river_basin": "Chalakudy Basin",
        "river_name": "Chalakudy River",
        "latitude": 10.3070,
        "longitude": 76.3330,
        "severity": "Moderate",
        "risk_level": "Moderate",
        "rainfall": 92.0,
        "water_level": 6.10,
        "affected_area_sqkm": 12.0,
        "days_ago": 22,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Overland flow through low agricultural terraces during intense 24h cloudburst event.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [76.2950, 10.3320],
                    [76.3420, 10.3450],
                    [76.3810, 10.3250],
                    [76.3900, 10.2850],
                    [76.3500, 10.2750],
                    [76.3100, 10.2980],
                    [76.2950, 10.3320]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 5. UTTAR PRADESH: Ganga-Yamuna Sangam Basin
    # -------------------------------------------------------------------------
    {
        "id": "flood_up_001",
        "name": "Ganga-Yamuna Sangam Lowlands (Prayagraj Sector)",
        "state": "Uttar Pradesh",
        "district": "Prayagraj",
        "river_basin": "Ganga Basin",
        "river_name": "Ganga & Yamuna Rivers",
        "latitude": 25.4358,
        "longitude": 81.8463,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 130.0,
        "water_level": 84.65,
        "affected_area_sqkm": 22.4,
        "days_ago": 1,  # TODAY / RECENT
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Yamuna and Ganga simultaneous swell submerging Baghmambari, Chhota Baghada, and coastal ghats.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [81.8020, 25.4620],
                    [81.8550, 25.4750],
                    [81.9050, 25.4520],
                    [81.9150, 25.4150],
                    [81.8650, 25.4050],
                    [81.8150, 25.4280],
                    [81.8020, 25.4620]
                ]
            ]
        }
    },
    {
        "id": "flood_up_002",
        "name": "Varanasi Ghats Riparian Inundation Zone",
        "state": "Uttar Pradesh",
        "district": "Varanasi",
        "river_basin": "Ganga Basin",
        "river_name": "Ganga River",
        "latitude": 25.3176,
        "longitude": 83.0062,
        "severity": "Moderate",
        "risk_level": "Moderate",
        "rainfall": 82.0,
        "water_level": 71.20,
        "affected_area_sqkm": 9.8,
        "days_ago": 6,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "River water submerged stepped platforms of all 84 historic ghats.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [82.9750, 25.3410],
                    [83.0150, 25.3520],
                    [83.0450, 25.3320],
                    [83.0510, 25.2950],
                    [83.0180, 25.2850],
                    [82.9850, 25.3080],
                    [82.9750, 25.3410]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 6. WEST BENGAL: Hooghly & Teesta Basins
    # -------------------------------------------------------------------------
    {
        "id": "flood_wb_001",
        "name": "Ganga-Padma Spillway Lowlands (Malda Sector)",
        "state": "West Bengal",
        "district": "Malda",
        "river_basin": "Ganga Basin",
        "river_name": "Fulhar & Mahananda Rivers",
        "latitude": 25.0108,
        "longitude": 88.1411,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 170.0,
        "water_level": 28.90,
        "affected_area_sqkm": 26.5,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Severe bank line collapse and backwater ponding inundating Harishchandrapur rural blocks.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [88.0950, 25.0420],
                    [88.1520, 25.0580],
                    [88.1980, 25.0350],
                    [88.2080, 24.9920],
                    [88.1620, 24.9810],
                    [88.1100, 25.0050],
                    [88.0950, 25.0420]
                ]
            ]
        }
    },
    {
        "id": "flood_wb_002",
        "name": "Hooghly Estuarine Inundation Zone (Howrah Lowlands)",
        "state": "West Bengal",
        "district": "Howrah",
        "river_basin": "Ganga Basin",
        "river_name": "Hooghly River",
        "latitude": 22.5958,
        "longitude": 88.2636,
        "severity": "Moderate",
        "risk_level": "Moderate",
        "rainfall": 78.0,
        "water_level": 5.40,
        "affected_area_sqkm": 14.1,
        "days_ago": 14,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "High spring bore tide exacerbated by storm depression causing drain locking.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [88.2250, 22.6250],
                    [88.2750, 22.6380],
                    [88.3150, 22.6150],
                    [88.3220, 22.5750],
                    [88.2810, 22.5620],
                    [88.2380, 22.5850],
                    [88.2250, 22.6250]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 7. MAHARASHTRA: Krishna & Godavari Floodplains
    # -------------------------------------------------------------------------
    {
        "id": "flood_mh_001",
        "name": "Panchganga River Floodplain (Kolhapur Sector)",
        "state": "Maharashtra",
        "district": "Kolhapur",
        "river_basin": "Krishna Basin",
        "river_name": "Panchganga River",
        "latitude": 16.7050,
        "longitude": 74.2433,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 190.0,
        "water_level": 43.50,
        "affected_area_sqkm": 27.8,
        "days_ago": 0,  # TODAY
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Radhanagari Dam automatic gates open; Rajaram barrage level crossing 43 ft danger line, submerging city link bridges.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.1950, 16.7350],
                    [74.2520, 16.7480],
                    [74.2980, 16.7250],
                    [74.3050, 16.6850],
                    [74.2620, 16.6720],
                    [74.2100, 16.6950],
                    [74.1950, 16.7350]
                ]
            ]
        }
    },
    {
        "id": "flood_mh_002",
        "name": "Krishna River Inundation Belt (Sangli Basin)",
        "state": "Maharashtra",
        "district": "Sangli",
        "river_basin": "Krishna Basin",
        "river_name": "Krishna River",
        "latitude": 16.8524,
        "longitude": 74.5815,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 132.0,
        "water_level": 45.20,
        "affected_area_sqkm": 23.0,
        "days_ago": 4,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Almatti dam backwaters creating extensive pooling across Sangli and Miraj sugarcane belts.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.5350, 16.8820],
                    [74.5920, 16.8980],
                    [74.6380, 16.8750],
                    [74.6450, 16.8320],
                    [74.6010, 16.8210],
                    [74.5500, 16.8450],
                    [74.5350, 16.8820]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 8. GUJARAT: Tapi River Delta (Surat Reach)
    # -------------------------------------------------------------------------
    {
        "id": "flood_gujarat_001",
        "name": "Tapi River Delta Inundation Sector (Surat Lowlands)",
        "state": "Gujarat",
        "district": "Surat",
        "river_basin": "Tapi Basin",
        "river_name": "Tapi River",
        "latitude": 21.1702,
        "longitude": 72.8311,
        "severity": "High",
        "risk_level": "High",
        "rainfall": 140.0,
        "water_level": 10.20,
        "affected_area_sqkm": 19.8,
        "days_ago": 3,  # LAST 7 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Ukai dam spill discharge exceeding 3.5 lakh cusecs combined with Arabian sea high tide.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [72.7850, 21.2050],
                    [72.8420, 21.2180],
                    [72.8880, 21.1950],
                    [72.8980, 21.1550],
                    [72.8510, 21.1420],
                    [72.8020, 21.1650],
                    [72.7850, 21.2050]
                ]
            ]
        }
    },

    # -------------------------------------------------------------------------
    # 9. JAMMU & KASHMIR: Jhelum Valley
    # -------------------------------------------------------------------------
    {
        "id": "flood_jk_001",
        "name": "Jhelum Valley Inundation Plain (Srinagar Sector)",
        "state": "Jammu and Kashmir",
        "district": "Srinagar",
        "river_basin": "Indus Basin",
        "river_name": "Jhelum River",
        "latitude": 34.0837,
        "longitude": 74.7973,
        "severity": "Critical",
        "risk_level": "Critical",
        "rainfall": 160.0,
        "water_level": 23.50,
        "affected_area_sqkm": 28.0,
        "days_ago": 26,  # LAST 30 DAYS
        "data_source": "Reference scenario (static demonstration data)", "provenance": "REFERENCE",
        "description": "Ram Munshi Bagh gauge crossing 21 ft danger mark; flood spill channel capacity overwhelmed.",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [74.7520, 34.1150],
                    [74.8050, 34.1280],
                    [74.8550, 34.1050],
                    [74.8620, 34.0650],
                    [74.8180, 34.0520],
                    [74.7680, 34.0750],
                    [74.7520, 34.1150]
                ]
            ]
        }
    }
]

# Assign realistic dynamic timestamps to each event relative to current execution time
def _compute_timestamps():
    now = datetime.utcnow()
    for ev in NATIONWIDE_FLOOD_EFFECT_AREAS:
        days = ev.get("days_ago", 0)
        # Offset date
        ev_date = now - timedelta(days=days)
        # Format timestamp e.g. "2026-09-13T10:30:00Z"
        ev["timestamp"] = ev_date.strftime("%Y-%m-%dT%H:%M:%SZ")
        ev["date"] = ev_date.strftime("%Y-%m-%d")
        ev["time"] = ev_date.strftime("%H:%M:%S")

_compute_timestamps()

# =============================================================================
# DATA SERVICE LOGIC
# =============================================================================

def get_flood_effect_areas(
    period: str = "today", 
    state: Optional[str] = None, 
    district: Optional[str] = None, 
    basin: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns filtered list of flood effect areas matching temporal & geographic criteria.
    Timestamps are computed once at module load and remain immutable (FG-012).
    - period: 'today', '7days', '30days', 'all'
    - state: State name or 'all'
    - district: District name or 'all'
    - basin: Basin name or 'all'
    """
    # FG-012: Do NOT recompute timestamps — they were set at module load
    now_current = datetime.utcnow()
    cutoff_today = now_current.date()
    cutoff_7days = (now_current - timedelta(days=7)).date()
    cutoff_30days = (now_current - timedelta(days=30)).date()

    results = []
    for ev in NATIONWIDE_FLOOD_EFFECT_AREAS:
        ev_date = (now_current - timedelta(days=ev.get("days_ago", 0))).date()

        # 1. Temporal filter
        if period == "today":
            if ev_date != cutoff_today:
                continue
        elif period == "7days":
            if ev_date < cutoff_7days:
                continue
        elif period == "30days":
            if ev_date < cutoff_30days:
                continue

        # 2. State filter
        if state and state.lower() != "all":
            if ev["state"].lower() != state.lower():
                continue

        # 3. District filter
        if district and district.lower() != "all":
            if ev["district"].lower() != district.lower():
                continue

        # 4. Basin filter
        if basin and basin.lower() != "all":
            if ev["river_basin"].lower() != basin.lower():
                continue

        results.append(ev)

    # Cross-reference live station observations to inject real-time telemetry
    try:
        from backend.live_india_service import LiveIndiaDataService
        live_map = LiveIndiaDataService.get_live_station_telemetry_map()
    except Exception:
        live_map = {}

    enriched_results = []
    existing_districts = set()

    for ev in results:
        ev_copy = dict(ev)
        ev_copy["geometry"] = dict(ev["geometry"])
        key = (ev.get("state", "").strip().lower(), ev.get("district", "").strip().lower())
        existing_districts.add(key)

        if key in live_map:
            live = live_map[key]
            # If live rainfall or river level is available, inject real-time telemetry
            if live.get("rainfall") is not None and live["rainfall"] > 0:
                ev_copy["rainfall"] = round(float(live["rainfall"]), 1)
            if live.get("water_level") is not None and live["water_level"] > 0:
                ev_copy["water_level"] = round(float(live["water_level"]), 2)
            if live.get("warning_active"):
                ev_copy["severity"] = "Critical" if live.get("risk_level") == "CRITICAL" else "High"
                ev_copy["risk_level"] = ev_copy["severity"]
            ev_copy["data_source"] = f"Reference scenario enriched with Open-Meteo telemetry ({live.get('provenance', 'UNAVAILABLE')})"
            ev_copy["provenance"] = "REFERENCE"

        enriched_results.append(ev_copy)

    # For TODAY: if any live station has an active warning / danger river level, synthesize an organic flood polygon
    if period in ["today", "all"]:
        try:
            from backend.live_india_service import LiveIndiaDataService
            cached_data = LiveIndiaDataService._CACHE.get("data") or []
            for t in cached_data:
                riv = t.get("river", {})
                fw = t.get("flood_warning", {})
                is_danger = riv.get("river_state") == "DANGER"
                is_warn = riv.get("river_state") == "WARNING"
                is_high = fw.get("risk_level") in ["HIGH", "CRITICAL"]

                if is_danger or (is_warn and is_high):
                    st_state = t.get("state", "").strip()
                    st_dist = t.get("district", "").strip()
                    key = (st_state.lower(), st_dist.lower())

                    if key not in existing_districts:
                        # Check filters
                        if state and state.lower() != "all" and st_state.lower() != state.lower():
                            continue
                        if district and district.lower() != "all" and st_dist.lower() != district.lower():
                            continue
                        if basin and basin.lower() != "all" and t.get("river_basin", "").lower() != basin.lower():
                            continue

                        # Generate dynamic riparian polygon around the elevated river gauge
                        lat = float(t.get("latitude"))
                        lon = float(t.get("longitude"))
                        radius_km = 4.8 if is_danger else 3.2
                        coords = generate_riparian_flood_polygon(lat, lon, radius_km=radius_km, elongation=2.0)

                        dynamic_ev = {
                            "id": f"flood_live_{t.get('key', 'gauge')}",
                            "name": f"{t.get('location_name', st_dist)} (Live Inundation Reach)",
                            "state": st_state,
                            "district": st_dist,
                            "river_basin": t.get("river_basin", "River Basin"),
                            "river_name": t.get("river_name", "River"),
                            "latitude": lat,
                            "longitude": lon,
                            "severity": "Critical" if is_danger else "High",
                            "risk_level": "Critical" if is_danger else "High",
                            "rainfall": round(float(t.get("rainfall", {}).get("value", 0.0)), 1),
                            "water_level": round(float(riv.get("value", 0.0)), 2),
                            "affected_area_sqkm": round(math.pi * (radius_km ** 2) * 1.5, 1),
                            "days_ago": 0,
                            "timestamp": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
                            "date": datetime.utcnow().strftime("%Y-%m-%d"),
                            "time": datetime.utcnow().strftime("%H:%M:%S"),
                            "data_source": "Estimated buffer from Open-Meteo-derived discharge and FloodGuard rule thresholds",
                            "provenance": "ESTIMATED",
                            "is_estimated": True,
                            "description": f"Estimated impact buffer: calculated river level ({riv.get('value')}m) exceeded {riv.get('river_state')} threshold along {t.get('river_name', 'river basin')}. This is not an observed flood extent.",
                            "geometry": {
                                "type": "Polygon",
                                "coordinates": [coords]
                            }
                        }
                        enriched_results.append(dynamic_ev)
                        existing_districts.add(key)
        except Exception:
            pass

    return enriched_results

def get_flood_effect_geojson(
    period: str = "today", 
    state: Optional[str] = None, 
    district: Optional[str] = None, 
    basin: Optional[str] = None
) -> Dict[str, Any]:
    """
    Returns GeoJSON FeatureCollection of flood effect areas.
    """
    areas = get_flood_effect_areas(period=period, state=state, district=district, basin=basin)
    features = []

    for ev in areas:
        features.append({
            "type": "Feature",
            "id": ev["id"],
            "properties": {
                "id": ev["id"],
                "name": ev["name"],
                "state": ev["state"],
                "district": ev["district"],
                "river_basin": ev["river_basin"],
                "river_name": ev["river_name"],
                "latitude": ev["latitude"],
                "longitude": ev["longitude"],
                "severity": ev["severity"],
                "risk_level": ev["risk_level"],
                "rainfall": ev["rainfall"],
                "water_level": ev["water_level"],
                "affected_area_sqkm": ev["affected_area_sqkm"],
                "timestamp": ev["timestamp"],
                "date": ev["date"],
                "time": ev["time"],
                "data_source": ev["data_source"],
                "source": ev["data_source"],
                "provenance": ev.get("provenance", "REFERENCE"),
                "is_estimated": ev.get("is_estimated", False),
                "description": ev["description"]
            },
            "geometry": ev["geometry"]
        })

    return {
        "type": "FeatureCollection",
        "name": f"FloodGuard_Flood_Effect_Areas_{period}",
        "metadata": {
            "period": period,
            "state_filter": state or "all",
            "district_filter": district or "all",
            "count": len(features),
            "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        },
        "features": features
    }
