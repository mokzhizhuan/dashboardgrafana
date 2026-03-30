import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FaultFormState,
  FaultSeverity,
  FeedbackTone,
} from "./AdminTypes";
import { parseIdList, splitDevicesInput } from "./adminSimulatorHelpers";
import {
  deleteTelemetryRows,
  getTelemetryRowCount,
  truncateTelemetry,
} from "./adminSimulatorApi";
import { useDeviceIntelligenceController } from "./useDeviceIntelligenceController";
import { useFaultWorkflowController } from "./useFaultWorkflowController";
import { useSimulatorRuntimeController } from "./useSimulatorRuntimeController";

export function useAdminSimulator() {
  const runtime = useSimulatorRuntimeController();

  const [actionMessage, setActionMessage] = useState("");
  const [messageType, setMessageType] = useState<FeedbackTone>("info");
  const [selectedFaultDevice, setSelectedFaultDevice] = useState<string | null>(
    null,
  );
  const [telemetryRowCount, setTelemetryRowCount] = useState<number | null>(null);
  const [deleteIdsInput, setDeleteIdsInput] = useState("");
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const [faultForm, setFaultForm] = useState<FaultFormState>({
    faultType: "high_temp",
    severity: "medium",
    targetDevicesText: "",
  });

  const setFeedback = useCallback(
    (tone: FeedbackTone, text: string) => {
      setMessageType(tone);
      runtime.setFeedback(tone, text);
    },
    [runtime],
  );

  const availableDevices = useMemo(
    () =>
      runtime.availableDevices.length
        ? runtime.availableDevices
        : Object.keys(runtime.status?.deviceStatus ?? {}),
    [runtime.availableDevices, runtime.status?.deviceStatus],
  );

  const refreshTelemetryRowCount = useCallback(async () => {
    try {
      const count = await getTelemetryRowCount();
      setTelemetryRowCount(count);
      return count;
    } catch (error) {
      console.error("Failed to load telemetry row count", error);
      setTelemetryRowCount(null);
      throw error;
    }
  }, []);

  useEffect(() => {
    refreshTelemetryRowCount().catch((error) => {
      console.error("Telemetry count refresh failed", error);
    });
  }, [refreshTelemetryRowCount]);

  const targetFaultForDevice = useCallback((device: string) => {
    setSelectedFaultDevice(device);
    setFaultForm((prev) => ({
      ...prev,
      targetDevicesText: device,
    }));
    setActionMessage(`Selected ${device} for fault targeting.`);
    window.setTimeout(() => setActionMessage(""), 2500);
  }, []);

  const updateFaultForm = useCallback(
    <K extends keyof FaultFormState>(key: K, value: FaultFormState[K]) => {
      setFaultForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setFaultSeverity = useCallback((severity: FaultSeverity) => {
    setFaultForm((prev) => ({ ...prev, severity }));
  }, []);

  const handleTargetDevicesBlur = useCallback(() => {
    const devices = splitDevicesInput(faultForm.targetDevicesText);
    const firstDevice = devices[0] ?? null;
    setSelectedFaultDevice(firstDevice);
  }, [faultForm.targetDevicesText]);

  const handleTruncateTelemetry = useCallback(async () => {
    setCleanupLoading(true);
    try {
      const result = await truncateTelemetry();
      const deletedCount = result?.deletedCount ?? 0;

      setDeleteIdsInput("");
      setFeedback(
        "success",
        `Telemetry table truncated. Removed ${deletedCount} row(s).`,
      );

      await Promise.all([refreshTelemetryRowCount(), runtime.refreshAll()]);
      return result;
    } catch (error) {
      console.error("Failed to truncate telemetry table", error);
      setFeedback("error", "Failed to truncate telemetry table.");
      throw error;
    } finally {
      setCleanupLoading(false);
    }
  }, [refreshTelemetryRowCount, runtime, setFeedback]);

  const handleDeleteSelectedTelemetry = useCallback(async () => {
    const ids = parseIdList(deleteIdsInput);

    if (!ids.length) {
      setFeedback("warning", "Enter one or more valid telemetry row IDs.");
      return null;
    }

    setCleanupLoading(true);
    try {
      const result = await deleteTelemetryRows(ids);
      const deletedCount = result?.deletedCount ?? 0;

      setDeleteIdsInput("");
      setFeedback("success", `Deleted ${deletedCount} telemetry row(s).`);

      await Promise.all([refreshTelemetryRowCount(), runtime.refreshAll()]);
      return result;
    } catch (error) {
      console.error("Failed to delete selected telemetry rows", error);
      setFeedback("error", "Failed to delete selected telemetry rows.");
      throw error;
    } finally {
      setCleanupLoading(false);
    }
  }, [deleteIdsInput, refreshTelemetryRowCount, runtime, setFeedback]);

  const loadTelemetryRowCount = useCallback(async () => {
    return refreshTelemetryRowCount();
  }, [refreshTelemetryRowCount]);

  const runDeleteTelemetryRows = useCallback(async () => {
    return handleDeleteSelectedTelemetry();
  }, [handleDeleteSelectedTelemetry]);

  const runTruncateTelemetry = useCallback(async () => {
    return handleTruncateTelemetry();
  }, [handleTruncateTelemetry]);

  const deviceIntel = useDeviceIntelligenceController({
    status: runtime.status,
    streamConnected: runtime.streamConnected,
    streamMode: runtime.streamMode,
    feedback: runtime.feedback,
    setFeedback,
  });

  const faultWorkflow = useFaultWorkflowController({
    faultForm,
    setFaultForm,
    status: runtime.status,
    availableDevices,
    selectedFaultDevice,
    setSelectedFaultDevice,
    setFeedback,
    setActionMessage,
    refreshAll: runtime.refreshAll,
    postAction: runtime.postAction,
  });

  const lastRow = runtime.status?.lastInsertedRow ?? null;
  const simSource = runtime.source;

  const bothLegacyAndFaultActive = Boolean(
    runtime.status?.legacyHighTempMode && runtime.status?.faultMode?.enabled,
  );

  const presetExecutionBlocked = Boolean(
    !runtime.status?.running || runtime.status?.paused,
  );

  const intelligence = {
    running: Boolean(runtime.status?.running),
    paused: Boolean(runtime.status?.paused),
    streamMode: runtime.streamMode,
    source: runtime.status?.source ?? runtime.source,
    deviceCount: runtime.status?.deviceCount ?? availableDevices.length,
    faultEnabled: Boolean(runtime.status?.faultMode?.enabled),
    legacyHighTempMode: Boolean(runtime.status?.legacyHighTempMode),
  };

  const backendMetrics = {
    rowsInserted: runtime.status?.rowsInserted ?? 0,
    rowsSkipped: runtime.status?.rowsSkipped ?? 0,
    faultRowsApplied: runtime.status?.faultRowsApplied ?? 0,
    offlineEvents: runtime.status?.offlineEvents ?? 0,
    currentIndex: runtime.status?.currentIndex ?? 0,
    totalRows: runtime.status?.totalRows ?? 0,
    lastInsertTime: runtime.status?.lastInsertTime ?? null,
    startedAt: runtime.status?.startedAt ?? null,
    stoppedAt: runtime.status?.stoppedAt ?? null,
    error: runtime.status?.error ?? null,
  };

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString();
  }, []);

  const formatAgo = useCallback((value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }, []);

  const formatDelay = useCallback((seconds?: number | null) => {
    if (seconds == null || Number.isNaN(seconds)) return "—";
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    return remain > 0 ? `${minutes}m ${remain}s` : `${minutes}m`;
  }, []);

  const formatRemaining = useCallback((seconds?: number | null) => {
    if (seconds == null || Number.isNaN(seconds)) return "—";
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    if (minutes < 60) return remain > 0 ? `${minutes}m ${remain}s` : `${minutes}m`;

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);

  const getHeartbeatLabel = useCallback((statusValue: string) => {
    const normalized = String(statusValue || "").toLowerCase();
    if (normalized.includes("offline")) return "offline";
    if (normalized.includes("stale")) return "stale";
    return "online";
  }, []);

  const getPillStyle = useCallback(
    (tone: "success" | "warning" | "danger" | "neutral") => {
      const styles = {
        success: {
          background: "rgba(34, 197, 94, 0.12)",
          color: "#166534",
          border: "1px solid rgba(34, 197, 94, 0.28)",
          borderRadius: 999,
          padding: "6px 12px",
          fontWeight: 800 as const,
        },
        warning: {
          background: "rgba(245, 158, 11, 0.12)",
          color: "#92400e",
          border: "1px solid rgba(245, 158, 11, 0.28)",
          borderRadius: 999,
          padding: "6px 12px",
          fontWeight: 800 as const,
        },
        danger: {
          background: "rgba(239, 68, 68, 0.12)",
          color: "#991b1b",
          border: "1px solid rgba(239, 68, 68, 0.28)",
          borderRadius: 999,
          padding: "6px 12px",
          fontWeight: 800 as const,
        },
        neutral: {
          background: "rgba(100, 116, 139, 0.12)",
          color: "#334155",
          border: "1px solid rgba(100, 116, 139, 0.28)",
          borderRadius: 999,
          padding: "6px 12px",
          fontWeight: 800 as const,
        },
      };

      return styles[tone];
    },
    [],
  );

  const getPresetButtonStyle = useCallback(
    (_preset: string) => getPillStyle("warning"),
    [getPillStyle],
  );

  const getStatusPill = useCallback(
    (statusValue: string) => {
      const normalized = String(statusValue || "").toLowerCase();
      if (normalized.includes("offline")) return getPillStyle("danger");
      if (normalized.includes("stale")) return getPillStyle("warning");
      return getPillStyle("success");
    },
    [getPillStyle],
  );

  const getDeviceRowStyle = useCallback(
    (row: { uiStatus?: string; isFaultTarget?: boolean }) => {
      if (row.isFaultTarget) {
        return {
          borderLeft: "4px solid #ef4444",
          background: "rgba(254, 242, 242, 0.9)",
        };
      }
      if (row.uiStatus === "offline") {
        return { borderLeft: "4px solid #ef4444" };
      }
      if (row.uiStatus === "stale") {
        return { borderLeft: "4px solid #f59e0b" };
      }
      return { borderLeft: "4px solid #22c55e" };
    },
    [],
  );

  return {
    ...runtime,
    ...deviceIntel,
    ...faultWorkflow,

    actionMessage,
    setActionMessage,
    messageType,
    setMessageType,

    selectedFaultDevice,
    setSelectedFaultDevice,
    targetFaultForDevice,

    faultForm,
    setFaultForm,
    updateFaultForm,
    setFaultSeverity,
    handleTargetDevicesBlur,

    availableDevices,

    telemetryRowCount,
    refreshTelemetryRowCount,
    deleteIdsInput,
    setDeleteIdsInput,
    cleanupLoading,
    handleTruncateTelemetry,
    handleDeleteSelectedTelemetry,

    loadTelemetryRowCount,
    runDeleteTelemetryRows,
    runTruncateTelemetry,

    lastRow,
    simSource,
    bothLegacyAndFaultActive,
    presetExecutionBlocked,
    intelligence,
    backendMetrics,

    getPillStyle,
    formatAgo,
    formatDateTime,
    formatDelay,
    formatRemaining,
    getHeartbeatLabel,
    getPresetButtonStyle,
    getDeviceRowStyle,
    getStatusPill,
  };
}