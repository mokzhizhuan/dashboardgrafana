import os
from typing import Any, Dict, Optional

import joblib
import numpy as np

try:
    import torch
    import torch.nn as nn
except ImportError:
    torch = None
    nn = None

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FEATURE_ORDER = [
    "rms",
    "peak",
    "kurtosis",
    "skewness",
    "crest_factor",
    "fft_peak_freq",
    "fft_peak_amp",
]

MODEL_PATHS = {
    "xgboost": os.path.join(BASE_DIR, "ml_models", "xgboost_fault.pkl"),
    "lightgbm": os.path.join(BASE_DIR, "ml_models", "lightgbm_fault.pkl"),
    "randomforest": os.path.join(BASE_DIR, "ml_models", "randomforest_fault.pkl"),
    "cnn": os.path.join(BASE_DIR, "ml_models", "cnn_fault.pth"),
}

ENCODER_PATH = os.path.join(BASE_DIR, "ml_models", "label_encoder.pkl")

_models: Dict[str, Any] = {}
_label_encoder = None


class FaultCNN(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()

        self.conv = nn.Sequential(
            nn.Conv1d(1, 16, 3, padding=1),
            nn.ReLU(),
            nn.Conv1d(16, 32, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
        )

        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(32, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )

    def forward(self, x):
        x = self.conv(x)
        x = self.fc(x)
        return x


def get_label_encoder():
    global _label_encoder

    if _label_encoder is None:
        if not os.path.exists(ENCODER_PATH):
            raise FileNotFoundError(f"Label encoder not found at: {ENCODER_PATH}")
        _label_encoder = joblib.load(ENCODER_PATH)

    return _label_encoder


def build_feature_array(features: Dict[str, float]) -> np.ndarray:
    try:
        row = [float(features[name]) for name in FEATURE_ORDER]
    except KeyError as e:
        raise ValueError(f"Missing required feature: {e}")

    return np.array([row], dtype=np.float32)


def build_cnn_tensor(features: Dict[str, float]):
    if torch is None:
        raise ImportError("PyTorch is not installed. Install torch to use CNN.")

    x = build_feature_array(features)  # shape: (1, 7)
    x_tensor = torch.tensor(x, dtype=torch.float32).unsqueeze(1)  # (1, 1, 7)
    return x_tensor


def get_fault_model(model_name: str):
    model_name = model_name.lower()

    if model_name not in MODEL_PATHS:
        raise ValueError(f"Unsupported model_name: {model_name}")

    if model_name in _models:
        return _models[model_name]

    model_path = MODEL_PATHS[model_name]

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model not found for '{model_name}' at: {model_path}"
        )

    if model_name == "cnn":
        if torch is None or nn is None:
            raise ImportError("PyTorch is required for CNN model loading.")

        encoder = get_label_encoder()
        num_classes = len(encoder.classes_)

        model = FaultCNN(num_classes=num_classes)
        state_dict = torch.load(model_path, map_location="cpu")
        model.load_state_dict(state_dict)
        model.eval()
        _models[model_name] = model
    else:
        _models[model_name] = joblib.load(model_path)

    return _models[model_name]


def get_model_info(model_name: str) -> Dict[str, str]:
    model = get_fault_model(model_name)
    return {
        "model_name": model_name,
        "model_class": model.__class__.__name__,
        "model_path": MODEL_PATHS[model_name],
    }


def decode_prediction_if_needed(model_name: str, prediction: Any) -> str:
    encoder = get_label_encoder()

    if model_name == "xgboost":
        decoded = encoder.inverse_transform([int(prediction)])[0]
        return str(decoded)

    if model_name == "cnn":
        decoded = encoder.inverse_transform([int(prediction)])[0]
        return str(decoded)

    return str(prediction)


def build_probabilities_if_needed(
    model_name: str,
    model: Any,
    probs: np.ndarray,
) -> Dict[str, float]:
    encoder = get_label_encoder()

    if model_name in {"xgboost", "cnn"}:
        class_names = [str(label) for label in encoder.inverse_transform(np.arange(len(probs)))]
    elif hasattr(model, "classes_"):
        class_names = [str(cls) for cls in model.classes_]
    else:
        class_names = [str(i) for i in range(len(probs))]

    return {
        class_name: float(prob)
        for class_name, prob in zip(class_names, probs)
    }


def predict_fault(model_name: str, features: Dict[str, float]) -> Dict[str, Any]:
    model_name = model_name.lower()
    model = get_fault_model(model_name)

    confidence: Optional[float] = None
    probabilities: Optional[Dict[str, float]] = None

    if model_name == "cnn":
        if torch is None:
            raise ImportError("PyTorch is not installed. Install torch to use CNN.")

        x_tensor = build_cnn_tensor(features)

        with torch.no_grad():
            logits = model(x_tensor)
            prob_tensor = torch.softmax(logits, dim=1)
            pred_idx = int(torch.argmax(prob_tensor, dim=1).item())
            probs = prob_tensor.squeeze(0).cpu().numpy()

        prediction = decode_prediction_if_needed(model_name, pred_idx)
        probabilities = build_probabilities_if_needed(model_name, model, probs)
        confidence = float(np.max(probs))

    else:
        x = build_feature_array(features)
        raw_prediction = model.predict(x)[0]
        prediction = decode_prediction_if_needed(model_name, raw_prediction)

        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(x)[0]
            probabilities = build_probabilities_if_needed(model_name, model, probs)
            confidence = float(np.max(probs))

    return {
        "predicted_label": prediction,
        "confidence": confidence,
        "probabilities": probabilities,
        "model_name": model_name,
        "model_class": model.__class__.__name__,
    }