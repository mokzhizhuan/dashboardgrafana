import React, { useMemo } from "react";
import { formatConfidence, formatModelName, type PredictionHistoryItem } from "../MLTypeUtils";

type Props = {
  history: PredictionHistoryItem[];
};

export default function MLSummaryCards({ history }: Props) {
  const summary = useMemo(() => {
    const total = history.length;
    const latest = history[0];
    const averageConfidence =
      total === 0 ? null : history.reduce((sum, row) => sum + Number(row.confidence || 0), 0) / total;

    const byLabel = history.reduce<Record<string, number>>((acc, row) => {
      acc[row.predicted_label] = (acc[row.predicted_label] || 0) + 1;
      return acc;
    }, {});

    const byModel = history.reduce<Record<string, number>>((acc, row) => {
      acc[row.model_name] = (acc[row.model_name] || 0) + 1;
      return acc;
    }, {});

    const topFault = Object.entries(byLabel).sort((a, b) => b[1] - a[1])[0]?.[0] || "--";
    const mostUsedModel = Object.entries(byModel).sort((a, b) => b[1] - a[1])[0]?.[0] || "--";

    return {
      total,
      latestModel: latest ? formatModelName(latest.model_name) : "--",
      latestLabel: latest?.predicted_label || "--",
      averageConfidence,
      topFault,
      mostUsedModel: formatModelName(mostUsedModel),
    };
  }, [history]);

  return (
  <section className="ml-summary-shell">
    <div className="ml-summary-grid">
      <div className="ml-summary-card">
        <div className="ml-summary-label">Total Saved Tests</div>
        <div className="ml-summary-value">{summary.total}</div>
        <div className="ml-summary-helper">Prediction records stored</div>
      </div>

      <div className="ml-summary-card">
        <div className="ml-summary-label">Latest Model</div>
        <div className="ml-summary-value">{summary.latestModel}</div>
        <div className="ml-summary-helper">Most recent model used</div>
      </div>

      <div className="ml-summary-card">
        <div className="ml-summary-label">Latest Predicted Label</div>
        <div className="ml-summary-value">{summary.latestLabel}</div>
        <div className="ml-summary-helper">Latest classification output</div>
      </div>

      <div className="ml-summary-card">
        <div className="ml-summary-label">Average Confidence</div>
        <div className="ml-summary-value">
          {formatConfidence(summary.averageConfidence)}
        </div>
        <div className="ml-summary-helper">Mean model confidence</div>
      </div>

      <div className="ml-summary-card">
        <div className="ml-summary-label">Top Fault Type</div>
        <div className="ml-summary-value">{summary.topFault}</div>
        <div className="ml-summary-helper">Most frequent label</div>
      </div>

      <div className="ml-summary-card">
        <div className="ml-summary-label">Most Used Model</div>
        <div className="ml-summary-value">{summary.mostUsedModel}</div>
        <div className="ml-summary-helper">Most used ML model</div>
      </div>
    </div>
  </section>
);
}
