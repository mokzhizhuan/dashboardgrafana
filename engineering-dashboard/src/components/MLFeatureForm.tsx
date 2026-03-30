import React from "react";
import type { FeatureForm } from "./MLTypeUtils";

type Props = {
  modelName: string;
  setModelName: React.Dispatch<React.SetStateAction<string>>;
  form: FeatureForm;
  loading: boolean;
  onUpdateField: (key: keyof FeatureForm, value: string) => void;
  onFillSample: () => void;
  onReset: () => void;
  onRefreshHistory: () => void;
  onPredict: (saveToDb: boolean) => Promise<void>;
  isFormValid: boolean;
  loadingHistory: boolean;
};

const featureGroups: Array<{
  title: string;
  subtitle: string;
  fields: Array<{ key: keyof FeatureForm; label: string; placeholder: string }>;
}> = [
  {
    title: "Statistical Features",
    subtitle: "Primary vibration indicators used by the prediction models.",
    fields: [
      { key: "rms", label: "RMS", placeholder: "e.g. 0.80" },
      { key: "peak", label: "Peak", placeholder: "e.g. 1.20" },
      { key: "kurtosis", label: "Kurtosis", placeholder: "e.g. 3.50" },
      { key: "skewness", label: "Skewness", placeholder: "e.g. 0.20" },
      { key: "crest_factor", label: "Crest Factor", placeholder: "e.g. 1.80" },
    ],
  },
  {
    title: "FFT Features",
    subtitle: "Dominant spectral response from the latest signal window.",
    fields: [
      { key: "fft_peak_freq", label: "FFT Peak Frequency", placeholder: "e.g. 60" },
      { key: "fft_peak_amp", label: "FFT Peak Amplitude", placeholder: "e.g. 0.50" },
    ],
  },
];

export default function MLFeatureForm({
  modelName,
  setModelName,
  form,
  loading,
  onUpdateField,
  onFillSample,
  onReset,
  onRefreshHistory,
  onPredict,
  isFormValid,
  loadingHistory,
}: Props) {
  return (
    <section className="panel-card">
     <div className="ml-form-topbar">
      <div>
        <h2 className="ml-feature-card-title">ML Fault Prediction</h2>
        <p className="ml-feature-card-subtitle">
          Test XGBoost, LightGBM, and CNN against the backend ML API with a cleaner operator flow.
        </p>
      </div>

      <div className="ml-form-topbar-right">
        <button className="ml-secondary-btn" type="button" onClick={onFillSample}>
          Fill Sample
        </button>
        <button className="ml-secondary-btn" type="button" onClick={onReset}>
          Reset
        </button>
        <button
          className="ml-secondary-btn"
          type="button"
          onClick={onRefreshHistory}
          disabled={loadingHistory}
        >
          {loadingHistory ? "Refreshing..." : "Refresh History"}
        </button>
      </div>
    </div>

      <div className="ml-form-shell">
        <div className="ml-form-left">
          <div className="ml-form-model-row">
            <label className="ml-field">
              <span className="ml-field-label">Model</span>
              <select
                className="ml-field-select"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={loading}
              >
              <option value="xgboost">XGBoost</option>
              <option value="lightgbm">LightGBM</option>
              <option value="cnn">CNN</option>
              <option value="randomforest">Random Forest</option>
            </select>
          </label>
        </div>
          {featureGroups.map((group) => (
            <div className="ml-section-block" key={group.title}>
              <div className="ml-section-title-row">
                <div>
                  <h3 className="ml-section-title">{group.title}</h3>
                  <p className="ml-section-subtitle">{group.subtitle}</p>
                </div>
              </div>

              <div className={group.fields.length > 2 ? "ml-feature-grid-5" : "ml-feature-grid-2"}>
                {group.fields.map((field) => (
                  <label key={field.key} className="ml-field">
                    <span className="ml-field-label">{field.label}</span>
                    <input
                      className="ml-field-input"
                      type="number"
                      step="any"
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => onUpdateField(field.key, e.target.value)}
                      disabled={loading}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="ml-predict-actions">
            <button
              className="action-btn"
              type="button"
              onClick={() => onPredict(false)}
              disabled={loading || !isFormValid}
            >
              {loading ? "Predicting..." : "Predict Only"}
            </button>

            <button
              className="ml-secondary-btn"
              type="button"
              onClick={() => onPredict(true)}
              disabled={loading || !isFormValid}
            >
              {loading ? "Saving..." : "Predict + Save"}
            </button>
          </div>
        </div>

        <div className="ml-preview-card">
          <div className="ml-side-summary-header">
            <h3 className="ml-preview-title">Live Feature Preview</h3>
            <p className="ml-preview-subtitle">Quick operator check before sending the request.</p>
          </div>

          <div className="ml-feature-preview-list">
            <div className="ml-preview-item"><span className="ml-preview-item-label">RMS</span><strong className="ml-preview-item-value">{form.rms || "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">Peak</span><strong className="ml-preview-item-value">{form.peak || "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">Kurtosis</span><strong className="ml-preview-item-value">{form.kurtosis || "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">Skewness</span><strong className="ml-preview-item-value">{form.skewness || "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">Crest Factor</span><strong className="ml-preview-item-value">{form.crest_factor || "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">FFT Peak Frequency</span><strong className="ml-preview-item-value">{form.fft_peak_freq ? `${form.fft_peak_freq} Hz` : "--"}</strong></div>
            <div className="ml-preview-item"><span className="ml-preview-item-label">FFT Peak Amplitude</span><strong className="ml-preview-item-value">{form.fft_peak_amp || "--"}</strong></div>
          </div>

          <div className="ml-preview-note">
            All seven numeric inputs must be filled before prediction is enabled.
          </div>
        </div>
      </div>
    </section>
  );
}
