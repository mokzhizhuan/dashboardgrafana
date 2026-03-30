import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from auth_router import require_admin
from .analytics import (
    compute_health_score,
    detect_anomalies_for_device,
    get_device_delay_seconds,
    get_latest_temp_for_device,
    health_band,
    predict_device_temperature,
    prediction_risk,
)
from prometheus_metrics import (
    record_fault_event,
    record_simulator_insert_success,
    set_fault_state,
    set_simulator_state,
    set_telemetry_latest_timestamp,
    set_telemetry_total_rows,
)
from .config import SIM_DEVICES
from .db import (
    delete_telemetry_rows,
    get_telemetry_metrics_snapshot,
    get_telemetry_row_count,
    insert_telemetry_row,
    truncate_telemetry_table,
)
from .faults import start_fault_state, validate_fault_request
from .helpers import get_default_sim_device_name, tracked_devices
from .models import (
    DeleteTelemetryRowsRequest,
    FaultStartRequest,
    SimulatorStartRequest,
    TruncateTableRequest
)
from .runtime import (
    prepare_run,
    refresh_prometheus_telemetry_from_batch,
    replay_csv_task,
    replay_random_task,
)
from .state import sim_state, stop_fault_state
from .utils import iso_now

router = APIRouter(prefix="/simulator", tags=["Simulator"])


def build_status_payload() -> Dict[str, Any]:
    return {
        "running": sim_state.running,
        "paused": sim_state.paused,
        "pausedAt": sim_state.paused_at,
        "csvFile": sim_state.csv_file,
        "interval": sim_state.interval_seconds,
        "loop": sim_state.loop,
        "rowsInserted": sim_state.rows_inserted,
        "rowsSkipped": sim_state.rows_skipped,
        "faultRowsApplied": sim_state.fault_rows_applied,
        "offlineEvents": sim_state.offline_events,
        "currentIndex": sim_state.current_index,
        "totalRows": sim_state.total_rows,
        "startedAt": sim_state.started_at,
        "stoppedAt": sim_state.stopped_at,
        "lastInsertTime": sim_state.last_insert_time,
        "lastInsertedRow": sim_state.last_inserted_row,
        "lastDevice": sim_state.last_device,
        "error": sim_state.error,
        "legacyHighTempMode": sim_state.force_high_temp,
        "faultMode": sim_state.fault_mode,
        "source": sim_state.source,
        "deviceLastSeen": sim_state.device_last_seen,
        "deviceStatus": sim_state.device_status,
        "deviceCount": sim_state.device_count,
    }


@router.get("/status")
async def simulator_status():
    return build_status_payload()


@router.get("/devices")
async def simulator_devices():
    return {"devices": SIM_DEVICES, "count": len(SIM_DEVICES)}


@router.get("/metrics")
async def simulator_metrics():
    uptime_seconds = None
    if sim_state.started_at and sim_state.running:
        started_dt = datetime.fromisoformat(sim_state.started_at)
        uptime_seconds = round((datetime.now() - started_dt).total_seconds(), 1)

    avg_loop_latency_ms = round(
        sim_state.total_loop_latency_ms / sim_state.loop_iterations,
        2,
    ) if sim_state.loop_iterations else 0.0

    inserts_per_minute = 0.0
    insert_rate_per_sec = 0.0
    if uptime_seconds and uptime_seconds > 0:
        insert_rate_per_sec = round(sim_state.rows_inserted / uptime_seconds, 2)
        inserts_per_minute = round(insert_rate_per_sec * 60, 2)

    stale_devices = 0
    offline_devices = 0
    stale_threshold = max(15, int(sim_state.interval_seconds) * 3)
    for device in tracked_devices():
        delay_sec = get_device_delay_seconds(device)
        status = sim_state.device_status.get(device)
        if status == "offline_simulated":
            offline_devices += 1
        elif delay_sec is not None and delay_sec > stale_threshold:
            stale_devices += 1

    return {
        "running": sim_state.running,
        "paused": sim_state.paused,
        "uptimeSeconds": uptime_seconds,
        "rowsInserted": sim_state.rows_inserted,
        "rowsSkipped": sim_state.rows_skipped,
        "faultRowsApplied": sim_state.fault_rows_applied,
        "offlineEvents": sim_state.offline_events,
        "lastDevice": sim_state.last_device,
        "currentIndex": sim_state.current_index,
        "totalRows": sim_state.total_rows,
        "insertRatePerSec": insert_rate_per_sec,
        "insertsPerMinute": inserts_per_minute,
        "avgLoopLatencyMs": avg_loop_latency_ms,
        "offlineDevices": offline_devices,
        "staleDevices": stale_devices,
        "source": sim_state.source,
        "deviceCount": sim_state.device_count,
    }


@router.get("/analytics/health")
async def analytics_health():
    payload = []
    for device in tracked_devices():
        delay_sec = get_device_delay_seconds(device)
        temp = get_latest_temp_for_device(device)
        score = compute_health_score(device, delay_sec, temp)
        payload.append(
            {
                "device": device,
                "health_score": score,
                "status": health_band(score),
                "delay_seconds": delay_sec,
                "temperature": temp,
                "device_status": sim_state.device_status.get(device, "unknown"),
            }
        )
    payload.sort(key=lambda x: (x["health_score"], x["device"]))
    return payload


@router.get("/analytics/anomalies")
async def analytics_anomalies():
    anomalies: List[Dict[str, Any]] = []
    for device in tracked_devices():
        anomalies.extend(
            detect_anomalies_for_device(
                device,
                get_device_delay_seconds(device),
                get_latest_temp_for_device(device),
            )
        )
    severity_order = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda x: (severity_order.get(x["severity"], 99), x["device"], x["type"]))
    return anomalies

async def refresh_telemetry_prometheus_after_cleanup() -> None:
    total_rows, latest_time = await get_telemetry_metrics_snapshot()
    set_telemetry_total_rows(total_rows)

    if latest_time is not None:
        set_telemetry_latest_timestamp(latest_time.timestamp())
    else:
        set_telemetry_latest_timestamp(0)



@router.get("/analytics/predictions")
async def analytics_predictions():
    payload = []
    for device in tracked_devices():
        delay_sec = get_device_delay_seconds(device)
        predicted_temp = await predict_device_temperature(device)
        payload.append(
            {
                "device": device,
                "predicted_temp": predicted_temp,
                "risk": prediction_risk(predicted_temp, delay_sec),
                "delay_seconds": delay_sec,
                "current_status": sim_state.device_status.get(device, "unknown"),
            }
        )
    risk_order = {"high": 0, "medium": 1, "low": 2, "unknown": 3}
    payload.sort(key=lambda x: (risk_order.get(x["risk"], 99), x["device"]))
    return payload


