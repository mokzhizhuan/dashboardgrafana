import React, { useMemo, useState } from "react";
import {
  formatConfidence,
  formatModelName,
  formatTimestamp,
  getConfidenceTone,
  getLabelTone,
  type FeatureForm,
  type PredictionHistoryItem,
} from "../MLTypeUtils";

type Props = {
  history: PredictionHistoryItem[];
  loadingHistory: boolean;
  historyError: string;
  onReuseRow: (nextModel: string, nextForm: FeatureForm) => void;
};

export default function MLPredictionHistoryTable({
  history,
  loadingHistory,
  historyError,
  onReuseRow,
}: Props) {
  const [modelFilter, setModelFilter] = useState("all");
  const [labelFilter, setLabelFilter] = useState("all");
  const [search, setSearch] = useState("");

  const labels = useMemo(
    () =>
      Array.from(new Set(history.map((row) => row.predicted_label))).sort(),
    [history]
  );

  const filteredHistory = useMemo(() => {
    return history.filter((row) => {
      const matchModel = modelFilter === "all" || row.model_name === modelFilter;
      const matchLabel =
        labelFilter === "all" || row.predicted_label === labelFilter;
      const term = search.trim().toLowerCase();

      const matchSearch =
        term.length === 0 ||
        row.predicted_label.toLowerCase().includes(term) ||
        row.model_name.toLowerCase().includes(term) ||
        String(row.id).includes(term);

      return matchModel && matchLabel && matchSearch;
    });
  }, [history, labelFilter, modelFilter, search]);

  return (
    <section className="ml-history-shell">
      {historyError && <div className="status-error">{historyError}</div>}

      <div className="ml-history-toolbar">
        <input
          className="ml-history-search"
          placeholder="Search by ID, model, or predicted label"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="ml-history-select"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
        >
          <option value="all">All Models</option>
          <option value="xgboost">XGBoost</option>
          <option value="lightgbm">LightGBM</option>
          <option value="cnn">CNN</option>
        </select>

        <select
          className="ml-history-select"
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
        >
          <option value="all">All Labels</option>
          {labels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loadingHistory ? (
        <div className="table-loading-box">
          <div className="loading-inline">
            <span className="spinner" />
            <span>Loading ML history...</span>
          </div>
        </div>
      ) : (
        <div className="ml-history-table-wrap">
          <table className="data-table ml-history-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Time</th>
                <th>Model</th>
                <th>Predicted Label</th>
                <th>Confidence</th>
                <th>RMS</th>
                <th>Peak</th>
                <th>FFT Freq</th>
                <th>FFT Amp</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={10}>No saved ML prediction history yet</td>
                </tr>
              ) : (
                filteredHistory.map((row) => (
                  <tr key={row.id}>
                    <td data-label="ID">{row.id}</td>
                    <td data-label="Time">{formatTimestamp(row.created_at)}</td>
                    <td data-label="Model">
                      <span className="ml-badge tone-neutral">
                        {formatModelName(row.model_name)}
                      </span>
                    </td>
                    <td data-label="Predicted Label">
                      <span
                        className={`ml-badge tone-${getLabelTone(
                          row.predicted_label
                        )}`}
                      >
                        {row.predicted_label}
                      </span>
                    </td>
                    <td
                      data-label="Confidence"
                      className="ml-history-confidence-cell"
                    >
                      <div className="ml-history-confidence">
                        <span>{formatConfidence(row.confidence)}</span>
                        <div className="ml-progress-track compact">
                          <div
                            className={`ml-progress-fill tone-${getConfidenceTone(
                              row.confidence
                            )}`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, Number(row.confidence || 0) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td data-label="RMS">{row.rms}</td>
                    <td data-label="Peak">{row.peak}</td>
                    <td data-label="FFT Freq">{row.fft_peak_freq}</td>
                    <td data-label="FFT Amp">{row.fft_peak_amp}</td>
                    <td data-label="Action">
                      <button
                        className="ml-history-reuse-btn"
                        type="button"
                        onClick={() =>
                          onReuseRow(row.model_name, {
                            rms: String(row.rms),
                            peak: String(row.peak),
                            kurtosis: String(row.kurtosis),
                            skewness: String(row.skewness),
                            crest_factor: String(row.crest_factor),
                            fft_peak_freq: String(row.fft_peak_freq),
                            fft_peak_amp: String(row.fft_peak_amp),
                          })
                        }
                      >
                        Reuse
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}