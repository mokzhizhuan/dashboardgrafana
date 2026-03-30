from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


def default_fault_mode() -> Dict[str, Any]:
    return {
        "enabled": False,
        "fault_type": None,
        "target_devices": [],
        "severity": "medium",
        "started_at": None,
        "config": {},
    }


class SimulatorStartRequest(BaseModel):
    csv_file: Optional[str] = None
    interval_seconds: float = 5.0
    loop: bool = True
    source: str = "csv"
    device_count: int = 3


class FaultStartRequest(BaseModel):
    fault_type: str = Field(
        ...,
        description="high_temp | stuck_temp | drift_up | noisy | offline",
    )
    target_devices: List[str] = Field(default_factory=list)
    severity: str = "medium"
    config: Dict[str, Any] = Field(default_factory=dict)

class DeleteTelemetryRowsRequest(BaseModel):
    ids: List[int] = Field(default_factory=list)


class TruncateTableRequest(BaseModel):
    confirm: str

@dataclass
class SimulatorState:
    running: bool = False
    paused: bool = False
    task: Optional[Any] = None
    csv_file: str = ""
    interval_seconds: float = 5.0
    loop: bool = True
    source: str = "csv"
    device_count: int = 3
    rows_inserted: int = 0
    rows_skipped: int = 0
    fault_rows_applied: int = 0
    offline_events: int = 0
    current_index: int = 0
    total_rows: int = 0
    started_at: Optional[str] = None
    stopped_at: Optional[str] = None
    paused_at: Optional[str] = None
    last_insert_time: Optional[str] = None
    last_inserted_row: Optional[dict] = None
    last_device: Optional[str] = None
    error: Optional[str] = None
    device_last_seen: Dict[str, str] = field(default_factory=dict)
    device_status: Dict[str, str] = field(default_factory=dict)
    device_next_due: Dict[str, float] = field(default_factory=dict)
    loop_iterations: int = 0
    total_loop_latency_ms: float = 0.0
    force_high_temp: bool = False
    fault_mode: Dict[str, Any] = field(default_factory=default_fault_mode)
    device_fault_memory: Dict[str, Dict[str, Any]] = field(default_factory=dict)
