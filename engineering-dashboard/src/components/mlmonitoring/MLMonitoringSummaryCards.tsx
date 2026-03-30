import React from "react";
import type { MonitoringSummary } from "./types";

type Props = {
  summary: MonitoringSummary;
};

export default function MLMonitoringSummaryCards({ summary }: Props) {
  const healthClass =
    summary.currentHealth === "critical"
      ? "critical"
      : summary.currentHealth === "warning"
      ? "warning"
      : "normal";

  return (
    <section className="ml-monitor-summary-grid">

      <article className={`ml-monitor-stat ${healthClass}`}>
        <div className="ml-monitor-stat-label">Current Health</div>
        <div className="ml-monitor-stat-value">
          <span className={`status-pill ${healthClass}`}>
            {summary.currentHealth}
          </span>
        </div>
        <div className="ml-monitor-stat-helper">
          Latest ML system health state
        </div>
      </article>

      <article className="ml-monitor-stat">
        <div className="ml-monitor-stat-label">Active Fault</div>
        <div className="ml-monitor-stat-value">
          {summary.activeFault || "None"}
        </div>
        <div className="ml-monitor-stat-helper">
          Current predicted condition
        </div>
      </article>

      <article className="ml-monitor-stat">
        <div className="ml-monitor-stat-label">Prediction Confidence</div>
        <div className="ml-monitor-stat-value">
          {(summary.confidence * 100).toFixed(1)}%
        </div>
        <div className="ml-monitor-stat-helper">
          Latest model confidence
        </div>
      </article>

      <article className="ml-monitor-stat">
        <div className="ml-monitor-stat-label">Active Model</div>
        <div className="ml-monitor-stat-value">
          {summary.activeModel || "-"}
        </div>
        <div className="ml-monitor-stat-helper">
          Model used for inference
        </div>
      </article>

      <article className="ml-monitor-stat">
        <div className="ml-monitor-stat-label">Total Predictions</div>
        <div className="ml-monitor-stat-value">
          {summary.totalPredictions}
        </div>
        <div className="ml-monitor-stat-helper">
          Total ML inference events
        </div>
      </article>

      <article className="ml-monitor-stat">
        <div className="ml-monitor-stat-label">Alerts Today</div>
        <div className="ml-monitor-stat-value">
          {summary.totalAlertsToday}
        </div>
        <div className="ml-monitor-stat-helper">
          Non-normal predictions today
        </div>
      </article>

    </section>
  );
}