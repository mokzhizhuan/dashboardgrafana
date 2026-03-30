from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter
from sqlalchemy import text

from database import MainSessionLocal

router = APIRouter(prefix="/performance", tags=["Performance"])


class TTLCache:
    def __init__(self, ttl_seconds: int = 5):
        self.ttl_seconds = ttl_seconds
        self._data: Dict[str, tuple[float, Any]] = {}

    def get(self, key: str):
        item = self._data.get(key)
        if not item:
            return None

        created_at, value = item
        if time.time() - created_at > self.ttl_seconds:
            self._data.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any):
        self._data[key] = (time.time(), value)

    def clear(self):
        self._data.clear()


cache = TTLCache(ttl_seconds=5)
AUTO_REFRESH_ENABLED = True
STALE_WARNING_SECONDS = 15
STALE_CRITICAL_SECONDS = 60


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def table_exists(db, table_name: str, schema_name: str = "public") -> bool:
    query = text(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = :schema_name
              AND table_name = :table_name
        )
        """
    )
    result = db.execute(
        query,
        {
            "schema_name": schema_name,
            "table_name": table_name,
        },
    )
    return bool(result.scalar())


def get_count(db, table_name: str) -> int:
    if not table_exists(db, table_name):
        return 0

    result = db.execute(text(f"SELECT COUNT(*) AS count FROM {table_name}"))
    row = result.first()
    return int(row[0]) if row and row[0] is not None else 0


def get_latest_timestamp(db, table_name: str) -> Optional[str]:
    ts_columns = {
        "telemetry": "time",
        "sensor_raw": "ts",
        "sensor_fft": "fft_time",
    }

    if not table_exists(db, table_name):
        return None

    column = ts_columns.get(table_name)
    if not column:
        return None

    try:
        result = db.execute(text(f"SELECT MAX({column}) AS latest_ts FROM {table_name}"))
        row = result.first()
        latest = row[0] if row else None
        if latest is None:
            return None
        return latest.isoformat() if hasattr(latest, "isoformat") else str(latest)
    except Exception:
        return None


def freshness_from_iso(last_refresh: Optional[str]) -> tuple[str, float | None]:
    if not last_refresh:
        return "stale", None

    try:
        parsed = datetime.fromisoformat(last_refresh.replace("Z", "+00:00"))
        age_seconds = max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds())
    except Exception:
        return "stale", None

    if age_seconds >= STALE_CRITICAL_SECONDS:
        return "stale", age_seconds
    if age_seconds >= STALE_WARNING_SECONDS:
        return "aging", age_seconds
    return "fresh", age_seconds


def build_runtime_row(
    module: str,
    table_name: str,
    row_count: int,
    latest_timestamp: Optional[str],
    table_available: bool,
    now_iso: str,
):
    if not table_available:
        return {
            "module": module,
            "status": "unavailable",
            "loading": False,
            "running": False,
            "lastUpdated": None,
            "notes": f"{table_name} table is not available yet",
            "rowCount": 0,
            "source": table_name,
        }

    if row_count > 0:
        return {
            "module": module,
            "status": "running",
            "loading": False,
            "running": True,
            "lastUpdated": latest_timestamp or now_iso,
            "notes": f"{row_count} rows available",
            "rowCount": row_count,
            "source": table_name,
        }

    return {
        "module": module,
        "status": "idle",
        "loading": False,
        "running": False,
        "lastUpdated": latest_timestamp or None,
        "notes": "Table is available but no data has been inserted yet",
        "rowCount": 0,
        "source": table_name,
    }


@router.get("/snapshot")
def get_performance_snapshot():
    cache_key = "snapshot"
    cached = cache.get(cache_key)
    if cached is not None:
        cached_copy = dict(cached)
        cached_copy["cacheHit"] = True
        return cached_copy

    request_started = time.perf_counter()
    db = MainSessionLocal()

    try:
        db_started = time.perf_counter()

        telemetry_exists = table_exists(db, "telemetry")
        raw_exists = table_exists(db, "sensor_raw")
        fft_exists = table_exists(db, "sensor_fft")

        telemetry_rows = get_count(db, "telemetry")
        raw_rows = get_count(db, "sensor_raw")
        fft_rows = get_count(db, "sensor_fft")

        telemetry_latest = get_latest_timestamp(db, "telemetry")
        raw_latest = get_latest_timestamp(db, "sensor_raw")
        fft_latest = get_latest_timestamp(db, "sensor_fft")

        db_query_ms = round((time.perf_counter() - db_started) * 1000, 2)
        now = utc_now_iso()

        available_timestamps = [
            ts for ts in [telemetry_latest, raw_latest, fft_latest] if ts
        ]
        latest_data_timestamp = max(available_timestamps) if available_timestamps else None

        freshness_source = latest_data_timestamp or now
        freshness, data_age_seconds = freshness_from_iso(freshness_source)

        total_rows = telemetry_rows + raw_rows + fft_rows
        available_table_count = sum([telemetry_exists, raw_exists, fft_exists])

        api_status = "healthy"
        ui_status = "ready"
        latest_status = "Healthy"

        if available_table_count == 0:
            api_status = "warning"
            ui_status = "warning"
            latest_status = "No monitoring tables"
        elif available_table_count < 3:
            api_status = "warning"
            ui_status = "warning"
            latest_status = "Partial data sources"
        elif total_rows == 0:
            api_status = "warning"
            ui_status = "warning"
            latest_status = "No Data"
        elif freshness == "aging":
            api_status = "warning"
            ui_status = "warning"
            latest_status = "Aging"
        elif freshness == "stale":
            api_status = "error"
            ui_status = "error"
            latest_status = "Stale"

        runtime = [
            build_runtime_row(
                module="Telemetry",
                table_name="telemetry",
                row_count=telemetry_rows,
                latest_timestamp=telemetry_latest,
                table_available=telemetry_exists,
                now_iso=now,
            ),
            build_runtime_row(
                module="Raw Sensor",
                table_name="sensor_raw",
                row_count=raw_rows,
                latest_timestamp=raw_latest,
                table_available=raw_exists,
                now_iso=now,
            ),
            build_runtime_row(
                module="FFT Engine",
                table_name="sensor_fft",
                row_count=fft_rows,
                latest_timestamp=fft_latest,
                table_available=fft_exists,
                now_iso=now,
            ),
        ]

        response_ms = round((time.perf_counter() - request_started) * 1000, 2)

        payload = {
            "telemetryRows": telemetry_rows,
            "rawRows": raw_rows,
            "fftRows": fft_rows,
            "autoRefresh": AUTO_REFRESH_ENABLED,
            "lastRefresh": now,
            "latestStatus": latest_status,
            "apiStatus": api_status,
            "uiStatus": ui_status,
            "runtime": runtime,
            "dataFreshness": freshness if latest_data_timestamp else "stale",
            "dataAgeSeconds": None if data_age_seconds is None else round(data_age_seconds, 2),
            "latestDataTimestamp": latest_data_timestamp,
            "apiResponseMs": response_ms,
            "dbQueryMs": db_query_ms,
            "cacheHit": False,
        }

        cache.set(cache_key, payload)
        return payload

    except Exception:
        response_ms = round((time.perf_counter() - request_started) * 1000, 2)
        return {
            "telemetryRows": 0,
            "rawRows": 0,
            "fftRows": 0,
            "autoRefresh": False,
            "lastRefresh": None,
            "latestStatus": "Backend unavailable",
            "apiStatus": "error",
            "uiStatus": "error",
            "runtime": [],
            "dataFreshness": "stale",
            "dataAgeSeconds": None,
            "latestDataTimestamp": None,
            "apiResponseMs": response_ms,
            "dbQueryMs": None,
            "cacheHit": False,
        }
    finally:
        db.close()


@router.post("/cache/clear")
def clear_performance_cache():
    cache.clear()
    return {"status": "ok", "message": "Performance cache cleared"}