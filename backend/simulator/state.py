import time
from datetime import datetime

from .config import DEFAULT_CSV_FILE
from .helpers_types import fault_row
from .models import SimulatorState, default_fault_mode
from prometheus_metrics import set_fault_state, set_simulator_state
from .utils import iso_now


sim_state = SimulatorState(csv_file=DEFAULT_CSV_FILE)


def reset_runtime() -> None:
    sim_state.rows_inserted = 0
    sim_state.rows_skipped = 0
    sim_state.fault_rows_applied = 0
    sim_state.offline_events = 0
    sim_state.current_index = 0
    sim_state.total_rows = 0
    sim_state.last_insert_time = None
    sim_state.last_inserted_row = None
    sim_state.last_device = None
    sim_state.error = None
    sim_state.device_last_seen.clear()
    sim_state.device_status.clear()
    sim_state.device_next_due.clear()
    sim_state.device_fault_memory.clear()
    sim_state.loop_iterations = 0
    sim_state.total_loop_latency_ms = 0.0
    sim_state.paused = False
    sim_state.paused_at = None


def note_loop_latency(loop_start: float) -> None:
    sim_state.loop_iterations += 1
    sim_state.total_loop_latency_ms += (time.perf_counter() - loop_start) * 1000


def mark_inserted(
    *,
    device_name: str,
    now: datetime,
    temperature: float,
    humidity: float,
    fault_applied: str | None,
) -> None:
    now_text = iso_now(now)
    sim_state.rows_inserted += 1
    sim_state.last_insert_time = now_text
    sim_state.last_device = device_name
    sim_state.device_last_seen[device_name] = now_text
    sim_state.device_status[device_name] = "online"
    sim_state.last_inserted_row = {
        "device_name": device_name,
        "time": now_text,
        "temperature": temperature,
        "humidity": humidity,
        "faultApplied": fault_applied,
        "skipped": False,
    }
    if fault_applied:
        sim_state.fault_rows_applied += 1


def mark_skipped(*, device_name: str, now: datetime, fault_applied: str | None) -> None:
    now_text = iso_now(now)
    sim_state.rows_skipped += 1
    sim_state.last_insert_time = now_text
    sim_state.last_device = device_name
    sim_state.device_status[device_name] = "offline_simulated"
    sim_state.last_inserted_row = {
        "device_name": device_name,
        "time": now_text,
        "temperature": None,
        "humidity": None,
        "faultApplied": fault_applied,
        "skipped": True,
    }
    if fault_applied == "offline":
        sim_state.offline_events += 1


def stop_run() -> None:
    sim_state.running = False
    sim_state.paused = False
    sim_state.task = None
    sim_state.stopped_at = iso_now(datetime.now())
    set_simulator_state(
        running=False,
        paused=False,
        interval_seconds=0,
    )


def stop_fault_state() -> None:
    for device in sim_state.fault_mode.get("target_devices", []):
        sim_state.device_fault_memory.pop(device, None)
    sim_state.fault_mode = default_fault_mode()
    set_fault_state(
        enabled=False,
        target_devices=0,
        fault_type="none",
    )
