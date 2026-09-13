"""
FloodGuard Data Models & Type Definitions
"""
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List

@dataclass
class User:
    id: Optional[int]
    name: str
    email: str
    password_hash: str
    role: str = "user"
    created_at: Optional[str] = None

@dataclass
class FloodArea:
    id: Optional[int]
    area_name: str
    district: str
    latitude: float
    longitude: float
    geometry_json: Optional[Dict[str, Any]]
    risk_level: str
    rainfall: float
    water_level: float
    elevation: float
    distance_to_river: int
    description: str
    last_updated: Optional[str] = None

@dataclass
class SafeLocation:
    id: Optional[int]
    location_name: str
    type: str
    latitude: float
    longitude: float
    capacity: int
    current_occupancy: int
    contact: str
    address: str
    status: str = "OPEN"

@dataclass
class Hospital:
    id: Optional[int]
    hospital_name: str
    latitude: float
    longitude: float
    address: str
    emergency_availability: str
    total_beds: int
    available_beds: int
    contact: str
    ambulance_helpline: str
    status: str = "OPERATIONAL"

@dataclass
class Alert:
    id: Optional[int]
    title: str
    description: str
    location: str
    risk_level: str
    alert_type: str
    date: str
    time: str
    status: str = "ACTIVE"

@dataclass
class RainfallRecord:
    id: Optional[int]
    location: str
    latitude: float
    longitude: float
    rainfall: float
    date: str
    time: str
    intensity: str

@dataclass
class RiverRecord:
    id: Optional[int]
    river_name: str
    location: str
    water_level: float
    warning_level: float
    danger_level: float
    status: str
    flow_rate_cumecs: int
    date: str
    time: str

@dataclass
class HistoricalFloodRecord:
    id: Optional[int]
    location: str
    district: str
    year: int
    severity: str
    duration: str
    affected_area: str
    peak_rainfall: float
    peak_river_level: float
    casualties: int
    evacuated_persons: int
    description: str
