from typing import Any, Dict


def fault_row(skip: bool, temperature: float | None, humidity: float | None, fault_applied: str | None) -> Dict[str, Any]:
    return {
        "skip": skip,
        "temperature": temperature,
        "humidity": humidity,
        "fault_applied": fault_applied,
    }
