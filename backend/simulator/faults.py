import random
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException
from prometheus_metrics import record_fault_event, set_fault_state
from .config import VALID_FAULT_TYPES, VALID_SEVERITY
from .helpers import get_sim_device_names, normalize_devices
from .helpers_types import fault_row
from .models import FaultStartRequest
from .state import mark_inserted, mark_skipped, sim_state
from .utils import iso_now


def get_active_fault_for_device(device_name: str) -> Optional[Dict[str, Any]]:
    fault = sim_state.fault_mode
    if not fault["enabled"]:
        return None
    targets = fault.get("target_devices", [])
    if targets and device_name not in targets:
        return None
    return fault


def apply_fault(
    device_name: str,
    normal_temp: float,
    normal_humidity: float,
    fault: Dict[str, Any],
) -> Dict[str, Any]:
    fault_type = fault.get("fault_type")
    severity = fault.get("severity", "medium")
    config = fault.get("config", {})
    memory = sim_state.device_fault_memory.setdefault(device_name, {})

    if fault_type == "high_temp":
        temp_ranges = {
            "low": (28.0, 30.0),
            "medium": (30.0, 33.0),
            "high": (33.0, 37.0),
        }
        low, high = temp_ranges[severity]
        temp = round(random.uniform(low, high), 2)
        humidity = round(max(normal_humidity, float(config.get("humidity_floor", 60.0))), 2)
        return fault_row(False, temp, humidity, "high_temp")

    if fault_type == "stuck_temp":
        if "stuck_temp" not in memory:
            stuck_ranges = {
                "low": (28.5, 30.5),
                "medium": (31.0, 34.0),
                "high": (34.5, 38.0),
            }
            low, high = stuck_ranges[severity]
            memory["stuck_temp"] = round(random.uniform(low, high), 2)
        return fault_row(False, memory["stuck_temp"], round(normal_humidity, 2), "stuck_temp")

    if fault_type == "drift_up":
        step_map = {"low": 0.15, "medium": 0.35, "high": 0.75}
        memory["drift_temp"] = memory.get("drift_temp", normal_temp) + float(
            config.get("step", step_map[severity])
        )
        humidity = round(max(20.0, normal_humidity - float(config.get("humidity_drop", 0.0))), 2)
        return fault_row(False, round(memory["drift_temp"], 2), humidity, "drift_up")

    if fault_type == "noisy":
        spread_map = {"low": 1.5, "medium": 3.5, "high": 6.5}
        spread = float(config.get("spread", spread_map[severity]))
        temp = round(normal_temp + random.uniform(-spread, spread), 2)
        humidity = round(
            max(20.0, min(95.0, normal_humidity + random.uniform(-(spread / 2), spread / 2))),
            2,
        )
        return fault_row(False, temp, humidity, "noisy")

    if fault_type == "offline":
        return fault_row(True, None, None, "offline")

    return fault_row(False, round(normal_temp, 2), round(normal_humidity, 2), None)


def apply_runtime_faults(
    device_name: str,
    base_temperature: float,
    base_humidity: float,
) -> Dict[str, Any]:
    if sim_state.force_high_temp:
        return fault_row(False, 42.0, round(max(base_humidity, 60.0), 2), "legacy_high_temp")

    active_fault = get_active_fault_for_device(device_name)
    if not active_fault:
        return fault_row(False, round(base_temperature, 2), round(base_humidity, 2), None)

    return apply_fault(device_name, base_temperature, base_humidity, active_fault)


def validate_fault_request(req: FaultStartRequest) -> Tuple[str, str, List[str]]:
    fault_type = req.fault_type.strip()
    severity = req.severity.strip().lower()
    target_devices = normalize_devices(req.target_devices)
    invalid_devices = [d for d in target_devices if d not in set(get_sim_device_names())]

    if invalid_devices:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid target devices: {', '.join(invalid_devices)}",
        )
    if fault_type not in VALID_FAULT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid fault_type. Allowed: {sorted(VALID_FAULT_TYPES)}",
        )
    if severity not in VALID_SEVERITY:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Allowed: {sorted(VALID_SEVERITY)}",
        )

    return fault_type, severity, target_devices


def start_fault_state(
    fault_type: str,
    severity: str,
    target_devices: List[str],
    config: Dict[str, Any],
) -> None:
    sim_state.device_fault_memory.clear()
    sim_state.fault_mode = {
        "enabled": True,
        "fault_type": fault_type,
        "target_devices": target_devices,
        "severity": severity,
        "started_at": iso_now(datetime.now()),
        "config": config or {},
    }
    set_fault_state(
        enabled=True,
        target_devices=len(target_devices),
        fault_type=fault_type,
    )


async def process_single_row(
    *,
    now: datetime,
    device_name: str,
    base_temperature: float,
    base_humidity: float,
) -> Optional[Dict[str, Any]]:
    result = apply_runtime_faults(device_name, base_temperature, base_humidity)
    if result.get("fault_applied"):
        record_fault_event("apply")
    if result["skip"]:
        mark_skipped(device_name=device_name, now=now, fault_applied=result["fault_applied"])
        return None
    
    row = {
        "device_name": device_name,
        "time": now,
        "temperature": result["temperature"],
        "humidity": result["humidity"],
    }
    mark_inserted(
        device_name=device_name,
        now=now,
        temperature=result["temperature"],
        humidity=result["humidity"],
        fault_applied=result["fault_applied"],
    )
    return row
