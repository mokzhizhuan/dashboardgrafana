import React, { useEffect, useMemo, useState } from "react";

import MLAlertPanel from "./MLAlertPanel";
import MLHealthGauge from "./MLHealthGauge";
import MLModelComparisonTable from "./MLModelComparisonTable";
import MLMonitoringSummaryCards from "./MLMonitoringSummaryCards";
import MLConfidenceTrendChart from "./MLConfidenceTrendChart";
import MLFaultDistributionChart from "./MLFaultDistributionChart";
import MLModelPerformancePanel from "./MLModelPerformancePanel";
import MLDriftMonitor from "./MLDriftMonitor";

import type {
  MonitoringAlert,
  MonitoringModelResult,
  MonitoringPrediction,
  MonitoringSeverity,
  MonitoringSummary,
} from "./types";

import "./mlmonitoring.css";

const API_BASE = "http://localhost:8000";

/* -----------------------------
   Helpers
----------------------------- */

function normalizeConfidence(value: unknown) {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  if (num > 1) return Math.max(0, Math.min(1, num / 100));
  return Math.max(0, Math.min(1, num));
}

function inferSeverity(label: string, confidence: number): MonitoringSeverity {
  const normalized = (label || "").toLowerCase();

  if (normalized.includes("normal")) return "normal";
  if (normalized.includes("bearing") && confidence >= 0.4) return "critical";
  if (confidence >= 0.65) return "critical";

  return "warning";
}

function getRecommendation(label: string) {
  const normalized = (label || "").toLowerCase();

  if (normalized.includes("bearing"))
    return "Inspect bearing lubrication and vibration trend.";

  if (normalized.includes("misalignment"))
    return "Check shaft alignment and coupling condition.";

  if (normalized.includes("imbalance"))
    return "Inspect rotor balance and mass distribution.";

  return "Continue monitoring.";
}

function normalizePrediction(item: any, index: number): MonitoringPrediction {
  const predictedLabel =
    item.predicted_label ??
    item.prediction ??
    item.label ??
    item.fault_label ??
    "Unknown";

  const confidence = normalizeConfidence(
    item.confidence ??
      item.probability ??
      item.prediction_confidence ??
      item.max_probability
  );

  const model =
    item.model ?? item.model_name ?? item.model_used ?? "Unknown";

  const time =
    item.time ??
    item.created_at ??
    item.timestamp ??
    new Date().toISOString();

  const severity = inferSeverity(predictedLabel, confidence);

  return {
    id: String(item.id ?? `${model}-${time}-${index}`),
    time,
    model,
    predictedLabel,
    confidence,
    healthStatus: severity,
    recommendation:
      item.recommended_action ?? getRecommendation(predictedLabel),
  };
}

function buildSummary(predictions: MonitoringPrediction[]): MonitoringSummary {
  const latest = predictions[0];

  const avgConfidence =
    predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.confidence, 0) /
        predictions.length
      : 0;

  const alertsToday = predictions.filter(
    (p) => p.healthStatus !== "normal"
  ).length;

  return {
    currentHealth: latest?.healthStatus ?? "normal",
    activeFault: latest?.predictedLabel ?? "No data",
    confidence: latest?.confidence ?? 0,
    lastInferenceTime: latest?.time ?? "",
    activeModel: latest?.model ?? "-",
    totalAlertsToday: alertsToday,
    totalPredictions: predictions.length,
    avgConfidence,
  };
}

function buildModelComparison(
  predictions: MonitoringPrediction[] = []
): MonitoringModelResult[] {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return [];
  }

  const latestByModel = new Map<string, MonitoringPrediction>();

  predictions.forEach((item) => {
    if (!latestByModel.has(item.model)) {
      latestByModel.set(item.model, item);
    }
  });

  return Array.from(latestByModel.values()).map((item) => ({
    model: item.model,
    predictedLabel: item.predictedLabel,
    confidence: item.confidence,
    status:
      item.healthStatus === "critical"
        ? "High risk"
        : item.healthStatus === "warning"
        ? "Monitor"
        : "Stable",
  }));
}

function buildAlerts(predictions: MonitoringPrediction[]): MonitoringAlert[] {
  return predictions
    .filter((p) => p.healthStatus !== "normal")
    .slice(0, 5)
    .map((p, i) => ({
      id: `${p.id}-alert-${i}`,
      time: p.time,
      severity: p.healthStatus,
      title: `${p.predictedLabel} detected`,
      message: p.recommendation,
      source: p.model,
      status: "active",
    }));
}

