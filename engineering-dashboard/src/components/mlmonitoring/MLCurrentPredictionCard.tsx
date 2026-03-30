import React from "react";
import { LatestPrediction } from "./types";

type Props = {
  prediction: LatestPrediction | null;
};

export default function MLCurrentPredictionCard({ prediction }: Props) {
  if (!prediction) {
    return (
      <div className="panel-card">
        <div className="panel-title">Current Prediction</div>
        <div className="status-info">No prediction available.</div>
      </div>
    );
  }

  const confidence = (prediction.confidence * 100).toFixed(1);

  const labelClass = prediction.predicted_label
    .toLowerCase()
    .replace(/\s/g, "-");

  return (
    <div className="panel-card prediction-card">
      <div className="panel-title">Current Prediction</div>

      <div className={`fault-badge ${labelClass}`}>
        {prediction.predicted_label}
      </div>

      <div className="prediction-confidence">
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${confidence}%` }}
          />
        </div>
        <span>{confidence}% confidence</span>
      </div>

      <div className="prediction-meta">
        <div>
          <strong>Model:</strong> {prediction.model}
        </div>

        <div>
          <strong>Last Inference:</strong>{" "}
          {new Date(prediction.time).toLocaleString()}
        </div>
      </div>

      <div className="prediction-action">
        <strong>Recommended Action:</strong>
        <div>{prediction.recommended_action}</div>
      </div>
    </div>
  );
}