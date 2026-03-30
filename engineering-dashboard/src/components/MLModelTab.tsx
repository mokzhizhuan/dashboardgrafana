import React, { useEffect, useMemo, useState } from "react";
import CollapsibleSection from "./CollapsibleSection";
import MLFeatureForm from "./MLFeatureForm";
import MLPredictionHistoryTable from "./mlmonitoring/MLPredictionHistoryTable";
import MLPredictionResultCard from "./mlmonitoring/MLPredictionResultCard";
import MLSummaryCards from "./mlmonitoring/MLSummaryCards";
import {
  DEFAULT_FORM,
  type FeatureForm,
  type PredictionHistoryItem,
  type PredictionResult,
} from "./MLTypeUtils";
import "./ml-ui.css";

const API_BASE = "http://localhost:8000";

type Props = {
  onOpenMonitoringDashboard?: () => void;
};

export default function MLModelTab({ onOpenMonitoringDashboard }: Props) {
  const [modelName, setModelName] = useState("xgboost");
  const [form, setForm] = useState(DEFAULT_FORM);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");

  const updateField = (key: keyof FeatureForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const payload = useMemo(
    () => ({
      rms: Number(form.rms),
      peak: Number(form.peak),
      kurtosis: Number(form.kurtosis),
      skewness: Number(form.skewness),
      crest_factor: Number(form.crest_factor),
      fft_peak_freq: Number(form.fft_peak_freq),
      fft_peak_amp: Number(form.fft_peak_amp),
    }),
    [form]
  );

  const isFormValid = useMemo(() => {
    return Object.values(form).every(
      (value) => value !== "" && !Number.isNaN(Number(value))
    );
  }, [form]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    setHistoryError("");

    try {
      const res = await fetch(`${API_BASE}/ml/predictions`);
      const data = await res.json();

      if (!res.ok) {
        const detail = data?.detail || "Prediction failed";

        if (typeof detail === "string" && detail.includes("state_dict")) {
          throw new Error(
            "CNN model is not aligned with the saved training weights. Please recheck backend model definition."
          );
        }

        throw new Error(detail);
      }

      setHistory(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setHistory([]);
      setHistoryError(err.message || "Failed to load ML history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handlePredict = async (saveToDb: boolean) => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      if (!isFormValid) {
        throw new Error("Please fill in all 7 feature fields with valid numbers.");
      }

      const endpoint = saveToDb
        ? `${API_BASE}/ml/predict/fault/${modelName}/save`
        : `${API_BASE}/ml/predict/fault/${modelName}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Prediction failed");
      }

      setResult(data);

      if (saveToDb) {
        await loadHistory();
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleFillSample = () => {
    setForm({
      rms: "0.8",
      peak: "1.2",
      kurtosis: "3.5",
      skewness: "0.2",
      crest_factor: "1.8",
      fft_peak_freq: "60",
      fft_peak_amp: "0.5",
    });
  };

  const handleReset = () => {
    setForm(DEFAULT_FORM);
    setResult(null);
    setError("");
  };

  const handleReuseRow = (nextModel: string, nextForm: FeatureForm) => {
    setModelName(nextModel);
    setForm(nextForm);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="ml-page-shell">
      <section className="ml-page-hero">
        <div className="ml-page-hero-text">
          <h2 className="ml-page-title">ML Engineering Console</h2>
          <p className="ml-page-subtitle">
            Manual testing workspace for ML fault prediction models, validation flow,
            and saved inference review before deployment to the monitoring console.
          </p>
        </div>

        <div className="ml-page-hero-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onOpenMonitoringDashboard}
          >
            Open Monitoring Console
          </button>
        </div>
      </section>

      <section className="ml-page-summary-strip">
        <div className="ml-page-summary-card">
          <div className="ml-page-summary-label">Active Model</div>
          <div className="ml-page-summary-value">{modelName}</div>
          <div className="ml-page-summary-helper">Current prediction model</div>
        </div>

        <div className="ml-page-summary-card">
          <div className="ml-page-summary-label">Saved Predictions</div>
          <div className="ml-page-summary-value">{history.length}</div>
          <div className="ml-page-summary-helper">Prediction history records</div>
        </div>

        <div className="ml-page-summary-card">
          <div className="ml-page-summary-label">Form Status</div>
          <div className="ml-page-summary-value">
            {isFormValid ? "Ready" : "Incomplete"}
          </div>
          <div className="ml-page-summary-helper">Feature input validation state</div>
        </div>

        <div className="ml-page-summary-card">
          <div className="ml-page-summary-label">History State</div>
          <div className="ml-page-summary-value">
            {loadingHistory ? "Loading" : "Stable"}
          </div>
          <div className="ml-page-summary-helper">Prediction history fetch status</div>
        </div>
      </section>

      <div className="ml-page-sections">
        <CollapsibleSection
          title="ML Model Test Console"
          subtitle="Engineering test console for validating ML models before deployment to the monitoring dashboard."
          defaultOpen={true}
        >
          <MLFeatureForm
            modelName={modelName}
            setModelName={setModelName}
            form={form}
            loading={loading}
            onUpdateField={updateField}
            onFillSample={handleFillSample}
            onReset={handleReset}
            onRefreshHistory={loadHistory}
            onPredict={handlePredict}
            isFormValid={isFormValid}
            loadingHistory={loadingHistory}
          />

          {error && <div className="status-error">{error}</div>}
        </CollapsibleSection>

        <CollapsibleSection
          title="Prediction Summary"
          subtitle="Quick ML monitoring stats from saved prediction history."
          defaultOpen={false}
        >
          <MLSummaryCards history={history} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Prediction Result"
          subtitle="Main output card with confidence, label highlight, and backend model details."
          defaultOpen={true}
        >
          <MLPredictionResultCard result={result} />
        </CollapsibleSection>

        <CollapsibleSection
          title="Saved Prediction History"
          subtitle="Cleaner history table with filters and quick reuse into the prediction form."
          defaultOpen={true}
          rightSlot={
            loadingHistory ? (
              <span className="loading-inline">
                <span className="spinner" />
                Loading history...
              </span>
            ) : null
          }
        >
          <MLPredictionHistoryTable
            history={history}
            loadingHistory={loadingHistory}
            historyError={historyError}
            onReuseRow={handleReuseRow}
          />
        </CollapsibleSection>
      </div>
    </div>
  );
}