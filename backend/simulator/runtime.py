import asyncio
import random
import time
from datetime import datetime
from typing import Any, Dict, List
import logging
logger = logging.getLogger(__name__)
from fastapi import HTTPException
from prometheus_metrics import (
    TELEMETRY_WRITES_TOTAL,
    record_simulator_insert_failure,
    record_simulator_insert_success,
    set_simulator_state,
    set_telemetry_latest_timestamp,
    set_telemetry_total_rows,
)
from .db import ensure_table, insert_telemetry_rows, get_telemetry_metrics_snapshot
from .config import DEFAULT_CSV_FILE, SIM_DEVICES
from .faults import process_single_row
from .helpers import load_csv_rows
from .models import SimulatorStartRequest
from .state import note_loop_latency, reset_runtime, sim_state, stop_run
from .utils import iso_now


def generate_random_row(
    device: Dict[str, Any],
    memory: Dict[str, Dict[str, float]],
) -> Dict[str, Any]:
    name = device["device_name"]
    base_temp = device["base_temp"]
    base_humidity = device["base_humidity"]
    state = memory.setdefault(name, {"temp": base_temp, "humidity": base_humidity})

    state["temp"] += (base_temp - state["temp"]) * 0.08 + random.uniform(-0.2, 0.2)
    state["humidity"] += (base_humidity - state["humidity"]) * 0.08 + random.uniform(-0.35, 0.35)
    state["temp"] = max(20.0, min(35.0, state["temp"]))
    state["humidity"] = max(30.0, min(90.0, state["humidity"]))

    return {
        "device_name": name,
        "temperature": round(state["temp"], 2),
        "humidity": round(state["humidity"], 2),
    }


def select_random_devices() -> List[Dict[str, Any]]:
    return SIM_DEVICES[: max(1, min(sim_state.device_count, len(SIM_DEVICES)))]


def prepare_run(req: SimulatorStartRequest) -> None:
    sim_state.csv_file = req.csv_file or DEFAULT_CSV_FILE
    sim_state.interval_seconds = max(1.0, req.interval_seconds)
    sim_state.loop = req.loop
    sim_state.source = req.source
    sim_state.device_count = max(1, min(req.device_count, len(SIM_DEVICES)))
    reset_runtime()
    sim_state.started_at = iso_now(datetime.now())
    sim_state.stopped_at = None
    sim_state.running = True
    set_simulator_state(
        running=True,
        paused=False,
        interval_seconds=sim_state.interval_seconds,
        target_device_count=sim_state.device_count,
    )


async def replay_csv_task() -> None:
    try:
        await ensure_table()
        rows = load_csv_rows(sim_state.csv_file)
        sim_state.total_rows = len(rows)
        sim_state.error = None
        if not rows:
            sim_state.running = False
            return

        while sim_state.running:
            if sim_state.paused:
                await asyncio.sleep(0.25)
                continue

            loop_start = time.perf_counter()
            if sim_state.current_index >= sim_state.total_rows:
                if sim_state.loop:
                    sim_state.current_index = 0
                else:
                    sim_state.running = False
                    break

            item = rows[sim_state.current_index]
            row = await process_single_row(
                now=datetime.now(),
                device_name=item["device_name"],
                base_temperature=float(item["temperature"]),
                base_humidity=float(item["humidity"]),
            )
            if row:
                one_row_batch = [row]
                await insert_telemetry_rows(one_row_batch)
                record_simulator_insert_success(row_count=1)
                await refresh_prometheus_telemetry_from_batch(one_row_batch)
            sim_state.current_index += 1
            note_loop_latency(loop_start)
            await asyncio.sleep(sim_state.interval_seconds)
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        sim_state.error = str(exc)
        logger.exception("Simulator task crashed")
        record_simulator_insert_failure()
    finally:
        stop_run()

async def refresh_prometheus_telemetry_from_batch(batch_rows: List[Dict[str, Any]]) -> None:
    if not batch_rows:
        return

    TELEMETRY_WRITES_TOTAL.inc(len(batch_rows))

    row_timestamps = [
        row["time"].timestamp()
        for row in batch_rows
        if row.get("time") is not None
    ]

    if row_timestamps:
        set_telemetry_latest_timestamp(max(row_timestamps))

    total_rows, latest_time = await get_telemetry_metrics_snapshot()
    set_telemetry_total_rows(total_rows)

    if latest_time is not None:
        set_telemetry_latest_timestamp(latest_time.timestamp())

async def replay_random_task() -> None:
    try:
        await ensure_table()
        sim_state.error = None
        device_memory: Dict[str, Dict[str, float]] = {}
        devices = select_random_devices()
        now_ts = time.time()

        for device in devices:
            device_name = device["device_name"]
            sim_state.device_next_due[device_name] = now_ts
            sim_state.device_status[device_name] = "initializing"

        while sim_state.running:
            if sim_state.paused:
                await asyncio.sleep(0.25)
                continue

            loop_start = time.perf_counter()
            cycle_now = datetime.now()
            cycle_ts = time.time()
            batch_rows: List[Dict[str, Any]] = []

            for device in devices:
                device_name = device["device_name"]
                if cycle_ts < sim_state.device_next_due.get(device_name, 0):
                    continue

                generated = generate_random_row(device, device_memory)
                row = await process_single_row(
                    now=cycle_now,
                    device_name=device_name,
                    base_temperature=generated["temperature"],
                    base_humidity=generated["humidity"],
                )
                if row:
                    batch_rows.append(row)

                jitter = random.uniform(-0.4, 0.4)
                sim_state.device_next_due[device_name] = cycle_ts + max(
                    0.5,
                    sim_state.interval_seconds + jitter,
                )

            if batch_rows:
                await insert_telemetry_rows(batch_rows)
                record_simulator_insert_success(row_count=len(batch_rows))
                await refresh_prometheus_telemetry_from_batch(batch_rows)

            note_loop_latency(loop_start)
            await asyncio.sleep(0.25)
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        sim_state.error = str(exc)
        logger.exception("Simulator task crashed")
        record_simulator_insert_failure()
    finally:
        set_simulator_state(
            running=False,
            paused=False,
            interval_seconds=0,
        )
        stop_run()
