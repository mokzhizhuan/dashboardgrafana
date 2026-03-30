import React from "react";
import { Navigate } from "react-router-dom";
import "./Admin.css";
import { useAdminSimulator } from "./admin/useAdminSimulator";
import { isAdmin } from "../auth";
import SimulatorControlsPanel from "./admin/SimulatorControlsPanel";
import InjectionPanel from "./admin/InjectionPanel";
import LegacyPanel from "./admin/LegacyPanel";
import FaultModePanel from "./admin/FaultModePanel";
import SystemIntelligencePanel from "./admin/SystemIntelligencePanel";
import BackendMetricsPanel from "./admin/BackendMetricsPanel";
import DeviceIntelligencePanel from "./admin/DeviceIntelligencePanel";
import {
  DeviceHeartbeatSection,
  LastInsertedRowSection,
  FaultModeStatusSection,
} from "./admin/AdminSectionBlocks";

type ConfirmAction =
  | {
      kind:
        | "pause"
        | "stop"
        | "legacy-start"
        | "fault-start"
        | "clear-fault-targets"
        | "safe-reset"
        | "truncate-telemetry";
      title: string;
      body: string;
      confirmLabel: string;
      tone?: "warning" | "danger" | "info";
      onConfirm: () => void | Promise<void>;
    }
  | null;


  
