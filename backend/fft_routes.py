from datetime import datetime
from typing import List, Optional

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import MainSessionLocal

router = APIRouter(prefix="/fft", tags=["FFT"])


# -----------------------------
# Database session
# -----------------------------
def get_db():
    db = MainSessionLocal()
    try:
        yield db
    finally:
        db.close()


# -----------------------------
# Pydantic models
# -----------------------------
class RawSensorIn(BaseModel):
    sensor_name: str = Field(..., min_length=1)
    value: float
    ts: Optional[datetime] = None


class RawSensorOut(BaseModel):
    id: int
    ts: datetime
    sensor_name: str
    value: float


class FFTRunRequest(BaseModel):
    sensor_name: str = Field(..., min_length=1)
    sampling_rate: float = Field(..., gt=0)
    window_size: int = Field(256, gt=1)
    clear_old_fft: bool = True


class FFTPointOut(BaseModel):
    frequency_hz: float
    amplitude: float


class FFTRunResponse(BaseModel):
    sensor_name: str
    sample_count: int
    fft_points: int
    sampling_rate: float
    window_size: int
    fft_time: datetime


# -----------------------------
# Insert raw sensor point
# -----------------------------
@router.post("/raw", response_model=dict)
def insert_raw_sensor(data: RawSensorIn, db: Session = Depends(get_db)):
    insert_sql = text("""
        INSERT INTO sensor_raw (ts, sensor_name, value)
        VALUES (:ts, :sensor_name, :value)
        RETURNING id, ts, sensor_name, value
    """)

    row = db.execute(
        insert_sql,
        {
            "ts": data.ts or datetime.now(),
            "sensor_name": data.sensor_name,
            "value": data.value,
        },
    ).fetchone()

    db.commit()

    return {
        "message": "Raw sensor data inserted successfully",
        "data": {
            "id": row.id,
            "ts": row.ts,
            "sensor_name": row.sensor_name,
            "value": row.value,
        },
    }


# -----------------------------
# Read raw sensor points
# -----------------------------
@router.get("/raw", response_model=List[RawSensorOut])
def get_raw_sensor_data(
    sensor_name: str = Query(...),
    limit: int = Query(100, gt=0, le=5000),
    db: Session = Depends(get_db),
):
    query_sql = text("""
        SELECT id, ts, sensor_name, value
        FROM sensor_raw
        WHERE sensor_name = :sensor_name
        ORDER BY ts ASC
        LIMIT :limit
    """)

    rows = db.execute(
        query_sql,
        {"sensor_name": sensor_name, "limit": limit}
    ).fetchall()

    return [
        RawSensorOut(
            id=row.id,
            ts=row.ts,
            sensor_name=row.sensor_name,
            value=row.value,
        )
        for row in rows
    ]


# -----------------------------
# Run FFT from latest raw samples
# -----------------------------
@router.post("/run", response_model=FFTRunResponse)
def run_fft(req: FFTRunRequest, db: Session = Depends(get_db)):
    latest_samples_sql = text("""
        SELECT ts, value
        FROM sensor_raw
        WHERE sensor_name = :sensor_name
        ORDER BY ts DESC
        LIMIT :window_size
    """)

    rows = db.execute(
        latest_samples_sql,
        {
            "sensor_name": req.sensor_name,
            "window_size": req.window_size,
        },
    ).fetchall()

    if len(rows) < req.window_size:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough samples. Need {req.window_size}, got {len(rows)}."
        )

    rows = list(rows)[::-1]  # oldest to newest
    signal = np.array([float(r.value) for r in rows], dtype=float)

    # Remove DC offset
    signal = signal - np.mean(signal)

    # FFT
    fft_vals = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), d=1.0 / req.sampling_rate)
    amps = np.abs(fft_vals)

    fft_time = rows[-1].ts

    if req.clear_old_fft:
        delete_sql = text("""
            DELETE FROM sensor_fft
            WHERE sensor_name = :sensor_name
        """)
        db.execute(delete_sql, {"sensor_name": req.sensor_name})

    insert_fft_sql = text("""
        INSERT INTO sensor_fft (fft_time, sensor_name, frequency_hz, amplitude)
        VALUES (:fft_time, :sensor_name, :frequency_hz, :amplitude)
    """)

    for f, a in zip(freqs, amps):
        db.execute(
            insert_fft_sql,
            {
                "fft_time": fft_time,
                "sensor_name": req.sensor_name,
                "frequency_hz": float(f),
                "amplitude": float(a),
            },
        )

    db.commit()

    return FFTRunResponse(
        sensor_name=req.sensor_name,
        sample_count=len(signal),
        fft_points=len(freqs),
        sampling_rate=req.sampling_rate,
        window_size=req.window_size,
        fft_time=fft_time,
    )


# -----------------------------
# Read FFT spectrum
# -----------------------------
@router.get("/spectrum", response_model=List[FFTPointOut])
def get_fft_spectrum(
    sensor_name: str = Query(...),
    db: Session = Depends(get_db),
):
    query_sql = text("""
        SELECT frequency_hz, amplitude
        FROM sensor_fft
        WHERE sensor_name = :sensor_name
        ORDER BY frequency_hz ASC
    """)

    rows = db.execute(query_sql, {"sensor_name": sensor_name}).fetchall()

    return [
        FFTPointOut(
            frequency_hz=float(row.frequency_hz),
            amplitude=float(row.amplitude),
        )
        for row in rows
    ]