import csv
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from .config import SIM_DEVICES
from .state import sim_state


def iso_now(dt: datetime) -> str:
    return dt.isoformat(sep=" ", timespec="seconds")


def get_sim_device_names() -> List[str]:
    return [d["device_name"] for d in SIM_DEVICES]


def get_sim_device(device_name: str) -> Optional[Dict[str, Any]]:
    return next((d for d in SIM_DEVICES if d["device_name"] == device_name), None)


def get_default_sim_device_name() -> str:
    names = get_sim_device_names()
    if not names:
        raise HTTPException(status_code=500, detail="No simulator devices configured")
    return names[0]


def normalize_devices(devices: List[str]) -> List[str]:
    return [d.strip() for d in devices if d and d.strip()]


def tracked_devices() -> List[str]:
    names = {device["device_name"] for device in SIM_DEVICES}
    names.update(sim_state.device_last_seen)
    names.update(sim_state.device_status)
    names.update(sim_state.fault_mode.get("target_devices", []))
    if sim_state.last_device:
        names.add(sim_state.last_device)
    return sorted(names)


def load_csv_rows(csv_file: str) -> List[Dict[str, Any]]:
    if not os.path.exists(csv_file):
        raise FileNotFoundError(f"CSV file not found: {csv_file}")

    rows: List[Dict[str, Any]] = []
    with open(csv_file, "r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        required = {"device_name", "time", "temperature", "humidity"}
        if not required.issubset(set(reader.fieldnames or [])):
            raise ValueError(
                f"CSV must contain columns {sorted(required)}. Found: {reader.fieldnames}"
            )

        for row in reader:
            rows.append(
                {
                    "device_name": row["device_name"],
                    "temperature": float(row["temperature"]),
                    "humidity": float(row["humidity"]),
                }
            )
    return rows
