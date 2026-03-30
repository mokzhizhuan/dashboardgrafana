import React from "react";

export type FaultType =
  | "high_temp"
  | "stuck_temp"
  | "drift_up"
  | "noisy"
  | "offline";

export type SeverityType = "low" | "medium" | "high";
export type FaultSeverity = SeverityType;

export type FeedbackTone = "info" | "success" | "error" | "warning";
export type MessageType = FeedbackTone;

export type SimulatorSource = "csv" | "random";
export type FaultPresetKey =
  | "hot_spike"
  | "sensor_freeze"
  | "drift_test"
  | "offline_drill";

export type StreamMode = "connecting" | "stream" | "polling";

export type FaultMode = {
  enabled: boolean;
  fault_type?: FaultType | null;
  target_devices?: string[];
  severity?: SeverityType;
  started_at?: string | null;
  config?: Record<string, unknown>;
};

export type SimulatorStatus = {
  running: boolean;
  paused?: boolean;
  pausedAt?: string | null;
  csvFile?: string | null;
  interval: number;
  loop?: boolean;
  rowsInserted: number;
  rowsSkipped?: number;
  faultRowsApplied?: number;
  offlineEvents?: number;
  currentIndex?: number;
  totalRows?: number;
  startedAt?: string | null;
  stoppedAt?: string | null;
  lastInsertTime?: string | null;
  lastInsertedRow?: {
    device_name?: string;
    time?: string;
    temperature?: number;
    humidity?: number;
    faultApplied?: string;
    skipped?: boolean;
  };
  lastDevice?: string | null;
  error?: string | null;
  legacyHighTempMode?: boolean;
  faultMode?: FaultMode;
  source?: SimulatorSource | string;
  deviceLastSeen?: Record<string, string | null>;
  deviceStatus?: Record<string, string>;
  deviceCount?: number;
};

export type FaultFormState = {
  faultType: FaultType;
  severity: FaultSeverity;
  targetDevicesText: string;
};

export type FeedbackState = {
  tone: FeedbackTone;
  text: string;
};

export type HeartbeatRow = {
  device: string;
  status: string;
  lastSeen: string | null;
  delaySec: number | null;
  uiStatus: "online" | "stale" | "offline";
  isFaultTarget?: boolean;
  isOfflineSimulated?: boolean;
  isLive?: boolean;
};

export type DeviceRow = {
  deviceName: string;
  uiStatus: "online" | "stale" | "offline";
  rawStatus: string;
  lastSeen: string | null;
  delaySec: number;
  delayText: string;
  lastSeenText: string;
  isFaultTarget: boolean;
  isOfflineSimulated: boolean;
  isLive: boolean;
  priority: number;
};

export type PillKind = "healthy" | "warning" | "critical" | "neutral";

export type HeaderChip = {
  label: string;
  kind: PillKind;
};

export type MetricCardItem = {
  label: string;
  value: React.ReactNode;
  valueStyle?: React.CSSProperties;
  hint?: React.ReactNode;
};

export type DetailCardItem = {
  label: string;
  value: React.ReactNode;
  valueStyle?: React.CSSProperties;
};