/* -----------------------------
   Dashboard
----------------------------- */

type Props = {
  onBackToModels?: () => void;
};

export default function MLMonitoringDashboard({
  onBackToModels,
}: Props) {
  const [predictions, setPredictions] = useState<MonitoringPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/ml/predictions`);
        const raw = await res.json();

        if (!res.ok) {
          throw new Error(raw?.detail || "Failed loading ML predictions");
        }

        const normalized = (Array.isArray(raw) ? raw : []).map(
          normalizePrediction
        );

        normalized.sort(
          (a, b) =>
            new Date(b.time).getTime() -
            new Date(a.time).getTime()
        );

        if (active) setPredictions(normalized);
      } catch (err: any) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();

    const timer = setInterval(() => {
      if (autoRefresh) loadData();
    }, 10000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [autoRefresh]);

  const summary = useMemo(() => buildSummary(predictions), [predictions]);
  const latest = predictions[0] ?? null;
  const modelComparison = useMemo(
    () => buildModelComparison(predictions ?? []),
    [predictions]
  );

  const alerts = useMemo(
    () => buildAlerts(predictions ?? []),
    [predictions]
  );

  return (
    <div className={`stack-gap ml-monitor-shell ${loading ? "loading" : ""}`} style={{ position: "relative" }}>
      {/* Header */}

      <div className="ml-monitor-header-card">
        <div className="ml-monitor-header-row">
          <div className="ml-monitor-header-text">
            <h2 className="ml-monitor-title">ML Monitoring Console</h2>
            <p className="ml-monitor-subtitle">
              Industrial monitoring view for machine health, predictions, and ML model behaviour.
            </p>
          </div>

          <div className="ml-monitor-header-actions">
            <button
              type="button"
              className="ml-back-button"
              onClick={onBackToModels}
            >
              ← Back to ML Models
            </button>

            <label className="ml-monitor-toggle">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto refresh (10s)
            </label>
          </div>
        </div>

        {error && <div className="status-error">{error}</div>}
      </div>

      {/* KPI */}

      <MLMonitoringSummaryCards summary={summary} />

      {/* Health + Prediction */}

      <div className="ml-monitor-main-grid">
        <MLHealthGauge
          label={latest?.predictedLabel ?? "Normal"}
          confidence={latest?.confidence ?? 0}
          severity={latest?.healthStatus ?? "normal"}
        />

        <div className="ml-monitor-card">
          <h3 className="ml-monitor-card-title">Current Prediction</h3>
          <p className="ml-monitor-card-subtitle">
            Latest inference result and recommended operator action.
          </p>

          {loading ? (
            <div className="ml-monitor-empty">Loading latest inference...</div>
          ) : latest ? (
            <div className="ml-current-prediction">
              <div className="ml-current-row">
                <span className={`status-pill ${latest.healthStatus}`}>
                  {latest.predictedLabel}
                </span>
                <span className="ml-current-confidence-text">
                  Confidence {(latest.confidence * 100).toFixed(1)}%
                </span>
              </div>

              <div className="ml-current-row column">
                <span className="ml-current-label">Confidence</span>
                <div className="confidence-bar large">
                  <div
                    className="confidence-fill"
                    style={{ width: `${latest.confidence * 100}%` }}
                  />
                </div>
              </div>

              <div className="ml-current-row">
                <span className="ml-current-label">Model</span>
                <span>{latest.model}</span>
              </div>

              <div className="ml-current-recommendation">
                {latest.recommendation}
              </div>
            </div>
          ) : (
            <div className="ml-monitor-empty">No predictions yet.</div>
          )}
        </div>
      </div>

      {/* Charts */}

      <div className="monitoring-chart-grid">
        <MLConfidenceTrendChart history={predictions ?? []} />
        <MLFaultDistributionChart history={predictions ?? []} />
      </div>

      {/* Model analysis */}

      <div className="ml-monitor-bottom-grid">
        <MLModelComparisonTable rows={modelComparison ?? []} />
        <MLModelPerformancePanel history={predictions ?? []} />
      </div>

      {/* Alerts + Drift */}

      <div className="ml-monitor-final-grid">
        <MLAlertPanel alerts={alerts ?? []} />
        <MLDriftMonitor predictions={predictions ?? []} />
      </div>
    </div>
  );
}