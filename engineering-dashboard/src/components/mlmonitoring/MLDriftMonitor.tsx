import React, { useMemo } from "react";
import type { DriftStatus, MonitoringPrediction } from "./types";

type Props = {
  predictions?: MonitoringPrediction[];
};

function calculateDriftScore(
  predictions: MonitoringPrediction[] = []
): {
  score: number;
  status: DriftStatus;
  recentCount: number;
  historicalCount: number;
} {
  if (!Array.isArray(predictions) || predictions.length < 10) {
    return {
      score: 0,
      status: "stable",
      recentCount: Math.min(predictions.length, 10),
      historicalCount: 0,
    };
  }

  const recent = predictions.slice(0, 10);
  const older = predictions.slice(10, 20);

  if (older.length === 0) {
    return {
      score: 0,
      status: "stable",
      recentCount: recent.length,
      historicalCount: 0,
    };
  }

  const recentAvg =
    recent.reduce((sum, p) => sum + p.confidence, 0) / recent.length;

  const olderAvg =
    older.reduce((sum, p) => sum + p.confidence, 0) / older.length;

  const drift = Math.abs(recentAvg - olderAvg);

  if (drift > 0.25) {
    return {
      score: drift,
      status: "critical",
      recentCount: recent.length,
      historicalCount: older.length,
    };
  }

  if (drift > 0.12) {
    return {
      score: drift,
      status: "warning",
      recentCount: recent.length,
      historicalCount: older.length,
    };
  }

  return {
    score: drift,
    status: "stable",
    recentCount: recent.length,
    historicalCount: older.length,
  };
}

export default function MLDriftMonitor({ predictions = [] }: Props) {
  const drift = useMemo(() => calculateDriftScore(predictions), [predictions]);
  const barClass = drift.status === "stable" ? "normal" : drift.status;

  return (
    <section className="ml-monitor-card ml-drift-card">
      <h3 className="ml-monitor-card-title">Model Drift Monitor</h3>
      <p className="ml-monitor-card-subtitle ml-drift-subtitle">
        Confidence drift between recent and historical inference windows.
      </p>

      <div className="ml-drift-body compact">
        <span className={`status-pill ${barClass}`}>
          {drift.status.toUpperCase()}
        </span>

        <div className="ml-drift-row">
          <span className="ml-drift-row-label">Drift Score</span>
          <span className="ml-drift-row-value">
            {(drift.score * 100).toFixed(1)}%
          </span>
        </div>

        <div className="confidence-bar large" aria-hidden="true">
          <div
            className="confidence-fill"
            style={{ width: `${Math.min(drift.score * 200, 100)}%` }}
          />
        </div>

        <div className="ml-drift-row">
          <span className="ml-drift-row-label">Recent Window</span>
          <span className="ml-drift-row-value">{drift.recentCount} items</span>
        </div>

        <div className="ml-drift-row">
          <span className="ml-drift-row-label">Historical Window</span>
          <span className="ml-drift-row-value">
            {drift.historicalCount} items
          </span>
        </div>
      </div>
    </section>
  );
}