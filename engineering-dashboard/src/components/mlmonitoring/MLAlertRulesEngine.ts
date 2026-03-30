import type { MonitoringAlert, MonitoringPrediction } from "./types";

export function generateAlerts(history: MonitoringPrediction[]): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];

  if (!history.length) return alerts;

  const latest = history[0];

  if (latest.predictedLabel !== "Normal" && latest.confidence > 0.7) {
    alerts.push({
      id: `critical-${latest.id}`,
      time: latest.time,
      severity: "critical",
      title: "High confidence fault detected",
      message: `${latest.predictedLabel} predicted with high confidence.`,
      source: latest.model,
      status: "active",
    });
  }

  const recentFaults = history
    .slice(0, 5)
    .filter((item) => item.predictedLabel !== "Normal");

  if (recentFaults.length >= 3) {
    alerts.push({
      id: `repeat-${latest.id}`,
      time: latest.time,
      severity: "warning",
      title: "Repeated fault predictions",
      message: "Multiple recent non-normal predictions detected.",
      source: latest.model,
      status: "active",
    });
  }

  return alerts;
}