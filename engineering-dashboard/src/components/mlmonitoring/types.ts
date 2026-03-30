export type MonitoringSeverity = "normal" | "warning" | "critical";

export type MonitoringPrediction = {
  id: string;
  time: string;
  model: string;
  predictedLabel: string;
  confidence: number;
  healthStatus: MonitoringSeverity;
  recommendation: string;
};

export type MonitoringSummary = {
  currentHealth: MonitoringSeverity;
  activeFault: string;
  confidence: number;
  lastInferenceTime: string;
  activeModel: string;
  totalAlertsToday: number;
  totalPredictions: number;
  avgConfidence: number;
};

export type MonitoringModelResult = {
  model: string;
  predictedLabel: string;
  confidence: number;
  status: string;
};

export type MonitoringAlert = {
  id: string;
  time: string;
  severity: MonitoringSeverity;
  title: string;
  message: string;
  source: string;
  status: string;
};

export type MonitoringHistoryPoint = {
  time: string;
  confidence: number;
  predictedLabel: string;
  model: string;
};

export type DriftStatus = "stable" | "warning" | "critical";