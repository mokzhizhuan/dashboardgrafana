from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, func
from sqlalchemy.dialects.postgresql import JSONB
from database import MainBase, MLBase


class Telemetry(MainBase):
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    time = Column(DateTime, nullable=False, server_default=func.now())
    device_name = Column(String, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)

class SensorRaw(MainBase):
    __tablename__ = "sensor_raw"

    id = Column(Integer, primary_key=True, index=True)
    ts = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    sensor_name = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)


class SensorFFT(MainBase):
    __tablename__ = "sensor_fft"

    id = Column(Integer, primary_key=True, index=True)
    fft_time = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    sensor_name = Column(String, nullable=False, index=True)
    frequency_hz = Column(Float, nullable=False)
    amplitude = Column(Float, nullable=False)


class MLPredictionTest(MLBase):
    __tablename__ = "ml_prediction_tests"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    model_name = Column(String(50), nullable=False)
    predicted_label = Column(String(100), nullable=False)
    confidence = Column(Float, nullable=True)

    rms = Column(Float, nullable=False)
    peak = Column(Float, nullable=False)
    kurtosis = Column(Float, nullable=False)
    skewness = Column(Float, nullable=False)
    crest_factor = Column(Float, nullable=False)
    fft_peak_freq = Column(Float, nullable=False)
    fft_peak_amp = Column(Float, nullable=False)

    probabilities_json = Column(JSONB, nullable=True)


class MLTrainingRun(MLBase):
    __tablename__ = "ml_training_runs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    model_name = Column(String(50), nullable=False)
    accuracy = Column(Float, nullable=True)

    dataset_path = Column(String, nullable=True)
    dataset_rows = Column(Integer, nullable=True)
    class_count = Column(Integer, nullable=True)

    model_file_path = Column(String, nullable=True)
    is_best = Column(Boolean, nullable=False, default=False)