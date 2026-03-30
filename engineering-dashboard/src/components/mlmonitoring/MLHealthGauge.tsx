import React, { useMemo } from "react";
import type { MonitoringSeverity } from "./types";

type Props = {
  label: string;
  confidence: number;
  severity: MonitoringSeverity;
};

function getHealthScore(label: string, confidence: number) {
  const normalizedLabel = (label || "normal").toLowerCase();
  const confidencePct = Math.max(0, Math.min(1, confidence)) * 100;

  const penaltyByLabel: Record<string, number> = {
    normal: 8,
    misalignment: 28,
    imbalance: 38,
    "bearing fault": 52,
  };

  const severityPenalty = penaltyByLabel[normalizedLabel] ?? 35;
  const confidencePenalty = normalizedLabel === "normal" ? confidencePct * 0.08 : confidencePct * 0.35;

  return Math.max(0, Math.min(100, Math.round(100 - severityPenalty - confidencePenalty)));
}

function getSeverityMeta(severity: MonitoringSeverity) {
  switch (severity) {
    case "critical":
      return {
        className: "critical",
        title: "Critical",
        helper: "Immediate maintenance attention recommended.",
      };
    case "warning":
      return {
        className: "warning",
        title: "Warning",
        helper: "Monitor closely and inspect the machine soon.",
      };
    default:
      return {
        className: "normal",
        title: "Normal",
        helper: "Machine condition is stable based on current inference.",
      };
  }
}

export default function MLHealthGauge({ label, confidence, severity }: Props) {
  const score = useMemo(() => getHealthScore(label, confidence), [label, confidence]);
  const meta = getSeverityMeta(severity);
  const progress = Math.max(0, Math.min(100, score));

  return (
    <div className="panel-card ml-monitor-card">
      <div className="section-head">
        <div>
          <h3 className="panel-title">Machine Health Indicator</h3>
          <p className="panel-subtitle">High-level machine condition score derived from the latest ML prediction.</p>
        </div>
      </div>

      <div className="ml-health-layout">
        <div
          className={`ml-health-gauge ${meta.className}`}
          style={{
            background: `conic-gradient(var(--gauge-fill) ${progress * 3.6}deg, var(--gauge-track) 0deg)`,
          }}
        >
          <div className="ml-health-gauge-inner">
            <div className="ml-health-score">{score}</div>
            <div className="ml-health-score-label">System Score</div>
          </div>
        </div>

        <div className="ml-health-details">
          <div className="ml-health-pill-row">
              <span className={`status-pill ${meta.className}`}>{meta.title}</span>
            </div>

            <h4 className="ml-health-fault">
              {(label || "").toLowerCase() === "normal" ? "Healthy condition" : label || "No active label"}
            </h4>

            <div className="ml-health-confidence">
              Confidence {(Math.max(0, confidence) * 100).toFixed(1)}%
            </div>

            <p className="ml-health-note">{meta.helper}</p>
        </div>
      </div>
    </div>
  );
}
