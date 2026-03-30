from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from database import ml_engine

router = APIRouter(prefix="/ml-monitoring", tags=["ML Monitoring Performance"])

MLSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ml_engine)


# ---------------------------------------------------------
# Small in-memory TTL cache
# ---------------------------------------------------------
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


def fetch_all_dicts(sql: str, params: Optional[dict] = None) -> List[dict]:
    db = MLSessionLocal()
    try:
        result = db.execute(text(sql), params or {})
        return [dict(row._mapping) for row in result]
    finally:
        db.close()


def fetch_one_dict(sql: str, params: Optional[dict] = None) -> dict:
    db = MLSessionLocal()
    try:
        result = db.execute(text(sql), params or {})
        row = result.first()
        return dict(row._mapping) if row else {}
    finally:
        db.close()


# ---------------------------------------------------------
# Summary cards endpoint
# ---------------------------------------------------------
@router.get("/summary")
def get_monitoring_summary():
    """
    Fast summary endpoint for dashboard cards.
    Adjust table names if your DB uses different names.
    """
    cache_key = "summary"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    sql = """
    SELECT
        COUNT(*) AS total_predictions,
        COALESCE(AVG(confidence), 0) AS avg_confidence,
        SUM(CASE WHEN LOWER(predicted_label) = 'fault' THEN 1 ELSE 0 END) AS fault_count,
        SUM(CASE WHEN LOWER(predicted_label) = 'normal' THEN 1 ELSE 0 END) AS normal_count,
        MAX(created_at) AS latest_prediction_time
    FROM ml_prediction_tests
    """

    data = fetch_one_dict(sql)

    total_predictions = int(data.get("total_predictions", 0) or 0)
    avg_confidence = float(data.get("avg_confidence", 0) or 0)
    fault_count = int(data.get("fault_count", 0) or 0)
    normal_count = int(data.get("normal_count", 0) or 0)

    health_score = round(max(0.0, 100.0 - (fault_count / total_predictions * 100.0)) if total_predictions else 100.0, 2)

    payload = {
        "totalPredictions": total_predictions,
        "avgConfidence": round(avg_confidence, 4),
        "faultCount": fault_count,
        "normalCount": normal_count,
        "latestPredictionTime": data.get("latest_prediction_time"),
        "currentHealth": health_score,
        "driftScore": round(max(0.0, min(100.0, 100.0 - avg_confidence * 100.0)), 2),
    }

    cache.set(cache_key, payload)
    return payload


# ---------------------------------------------------------
# Confidence / health trend
# ---------------------------------------------------------
@router.get("/health-trend")
def get_health_trend(limit: int = Query(default=50, ge=10, le=500)):
    cache_key = f"health_trend:{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    sql = """
    SELECT
        created_at,
        predicted_label,
        confidence
    FROM ml_prediction_tests 
    ORDER BY created_at DESC
    LIMIT :limit
    """

    rows = fetch_all_dicts(sql, {"limit": limit})
    rows.reverse()

    trend = []
    for row in rows:
        label = str(row.get("predicted_label", "") or "").lower()
        confidence = float(row.get("confidence", 0) or 0)

        health_score = 100.0
        if label == "fault":
            health_score = max(0.0, 100.0 - confidence * 100.0)
        elif label == "warning":
            health_score = max(0.0, 100.0 - confidence * 60.0)

        trend.append(
            {
                "time": row.get("created_at"),
                "predicted_label": row.get("predicted_label"),
                "confidence": round(confidence, 4),
                "health_score": round(health_score, 2),
            }
        )

    cache.set(cache_key, trend)
    return trend


# ---------------------------------------------------------
# Fault distribution
# ---------------------------------------------------------
@router.get("/fault-distribution")
def get_fault_distribution():
    cache_key = "fault_distribution"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    sql = """
    SELECT
        predicted_label,
        COUNT(*) AS value
    FROM ml_prediction_tests 
    GROUP BY predicted_label
    ORDER BY value DESC
    """

    rows = fetch_all_dicts(sql)
    cache.set(cache_key, rows)
    return rows


# ---------------------------------------------------------
# Model comparison
# ---------------------------------------------------------
@router.get("/model-comparison")
def get_model_comparison():
    cache_key = "model_comparison"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    sql = """
    SELECT
        model_name,
        accuracy,
        dataset_rows,
        class_count,
        created_at,
        is_best
    FROM ml_training_runs
    ORDER BY created_at DESC
    """

    rows = fetch_all_dicts(sql)
    cache.set(cache_key, rows)
    return rows


# ---------------------------------------------------------
# One combined endpoint for frontend
# ---------------------------------------------------------
@router.get("/dashboard")
def get_ml_monitoring_dashboard(limit: int = Query(default=50, ge=10, le=500)):
    return {
        "summary": get_monitoring_summary(),
        "healthTrend": get_health_trend(limit=limit),
        "faultDistribution": get_fault_distribution(),
        "modelComparison": get_model_comparison(),
    }


# ---------------------------------------------------------
# Manual cache reset if needed
# ---------------------------------------------------------
@router.post("/cache/clear")
def clear_dashboard_cache():
    cache.clear()
    return {"status": "ok", "message": "ML monitoring cache cleared"}