from typing import List, Optional
import io , os

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from sqlalchemy import func, text
from sqlalchemy.orm import Session

import pandas as pd

from database import (
    MainSessionLocal,
    main_engine,
    MainBase,
    ml_engine,
    MLBase,
)
from prometheus_metrics import (
    router as prometheus_router,
    prometheus_http_middleware,
    TELEMETRY_WRITES_TOTAL,
    TELEMETRY_READS_TOTAL,
    EXPORT_CSV_TOTAL,
    TELEMETRY_TOTAL_ROWS,
    TELEMETRY_LATEST_TIMESTAMP_SECONDS,
    observe_query_duration,
    record_db_failure,
    set_telemetry_total_rows,
    set_telemetry_latest_timestamp,
)
from time import perf_counter
from models import Telemetry
from fft_routes import router as fft_router
from auth_router import router as auth_router
from routes.ml_routes import router as ml_router
from routes.ml_monitoring_perf_routes import router as ml_monitoring_perf_router
from routes.performance_routes import router as performance_router
from simulator import router as simulator_router
from telemetry_test import router as telemetry_router
#from routes.auth import router as auth_routers, init_auth_tables, seed_admin_if_missing

app = FastAPI(title="Main Grafana Monitoring Dashboard API")

origins = os.getenv(
    "CORS_ALLOW_ORIGINS",
    "http://localhost:5173,http://localhost:4173,http://localhost:3000,http://localhost:4000,http://localhost:9090,"
    "http://127.0.0.1:5173,http://127.0.0.1:4173,http://127.0.0.1:3000,http://127.0.0.1:4000,http://127.0.0.1:9090",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(prometheus_http_middleware)
app.include_router(fft_router)
app.include_router(ml_router)
app.include_router(ml_monitoring_perf_router)
app.include_router(performance_router)
app.include_router(telemetry_router)
app.include_router(simulator_router)
app.include_router(auth_router)
#app.include_router(auth_routers)

app.include_router(prometheus_router)

SGT = timezone(timedelta(hours=8))


class TelemetryIn(BaseModel):
    device_name: str = Field(..., min_length=1)
    temperature: float
    humidity: float


class TelemetryOut(BaseModel):
    time: str
    device_name: str
    temperature: float
    humidity: float

    class Config:
        from_attributes = True

class MainDashboardOptionsOut(BaseModel):
    telemetry_devices: List[str]
    sensors: List[str]

def get_db():
    db = MainSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_main_dashboard_options(db: Session) -> dict:
    telemetry_rows = db.execute(
        text(
            """
            SELECT DISTINCT device_name
            FROM telemetry
            WHERE device_name IS NOT NULL AND TRIM(device_name) <> ''
            ORDER BY device_name
            """
        )
    ).fetchall()

    sensor_rows = db.execute(
        text(
            """
            SELECT sensor_name
            FROM (
                SELECT DISTINCT sensor_name
                FROM sensor_raw
                WHERE sensor_name IS NOT NULL AND TRIM(sensor_name) <> ''
            ) AS distinct_sensors
            ORDER BY
                regexp_replace(sensor_name, '\d+$', '') ASC,
                COALESCE(NULLIF(substring(sensor_name FROM '(\d+)$'), ''), '0')::INTEGER ASC,
                sensor_name ASC
            """
        )
    ).fetchall()

    return {
        "telemetry_devices": [row[0] for row in telemetry_rows],
        "sensors": [row[0] for row in sensor_rows],
    }   

def refresh_telemetry_metrics(db: Session) -> None:
    total_rows = db.query(func.count(Telemetry.id)).scalar() or 0
    set_telemetry_total_rows(total_rows)

    latest_time = db.query(func.max(Telemetry.time)).scalar()
    if latest_time:
        if latest_time.tzinfo is None:
            latest_time = latest_time.replace(tzinfo=SGT)
        set_telemetry_latest_timestamp(latest_time.timestamp())
    else:
        set_telemetry_latest_timestamp(0)


@app.on_event("startup")
def initialize_app():
    try:
        MainBase.metadata.create_all(bind=main_engine)
    except Exception as exc:
        print(f"Failed to initialize main database tables: {exc}")

    try:
        MLBase.metadata.create_all(bind=ml_engine)
    except Exception as exc:
        print(f"Failed to initialize ML database tables: {exc}")

    db = MainSessionLocal()
    try:
        refresh_telemetry_metrics(db)
    except Exception as exc:
        record_db_failure("telemetry_read")
        print(f"Failed to initialize Prometheus telemetry metrics: {exc}")
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "FastAPI backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/main-dashboard/options", response_model=MainDashboardOptionsOut)
def main_dashboard_options(db: Session = Depends(get_db)):
    try:
        return get_main_dashboard_options(db)
    except Exception:
        record_db_failure("telemetry_read")
        raise

@app.post("/telemetry", response_model=TelemetryOut)
def add_telemetry(item: TelemetryIn, db: Session = Depends(get_db)):
    try:
        record = Telemetry(
            device_name=item.device_name,
            temperature=item.temperature,
            humidity=item.humidity,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        TELEMETRY_WRITES_TOTAL.inc()
        refresh_telemetry_metrics(db)

        return TelemetryOut(
            time=record.time.isoformat(timespec="seconds"),
            device_name=record.device_name,
            temperature=record.temperature,
            humidity=record.humidity,
        )
    except Exception:
        db.rollback()
        record_db_failure("telemetry_write")
        raise


@app.get("/telemetry", response_model=List[TelemetryOut])
def get_telemetry(
    device: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=5000),
    db: Session = Depends(get_db),
):
    started = perf_counter()

    try:
        query = db.query(Telemetry)

        if device:
            query = query.filter(Telemetry.device_name == device)

        rows = query.order_by(Telemetry.time.desc()).limit(limit).all()

        TELEMETRY_READS_TOTAL.labels(device=device or "all").inc()
        refresh_telemetry_metrics(db)

        return [
            TelemetryOut(
                time=row.time.isoformat(timespec="seconds"),
                device_name=row.device_name,
                temperature=row.temperature,
                humidity=row.humidity,
            )
            for row in rows
        ]
    except Exception:
        record_db_failure("telemetry_read")
        raise
    finally:
        observe_query_duration("telemetry_read", perf_counter() - started)


@app.get("/export/dashboard_csv")
def export_dashboard_csv(
    device: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    started = perf_counter()

    try:
        query = db.query(Telemetry)

        if device:
            query = query.filter(Telemetry.device_name == device)

        rows = query.order_by(Telemetry.time.asc()).all()

        EXPORT_CSV_TOTAL.labels(device=device or "all").inc()
        refresh_telemetry_metrics(db)

        data = [
            {
                "time": row.time.isoformat(timespec="seconds"),
                "device_name": row.device_name,
                "temperature": row.temperature,
                "humidity": row.humidity,
            }
            for row in rows
        ]

        df = pd.DataFrame(data)

        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)

        filename = f"{device or 'all_devices'}_dashboard_export.csv"

        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception:
        record_db_failure("telemetry_export")
        raise
    finally:
        observe_query_duration("telemetry_export", perf_counter() - started)