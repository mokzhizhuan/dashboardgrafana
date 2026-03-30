from datetime import datetime
from typing import Any, Dict, List, Optional

from .db import query_last_n_temps
from .helpers import get_sim_device, tracked_devices
from .state import sim_state


def get_device_delay_seconds(device_name: str) -> Optional[int]:
    last_seen = sim_state.device_last_seen.get(device_name)
    if not last_seen:
        return None
    try:
        dt = datetime.fromisoformat(last_seen)
    except ValueError:
        return None
    return max(0, int((datetime.now() - dt).total_seconds()))


def get_latest_temp_for_device(device_name: str) -> Optional[float]:
    last_row = sim_state.last_inserted_row or {}
    if last_row.get("device_name") == device_name and not last_row.get("skipped"):
        temp = last_row.get("temperature")
        if isinstance(temp, (int, float)):
            return float(temp)
    device = get_sim_device(device_name)
    return float(device["base_temp"]) if device else None


def compute_health_score(device_name: str, delay_sec: Optional[int], temp: Optional[float]) -> int:
    score = 100
    if delay_sec is not None:
        if delay_sec > 30:
            score -= 40
        elif delay_sec > 15:
            score -= 25
        elif delay_sec > 8:
            score -= 10
    if temp is not None:
        if temp > 33:
            score -= 35
        elif temp > 30:
            score -= 20
        elif temp < 21:
            score -= 10
    if sim_state.device_status.get(device_name) == "offline_simulated":
        score -= 35
    return max(0, min(100, score))


def health_band(score: int) -> str:
    if score >= 85:
        return "healthy"
    if score >= 60:
        return "warning"
    return "critical"


def detect_anomalies_for_device(
    device_name: str,
    delay_sec: Optional[int],
    temp: Optional[float],
) -> List[Dict[str, Any]]:
    anomalies: List[Dict[str, Any]] = []
    if sim_state.device_status.get(device_name) == "offline_simulated":
        anomalies.append(
            {
                "device": device_name,
                "type": "offline_simulated",
                "severity": "high",
                "message": "Device is currently under simulated offline fault mode.",
            }
        )
    if delay_sec is not None:
        if delay_sec > 30:
            anomalies.append(
                {
                    "device": device_name,
                    "type": "stale_data",
                    "severity": "high",
                    "message": f"No fresh data for {delay_sec} seconds.",
                }
            )
        elif delay_sec > 15:
            anomalies.append(
                {
                    "device": device_name,
                    "type": "delay_risk",
                    "severity": "medium",
                    "message": f"Telemetry delay is elevated at {delay_sec} seconds.",
                }
            )
    if temp is not None:
        if temp > 33:
            anomalies.append(
                {
                    "device": device_name,
                    "type": "temperature_spike",
                    "severity": "high",
                    "message": f"Temperature is critically high at {temp:.1f} °C.",
                }
            )
        elif temp > 30:
            anomalies.append(
                {
                    "device": device_name,
                    "type": "temperature_warning",
                    "severity": "medium",
                    "message": f"Temperature is above normal at {temp:.1f} °C.",
                }
            )
    return anomalies


async def predict_device_temperature(device_name: str) -> Optional[float]:
    temps = await query_last_n_temps(device_name, limit=2)
    if len(temps) < 2:
        return None
    latest, previous = temps[0], temps[1]
    return round(latest + (latest - previous), 2)


def prediction_risk(predicted_temp: Optional[float], delay_sec: Optional[int]) -> str:
    if delay_sec is not None and delay_sec > 30:
        return "high"
    if predicted_temp is None:
        return "unknown"
    if predicted_temp > 33:
        return "high"
    if predicted_temp > 30:
        return "medium"
    return "low"
