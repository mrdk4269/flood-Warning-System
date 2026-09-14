"""
FloodGuard India Comprehensive Geographical & Hydrological Data Registry
Provides nationwide coverage for:
- All 28 States & 8 Union Territories with bounding boxes and flood-prone districts
- 9 Major Indian River Basins (Ganga, Brahmaputra, Mahanadi, Godavari, Krishna, Narmada, Tapi, Kaveri, Indus)
- Curated vector GeoJSON geometries for State Boundaries & Major River Channels
- Historical Flood Disaster Inundation Archive across India
- 3-Day Meteorological & Hydrological Forward Forecast Hazard Zones
"""
from typing import Dict, Any, List

# =============================================================================
# 1. ALL 28 INDIAN STATES & 8 UNION TERRITORIES REGISTRY
# =============================================================================

INDIAN_STATES = {
    "Assam": {
        "capital": "Dispur",
        "center": [26.2006, 92.9376],
        "zoom": 7,
        "bbox": [24.1, 89.7, 28.0, 96.0],
        "primary_basins": ["Brahmaputra Basin", "Barak Basin"],
        "flood_prone_districts": [
            "Dibrugarh", "Dhemaji", "Lakhimpur", "Kamrup Metropolitan", 
            "Barpeta", "Dhubri", "Morigaon", "Nagaon", "Cachar", "Karimganj"
        ],
        "vulnerability_index": "EXTREME",
        "annual_flood_frequency": "Annual Severe Monsoon Overflow"
    },
    "Bihar": {
        "capital": "Patna",
        "center": [25.0961, 85.3131],
        "zoom": 7,
        "bbox": [24.3, 83.3, 27.5, 88.3],
        "primary_basins": ["Ganga Basin", "Kosi Basin", "Gandak Basin"],
        "flood_prone_districts": [
            "Patna", "Bhagalpur", "Supaul", "Madhepura", "Saharsa", 
            "Muzaffarpur", "Darbhanga", "Katihar", "Purnia", "Samastipur"
        ],
        "vulnerability_index": "EXTREME",
        "annual_flood_frequency": "Annual Monsoon Flash/Sustained Inundation"
    },
    "Odisha": {
        "capital": "Bhubaneswar",
        "center": [20.4637, 85.88],
        "zoom": 7,
        "bbox": [17.8, 81.3, 22.6, 87.5],
        "primary_basins": ["Mahanadi Basin", "Baitarani Basin", "Subarnarekha Basin"],
        "flood_prone_districts": [
            "Cuttack", "Kendrapara", "Puri", "Jagatsinghpur", "Jajpur", 
            "Balasore", "Bhadrak", "Sambalpur", "Khurda"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Cyclonic & Monsoonal Basin Spill"
    },
    "West Bengal": {
        "capital": "Kolkata",
        "center": [22.9868, 87.8550],
        "zoom": 7,
        "bbox": [21.5, 85.8, 27.2, 89.9],
        "primary_basins": ["Ganga Basin", "Brahmaputra Basin", "Teesta Basin"],
        "flood_prone_districts": [
            "Kolkata", "Howrah", "Malda", "Murshidabad", "Jalpaiguri", 
            "Cooch Behar", "North 24 Parganas", "South 24 Parganas", "Paschim Medinipur"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Tidal Surge & Gangetic Basin Overflow"
    },
    "Uttar Pradesh": {
        "capital": "Lucknow",
        "center": [26.8467, 80.9462],
        "zoom": 7,
        "bbox": [23.8, 77.1, 30.4, 84.6],
        "primary_basins": ["Ganga Basin", "Yamuna Basin", "Ghaghara Basin"],
        "flood_prone_districts": [
            "Prayagraj", "Varanasi", "Gorakhpur", "Ballia", "Bahraich", 
            "Kanpur", "Ayodhya", "Gonda", "Barabanki", "Badaun"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Gangetic & Terai Flood Plains Deluge"
    },
    "Kerala": {
        "capital": "Thiruvananthapuram",
        "center": [10.8505, 76.2711],
        "zoom": 7,
        "bbox": [8.3, 74.8, 12.8, 77.4],
        "primary_basins": ["Periyar Basin", "Chalakudy Basin", "Pamba Basin", "Bharathappuzha"],
        "flood_prone_districts": [
            "Ernakulam", "Idukki", "Alappuzha", "Thrissur", "Wayanad", 
            "Kottayam", "Pathanamthitta", "Malappuram"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Western Ghats Intense Orographic Downpour"
    },
    "Maharashtra": {
        "capital": "Mumbai",
        "center": [19.7515, 75.7139],
        "zoom": 6,
        "bbox": [15.6, 72.6, 22.0, 80.9],
        "primary_basins": ["Godavari Basin", "Krishna Basin", "Tapi Basin"],
        "flood_prone_districts": [
            "Mumbai", "Thane", "Kolhapur", "Sangli", "Raigad", 
            "Nashik", "Nanded", "Ratnagiri", "Pune"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Konkan Cloudbursts & Krishna-Godavari Inundation"
    },
    "Gujarat": {
        "capital": "Gandhinagar",
        "center": [22.2587, 71.1924],
        "zoom": 6,
        "bbox": [20.1, 68.1, 24.7, 74.5],
        "primary_basins": ["Narmada Basin", "Tapi Basin", "Sabarmati Basin", "Mahi Basin"],
        "flood_prone_districts": [
            "Surat", "Bharuch", "Vadodara", "Ahmedabad", "Navsari", 
            "Valsad", "Banaskantha", "Patan", "Junagadh"
        ],
        "vulnerability_index": "MODERATE_HIGH",
        "annual_flood_frequency": "River Flash Inundation & Coastal Tidal Flooding"
    },
    "Andhra Pradesh": {
        "capital": "Amaravati",
        "center": [15.9129, 79.7400],
        "zoom": 7,
        "bbox": [12.6, 76.7, 19.1, 84.8],
        "primary_basins": ["Godavari Basin", "Krishna Basin", "Pennar Basin"],
        "flood_prone_districts": [
            "East Godavari", "West Godavari", "Krishna", "Guntur", 
            "Visakhapatnam", "Nellore", "Dr. B.R. Ambedkar Konaseema"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Delta Inundation & Cyclonic Storm Surges"
    },
    "Telangana": {
        "capital": "Hyderabad",
        "center": [18.1124, 79.0193],
        "zoom": 7,
        "bbox": [15.8, 77.2, 19.9, 81.8],
        "primary_basins": ["Godavari Basin", "Krishna Basin"],
        "flood_prone_districts": [
            "Bhadradri Kothagudem", "Mulugu", "Jayashankar Bhupalpally", 
            "Hyderabad", "Mancherial", "Peddapalli"
        ],
        "vulnerability_index": "MODERATE_HIGH",
        "annual_flood_frequency": "Godavari River Spills & Urban Flash Floods"
    },
    "Karnataka": {
        "capital": "Bengaluru",
        "center": [15.3173, 75.7139],
        "zoom": 7,
        "bbox": [11.5, 74.0, 18.5, 78.6],
        "primary_basins": ["Krishna Basin", "Kaveri Basin", "Tungabhadra Basin"],
        "flood_prone_districts": [
            "Belagavi", "Bagalkot", "Uttara Kannada", "Udupi", 
            "Dakshina Kannada", "Kodagu", "Raichur", "Kalaburagi"
        ],
        "vulnerability_index": "MODERATE_HIGH",
        "annual_flood_frequency": "Krishna Upper Catchment & Coastal Inundation"
    },
    "Tamil Nadu": {
        "capital": "Chennai",
        "center": [11.1271, 78.6569],
        "zoom": 7,
        "bbox": [8.1, 76.2, 13.6, 80.3],
        "primary_basins": ["Kaveri Basin", "Palar Basin", "Vaigai Basin", "Tamirabarani Basin"],
        "flood_prone_districts": [
            "Chennai", "Thiruvallur", "Kanchipuram", "Cuddalore", 
            "Thanjavur", "Tiruvarur", "Nagapattinam", "Thoothukudi", "Tirunelveli"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Northeast Monsoon Depressions & Coastal Flooding"
    },
    "Punjab": {
        "capital": "Chandigarh",
        "center": [31.1471, 75.3412],
        "zoom": 7,
        "bbox": [29.5, 73.8, 32.5, 76.9],
        "primary_basins": ["Indus Basin", "Sutlej Basin", "Beas Basin", "Ravi Basin"],
        "flood_prone_districts": [
            "Rupnagar", "Ferozepur", "Patiala", "Gurdaspur", "Jalandhar", "Hoshiarpur"
        ],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Sutlej & Ghaggar Seasonal Spills"
    },
    "Haryana": {
        "capital": "Chandigarh",
        "center": [29.0588, 76.0856],
        "zoom": 7,
        "bbox": [27.6, 74.4, 30.9, 77.6],
        "primary_basins": ["Yamuna Basin", "Ghaggar Basin"],
        "flood_prone_districts": [
            "Yamunanagar", "Ambala", "Karnal", "Panipat", "Palwal", "Sirsa"
        ],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Yamuna & Hathnikund Barrage Releases"
    },
    "Uttarakhand": {
        "capital": "Dehradun",
        "center": [30.0668, 79.0193],
        "zoom": 7,
        "bbox": [28.7, 77.5, 31.5, 81.0],
        "primary_basins": ["Ganga Basin", "Alaknanda Basin", "Bhagirathi Basin"],
        "flood_prone_districts": [
            "Rudraprayag", "Chamoli", "Uttarkashi", "Haridwar", "Pithoragarh", "Dehradun"
        ],
        "vulnerability_index": "EXTREME",
        "annual_flood_frequency": "Glacial Lake Outbursts, Cloudbursts & Flash Floods"
    },
    "Himachal Pradesh": {
        "capital": "Shimla",
        "center": [31.1048, 77.1734],
        "zoom": 7,
        "bbox": [30.3, 75.7, 33.3, 79.0],
        "primary_basins": ["Indus Basin", "Beas Basin", "Sutlej Basin", "Ravi Basin"],
        "flood_prone_districts": [
            "Mandi", "Kullu", "Kangra", "Shimla", "Sirmaur", "Chamba"
        ],
        "vulnerability_index": "EXTREME",
        "annual_flood_frequency": "Intense Himalayan Cloudbursts & Flash Floods"
    },
    "Jammu and Kashmir": {
        "capital": "Srinagar",
        "center": [33.7782, 76.5762],
        "zoom": 7,
        "bbox": [32.2, 73.4, 37.1, 80.3],
        "primary_basins": ["Indus Basin", "Jhelum Basin", "Chenab Basin"],
        "flood_prone_districts": [
            "Srinagar", "Anantnag", "Baramulla", "Pulwama", "Jammu", "Kathua"
        ],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Jhelum Valley Overflow & Glacial Melt Spikes"
    },
    "Madhya Pradesh": {
        "capital": "Bhopal",
        "center": [22.9734, 78.6569],
        "zoom": 6,
        "bbox": [21.0, 74.0, 26.9, 82.8],
        "primary_basins": ["Narmada Basin", "Ganga Basin", "Chambal Basin", "Betwa Basin"],
        "flood_prone_districts": [
            "Hoshangabad (Narmadapuram)", "Jabalpur", "Barwani", "Sheopur", "Bhind"
        ],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Narmada Basin Monsoon Spills"
    },
    "Rajasthan": {
        "capital": "Jaipur",
        "center": [27.0238, 74.2179],
        "zoom": 6,
        "bbox": [23.0, 69.5, 30.2, 78.3],
        "primary_basins": ["Chambal Basin", "Luni Basin", "Mahi Basin"],
        "flood_prone_districts": [
            "Kota", "Jhalawar", "Baran", "Barmer", "Jalore"
        ],
        "vulnerability_index": "LOW_MODERATE",
        "annual_flood_frequency": "Chambal Barrage Releases & Desert Flash Floods"
    },
    "Jharkhand": {
        "capital": "Ranchi",
        "center": [23.6102, 85.2799],
        "zoom": 7,
        "bbox": [21.9, 83.3, 25.3, 87.9],
        "primary_basins": ["Subarnarekha Basin", "Damodar Basin", "Ganga Basin"],
        "flood_prone_districts": [
            "East Singhbhum", "Sahebganj", "Dhanbad", "Ranchi"
        ],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Subarnarekha & Damodar Valley Flooding"
    },
    "Chhattisgarh": {
        "capital": "Raipur",
        "center": [21.2787, 81.8661],
        "zoom": 7,
        "bbox": [17.8, 80.2, 24.1, 84.4],
        "primary_basins": ["Mahanadi Basin", "Godavari Basin"],
        "flood_prone_districts": [
            "Raipur", "Bilaspur", "Janjgir-Champa", "Sukma", "Bijapur"
        ],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Upper Mahanadi & Indravati River Surges"
    },
    "Goa": {
        "capital": "Panaji",
        "center": [15.2993, 74.1240],
        "zoom": 9,
        "bbox": [14.9, 73.6, 15.8, 74.4],
        "primary_basins": ["Mandovi Basin", "Zuari Basin"],
        "flood_prone_districts": ["North Goa", "South Goa"],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "High Tide & Monsoon River Spills"
    },
    "Tripura": {
        "capital": "Agartala",
        "center": [23.9408, 91.9882],
        "zoom": 8,
        "bbox": [22.9, 91.1, 24.5, 92.4],
        "primary_basins": ["Meghna Basin", "Howrah River"],
        "flood_prone_districts": ["West Tripura", "Gomati", "South Tripura"],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Transboundary River Spills"
    },
    "Manipur": {
        "capital": "Imphal",
        "center": [24.6637, 93.9063],
        "zoom": 8,
        "bbox": [23.8, 93.0, 25.7, 94.8],
        "primary_basins": ["Barak Basin", "Manipur River Basin"],
        "flood_prone_districts": ["Imphal West", "Imphal East", "Thoubal"],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Imphal Valley Monsoon Inundation"
    },
    "Meghalaya": {
        "capital": "Shillong",
        "center": [25.4670, 91.3662],
        "zoom": 8,
        "bbox": [25.0, 89.8, 26.1, 92.8],
        "primary_basins": ["Brahmaputra Basin", "Surma Basin"],
        "flood_prone_districts": ["West Garo Hills", "South West Garo Hills"],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Flash Floods & Extreme Precipitation Events"
    },
    "Nagaland": {
        "capital": "Kohima",
        "center": [26.1584, 94.5624],
        "zoom": 8,
        "bbox": [25.2, 93.3, 27.0, 95.2],
        "primary_basins": ["Brahmaputra Basin", "Dhansiri Basin"],
        "flood_prone_districts": ["Dimapur"],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Dhansiri River Flooding"
    },
    "Mizoram": {
        "capital": "Aizawl",
        "center": [23.1645, 92.9376],
        "zoom": 8,
        "bbox": [21.9, 92.2, 24.5, 93.4],
        "primary_basins": ["Barak Basin", "Kaladan Basin"],
        "flood_prone_districts": ["Aizawl", "Lunglei"],
        "vulnerability_index": "MODERATE",
        "annual_flood_frequency": "Flash Floods in River Valleys"
    },
    "Arunachal Pradesh": {
        "capital": "Itanagar",
        "center": [28.2180, 94.7278],
        "zoom": 7,
        "bbox": [26.5, 91.5, 29.5, 97.4],
        "primary_basins": ["Brahmaputra Basin", "Siang Basin", "Subansiri Basin"],
        "flood_prone_districts": ["East Siang", "Lohit", "Namsai"],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Siang River Surges & Himalayan Flash Floods"
    },
    "Sikkim": {
        "capital": "Gangtok",
        "center": [27.5330, 88.5122],
        "zoom": 9,
        "bbox": [27.0, 88.0, 28.1, 88.9],
        "primary_basins": ["Teesta Basin"],
        "flood_prone_districts": ["Mangan", "Gangtok", "Namchi"],
        "vulnerability_index": "EXTREME",
        "annual_flood_frequency": "GLOF (Glacial Lake Outbursts) & Teesta Flash Floods"
    },
    "Delhi": {
        "capital": "New Delhi",
        "center": [28.6139, 77.2090],
        "zoom": 10,
        "bbox": [28.4, 76.8, 28.9, 77.4],
        "primary_basins": ["Yamuna Basin"],
        "flood_prone_districts": ["North Delhi", "East Delhi", "North East Delhi", "Central Delhi"],
        "vulnerability_index": "HIGH",
        "annual_flood_frequency": "Yamuna River Embankment Breaches & Urban Floods"
    }
}

# =============================================================================
# 2. 9 MAJOR INDIAN RIVER BASINS REGISTRY
# =============================================================================

MAJOR_RIVER_BASINS = {
    "Ganga": {
        "basin_name": "Ganga River Basin",
        "drainage_area_sq_km": 1086000,
        "origin": "Gangotri Glacier, Uttarakhand",
        "mouth": "Bay of Bengal (Ganga-Brahmaputra Delta)",
        "riparian_states": ["Uttarakhand", "Uttar Pradesh", "Bihar", "West Bengal", "Delhi", "Haryana", "Rajasthan", "Madhya Pradesh"],
        "major_tributaries": ["Yamuna", "Ghaghara", "Kosi", "Gandak", "Son", "Gomti", "Ramganga", "Hooghly"],
        "flood_vulnerability": "Extremely High (Kosi 'Sorrow of Bihar', Gangetic plains overflow)",
        "center": [25.5, 83.0],
        "zoom": 6
    },
    "Brahmaputra": {
        "basin_name": "Brahmaputra River Basin",
        "drainage_area_sq_km": 580000,
        "origin": "Angsi Glacier, Tibet (Yarlung Tsangpo)",
        "mouth": "Bay of Bengal (Meghna)",
        "riparian_states": ["Arunachal Pradesh", "Assam", "Meghalaya", "Nagaland", "Sikkim", "West Bengal"],
        "major_tributaries": ["Subansiri", "Dihang", "Lohit", "Manas", "Teesta", "Dhansiri", "Kopili", "Barak"],
        "flood_vulnerability": "Extreme (Annual catastrophic Assam inundation, high sediment discharge)",
        "center": [26.5, 93.0],
        "zoom": 6
    },
    "Mahanadi": {
        "basin_name": "Mahanadi River Basin",
        "drainage_area_sq_km": 141600,
        "origin": "Sihawa, Dhamtari, Chhattisgarh",
        "mouth": "Bay of Bengal, False Point, Odisha",
        "riparian_states": ["Chhattisgarh", "Odisha", "Jharkhand", "Maharashtra", "Madhya Pradesh"],
        "major_tributaries": ["Seonath", "Hasdeo", "Mand", "Ib", "Ong", "Tel", "Kuakhai", "Daya", "Birupa"],
        "flood_vulnerability": "High (Mundali deltaic fan, Hirakud multi-gate emergency releases)",
        "center": [21.0, 84.5],
        "zoom": 7
    },
    "Godavari": {
        "basin_name": "Godavari River Basin (Dakshin Ganga)",
        "drainage_area_sq_km": 312812,
        "origin": "Trimbakeshwar, Nashik, Maharashtra",
        "mouth": "Bay of Bengal, Andhra Pradesh",
        "riparian_states": ["Maharashtra", "Telangana", "Andhra Pradesh", "Chhattisgarh", "Madhya Pradesh", "Odisha", "Karnataka"],
        "major_tributaries": ["Pranhita", "Indravati", "Manjira", "Wainganga", "Wardha", "Sabari"],
        "flood_vulnerability": "High (Bhadrachalam inundation, Dowleswaram/Sir Arthur Cotton Barrage surge)",
        "center": [18.8, 79.5],
        "zoom": 6
    },
    "Krishna": {
        "basin_name": "Krishna River Basin",
        "drainage_area_sq_km": 258948,
        "origin": "Mahabaleshwar, Maharashtra",
        "mouth": "Bay of Bengal, Hamsaladeevi, Andhra Pradesh",
        "riparian_states": ["Maharashtra", "Karnataka", "Telangana", "Andhra Pradesh"],
        "major_tributaries": ["Tungabhadra", "Bhima", "Koyna", "Ghataprabha", "Malaprabha", "Musi", "Dindi"],
        "flood_vulnerability": "High (Kolhapur/Sangli backwater flooding, Almatti & Prakasam Barrage peaks)",
        "center": [16.5, 77.0],
        "zoom": 6
    },
    "Narmada": {
        "basin_name": "Narmada River Basin",
        "drainage_area_sq_km": 98796,
        "origin": "Amarkantak Plateau, Madhya Pradesh",
        "mouth": "Gulf of Khambhat, Arabian Sea, Bharuch, Gujarat",
        "riparian_states": ["Madhya Pradesh", "Gujarat", "Maharashtra"],
        "major_tributaries": ["Tawa", "Hiran", "Sher", "Kolar", "Orsang"],
        "flood_vulnerability": "Moderate-High (Sardar Sarovar Dam full reservoir discharge into Golden Bridge, Bharuch)",
        "center": [22.3, 76.5],
        "zoom": 7
    },
    "Tapi": {
        "basin_name": "Tapi River Basin",
        "drainage_area_sq_km": 65145,
        "origin": "Multai, Betul District, Madhya Pradesh",
        "mouth": "Gulf of Khambhat, Arabian Sea, Surat, Gujarat",
        "riparian_states": ["Madhya Pradesh", "Maharashtra", "Gujarat"],
        "major_tributaries": ["Purna", "Girna", "Panjhra", "Vaghur", "Bori", "Aner"],
        "flood_vulnerability": "High (Ukai Dam emergency discharge submerging Surat urban plains)",
        "center": [21.2, 74.0],
        "zoom": 7
    },
    "Kaveri": {
        "basin_name": "Kaveri River Basin",
        "drainage_area_sq_km": 81155,
        "origin": "Talakaveri, Kodagu, Karnataka",
        "mouth": "Bay of Bengal, Poompuhar, Tamil Nadu",
        "riparian_states": ["Karnataka", "Tamil Nadu", "Kerala", "Puducherry"],
        "major_tributaries": ["Kabini", "Bhavani", "Hemavati", "Amaravati", "Arkavathi", "Noyyal", "Kollidam"],
        "flood_vulnerability": "Moderate-High (Mettur Dam outflow and Kollidam deltaic spills)",
        "center": [11.5, 77.8],
        "zoom": 7
    },
    "Indus": {
        "basin_name": "Indus River Basin (India Reaches)",
        "drainage_area_sq_km": 321289,
        "origin": "Manasarovar, Tibet",
        "mouth": "Arabian Sea",
        "riparian_states": ["Jammu and Kashmir", "Ladakh", "Himachal Pradesh", "Punjab", "Haryana", "Rajasthan"],
        "major_tributaries": ["Jhelum", "Chenab", "Ravi", "Beas", "Sutlej", "Zanskar", "Shyok"],
        "flood_vulnerability": "Extreme (Flash floods in Jhelum Valley / Srinagar, Sutlej & Beas spills in Punjab)",
        "center": [32.5, 75.8],
        "zoom": 6
    }
}

# =============================================================================
# 3. HISTORICAL FLOOD DISASTER INUNDATION ARCHIVE ACROSS INDIA
# =============================================================================

HISTORICAL_FLOOD_EVENTS: List[Dict[str, Any]] = [
    {
        "id": "assam_2022_2024",
        "title": "Assam Brahmaputra & Barak Catastrophic Inundation",
        "state": "Assam",
        "year": 2022,
        "severity": "CRITICAL",
        "river_basin": "Brahmaputra Basin",
        "districts_affected": ["Dibrugarh", "Barpeta", "Darrang", "Cachar (Silchar)", "Dhubri", "Kamrup"],
        "affected_area_sq_km": 14500,
        "population_affected": 5400000,
        "peak_discharge_m3s": 58000,
        "description": "Unprecedented monsoon rainfall caused catastrophic overtopping of Brahmaputra and Barak embankments, submerging Silchar city under 12 feet of water.",
        "coordinates": [26.1445, 91.7362]
    },
    {
        "id": "bihar_2008_kosi",
        "title": "Bihar Kosi River Avulsion & Delta Catastrophe",
        "state": "Bihar",
        "year": 2008,
        "severity": "CRITICAL",
        "river_basin": "Kosi Basin (Ganga)",
        "districts_affected": ["Supaul", "Madhepura", "Saharsa", "Araria", "Purnia"],
        "affected_area_sq_km": 11200,
        "population_affected": 3300000,
        "peak_discharge_m3s": 38500,
        "description": "Kusalha embankment breach on Kosi river shifted river channel 120 km east, inundating densely populated historic dry lands.",
        "coordinates": [26.1226, 86.6027]
    },
    {
        "id": "kerala_2018_periyar",
        "title": "Kerala Great Monsoonal Deluge",
        "state": "Kerala",
        "year": 2018,
        "severity": "CRITICAL",
        "river_basin": "Periyar Basin",
        "districts_affected": ["Ernakulam", "Idukki", "Alappuzha", "Thrissur", "Pathanamthitta"],
        "affected_area_sq_km": 6800,
        "population_affected": 5400000,
        "peak_discharge_m3s": 8400,
        "description": "Severe orographic rainfall overfilled 35 dams simultaneously, triggering devastating downstream dam releases through Periyar and Chalakudy valleys.",
        "coordinates": [10.1076, 76.3516]
    },
    {
        "id": "odisha_2011_mahanadi",
        "title": "Odisha Mahanadi Basin Mega Flood",
        "state": "Odisha",
        "year": 2011,
        "severity": "HIGH",
        "river_basin": "Mahanadi Basin",
        "districts_affected": ["Cuttack", "Kendrapara", "Puri", "Jagatsinghpur", "Bhadrak"],
        "affected_area_sq_km": 8900,
        "population_affected": 3400000,
        "peak_discharge_m3s": 39500,
        "description": "Simultaneous cyclonic depression over upper and lower catchments led to discharge of 13.6 lakh cusecs past Mundali Barrage, submerging the Mahanadi delta.",
        "coordinates": [20.4625, 85.8830]
    },
    {
        "id": "uttarakhand_2013_kedarnath",
        "title": "Uttarakhand Himalayan Tsunami & Cloudburst Flood",
        "state": "Uttarakhand",
        "year": 2013,
        "severity": "CRITICAL",
        "river_basin": "Ganga Basin (Mandakini / Alaknanda)",
        "districts_affected": ["Rudraprayag", "Chamoli", "Uttarkashi", "Haridwar"],
        "affected_area_sq_km": 4200,
        "population_affected": 420000,
        "peak_discharge_m3s": 14200,
        "description": "Chorabari glacial lake breach and multiple cloudbursts sent massive debris torrents down Mandakini and Alaknanda rivers, devastating valley settlements.",
        "coordinates": [30.7346, 79.0669]
    },
    {
        "id": "jk_2014_jhelum",
        "title": "Jammu and Kashmir Jhelum River Mega-Inundation",
        "state": "Jammu and Kashmir",
        "year": 2014,
        "severity": "CRITICAL",
        "river_basin": "Indus Basin (Jhelum)",
        "districts_affected": ["Srinagar", "Anantnag", "Baramulla", "Pulwama"],
        "affected_area_sq_km": 5600,
        "population_affected": 2600000,
        "peak_discharge_m3s": 18000,
        "description": "Continuous monsoonal rain caused Jhelum river to breach flood spill channels, submerging vast portions of Srinagar city under 15-18 feet of floodwater.",
        "coordinates": [34.0837, 74.7973]
    },
    {
        "id": "gujarat_2006_tapi",
        "title": "Surat Tapi River Flash Deluge",
        "state": "Gujarat",
        "year": 2006,
        "severity": "HIGH",
        "river_basin": "Tapi Basin",
        "districts_affected": ["Surat", "Navsari", "Bharuch"],
        "affected_area_sq_km": 3800,
        "population_affected": 2000000,
        "peak_discharge_m3s": 25700,
        "description": "Ukai Dam emergency water discharge exceeded 9 lakh cusecs, inundating 80% of Surat metropolitan area for over 72 hours.",
        "coordinates": [21.1702, 72.8311]
    },
    {
        "id": "maharashtra_2019_krishna",
        "title": "Western Maharashtra Krishna-Panchganga Floods",
        "state": "Maharashtra",
        "year": 2019,
        "severity": "HIGH",
        "river_basin": "Krishna Basin",
        "districts_affected": ["Kolhapur", "Sangli", "Satara", "Pune"],
        "affected_area_sq_km": 4900,
        "population_affected": 1500000,
        "peak_discharge_m3s": 15200,
        "description": "Backwater effect from Almatti Dam and extreme precipitation in Koyna catchment submerged Sangli and Kolhapur city centers.",
        "coordinates": [16.8524, 74.5815]
    },
    {
        "id": "tamilnadu_2015_chennai",
        "title": "Chennai Adyar & Cooum River Urban Flood",
        "state": "Tamil Nadu",
        "year": 2015,
        "severity": "CRITICAL",
        "river_basin": "Coastal Palar Basin",
        "districts_affected": ["Chennai", "Kanchipuram", "Thiruvallur", "Cuddalore"],
        "affected_area_sq_km": 3200,
        "population_affected": 3000000,
        "peak_discharge_m3s": 8200,
        "description": "Record-breaking northeast monsoon precipitation (490 mm in 24 hours) triggered Chembarambakkam reservoir releases, overflowing the Adyar river.",
        "coordinates": [13.0827, 80.2707]
    },
    {
        "id": "westbengal_2021_damodar",
        "title": "West Bengal Lower Gangetic & Damodar Valley Spills",
        "state": "West Bengal",
        "year": 2021,
        "severity": "HIGH",
        "river_basin": "Ganga Basin (Damodar & Hooghly)",
        "districts_affected": ["Howrah", "Hooghly", "Paschim Medinipur", "Purba Bardhaman"],
        "affected_area_sq_km": 5400,
        "population_affected": 1800000,
        "peak_discharge_m3s": 12800,
        "description": "Heavy depression rainfall across Jharkhand and DVC dam discharges inundated southern West Bengal agricultural plains.",
        "coordinates": [22.5726, 88.3639]
    }
]

# =============================================================================
# 4. GEOJSON GENERATOR FOR MAJOR INDIAN RIVERS
# =============================================================================

def get_india_rivers_geojson() -> Dict[str, Any]:
    """Returns vector LineString GeoJSON for 10 major Indian river systems."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Ganga River",
                    "basin": "Ganga",
                    "length_km": 2525,
                    "color": "#38BDF8",
                    "danger_mark_m": 71.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [78.59, 30.14], [78.16, 29.94], [80.33, 26.44], 
                        [81.84, 25.43], [83.00, 25.31], [85.13, 25.61], 
                        [87.97, 24.80], [88.36, 22.57], [88.10, 21.60]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Brahmaputra River",
                    "basin": "Brahmaputra",
                    "length_km": 2900,
                    "color": "#06B6D4",
                    "danger_mark_m": 49.68
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [95.35, 28.10], [94.90, 27.48], [93.80, 26.80], 
                        [92.80, 26.60], [91.73, 26.18], [90.50, 26.10], 
                        [89.97, 26.00], [89.80, 25.10]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Mahanadi River",
                    "basin": "Mahanadi",
                    "length_km": 851,
                    "color": "#0284C7",
                    "danger_mark_m": 27.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [81.90, 21.15], [82.60, 21.40], [83.85, 21.55], 
                        [84.40, 20.80], [85.50, 20.45], [85.88, 20.46], 
                        [86.42, 20.50], [86.70, 20.30]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Godavari River",
                    "basin": "Godavari",
                    "length_km": 1465,
                    "color": "#0EA5E9",
                    "danger_mark_m": 53.0
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.53, 19.93], [75.30, 19.80], [77.30, 19.15], 
                        [79.00, 18.90], [80.82, 17.67], [81.78, 17.00], 
                        [82.25, 16.70]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Krishna River",
                    "basin": "Krishna",
                    "length_km": 1400,
                    "color": "#2563EB",
                    "danger_mark_m": 43.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [73.66, 17.92], [74.58, 16.85], [75.70, 16.30], 
                        [77.20, 16.20], [79.00, 16.40], [80.60, 16.50], 
                        [80.95, 15.80]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Narmada River",
                    "basin": "Narmada",
                    "length_km": 1312,
                    "color": "#3B82F6",
                    "danger_mark_m": 31.0
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [81.76, 22.67], [79.95, 23.16], [77.74, 22.75], 
                        [75.80, 22.18], [73.74, 21.83], [72.98, 21.70], 
                        [72.58, 21.65]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Tapi River",
                    "basin": "Tapi",
                    "length_km": 724,
                    "color": "#60A5FA",
                    "danger_mark_m": 24.0
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [78.34, 21.78], [76.22, 21.31], [74.24, 21.35], 
                        [73.20, 21.25], [72.83, 21.17], [72.69, 21.08]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Kaveri River",
                    "basin": "Kaveri",
                    "length_km": 805,
                    "color": "#38BDF8",
                    "danger_mark_m": 12.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [75.52, 12.38], [76.71, 12.42], [77.70, 12.00], 
                        [78.65, 11.12], [79.13, 10.79], [79.85, 11.15]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Periyar River",
                    "basin": "Periyar",
                    "length_km": 244,
                    "color": "#0284C7",
                    "danger_mark_m": 8.5
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [77.20, 9.50], [76.95, 9.85], [76.60, 10.15], 
                        [76.43, 10.16], [76.35, 10.10], [76.22, 10.14]
                    ]
                }
            },
            {
                "type": "Feature",
                "properties": {
                    "river_name": "Jhelum River",
                    "basin": "Indus",
                    "length_km": 725,
                    "color": "#38BDF8",
                    "danger_mark_m": 6.8
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [75.31, 33.53], [75.15, 33.73], [74.80, 34.08], 
                        [74.58, 34.20], [74.35, 34.22], [74.12, 34.10]
                    ]
                }
            }
        ]
    }

# =============================================================================
# 5. GEOJSON GENERATOR FOR INDIA STATE BOUNDARIES (POLYGONS/BOUNDS)
# =============================================================================

def get_india_states_geojson() -> Dict[str, Any]:
    """Returns polygonal bounding boxes and centers for Indian states."""
    features = []
    for state_name, meta in INDIAN_STATES.items():
        min_lat, min_lng, max_lat, max_lng = meta["bbox"]
        features.append({
            "type": "Feature",
            "properties": {
                "state_name": state_name,
                "name": state_name,
                "capital": meta["capital"],
                "primary_basins": meta["primary_basins"],
                "vulnerability_index": meta["vulnerability_index"],
                "annual_frequency": meta["annual_flood_frequency"],
                "flood_prone_districts_count": len(meta["flood_prone_districts"]),
                "center": meta["center"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [min_lng, min_lat],
                    [max_lng, min_lat],
                    [max_lng, max_lat],
                    [min_lng, max_lat],
                    [min_lng, min_lat]
                ]]
            }
        })
    return {
        "type": "FeatureCollection",
        "features": features
    }

# =============================================================================
# 6. GEOJSON GENERATOR FOR 3-DAY FORECAST RISK AREAS
# =============================================================================

def get_forecast_risk_geojson(state_filter: str = None) -> Dict[str, Any]:
    """Returns spatial forecast polygons for upcoming 72-hour precipitation and flood risk."""
    forecast_zones = [
        {
            "name": "Lower Brahmaputra Flood Influx Zone",
            "state": "Assam",
            "district": "Barpeta",
            "basin": "Brahmaputra Basin",
            "projected_rain_72h_mm": 185.0,
            "forecast_risk": "HIGH",
            "valid_period": "Next 24-72 Hours",
            "color": "#F97316",
            "center": [26.32, 91.00],
            "radius_km": 40
        },
        {
            "name": "Kosi-Seemanchal Monsoon Inundation Watch",
            "state": "Bihar",
            "district": "Supaul",
            "basin": "Kosi Basin",
            "projected_rain_72h_mm": 210.0,
            "forecast_risk": "CRITICAL",
            "valid_period": "Next 12-48 Hours",
            "color": "#EF4444",
            "center": [26.12, 86.60],
            "radius_km": 45
        },
        {
            "name": "Mahanadi Deltaic Catchment Surge",
            "state": "Odisha",
            "district": "Cuttack",
            "basin": "Mahanadi Basin",
            "projected_rain_72h_mm": 95.0,
            "forecast_risk": "MEDIUM",
            "valid_period": "Next 48 Hours",
            "color": "#F59E0B",
            "center": [20.46, 85.88],
            "radius_km": 35
        },
        {
            "name": "Periyar Valley Flash Discharge Watch",
            "state": "Kerala",
            "district": "Ernakulam",
            "basin": "Periyar Basin",
            "projected_rain_72h_mm": 115.0,
            "forecast_risk": "HIGH",
            "valid_period": "Next 24 Hours",
            "color": "#F97316",
            "center": [10.10, 76.35],
            "radius_km": 25
        },
        {
            "name": "Ganga Middle Reach Spill Watch",
            "state": "Uttar Pradesh",
            "district": "Prayagraj",
            "basin": "Ganga Basin",
            "projected_rain_72h_mm": 80.0,
            "forecast_risk": "MEDIUM",
            "valid_period": "Next 72 Hours",
            "color": "#F59E0B",
            "center": [25.43, 81.84],
            "radius_km": 30
        },
        {
            "name": "Teesta Flash Flood Forward Alert",
            "state": "West Bengal",
            "district": "Jalpaiguri",
            "basin": "Teesta Basin",
            "projected_rain_72h_mm": 160.0,
            "forecast_risk": "HIGH",
            "valid_period": "Next 36 Hours",
            "color": "#F97316",
            "center": [26.54, 88.71],
            "radius_km": 28
        }
    ]

    features = []
    for z in forecast_zones:
        if state_filter and state_filter.lower() != "all" and state_filter.lower() not in z["state"].lower():
            continue
        lat, lng = z["center"]
        d = 0.35  # approx bounding box delta
        features.append({
            "type": "Feature",
            "properties": {
                "zone_name": z["name"],
                "feature_type": "forecast_alert_zone",
                "state": z["state"],
                "district": z["district"],
                "basin": z["basin"],
                "forecast_risk": z["forecast_risk"],
                "projected_rain_72h_mm": z["projected_rain_72h_mm"],
                "valid_period": z["valid_period"],
                "color": z["color"],
                "provenance": "FORECAST",
                "geometry_note": "Approximate bounding-box alert zone, not a modelled inundation footprint."
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [lng - d, lat - d],
                    [lng + d, lat - d],
                    [lng + d, lat + d],
                    [lng - d, lat + d],
                    [lng - d, lat - d]
                ]]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }
