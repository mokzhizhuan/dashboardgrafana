# prometheus_metrics.py
from time import perf_counter, time
from typing import Callable, Optional
import json
import os
import requests
from urllib.parse import quote
from urllib.request import Request as UrlRequest, urlopen
from fastapi import APIRouter, Request, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

router = APIRouter(prefix="/prometheus", tags=["prometheus"])
PROMETHEUS_BASE_URL = os.getenv("PROMETHEUS_BASE_URL", "http://prometheus:9090").rstrip("/")
PROMETHEUS_JOB_NAME = os.getenv("PROMETHEUS_JOB_NAME", "engineering-dashboard-fastapi")
PROMETHEUS_TIMEOUT_SECONDS = float(os.getenv("PROMETHEUS_TIMEOUT_SECONDS", "2.0"))
# -----------------------------
# App / HTTP metrics
# -----------------------------
APP_INFO = Gauge(
    "engineering_dashboard_app_info",
    "Static application info",
    ["app_name", "version"],
)

APP_UP = Gauge(
    "engineering_dashboard_app_up",
    "Application availability flag",
)

HTTP_REQUESTS_TOTAL = Counter(
    "engineering_dashboard_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "engineering_dashboard_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10),
)

# -----------------------------
# Telemetry metrics
# -----------------------------
TELEMETRY_WRITES_TOTAL = Counter(
    "engineering_dashboard_telemetry_writes_total",
    "Total telemetry rows written",
)

TELEMETRY_READS_TOTAL = Counter(
    "engineering_dashboard_telemetry_reads_total",
    "Total telemetry read requests",
    ["device"],
)

EXPORT_CSV_TOTAL = Counter(
    "engineering_dashboard_export_csv_total",
    "Total dashboard CSV export requests",
    ["device"],
)

TELEMETRY_TOTAL_ROWS = Gauge(
    "engineering_dashboard_telemetry_total_rows",
    "Total rows currently stored in telemetry table",
)

TELEMETRY_LATEST_TIMESTAMP_SECONDS = Gauge(
    "engineering_dashboard_latest_telemetry_timestamp_seconds",
    "Unix timestamp of the latest telemetry row",
)

TELEMETRY_QUERY_DURATION_SECONDS = Histogram(
    "engineering_dashboard_telemetry_query_duration_seconds",
    "Telemetry and export query duration in seconds",
    ["query_type"],
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5),
)

DB_OPERATION_FAILURES_TOTAL = Counter(
    "engineering_dashboard_db_operation_failures_total",
    "Total database operation failures",
    ["operation"],
)

# -----------------------------
# Simulator metrics
# -----------------------------
SIMULATOR_RUNNING = Gauge(
    "engineering_dashboard_simulator_running",
    "Whether simulator is running (1=yes, 0=no)",
)

SIMULATOR_PAUSED = Gauge(
    "engineering_dashboard_simulator_paused",
    "Whether simulator is paused (1=yes, 0=no)",
)

SIMULATOR_INTERVAL_SECONDS = Gauge(
    "engineering_dashboard_simulator_interval_seconds",
    "Current simulator interval in seconds",
)

SIMULATOR_ROWS_INSERTED_TOTAL = Counter(
    "engineering_dashboard_simulator_rows_inserted_total",
    "Total simulator-inserted rows",
)

SIMULATOR_INSERT_FAILURES_TOTAL = Counter(
    "engineering_dashboard_simulator_insert_failures_total",
    "Total simulator insert failures",
)

SIMULATOR_LAST_INSERT_TIMESTAMP_SECONDS = Gauge(
    "engineering_dashboard_simulator_last_insert_timestamp_seconds",
    "Unix timestamp of the last successful simulator insert",
)

SIMULATOR_TARGET_DEVICE_COUNT = Gauge(
    "engineering_dashboard_simulator_target_device_count",
    "Number of devices configured/targeted by simulator",
)

# -----------------------------
# Fault mode metrics
# -----------------------------
FAULT_MODE_ENABLED = Gauge(
    "engineering_dashboard_fault_mode_enabled",
    "Whether fault mode is active (1=yes, 0=no)",
)

FAULT_MODE_TARGET_DEVICES = Gauge(
    "engineering_dashboard_fault_mode_target_devices",
    "Number of target devices currently affected by fault mode",
)

FAULT_EVENTS_TOTAL = Counter(
    "engineering_dashboard_fault_events_total",
    "Total number of fault mode start/apply/stop events",
    ["event_type"],
)

FAULT_TYPE_INFO = Gauge(
    "engineering_dashboard_fault_type_info",
    "Current fault type info",
    ["fault_type"],
)

APP_INFO.labels(
    app_name="engineering-dashboard",
    version="1.0.0",
).set(1)

APP_UP.set(1)
SIMULATOR_RUNNING.set(0)
SIMULATOR_PAUSED.set(0)
SIMULATOR_INTERVAL_SECONDS.set(0)
SIMULATOR_TARGET_DEVICE_COUNT.set(0)
FAULT_MODE_ENABLED.set(0)
FAULT_MODE_TARGET_DEVICES.set(0)


def normalize_path(path: str) -> str:
    if not path:
        return "root"
    return path.replace("/", "_").strip("_") or "root"


async def prometheus_http_middleware(request: Request, call_next: Callable):
    method = request.method
    path = normalize_path(request.url.path)
    started = perf_counter()

    status_code = "500"

    try:
        response = await call_next(request)
        status_code = str(response.status_code)
        return response
    finally:
        duration = perf_counter() - started
        HTTP_REQUESTS_TOTAL.labels(
            method=method,
            path=path,
            status_code=status_code,
        ).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            method=method,
            path=path,
        ).observe(duration)


def record_db_failure(operation: str) -> None:
    DB_OPERATION_FAILURES_TOTAL.labels(operation=operation).inc()


def observe_query_duration(query_type: str, duration_seconds: float) -> None:
    TELEMETRY_QUERY_DURATION_SECONDS.labels(query_type=query_type).observe(duration_seconds)


def set_simulator_state(
    *,
    running: Optional[bool] = None,
    paused: Optional[bool] = None,
    interval_seconds: Optional[float] = None,
    target_device_count: Optional[int] = None,
) -> None:
    if running is not None:
        SIMULATOR_RUNNING.set(1 if running else 0)
    if paused is not None:
        SIMULATOR_PAUSED.set(1 if paused else 0)
    if interval_seconds is not None:
        SIMULATOR_INTERVAL_SECONDS.set(interval_seconds)
    if target_device_count is not None:
        SIMULATOR_TARGET_DEVICE_COUNT.set(target_device_count)


def record_simulator_insert_success(row_count: int = 1) -> None:
    if row_count > 0:
        SIMULATOR_ROWS_INSERTED_TOTAL.inc(row_count)
    SIMULATOR_LAST_INSERT_TIMESTAMP_SECONDS.set(time())


def record_simulator_insert_failure(count: int = 1) -> None:
    if count > 0:
        SIMULATOR_INSERT_FAILURES_TOTAL.inc(count)


def set_fault_state(
    *,
    enabled: Optional[bool] = None,
    target_devices: Optional[int] = None,
    fault_type: Optional[str] = None,
) -> None:
    if enabled is not None:
        FAULT_MODE_ENABLED.set(1 if enabled else 0)

    if target_devices is not None:
        FAULT_MODE_TARGET_DEVICES.set(target_devices)

    if fault_type is not None:
        for existing_type in ["none", "high_temp", "stuck_temp", "drift_up", "noisy", "offline"]:
            FAULT_TYPE_INFO.labels(fault_type=existing_type).set(0)
        FAULT_TYPE_INFO.labels(fault_type=fault_type).set(1)


def record_fault_event(event_type: str) -> None:
    FAULT_EVENTS_TOTAL.labels(event_type=event_type).inc()


def _gauge_value(metric: Gauge, labels: Optional[dict] = None) -> float:
    labels = labels or {}
    try:
        return float(metric.labels(**labels)._value.get())
    except Exception:
        try:
            return float(metric._value.get())
        except Exception:
            return 0.0


def _counter_total(metric: Counter, labels: Optional[dict] = None) -> float:
    labels = labels or {}
    try:
        return float(metric.labels(**labels)._value.get())
    except Exception:
        try:
            return float(metric._value.get())
        except Exception:
            return 0.0

def set_telemetry_latest_timestamp(timestamp_seconds: float) -> None:
    TELEMETRY_LATEST_TIMESTAMP_SECONDS.set(max(0.0, timestamp_seconds))

def set_telemetry_total_rows(total_rows: int) -> None:
    TELEMETRY_TOTAL_ROWS.set(max(0, total_rows))

def _histogram_summary(metric: Histogram, labels: dict) -> dict:
    try:
        child = metric.labels(**labels)
        count = float(child._count.get())
        total_sum = float(child._sum.get())
        average = total_sum / count if count > 0 else 0.0
        return {
            "count": count,
            "sum": total_sum,
            "avg": average,
        }
    except Exception:
        return {
            "count": 0.0,
            "sum": 0.0,
            "avg": 0.0,
        }

def _fetch_json(url: str) -> Optional[dict]:
    try:
        request = UrlRequest(
            url,
            headers={"Accept": "application/json"},
            method="GET",
        )
        with urlopen(request, timeout=PROMETHEUS_TIMEOUT_SECONDS) as response:
            payload = response.read().decode("utf-8")
            return json.loads(payload)
    except Exception:
        return None


def _prometheus_instant_query(expression: str) -> Optional[list]:
    encoded_query = quote(expression, safe="")
    url = f"{PROMETHEUS_BASE_URL}/api/v1/query?query={encoded_query}"
    payload = _fetch_json(url)
    if not payload or payload.get("status") != "success":
        return None

    data = payload.get("data", {})
    result = data.get("result", [])
    if isinstance(result, list):
        return result
    return None


def _prometheus_scalar_query(expression: str) -> Optional[float]:
    result = _prometheus_instant_query(expression)
    if not result:
        return None

    try:
        value = result[0].get("value")
        if not isinstance(value, list) or len(value) < 2:
            return None
        return float(value[1])
    except Exception:
        return None


def _prometheus_targets_summary(job_name: str):
    try:
        response = requests.get(f"{PROMETHEUS_BASE_URL}/api/v1/targets", timeout=5)
        response.raise_for_status()
        payload = response.json()

        active_targets = payload.get("data", {}).get("activeTargets", [])
        matched = [
            target for target in active_targets
            if target.get("labels", {}).get("job") == job_name
        ]

        targets_up = sum(1 for target in matched if target.get("health") == "up")
        targets_down = sum(1 for target in matched if target.get("health") != "up")

        return {
            "up": True,
            "job_found": len(matched) > 0,
            "targets_up": targets_up,
            "targets_down": targets_down,
            "last_error": None,
        }
    except Exception as exc:
        return {
            "up": False,
            "job_found": False,
            "targets_up": None,
            "targets_down": None,
            "last_error": str(exc),
        }


def _prometheus_job_metric_average(metric_name: str, job_name: str) -> Optional[float]:
    expression = f'avg({metric_name}{{job="{job_name}"}})'
    return _prometheus_scalar_query(expression)

@router.get("/metrics")
def get_metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@router.get("/metrics-data")
def prometheus_metrics_data(limit: int = 200):
    safe_limit = max(1, min(limit, 1000))

    raw_metrics = generate_latest()
    metrics_text = raw_metrics.decode("utf-8", errors="replace")

    lines = [line for line in metrics_text.splitlines() if line.strip()]

    return {
        "limit": safe_limit,
        "total_lines": len(lines),
        "returned_lines": min(len(lines), safe_limit),
        "lines": lines[:safe_limit],
        "text": "\n".join(lines[:safe_limit]),
    }

@router.get("/status")
def prometheus_status():
    return {
        "metrics_path": "/prometheus/metrics",
        "health_path": "/health",
        "app_up": True,
        "phase_1b": {
            "simulator_metrics": True,
            "fault_metrics": True,
            "db_metrics": True,
        },
    }


