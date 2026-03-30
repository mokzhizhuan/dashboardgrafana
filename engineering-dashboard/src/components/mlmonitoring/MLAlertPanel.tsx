import React from "react";

type AlertItem = {
  id: string;
  title: string;
  message: string;
  severity: "normal" | "warning" | "critical";
};

type Props = {
  alerts: AlertItem[];
};

export default function MLAlertPanel({ alerts }: Props) {
  const latestAlert = alerts[0];

  const healthStatus =
    latestAlert?.severity === "critical"
      ? "Critical"
      : latestAlert?.severity === "warning"
      ? "Monitor"
      : "Stable";

  const severityClass =
    latestAlert?.severity === "critical"
      ? "critical"
      : latestAlert?.severity === "warning"
      ? "warning"
      : "normal";

  return (
    <section className="ml-monitor-card">
      <h3 className="ml-monitor-card-title">System Health</h3>
      <p className="ml-monitor-card-subtitle">
        Current machine health overview, active alert state, and latest ML monitoring result.
      </p>

      <div className="ml-alert-grid">
        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">System Health</div>
          <div className="ml-alert-stat-value">0%</div>
        </article>

        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">Accuracy</div>
          <div className="ml-alert-stat-value">0%</div>
        </article>

        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">Active Model</div>
          <div className="ml-alert-stat-value">No model</div>
        </article>

        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">Health Status</div>
          <div className="ml-alert-stat-value">
            <span className={`status-pill ${severityClass}`}>{healthStatus}</span>
          </div>
        </article>

        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">Active Alerts</div>
          <div className="ml-alert-stat-value">{alerts.length}</div>
        </article>

        <article className="ml-alert-stat">
          <div className="ml-alert-stat-label">Latest Prediction</div>
          <div className="ml-alert-stat-value">
            {latestAlert?.title || "No prediction"}
          </div>
        </article>

        <article className="ml-alert-message-card">
          <div className="ml-alert-message-label">Latest Alert Message</div>
          <div className="ml-alert-message-text">
            {latestAlert?.message || "No active alerts"}
          </div>
        </article>
      </div>
    </section>
  );
}