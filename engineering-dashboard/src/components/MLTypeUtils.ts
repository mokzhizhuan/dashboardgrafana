export type PredictionResult = {
  predicted_label: string;
  confidence?: number | null;
  probabilities?: Record<string, number> | null;
  model_name?: string;
  model_class?: string;
};

export type PredictionHistoryItem = {
  id: number;
  created_at: string;
  model_name: string;
  predicted_label: string;
  confidence?: number | null;
  rms: number;
  peak: number;
  kurtosis: number;
  skewness: number;
  crest_factor: number;
  fft_peak_freq: number;
  fft_peak_amp: number;
  probabilities?: Record<string, number> | null;
};

export type FeatureForm = {
  rms: string;
  peak: string;
  kurtosis: string;
  skewness: string;
  crest_factor: string;
  fft_peak_freq: string;
  fft_peak_amp: string;
};

export const DEFAULT_FORM: FeatureForm = {
  rms: "",
  peak: "",
  kurtosis: "",
  skewness: "",
  crest_factor: "",
  fft_peak_freq: "",
  fft_peak_amp: "",
};

export function formatConfidence(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "N/A";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function confidencePercent(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.max(0, Math.min(100, Number(value) * 100));
}

export function formatModelName(model?: string) {
  if (!model) return "--";
  const normalized = model.toLowerCase();
  if (normalized === "xgboost") return "XGBoost";
  if (normalized === "lightgbm") return "LightGBM";
  if (normalized === "cnn") return "CNN";
  if (normalized === "randomforest") return "Random Forest";
  return model;
}

export function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function getRecommendation(label?: string) {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("bearing")) {
    return "Inspect bearing wear, lubrication condition, and vibration trend around the rotating assembly.";
  }
  if (normalized.includes("misalignment")) {
    return "Check shaft alignment, coupling condition, and mounting offsets before the next run.";
  }
  if (normalized.includes("unbalance") || normalized.includes("imbalance")) {
    return "Review rotor balance and look for uneven mass distribution or loosened rotating parts.";
  }
  if (normalized.includes("normal")) {
    return "No immediate fault indication. Continue monitoring and compare against the next incoming sample.";
  }
  return "Review the spectrum and recent raw trend together before confirming the maintenance action.";
}

export function getLabelTone(label?: string) {
  const normalized = (label || "").toLowerCase();
  if (normalized.includes("normal")) return "success";
  if (normalized.includes("bearing")) return "warning";
  if (normalized.includes("misalignment")) return "info";
  if (normalized.includes("unbalance") || normalized.includes("imbalance")) return "danger";
  return "neutral";
}

export function getConfidenceTone(value?: number | null) {
  const percent = confidencePercent(value);
  if (percent >= 70) return "success";
  if (percent >= 40) return "warning";
  return "danger";
}