@router.get("/summary")
def prometheus_summary():
    telemetry_read_all = _counter_total(
        TELEMETRY_READS_TOTAL,
        {"device": "all"},
    )
    export_all = _counter_total(
        EXPORT_CSV_TOTAL,
        {"device": "all"},
    )
    read_hist = _histogram_summary(
        TELEMETRY_QUERY_DURATION_SECONDS,
        {"query_type": "telemetry_read"},
    )
    export_hist = _histogram_summary(
        TELEMETRY_QUERY_DURATION_SECONDS,
        {"query_type": "telemetry_export"},
    )
    latest_ts = _gauge_value(TELEMETRY_LATEST_TIMESTAMP_SECONDS)

    active_fault_type = "none"
    for fault_type in ["high_temp", "stuck_temp", "drift_up", "noisy", "offline", "none"]:
        if _gauge_value(FAULT_TYPE_INFO, {"fault_type": fault_type}) >= 1:
            active_fault_type = fault_type
            break

    simulator_running = _gauge_value(SIMULATOR_RUNNING) >= 1
    simulator_paused = _gauge_value(SIMULATOR_PAUSED) >= 1
    app_up = _gauge_value(APP_UP) >= 1

    db_failures_write = _counter_total(
        DB_OPERATION_FAILURES_TOTAL,
        {"operation": "telemetry_write"},
    )
    db_failures_read = _counter_total(
        DB_OPERATION_FAILURES_TOTAL,
        {"operation": "telemetry_read"},
    )
    db_failures_export = _counter_total(
        DB_OPERATION_FAILURES_TOTAL,
        {"operation": "telemetry_export"},
    )

    prometheus_targets = _prometheus_targets_summary(PROMETHEUS_JOB_NAME)
    scrape_duration = _prometheus_job_metric_average(
        "scrape_duration_seconds",
        PROMETHEUS_JOB_NAME,
    )
    scrape_samples = _prometheus_job_metric_average(
        "scrape_samples_post_metric_relabeling",
        PROMETHEUS_JOB_NAME,
    )

    return {
        "app": {
            "up": app_up,
            "metrics_path": "/prometheus/metrics",
            "summary_path": "/prometheus/summary",
        },
        "telemetry": {
            "writes_total": _counter_total(TELEMETRY_WRITES_TOTAL),
            "reads_all_total": telemetry_read_all,
            "export_all_total": export_all,
            "total_rows": _gauge_value(TELEMETRY_TOTAL_ROWS),
            "latest_timestamp_seconds": latest_ts,
            "latest_age_seconds": max(0.0, time() - latest_ts) if latest_ts > 0 else None,
            "read_query_avg_seconds": read_hist["avg"],
            "read_query_count": read_hist["count"],
            "export_query_avg_seconds": export_hist["avg"],
            "export_query_count": export_hist["count"],
        },
        "simulator": {
            "running": simulator_running,
            "paused": simulator_paused,
            "interval_seconds": _gauge_value(SIMULATOR_INTERVAL_SECONDS),
            "rows_inserted_total": _counter_total(SIMULATOR_ROWS_INSERTED_TOTAL),
            "insert_failures_total": _counter_total(SIMULATOR_INSERT_FAILURES_TOTAL),
            "last_insert_timestamp_seconds": _gauge_value(SIMULATOR_LAST_INSERT_TIMESTAMP_SECONDS),
            "target_device_count": _gauge_value(SIMULATOR_TARGET_DEVICE_COUNT),
        },
        "fault": {
            "enabled": _gauge_value(FAULT_MODE_ENABLED) >= 1,
            "target_devices": _gauge_value(FAULT_MODE_TARGET_DEVICES),
            "active_fault_type": active_fault_type,
            "start_events_total": _counter_total(FAULT_EVENTS_TOTAL, {"event_type": "start"}),
            "apply_events_total": _counter_total(FAULT_EVENTS_TOTAL, {"event_type": "apply"}),
            "stop_events_total": _counter_total(FAULT_EVENTS_TOTAL, {"event_type": "stop"}),
            "manual_high_temp_total": _counter_total(FAULT_EVENTS_TOTAL, {"event_type": "manual_high_temp"}),
            "manual_offline_gap_total": _counter_total(FAULT_EVENTS_TOTAL, {"event_type": "manual_offline_gap"}),
        },
        "database": {
            "failures_telemetry_write": db_failures_write,
            "failures_telemetry_read": db_failures_read,
            "failures_telemetry_export": db_failures_export,
        },
        "prometheus": {
            "base_url": PROMETHEUS_BASE_URL,
            "job_name": PROMETHEUS_JOB_NAME,
            "up": prometheus_targets.get("up"),
            "job_found": prometheus_targets.get("job_found"),
            "targets_up": prometheus_targets.get("targets_up"),
            "targets_down": prometheus_targets.get("targets_down"),
            "last_scrape_duration_seconds": scrape_duration,
            "scrape_samples": scrape_samples,
            "last_error": prometheus_targets.get("last_error"),
        },
    }