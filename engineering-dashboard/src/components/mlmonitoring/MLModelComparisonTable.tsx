import React from "react";
import type { MonitoringModelResult } from "./types";

type Props = {
  rows?: MonitoringModelResult[];
};

export default function MLModelComparisonTable({ rows = [] }: Props) {
  return (
    <section className="ml-monitor-card">
  <h3 className="ml-monitor-card-title">Model Comparison</h3>
  <p className="ml-monitor-card-subtitle">
    Latest predicted label, confidence, and risk status by model.
  </p>
      {rows.length === 0 ? (
        <div className="status-info">No model comparison data available</div>
      ) : (
        <div className="ml-monitor-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Predicted Label</th>
                <th>Confidence</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.model}>
                  <td data-label="Model">{row.model}</td>
                  <td data-label="Predicted Label">
                    <span
                      className={`ml-table-badge ${
                        row.predictedLabel.toLowerCase().includes("normal")
                          ? "normal"
                          : row.predictedLabel.toLowerCase().includes("bearing")
                          ? "critical"
                          : "warning"
                      }`}
                    >
                      {row.predictedLabel}
                    </span>
                  </td>
                  <td data-label="Confidence" className="ml-number-cell">
                    {(row.confidence * 100).toFixed(1)}%
                  </td>
                  <td data-label="Status">
                    <span
                      className={`ml-table-badge ${
                        row.status === "High risk"
                          ? "critical"
                          : row.status === "Monitor"
                          ? "warning"
                          : "normal"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}