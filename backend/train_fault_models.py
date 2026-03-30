import os

import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from lightgbm import LGBMClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from torch.utils.data import DataLoader, TensorDataset
from xgboost import XGBClassifier
from sklearn.ensemble import RandomForestClassifier

from database import MLSessionLocal
from models import MLTrainingRun

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATASET_PATH = os.path.join(BASE_DIR, "data", "fault_dataset.csv")

MODEL_DIR = os.path.join(BASE_DIR, "ml_models")
XGB_MODEL_PATH = os.path.join(MODEL_DIR, "xgboost_fault.pkl")
LGBM_MODEL_PATH = os.path.join(MODEL_DIR, "lightgbm_fault.pkl")
CNN_MODEL_PATH = os.path.join(MODEL_DIR, "cnn_fault.pth")
ENCODER_PATH = os.path.join(MODEL_DIR, "label_encoder.pkl")
RF_MODEL_PATH = os.path.join(MODEL_DIR, "randomforest_fault.pkl")

FEATURE_COLUMNS = [
    "rms",
    "peak",
    "kurtosis",
    "skewness",
    "crest_factor",
    "fft_peak_freq",
    "fft_peak_amp",
]

LABEL_COLUMN = "label"


class FaultCNN(nn.Module):
    def __init__(self, num_classes: int):
        super().__init__()

        self.conv = nn.Sequential(
            nn.Conv1d(1, 16, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.Conv1d(16, 32, kernel_size=3, padding=1),
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


def validate_dataset(df: pd.DataFrame) -> None:
    required = FEATURE_COLUMNS + [LABEL_COLUMN]
    missing = [c for c in required if c not in df.columns]

    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    if df.empty:
        raise ValueError("Dataset is empty.")

    if df[LABEL_COLUMN].nunique() < 2:
        raise ValueError("Dataset must contain at least 2 unique classes.")

    if df[FEATURE_COLUMNS].isnull().any().any():
        raise ValueError("Dataset contains missing values in feature columns.")

    if df[LABEL_COLUMN].isnull().any():
        raise ValueError("Dataset contains missing values in label column.")


def prepare_data(df: pd.DataFrame):
    X = df[FEATURE_COLUMNS].values.astype(np.float32)
    y_text = df[LABEL_COLUMN].astype(str)

    encoder = LabelEncoder()
    y_encoded = encoder.fit_transform(y_text)

    return X, y_text, y_encoded, encoder


def split_data(X, y_text, y_encoded):
    n_samples = len(X)
    n_classes = len(np.unique(y_text))

    if n_samples < 8:
        print(
            f"Warning: dataset is very small (samples={n_samples}, classes={n_classes}). "
            "Results may not be reliable."
        )

    test_size = max(0.2, n_classes / n_samples)

    if test_size >= 1:
        raise ValueError(
            f"Dataset too small to split safely: samples={n_samples}, classes={n_classes}"
        )

    estimated_test_count = max(1, int(round(n_samples * test_size)))
    stratify_value = y_text if estimated_test_count >= n_classes else None

    if stratify_value is None:
        print(
            "Falling back to non-stratified split because "
            f"estimated_test_count={estimated_test_count} < number_of_classes={n_classes}"
        )

    return train_test_split(
        X,
        y_text,
        y_encoded,
        test_size=test_size,
        random_state=42,
        stratify=stratify_value,
    )


def train_xgboost(X_train, X_test, y_train_enc, y_test_text, encoder):
    print("\n===== Training XGBoost =====")

    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        eval_metric="mlogloss",
        random_state=42,
    )

    model.fit(X_train, y_train_enc)

    preds_enc = model.predict(X_test)
    preds_text = encoder.inverse_transform(preds_enc)

    acc = accuracy_score(y_test_text, preds_text)

    print(f"XGBoost Accuracy: {acc:.4f}")
    print(classification_report(y_test_text, preds_text, zero_division=0))

    return model, acc


def train_lightgbm(X_train, X_test, y_train_text, y_test_text):
    print("\n===== Training LightGBM =====")

    model = LGBMClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=-1,
        random_state=42,
    )

    model.fit(X_train, y_train_text)

    preds_text = model.predict(X_test)
    acc = accuracy_score(y_test_text, preds_text)

    print(f"LightGBM Accuracy: {acc:.4f}")
    print(classification_report(y_test_text, preds_text, zero_division=0))

    return model, acc


