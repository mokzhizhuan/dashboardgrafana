import React from "react";
import {
  confidencePercent,
  formatConfidence,
  formatModelName,
  getConfidenceTone,
  getLabelTone,
  getRecommendation,
  type PredictionResult,
} from "../MLTypeUtils";

type Props = {
  result: PredictionResult | null;
};

export default function MLPredictionResultCard({ result }: Props) {
  if (!result) {
    return (
      <section className="panel-card">
        <div className="empty-state">No ML prediction result yet.</div>
      </section>
    );
  }

  const labelTone = getLabelTone(result.predicted_label);
  const confidenceTone = getConfidenceTone(result.confidence);
  const probabilityEntries = Object.entries(result.probabilities || {}).sort((a, b) => Number(b[1]) - Number(a[1]));

  return (
    <section className="panel-card">
      <div className="stats-grid ml-stats-grid">
        <div className="stat-card">
          <div className="stat-label">Model</div>
          <div className="stat-value">{formatModelName(result.model_name)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Model Class</div>
          <div className="stat-value">{result.model_class || "--"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Predicted Label</div>
          <div className="stat-value">{result.predicted_label || "--"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Confidence</div>
          <div className="stat-value">{formatConfidence(result.confidence)}</div>
        </div>
      </div>

      <div className="table-wrap" style={{ marginTop: 20 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Probability</th>
              <th>Confidence Bar</th>
            </tr>
          </thead>
          <tbody>
            {probabilityEntries.length === 0 ? (
              <tr>
                <td colSpan={3}>No probability output available</td>
              </tr>
            ) : (
              probabilityEntries.map(([label, prob]) => (
                <tr key={label}>
                  <td><span className={`ml-badge tone-${getLabelTone(label)}`}>{label}</span></td>
                  <td>{formatConfidence(Number(prob))}</td>
                  <td>
                    <div className="ml-progress-track compact">
                      <div
                        className={`ml-progress-fill tone-${getConfidenceTone(Number(prob))}`}
                        style={{ width: `${confidencePercent(Number(prob))}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