export default function AdminTab() {
  if (!isAdmin()) {
    return <Navigate to="/login" replace />;
  }
  
  const {
    streamMode,
    status,
    loading,
    rate,
    feedback,
    clearFeedback,
    actionMessage,
    setActionMessage,
    messageType,
    setMessageType,
    intervalSeconds,
    setIntervalSeconds,
    faultType,
    setFaultType,
    faultDevicesInput,
    setFaultDevicesInput,
    faultSeverity,
    setFaultSeverity,
    availableDevices,
    deviceCount,
    setDeviceCount,
    deviceFilter,
    setDeviceFilter,
    deviceSort,
    setDeviceSort,
    deviceSearch,
    setDeviceSearch,
    deviceIntelCollapsed,
    setDeviceIntelCollapsed,
    showTopRiskOnly,
    setShowTopRiskOnly,
    selectedDevice,
    setSelectedDevice,
    copiedDevice,
    lastTargetedDevice,
    savedFaultPreset,
    savedFaultPresetSeverity,
    savedFaultPresetType,
    faultDrillUntil,
    faultDrillTimeoutRef,
    showFaultStartConfirm,
    pendingPresetStart,
    faultDrillRemainingSec,
    faultMode,
    lastRow,
    bothLegacyAndFaultActive,
    presetExecutionBlocked,
    simSource: currentSimSource,
    staleThresholdSec,
    intelligence,
    deviceIntelligenceRows,
    visibleDeviceRows,
    deviceCounts,
    backendMetrics,
    topRiskNames,
    faultTargetList,
    filteredVisibleDeviceNames,
    topRiskVisibleDeviceNames,
    activeFaultTargetNames,
    draftDiffersFromActiveFault,
    activeFaultAgeText,
    activeFaultPresetName,
    activeFaultVisibleTargets,
    activeFaultHiddenTargets,
    getPillStyle,
    formatAgo,
    fetchStatus,
    startSimulator,
    pauseSimulator,
    resumeSimulator,
    stopSimulator,
    injectHighTemp,
    startHighTempMode,
    stopHighTempMode,
    injectOfflineGap,
    startFaultMode,
    stopFaultMode,
    formatDateTime,
    formatDelay,
    formatRemaining,
    getHeartbeatLabel,
    heartbeatRows,
    copyDeviceName,
    targetFaultForDevice,
    isolateDevice,
    clearDeviceFocus,
    syncFaultDevicesInput,
    addFaultTargetChip,
    removeFaultTargetChip,
    clearFaultTargets,
    useFilteredDevicesAsTargets,
    useTopRiskDevicesAsTargets,
    useActiveFaultTargets,
    saveFaultDraftPreset,
    loadFaultDraftPreset,
    clearSavedFaultPreset,
    applySeverityPreset,
    applyFaultPreset,
    getPresetHint,
    getPresetButtonStyle,
    resetFaultDraft,
    cancelActiveDrill,
    applyPresetAndMaybeStart,
    confirmPendingPresetStart,
    cancelPendingPresetStart,
    getDeviceRowStyle,
    getStatusPill,
    source,
    setSource,
    csvFile,
    setCsvFile,
    telemetryRowCount,
    deleteIdsInput,
    setDeleteIdsInput,
    cleanupLoading,
    loadTelemetryRowCount,
    runDeleteTelemetryRows,
    runTruncateTelemetry,
  } = useAdminSimulator();
  const [confirmAction, setConfirmAction] = React.useState<ConfirmAction>(null);
  const [hiddenToastKeys, setHiddenToastKeys] = React.useState<string[]>([]);
const toastTimersRef = React.useRef<Record<string, number>>({});
  const legacyModeActive = Boolean(status?.legacyHighTempMode);
  const sustainedFaultActive = Boolean(faultMode?.enabled);
  const legacyFaultConflictKey = "legacy-fault-conflict";
  const hiddenDraftTargets = React.useMemo(() => {
    const visible = new Set(filteredVisibleDeviceNames);
    return faultTargetList.filter((name) => !visible.has(name));
  }, [faultTargetList, filteredVisibleDeviceNames]);
  const visibleDraftTargets = React.useMemo(() => {
    const visible = new Set(filteredVisibleDeviceNames);
    return faultTargetList.filter((name) => visible.has(name));
  }, [faultTargetList, filteredVisibleDeviceNames]);
  const operatorContextItems = React.useMemo(() => {
    return [
      {
        label: "Simulator",
        value: status?.running ? (status?.paused ? "Paused" : "Running") : "Stopped",
        tone: status?.running ? (status?.paused ? "warning" : "success") : "danger",
      },
      {
        label: "Stream",
        value:
          streamMode === "stream"
            ? "Stream"
            : streamMode === "connecting"
            ? "Reconnecting"
            : "Polling",
        tone:
          streamMode === "stream"
            ? "success"
            : streamMode === "connecting"
            ? "warning"
            : "warning",
      },
      {
        label: "Source",
        value: String(status?.source ?? currentSimSource).toUpperCase(),
        tone: "neutral",
      },
      {
        label: "Legacy Mode",
        value: legacyModeActive ? "Active" : "Inactive",
        tone: legacyModeActive ? "warning" : "neutral",
      },
      {
        label: "Fault Mode",
        value: sustainedFaultActive ? "Active" : "Inactive",
        tone: sustainedFaultActive ? "danger" : "neutral",
      },
      {
        label: "Fault Targets",
        value: `${faultTargetList.length} total • ${visibleDraftTargets.length} visible • ${hiddenDraftTargets.length} hidden`,
        tone: hiddenDraftTargets.length > 0 ? "warning" : "neutral",
      },
      {
        label: "Active Preset",
        value: activeFaultPresetName ? activeFaultPresetName.replaceAll("_", " ") : "None",
        tone: activeFaultPresetName ? "danger" : "neutral",
      },
      {
        label: "Drill",
        value:
          faultDrillRemainingSec && faultDrillRemainingSec > 0
            ? `${formatRemaining(faultDrillRemainingSec)} left`
            : "Inactive",
        tone:
          faultDrillRemainingSec && faultDrillRemainingSec > 0 ? "warning" : "neutral",
      },
    ];
  }, [
    status,
    currentSimSource,
    streamMode,
    legacyModeActive,
    sustainedFaultActive,
    faultTargetList.length,
    visibleDraftTargets.length,
    hiddenDraftTargets.length,
    activeFaultPresetName,
    faultDrillRemainingSec,
    formatRemaining,
  ]);
  const stickyWarnings = React.useMemo(() => {
    const warnings: { key: string; tone: "info" | "warning" | "danger"; text: string }[] = [];
    if (sustainedFaultActive) {
      warnings.push({
        key: "fault-active",
        tone: "danger",
        text: `FAULT ACTIVE${
          activeFaultPresetName ? `: ${activeFaultPresetName.replaceAll("_", " ")}` : ""
        }${
          activeFaultTargetNames?.length ? ` on ${activeFaultTargetNames.length} device(s)` : ""
        }.`,
      });
    }
    if (legacyModeActive) {
      warnings.push({
        key: "legacy-active",
        tone: "warning",
        text: "LEGACY HIGH TEMP MODE ACTIVE. This may dominate simulator output.",
      });
    }
    if (faultDrillRemainingSec && faultDrillRemainingSec > 0) {
      warnings.push({
        key: "drill-active",
        tone: "warning",
        text: `DRILL ACTIVE: ${formatRemaining(faultDrillRemainingSec)} remaining.`,
      });
    }
    if (streamMode === "polling") {
      warnings.push({
        key: "polling-fallback",
        tone: "info",
        text: "Live stream unavailable. AdminTab is using polling fallback.",
      });
    }
    if (streamMode === "connecting") {
      warnings.push({
        key: "reconnecting",
        tone: "info",
        text: "Realtime stream reconnect in progress.",
      });
    }
    return warnings;
  }, [
    sustainedFaultActive,
    activeFaultPresetName,
    activeFaultTargetNames,
    legacyModeActive,
    faultDrillRemainingSec,
    formatRemaining,
    streamMode,
  ]);
  const warningToasts = React.useMemo(() => {
  const items = [...stickyWarnings];
  if (bothLegacyAndFaultActive) {
    items.push({
      key: legacyFaultConflictKey,
      tone: "info" as const,
      text:
        "Legacy high temp mode and sustained fault mode are both active. Legacy mode may dominate the inserted simulator output depending on backend replay logic.",
    });
  }
  return items;
}, [stickyWarnings, bothLegacyAndFaultActive, legacyFaultConflictKey]);
  React.useEffect(() => {
  const activeKeys = new Set(warningToasts.map((toast) => toast.key));
  setHiddenToastKeys((prev) => prev.filter((key) => activeKeys.has(key)));
  warningToasts.forEach((toast) => {
    if (hiddenToastKeys.includes(toast.key)) return;
    if (toastTimersRef.current[toast.key]) return;
    const timer = window.setTimeout(() => {
      setHiddenToastKeys((prev) =>
        prev.includes(toast.key) ? prev : [...prev, toast.key]
      );
      delete toastTimersRef.current[toast.key];
    }, 5000);

    toastTimersRef.current[toast.key] = timer;
  });
  Object.keys(toastTimersRef.current).forEach((key) => {
    if (!activeKeys.has(key)) {
      window.clearTimeout(toastTimersRef.current[key]);
      delete toastTimersRef.current[key];
    }
  });
  return undefined;
}, [warningToasts, hiddenToastKeys]);
const dismissToast = (key: string) => {
  setHiddenToastKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  if (toastTimersRef.current[key]) {
    window.clearTimeout(toastTimersRef.current[key]);
    delete toastTimersRef.current[key];
  }
};
  const openConfirmation = (config: ConfirmAction) => {
    setConfirmAction(config);
  };
  const closeConfirmation = () => {
    setConfirmAction(null);
  };
  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    await confirmAction.onConfirm();
    setConfirmAction(null);
  };
  const guardedPauseSimulator = async () => {
    if (faultDrillRemainingSec && faultDrillRemainingSec > 0) {
      openConfirmation({
        kind: "pause",
        title: "Pause simulator during active drill?",
        body: `A timed drill is still running with ${formatRemaining(
          faultDrillRemainingSec
        )} remaining. Pausing now may interrupt the operator workflow and make the drill state harder to interpret.`,
        confirmLabel: "Pause Anyway",
        tone: "warning",
        onConfirm: pauseSimulator,
      });
      return;
    }
    if (sustainedFaultActive || legacyModeActive) {
      openConfirmation({
        kind: "pause",
        title: "Pause simulator while active modes exist?",
        body: "Legacy mode or sustained fault mode is currently active. Pausing now may leave the operator looking at stale active-state banners.",
        confirmLabel: "Pause Anyway",
        tone: "warning",
        onConfirm: pauseSimulator,
      });
      return;
    }
    await pauseSimulator();
  };
  const guardedStopSimulator = async () => {
    if (sustainedFaultActive || legacyModeActive || (faultDrillRemainingSec ?? 0) > 0) {
      openConfirmation({
        kind: "stop",
        title: "Stop simulator with active operator modes?",
        body: "One or more operator modes are still active (fault mode, legacy mode, or timed drill). Stopping now may cut off the current test state unexpectedly.",
        confirmLabel: "Stop Simulator",
        tone: "danger",
        onConfirm: stopSimulator,
      });
      return;
    }
    await stopSimulator();
  };
  const guardedStartHighTempMode = async () => {
    if (sustainedFaultActive) {
      openConfirmation({
        kind: "legacy-start",
        title: "Start legacy mode while fault mode is active?",
        body: "Sustained fault mode is already active. Legacy high temp mode may dominate the inserted output depending on backend replay behavior.",
        confirmLabel: "Start Legacy Mode",
        tone: "warning",
        onConfirm: startHighTempMode,
      });
      return;
    }
    await startHighTempMode();
  };
  const guardedClearFaultTargets = async () => {
    if (!faultTargetList.length) {
      clearFaultTargets();
      return;
    }
    openConfirmation({
      kind: "clear-fault-targets",
      title: "Clear current fault targets?",
      body: `This will remove ${faultTargetList.length} drafted target device(s) from the current fault configuration.`,
      confirmLabel: "Clear Targets",
      tone: "warning",
      onConfirm: clearFaultTargets,
    });
  };
  const guardedStartFaultMode = async () => {
    if (!faultTargetList.length) {
      openConfirmation({
        kind: "fault-start",
        title: "No fault targets selected",
        body: "This draft does not contain any target devices. Select targets first before starting sustained fault mode.",
        confirmLabel: "Close",
        tone: "info",
        onConfirm: () => {},
      });
      return;
    }
    if (legacyModeActive) {
      openConfirmation({
        kind: "fault-start",
        title: "Start fault mode while legacy mode is active?",
        body: "Legacy high temp mode is currently active. Running both together can make output interpretation harder during testing.",
        confirmLabel: "Start Fault Mode",
        tone: "warning",
        onConfirm: startFaultMode,
      });
      return;
    }
    if (hiddenDraftTargets.length > 0) {
      openConfirmation({
        kind: "fault-start",
        title: "Some fault targets are hidden by current filters",
        body: `${hiddenDraftTargets.length} of ${faultTargetList.length} drafted target(s) are hidden by the current device filter/search. Visible: ${visibleDraftTargets.length}. Hidden targets will still be affected if you proceed.`,
        confirmLabel: "Start Fault Mode",
        tone: "warning",
        onConfirm: startFaultMode,
      });
      return;
    }

    await startFaultMode();
  };
  const clearOperatorView = () => {
    setDeviceSearch("");
    setDeviceFilter("all");
    clearDeviceFocus();
  };
  const copyActiveFaultToDraft = () => {
    if (!activeFaultTargetNames?.length) {
      setActionMessage("No active fault targets available to copy into the draft.");
      setMessageType("info");
      return;
    }
    syncFaultDevicesInput(activeFaultTargetNames.join(", "));
    setActionMessage(
      `Copied ${activeFaultTargetNames.length} active fault target(s) into the draft.`
    );
    setMessageType("success");
  };
  const reuseLastFaultPreset = () => {
    if (!savedFaultPreset.length) {
      setActionMessage("No saved fault preset is available to reuse.");
      setMessageType("info");
      return;
    }
    if (savedFaultPresetType) {
      setFaultType(savedFaultPresetType);
    }
    if (savedFaultPresetSeverity) {
      setFaultSeverity(savedFaultPresetSeverity);
    }
    loadFaultDraftPreset();
    setActionMessage(`Reused saved fault preset with ${savedFaultPreset.length} target(s).`);
    setMessageType("success");
  };

  const safeResetFaultWorkflow = () => {
    clearOperatorView();
    clearFaultTargets();
    resetFaultDraft();

    if (faultDrillRemainingSec && faultDrillRemainingSec > 0) {
      cancelActiveDrill();
    }

    setActionMessage("Fault workflow reset to a safe neutral state.");
    setMessageType("success");
  };