def train_cnn(X_train, X_test, y_train_enc, y_test_text, encoder):
    print("\n===== Training CNN =====")

    device = torch.device("cpu")
    num_classes = len(encoder.classes_)

    model = FaultCNN(num_classes).to(device)

    X_train_tensor = torch.tensor(X_train, dtype=torch.float32).unsqueeze(1)
    X_test_tensor = torch.tensor(X_test, dtype=torch.float32).unsqueeze(1)
    y_train_tensor = torch.tensor(y_train_enc, dtype=torch.long)

    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    train_loader = DataLoader(train_dataset, batch_size=8, shuffle=True)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)

    epochs = 50

    model.train()
    for epoch in range(epochs):
        epoch_loss = 0.0

        for batch_x, batch_y in train_loader:
            batch_x = batch_x.to(device)
            batch_y = batch_y.to(device)

            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        if epoch % 10 == 0 or epoch == epochs - 1:
            print(f"Epoch {epoch + 1}/{epochs} - loss: {epoch_loss:.4f}")

    model.eval()
    with torch.no_grad():
        outputs = model(X_test_tensor.to(device))
        preds_enc = torch.argmax(outputs, dim=1).cpu().numpy()

    preds_text = encoder.inverse_transform(preds_enc)
    acc = accuracy_score(y_test_text, preds_text)

    print(f"CNN Accuracy: {acc:.4f}")
    print(classification_report(y_test_text, preds_text, zero_division=0))

    return model, acc


def save_training_runs_to_db(dataset_path, dataset_rows, class_count, scores):
    db = MLSessionLocal()
    try:
        best_model = max(scores, key=lambda x: x["accuracy"])

        for score in scores:
            row = MLTrainingRun(
                model_name=score["model_name"],
                accuracy=score["accuracy"],
                dataset_path=dataset_path,
                dataset_rows=dataset_rows,
                class_count=class_count,
                model_file_path=score["model_file_path"],
                is_best=(score["model_name"] == best_model["model_name"]),
            )
            db.add(row)

        db.commit()
        print("\nTraining results saved to ml_training_runs table.")
    finally:
        db.close()


def main():
    if not os.path.exists(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    validate_dataset(df)

    print(f"Dataset loaded: {DATASET_PATH}")
    print(f"Rows: {len(df)}")
    print(f"Classes: {sorted(df[LABEL_COLUMN].astype(str).unique().tolist())}")

    X, y_text, y_encoded, encoder = prepare_data(df)

    (
        X_train,
        X_test,
        y_train_text,
        y_test_text,
        y_train_enc,
        y_test_enc,
    ) = split_data(X, y_text, y_encoded)

    xgb_model, xgb_acc = train_xgboost(
        X_train,
        X_test,
        y_train_enc,
        y_test_text,
        encoder,
    )

    lgbm_model, lgbm_acc = train_lightgbm(
        X_train,
        X_test,
        y_train_text,
        y_test_text,
    )

    cnn_model, cnn_acc = train_cnn(
        X_train,
        X_test,
        y_train_enc,
        y_test_text,
        encoder,
    )
    rf_model, rf_acc = train_randomforest(
        X_train,
        X_test,
        y_train_text,
        y_test_text,
    )
    os.makedirs(MODEL_DIR, exist_ok=True)

    joblib.dump(xgb_model, XGB_MODEL_PATH)
    joblib.dump(lgbm_model, LGBM_MODEL_PATH)
    joblib.dump(encoder, ENCODER_PATH)
    joblib.dump(rf_model, RF_MODEL_PATH)
    torch.save(cnn_model.state_dict(), CNN_MODEL_PATH)

    print("\nSaved models:")
    print(XGB_MODEL_PATH)
    print(LGBM_MODEL_PATH)
    print(CNN_MODEL_PATH)
    print(ENCODER_PATH)

    scores = [
        {
            "model_name": "XGBoost",
            "accuracy": float(xgb_acc),
            "model_file_path": XGB_MODEL_PATH,
        },
        {
            "model_name": "LightGBM",
            "accuracy": float(lgbm_acc),
            "model_file_path": LGBM_MODEL_PATH,
        },
        {
            "model_name": "CNN",
            "accuracy": float(cnn_acc),
            "model_file_path": CNN_MODEL_PATH,
        },
        {
            "model_name": "RandomForest",
            "accuracy": float(rf_acc),
            "model_file_path": RF_MODEL_PATH,
        },
    ]

    save_training_runs_to_db(
        dataset_path=DATASET_PATH,
        dataset_rows=len(df),
        class_count=df[LABEL_COLUMN].nunique(),
        scores=scores,
    )

    best_model = max(scores, key=lambda x: x["accuracy"])
    print(f"\nBest model: {best_model['model_name']}")

def train_randomforest(X_train, X_test, y_train_text, y_test_text):
    print("\n===== Training Random Forest =====")

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=42,
    )

    model.fit(X_train, y_train_text)

    preds_text = model.predict(X_test)
    acc = accuracy_score(y_test_text, preds_text)

    print(f"Random Forest Accuracy: {acc:.4f}")
    print(classification_report(y_test_text, preds_text, zero_division=0))

    return model, acc


if __name__ == "__main__":
    main()
