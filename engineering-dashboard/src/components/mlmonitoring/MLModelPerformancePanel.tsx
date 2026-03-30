import React from "react";
import type { MonitoringPrediction } from "./types";

type Props = {
  history?: MonitoringPrediction[];
};

export default function MLModelPerformancePanel({ history = [] }: Props) {
  const stats: Record<string, { count: number; totalConfidence: number }> = {};

  history.forEach((item) => {
    if (!stats[item.model]) {
      stats[item.model] = { count: 0, totalConfidence: 0 };
    }

    stats[item.model].count += 1;
    stats[item.model].totalConfidence += item.confidence;
  });

  const rows = Object.entries(stats);

  return (
    <section className="ml-monitor-card">
      <h3 className="ml-monitor-card-title">Model Performance</h3>
      <p className="ml-monitor-card-subtitle">
        Latest predicted label, confidence, and risk status by model.
      </p>

      {rows.length === 0 ? (
        <div className="status-info">No model performance data available.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Model</th>
              <th>Predictions</th>
              <th>Avg Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([model, value]) => (
              <tr key={model}>
                <td>{model}</td>
                <td className="ml-number-cell">{value.count}</td>
                  <td className="ml-number-cell">
                    {((value.totalConfidence / value.count) * 100).toFixed(1)}%
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}