const guardedTruncateTelemetry = async () => {
  openConfirmation({
    kind: "truncate-telemetry",
    title: "Truncate telemetry table?",
    body: `This will permanently remove all telemetry rows${
      telemetryRowCount != null ? ` (${telemetryRowCount} currently stored)` : ""
    } and reset identity values. This action cannot be undone.`,
    confirmLabel: "Truncate Telemetry",
    tone: "danger",
    onConfirm: runTruncateTelemetry,
  });
};
  const guardedSafeResetFaultWorkflow = async () => {
    if (sustainedFaultActive || legacyModeActive || (faultDrillRemainingSec ?? 0) > 0) {
      openConfirmation({
        kind: "safe-reset",
        title: "Reset operator workflow while active modes exist?",
        body:
          "Fault mode, legacy mode, or an active drill is still running. Resetting now will clear draft targets and the current operator view, and may interrupt the current test workflow.",
        confirmLabel: "Reset Anyway",
        tone: "warning",
        onConfirm: safeResetFaultWorkflow,
      });
      return;
    }
    safeResetFaultWorkflow();
  };

  return (
    <div className={`admin-page ${loading ? "admin-loading" : ""}`}>
      <div className="admin-page-header">
        <div>
          <h2 className="section-title">
            Admin / Simulator Control
            {status?.running && <span className="admin-status-dot live">● LIVE</span>}
            {streamMode === "stream" && (
              <span className="admin-status-dot live">● STREAM</span>
            )}
            {streamMode === "connecting" && (
              <span className="admin-status-dot warning">● RECONNECTING</span>
            )}
            {streamMode === "polling" && (
              <span className="admin-status-dot warning">● POLLING</span>
            )}
          </h2>
          <p className="admin-page-subtitle">
            Control simulator operations, review operator context, and monitor backend
            insertion activity from one consistent admin workspace.
          </p>
        </div>
      </div>
      <div className="admin-top-stack">
        <div className="admin-context-card">
          <div className="admin-context-header">
            <div>
              <h3 className="admin-context-title">Operator Context</h3>
              <p className="admin-context-subtitle">
                Live overview of simulator state, stream mode, source, active fault
                workflow, and current targeting scope.
              </p>
            </div>
          </div>
          <div className="admin-context-grid">
            {operatorContextItems.map((item) => (
              <div key={item.label} className="admin-context-item">
                <div className="admin-context-label">{item.label}</div>
                <div
                  style={{
                    ...getPillStyle(item.tone as "success" | "warning" | "danger" | "neutral"),
                    display: "inline-flex",
                  }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
        {(feedback ||
          warningToasts.some((toast) => !hiddenToastKeys.includes(toast.key))) && (
          <div className="admin-toast-stack">
            {feedback && (
              <div
                className={`admin-toast ${
                  feedback.tone === "error"
                    ? "danger"
                    : feedback.tone === "info"
                    ? "info"
                    : "success"
                }`}
                role="status"
                aria-live="polite"
              >
                <div className="admin-toast-text">{feedback.text}</div>
                <button
                  type="button"
                  className="admin-toast-close"
                  onClick={clearFeedback}
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            )}
            {warningToasts
              .filter((toast) => !hiddenToastKeys.includes(toast.key))
              .map((toast) => (
                <div key={toast.key} className={`admin-toast ${toast.tone}`}>
                  <div className="admin-toast-text">{toast.text}</div>
                  <button
                    type="button"
                    className="admin-toast-close"
                    onClick={() => dismissToast(toast.key)}
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              ))}
          </div>
        )}
        {confirmAction && (
          <div className="admin-confirm-overlay" onClick={closeConfirmation}>
            <div
              className={`admin-confirm-modal admin-confirm-modal--${confirmAction.tone ?? "warning"}`}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-confirm-title"
            >
              <div className="admin-confirm-header">
                <h3 id="admin-confirm-title" className="admin-confirm-title">
                  {confirmAction.title}
                </h3>
              </div>
              <div className="admin-confirm-body">{confirmAction.body}</div>
              <div className="admin-confirm-actions">
                <button
                  type="button"
                  onClick={closeConfirmation}
                  className="admin-pill-button"
                  style={{
                    ...getPillStyle("neutral"),
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runConfirmedAction}
                  className="admin-pill-button"
                  style={{
                    ...getPillStyle(
                      confirmAction.tone === "danger"
                        ? "danger"
                        : confirmAction.tone === "info"
                        ? "neutral"
                        : "warning"
                    ),
                    cursor: "pointer",
                  }}
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
        {showFaultStartConfirm && pendingPresetStart && (
          <div className="admin-message info">
            Confirm preset execution:{" "}
            <strong>{pendingPresetStart.preset.replaceAll("_", " ")}</strong>
            {pendingPresetStart.autoStopSeconds
              ? ` for ${pendingPresetStart.autoStopSeconds}s`
              : ""}{" "}
            on the current targets?
            <div className="admin-inline-actions" style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={confirmPendingPresetStart}
                style={{
                  ...getPillStyle("warning"),
                  cursor: "pointer",
                  background: "rgba(245,158,11,0.12)",
                }}
              >
                Confirm Start
              </button>
              <button
                type="button"
                onClick={cancelPendingPresetStart}
                style={{
                  ...getPillStyle("neutral"),
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="stats-grid admin-section-tight">
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Simulator Status</div>
          <div
            className={`stat-card-value ${
              status?.running ? (status?.paused ? "warning" : "success") : "danger"
            }`}
          >
            {status?.running ? (status?.paused ? "Paused" : "Running") : "Stopped"}
          </div>
        </div>
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Rows Inserted</div>
          <div className="stat-card-value">{status?.rowsInserted ?? 0}</div>
        </div>
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Rows Skipped</div>
          <div className="stat-card-value">{status?.rowsSkipped ?? 0}</div>
        </div>
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Last Insert</div>
          <div className="stat-card-value">{formatDateTime(status?.lastInsertTime)}</div>
        </div>
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Insert Rate</div>
          <div className="stat-card-value">{rate.toFixed(2)} /s</div>
        </div>
        <div className="stat-card admin-stat-card">
          <div className="stat-card-label">Source</div>
          <div className="stat-card-value">
            {String(status?.source ?? currentSimSource).toUpperCase()}
          </div>
        </div>
      </div>
      <div className="admin-group-grid">
        <SimulatorControlsPanel
          status={status}
          source={source}
          setSource={setSource}
          deviceCount={deviceCount}
          setDeviceCount={setDeviceCount}
          intervalSeconds={intervalSeconds}
          setIntervalSeconds={setIntervalSeconds}
          csvFile={csvFile}
          setCsvFile={setCsvFile}
          loading={loading}
          startSimulator={startSimulator}
          pauseSimulator={guardedPauseSimulator}
          resumeSimulator={resumeSimulator}
          stopSimulator={guardedStopSimulator}
          fetchStatus={fetchStatus}
        />
        <InjectionPanel
          loading={loading}
          injectHighTemp={injectHighTemp}
          injectOfflineGap={injectOfflineGap}
        />
        <LegacyPanel
          loading={loading}
          legacyHighTempMode={Boolean(status?.legacyHighTempMode)}
          startHighTempMode={guardedStartHighTempMode}
          stopHighTempMode={stopHighTempMode}
        />
        <div className="admin-panel admin-secondary-panel">
        <div className="admin-panel-header">
          <div>
            <div className="admin-panel-kicker">Maintenance</div>
            <h3 className="admin-panel-title">Data Cleanup</h3>
            <p className="admin-panel-subtitle">
              Delete selected telemetry rows or fully truncate telemetry data for a clean reset.
            </p>
          </div>
          <div
            style={{
              ...getPillStyle("neutral"),
              display: "inline-flex",
            }}
          >
            Rows: {telemetryRowCount == null ? "Unknown" : telemetryRowCount.toLocaleString()}
          </div>
        </div>
            <div className="admin-danger-note">
              Truncate permanently clears the telemetry table and resets identity values.
            </div>
        <div className="admin-form-grid admin-form-grid-compact">
          <label className="admin-field admin-field-full">
            <span className="admin-label">Delete Selected Row IDs</span>
            <input
              className="admin-input"
              value={deleteIdsInput}
              onChange={(e) => setDeleteIdsInput(e.target.value)}
              placeholder="e.g. 101, 102, 103"
            />
            <span className="admin-field-help">
              Enter telemetry row IDs separated by commas.
            </span>
          </label>
        </div>
        <div className="admin-inline-actions">
          <button
            type="button"
            className="admin-pill-button"
            onClick={runDeleteTelemetryRows}
            disabled={cleanupLoading}
            style={{ ...getPillStyle("warning"), cursor: "pointer" }}
          >
            Delete Selected
          </button>
          <button
            type="button"
            className="admin-pill-button"
            onClick={guardedTruncateTelemetry}
            disabled={cleanupLoading}
            style={{ ...getPillStyle("danger"), cursor: "pointer" }}
          >
            Truncate Telemetry
          </button>
          <button
            type="button"
            className="admin-pill-button"
            onClick={loadTelemetryRowCount}
            disabled={cleanupLoading}
            style={{ ...getPillStyle("neutral"), cursor: "pointer" }}
          >
            Refresh Count
          </button>
        </div>
        </div>
        <FaultModePanel
          loading={loading}
          status={status}
          faultMode={faultMode}
          faultType={faultType}
          setFaultType={setFaultType}
          faultSeverity={faultSeverity}
          setFaultSeverity={setFaultSeverity}
          faultDevicesInput={faultDevicesInput}
          setFaultDevicesInput={setFaultDevicesInput}
          faultTargetList={faultTargetList}
          availableFaultDevices={availableDevices}
          filteredVisibleDeviceNames={filteredVisibleDeviceNames}
          topRiskVisibleDeviceNames={topRiskVisibleDeviceNames}
          activeFaultTargetNames={activeFaultTargetNames}
          activeFaultVisibleTargets={activeFaultVisibleTargets}
          activeFaultHiddenTargets={activeFaultHiddenTargets}
          activeFaultPresetName={activeFaultPresetName}
          activeFaultAgeText={activeFaultAgeText}
          draftDiffersFromActiveFault={draftDiffersFromActiveFault}
          faultDrillUntil={faultDrillUntil}
          faultDrillRemainingSec={faultDrillRemainingSec}
          presetExecutionBlocked={presetExecutionBlocked}
          applyFaultPreset={applyFaultPreset}
          applyPresetAndMaybeStart={applyPresetAndMaybeStart}
          getPresetHint={getPresetHint}
          getPresetButtonStyle={getPresetButtonStyle}
          resetFaultDraft={resetFaultDraft}
          syncFaultDevicesInput={syncFaultDevicesInput}
          addFaultTargetChip={addFaultTargetChip}
          removeFaultTargetChip={removeFaultTargetChip}
          clearFaultTargets={guardedClearFaultTargets}
          useFilteredDevicesAsTargets={useFilteredDevicesAsTargets}
          useTopRiskDevicesAsTargets={useTopRiskDevicesAsTargets}
          useActiveFaultTargets={useActiveFaultTargets}
          saveFaultDraftPreset={saveFaultDraftPreset}
          loadFaultDraftPreset={loadFaultDraftPreset}
          clearSavedFaultPreset={clearSavedFaultPreset}
          savedFaultPreset={savedFaultPreset}
          savedFaultPresetSeverity={savedFaultPresetSeverity}
          savedFaultPresetType={savedFaultPresetType}
          startFaultMode={guardedStartFaultMode}
          stopFaultMode={stopFaultMode}
          cancelActiveDrill={cancelActiveDrill}
          formatDateTime={formatDateTime}
          formatRemaining={formatRemaining}
          deviceSearch={deviceSearch}
          deviceFilter={deviceFilter}
          clearOperatorView={clearOperatorView}
          copyActiveFaultToDraft={copyActiveFaultToDraft}
          reuseLastFaultPreset={reuseLastFaultPreset}
          safeResetFaultWorkflow={guardedSafeResetFaultWorkflow}
        />
        <SystemIntelligencePanel
          intelligence={intelligence}
          status={status}
          activeFaultPresetName={activeFaultPresetName}
          activeFaultAgeText={activeFaultAgeText}
          faultDrillRemainingSec={faultDrillRemainingSec}
          formatAgo={formatAgo}
          formatRemaining={formatRemaining}
          isCompactLayout={typeof window !== "undefined" ? window.innerWidth < 980 : false}
        />
        <BackendMetricsPanel
          backendMetrics={backendMetrics}
          status={status}
          formatDateTime={formatDateTime}
          isCompactLayout={typeof window !== "undefined" ? window.innerWidth < 980 : false}
        />
        <DeviceIntelligencePanel
          status={status}
          streamMode={streamMode}
          visibleDeviceRows={visibleDeviceRows}
          deviceIntelligenceRows={deviceIntelligenceRows}
          activeFaultTargetNames={activeFaultTargetNames}
          deviceIntelCollapsed={deviceIntelCollapsed}
          setDeviceIntelCollapsed={setDeviceIntelCollapsed}
          deviceCounts={deviceCounts}
          deviceFilter={deviceFilter}
          setDeviceFilter={setDeviceFilter}
          staleThresholdSec={staleThresholdSec}
          deviceSort={deviceSort}
          setDeviceSort={setDeviceSort}
          deviceSearch={deviceSearch}
          setDeviceSearch={setDeviceSearch}
          showTopRiskOnly={showTopRiskOnly}
          setShowTopRiskOnly={setShowTopRiskOnly}
          clearDeviceFocus={clearDeviceFocus}
          selectedDevice={selectedDevice}
          copiedDevice={copiedDevice}
          lastTargetedDevice={lastTargetedDevice}
          topRiskNames={topRiskNames}
          getDeviceRowStyle={getDeviceRowStyle}
          getStatusPill={getStatusPill}
          copyDeviceName={copyDeviceName}
          targetFaultForDevice={targetFaultForDevice}
          isolateDevice={isolateDevice}
          isCompactLayout={typeof window !== "undefined" ? window.innerWidth < 980 : false}
        />
        <DeviceHeartbeatSection
          heartbeatRows={heartbeatRows}
          deviceSearch={deviceSearch}
          deviceFilter={deviceFilter}
          isCompactLayout={typeof window !== "undefined" ? window.innerWidth < 980 : false}
          formatDateTime={formatDateTime}
          formatDelay={formatDelay}
          getHeartbeatLabel={getHeartbeatLabel}
        />
        <LastInsertedRowSection
          lastRow={lastRow}
          status={status}
          formatDateTime={formatDateTime}
        />
        <FaultModeStatusSection
          faultMode={faultMode}
          activeFaultPresetName={activeFaultPresetName}
          activeFaultAgeText={activeFaultAgeText}
          activeFaultVisibleTargets={activeFaultVisibleTargets}
          activeFaultHiddenTargets={activeFaultHiddenTargets}
          faultDrillRemainingSec={faultDrillRemainingSec}
          draftDiffersFromActiveFault={draftDiffersFromActiveFault}
          formatDateTime={formatDateTime}
          formatRemaining={formatRemaining}
          status={status}
        />
      </div>
      </div>
  );
}