@router.get("/stream")
async def simulator_stream():
    async def event_generator():
        while True:
            yield f"data: {json.dumps(build_status_payload())}\n\n"
            await asyncio.sleep(1.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.post("/start")
async def start_simulator(
    req: Optional[SimulatorStartRequest] = None,
    current_user: dict = Depends(require_admin),
):
    if sim_state.running:
        raise HTTPException(status_code=400, detail="Simulator is already running")

    request = req or SimulatorStartRequest()
    prepare_run(request)
    set_simulator_state(
        running=True,
        paused=False,
        interval_seconds=sim_state.interval_seconds,
        target_device_count=sim_state.device_count,
    )
    sim_state.task = asyncio.create_task(
        replay_random_task() if request.source == "random" else replay_csv_task()
    )

    return {
        "message": "Simulator started",
        "running": True,
        "paused": False,
        "csvFile": sim_state.csv_file,
        "interval": sim_state.interval_seconds,
        "loop": sim_state.loop,
        "source": sim_state.source,
        "deviceCount": sim_state.device_count,
    }


@router.post("/pause")
async def pause_simulator(current_user: dict = Depends(require_admin)):
    if not sim_state.running:
        raise HTTPException(status_code=400, detail="Simulator is not running")
    if sim_state.paused:
        return {"message": "Simulator already paused", "running": True, "paused": True}

    sim_state.paused = True
    sim_state.paused_at = iso_now(datetime.now())
    set_simulator_state(paused=True, running=True)
    return {
        "message": "Simulator paused",
        "running": True,
        "paused": True,
        "pausedAt": sim_state.paused_at,
    }


@router.post("/resume")
async def resume_simulator(current_user: dict = Depends(require_admin)):
    if not sim_state.running:
        raise HTTPException(status_code=400, detail="Simulator is not running")
    if not sim_state.paused:
        return {"message": "Simulator already running", "running": True, "paused": False}

    sim_state.paused = False
    sim_state.paused_at = None
    set_simulator_state(paused=False, running=True)
    return {"message": "Simulator resumed", "running": True, "paused": False}


@router.post("/stop")
async def stop_simulator(current_user: dict = Depends(require_admin)):
    if not sim_state.running:
        return {"message": "Simulator already stopped", "running": False, "paused": False}

    sim_state.running = False
    sim_state.paused = False
    if sim_state.task:
        sim_state.task.cancel()
        sim_state.task = None
    sim_state.stopped_at = iso_now(datetime.now())
    set_simulator_state(
        running=False,
        paused=False,
        interval_seconds=0,
    )
    return {"message": "Simulator stopped", "running": False, "paused": False}


@router.post("/inject/high-temp")
async def inject_high_temp(current_user: dict = Depends(require_admin)):
    now = datetime.now()
    device_name = get_default_sim_device_name()
    temperature = 42.5
    humidity = 61.0
    await insert_telemetry_row(device_name, now, temperature, humidity)

    sim_state.rows_inserted += 1
    sim_state.last_insert_time = iso_now(now)
    sim_state.last_device = device_name
    sim_state.device_last_seen[device_name] = sim_state.last_insert_time
    sim_state.device_status[device_name] = "online"
    sim_state.last_inserted_row = {
        "device_name": device_name,
        "time": sim_state.last_insert_time,
        "temperature": temperature,
        "humidity": humidity,
        "faultApplied": "manual_high_temp",
        "skipped": False,
    }
    sim_state.fault_rows_applied += 1
    record_simulator_insert_success(row_count=1)
    await refresh_prometheus_telemetry_from_batch(
        [
            {
                "device_name": device_name,
                "time": now,
                "temperature": temperature,
                "humidity": humidity,
            }
        ]
    )
    record_fault_event("manual_high_temp")
    return {
        "message": "High temperature anomaly injected",
        "device_name": device_name,
        "time": sim_state.last_insert_time,
        "temperature": temperature,
        "humidity": humidity,
    }


@router.post("/inject/high-temp/start")
async def start_high_temp(current_user: dict = Depends(require_admin)):
    sim_state.force_high_temp = True
    return {"message": "High temp mode ON"}


@router.post("/inject/high-temp/stop")
async def stop_high_temp(current_user: dict = Depends(require_admin)):
    sim_state.force_high_temp = False
    return {"message": "High temp mode OFF"}


@router.post("/inject/offline-gap")
async def inject_offline_gap(current_user: dict = Depends(require_admin)):
    old_time = datetime.now() - timedelta(hours=2)
    device_name = get_default_sim_device_name()
    temperature = 24.8
    humidity = 57.2
    await insert_telemetry_row(device_name, old_time, temperature, humidity)
    record_simulator_insert_success(row_count=1)
    await refresh_prometheus_telemetry_from_batch(
        [
            {
                "device_name": device_name,
                "time": old_time,
                "temperature": temperature,
                "humidity": humidity,
            }
        ]
    )
    record_fault_event("manual_offline_gap")
    return {
        "message": "Offline gap row injected",
        "device_name": device_name,
        "time": iso_now(old_time),
        "temperature": temperature,
        "humidity": humidity,
    }


@router.post("/fault/start")
async def start_fault_mode(
    req: FaultStartRequest,
    current_user: dict = Depends(require_admin),
):
    fault_type, severity, target_devices = validate_fault_request(req)
    start_fault_state(fault_type, severity, target_devices, req.config)
    set_fault_state(
        enabled=True,
        target_devices=len(target_devices),
        fault_type=fault_type,
    )
    record_fault_event("start")
    return {"message": "Sustained fault mode started", "faultMode": sim_state.fault_mode}


@router.post("/fault/stop")
async def stop_fault_mode_route(current_user: dict = Depends(require_admin)):
    stop_fault_state()
    set_fault_state(
        enabled=False,
        target_devices=0,
        fault_type="none",
    )
    record_fault_event("stop")
    return {"message": "Sustained fault mode stopped", "faultMode": sim_state.fault_mode}


@router.get("/fault/status")
async def fault_status():
    return sim_state.fault_mode

@router.get("/admin/data/telemetry/count")
async def admin_get_telemetry_count(current_user: dict = Depends(require_admin)):
    count = await get_telemetry_row_count()
    return {"table": "telemetry", "rowCount": count}


@router.delete("/admin/data/telemetry/rows")
async def admin_delete_telemetry_rows(
    req: DeleteTelemetryRowsRequest,
    current_user: dict = Depends(require_admin),
):
    ids = sorted({int(x) for x in req.ids if int(x) > 0})
    if not ids:
        raise HTTPException(status_code=400, detail="No valid telemetry row ids provided")

    deleted = await delete_telemetry_rows(ids)
    await refresh_telemetry_prometheus_after_cleanup()

    return {
        "message": "Selected telemetry rows deleted",
        "table": "telemetry",
        "requestedCount": len(ids),
        "deletedCount": deleted,
    }


@router.post("/admin/data/telemetry/truncate")
async def admin_truncate_telemetry(
    req: TruncateTableRequest,
    current_user: dict = Depends(require_admin),
):
    if req.confirm.strip().upper() != "TRUNCATE":
        raise HTTPException(
            status_code=400,
            detail='Confirmation text must be "TRUNCATE"',
        )

    before_count = await get_telemetry_row_count()
    await truncate_telemetry_table()
    await refresh_telemetry_prometheus_after_cleanup()

    return {
        "message": "Telemetry table truncated",
        "table": "telemetry",
        "deletedCount": before_count,
        "identityReset": True,
    }