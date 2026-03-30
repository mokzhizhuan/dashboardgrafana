import os
from pathlib import Path

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:126523@postgres:5432/engineering_dashboard",
)

BASE_DIR = Path(__file__).resolve().parent
DEFAULT_CSV_FILE = str(BASE_DIR / "telemetry_simulation.csv")

SIM_DEVICES = [
    {"device_name": "sensor_01", "base_temp": 24.5, "base_humidity": 56.0},
    {"device_name": "sensor_02", "base_temp": 25.2, "base_humidity": 58.0},
    {"device_name": "sensor_03", "base_temp": 23.8, "base_humidity": 60.5},
    {"device_name": "sensor_04", "base_temp": 26.1, "base_humidity": 54.2},
]

VALID_FAULT_TYPES = {"high_temp", "stuck_temp", "drift_up", "noisy", "offline"}
VALID_SEVERITY = {"low", "medium", "high"}
