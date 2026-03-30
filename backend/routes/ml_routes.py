from typing import Dict, Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from services.ml_service import get_model_info, predict_fault
from database import MLSessionLocal
from models import MLPredictionTest 

router = APIRouter(prefix="/ml", tags=["ML Model"])


def get_db():
    db = MLSessionLocal()
    try:
        yield db
    finally:
        db.close()


class FaultInput(BaseModel):
    rms: float
    peak: float
    kurtosis: float
    skewness: float
    crest_factor: float
    fft_peak_freq: float
    fft_peak_amp: float


class FaultPredictionOut(BaseModel):
    predicted_label: str
    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None
    model_name: Optional[str] = None
    model_class: Optional[str] = None


@router.get("/health/{model_name}")
def ml_health(model_name: str):
    try:
        info = get_model_info(model_name)
        return {
            "status": "ok",
            "module": "ml",
            **info,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML health check failed: {e}")


@router.post("/predict/fault/{model_name}", response_model=FaultPredictionOut)
def predict_fault_route(model_name: str, data: FaultInput):
    try:
        return predict_fault(model_name, data.model_dump())
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
    
@router.post("/predict/fault/{model_name}/save", response_model=FaultPredictionOut)
def predict_fault_and_save(model_name: str, data: FaultInput, db: Session = Depends(get_db)):
    try:
        result = predict_fault(model_name, data.model_dump())

        row = MLPredictionTest(
            model_name=result["model_name"],
            predicted_label=result["predicted_label"],
            confidence=result.get("confidence"),
            rms=data.rms,
            peak=data.peak,
            kurtosis=data.kurtosis,
            skewness=data.skewness,
            crest_factor=data.crest_factor,
            fft_peak_freq=data.fft_peak_freq,
            fft_peak_amp=data.fft_peak_amp,
            probabilities_json=result.get("probabilities"),
        )

        db.add(row)
        db.commit()
        db.refresh(row)

        return result

    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")
    
@router.get("/predictions")
def get_prediction_history(db: Session = Depends(get_db)):
    rows = (
        db.query(MLPredictionTest)
        .order_by(MLPredictionTest.created_at.desc())
        .limit(50)
        .all()
    )

    return [
        {
            "id": row.id,
            "created_at": row.created_at,
            "model_name": row.model_name,
            "predicted_label": row.predicted_label,
            "confidence": row.confidence,
            "rms": row.rms,
            "peak": row.peak,
            "kurtosis": row.kurtosis,
            "skewness": row.skewness,
            "crest_factor": row.crest_factor,
            "fft_peak_freq": row.fft_peak_freq,
            "fft_peak_amp": row.fft_peak_amp,
            "probabilities": row.probabilities_json,
        }
        for row in rows
    ]