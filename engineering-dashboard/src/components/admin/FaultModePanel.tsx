import React from "react";
import type {
  FaultMode,
  FaultType,
  SeverityType,
  SimulatorStatus,
  FaultPresetKey,
  PillKind,
} from "./AdminTypes";
import { getPillStyle } from "./AdminUi";

type PresetTone = PillKind;

type FaultModePanelProps = {
  faultMode: FaultMode | undefined;
  status: SimulatorStatus | null;
  faultType: FaultType;
  setFaultType: React.Dispatch<React.SetStateAction<FaultType>>;
  faultSeverity: SeverityType;
  setFaultSeverity: React.Dispatch<React.SetStateAction<SeverityType>>;
  faultDevicesInput: string;
  setFaultDevicesInput: React.Dispatch<React.SetStateAction<string>>;
  faultTargetList: string[];
  availableFaultDevices: string[];
  filteredVisibleDeviceNames: string[];
  topRiskVisibleDeviceNames: string[];
  activeFaultTargetNames: string[];
  activeFaultVisibleTargets: string[];
  activeFaultHiddenTargets: string[];
  activeFaultPresetName: string;
  activeFaultAgeText: string;
  savedFaultPreset: string[];
  savedFaultPresetSeverity: SeverityType;
  savedFaultPresetType: FaultType;
  faultDrillUntil: string | null;
  faultDrillRemainingSec: number | null;
  draftDiffersFromActiveFault: boolean;
  loading: boolean;
  presetExecutionBlocked: boolean;
  formatDateTime: (value?: string | null) => string;
  formatRemaining: (seconds: number | null) => string;
  getPresetButtonStyle: (tone: PresetTone, filled?: boolean) => React.CSSProperties;
  getPresetHint: (preset: FaultPresetKey) => string;
  applyFaultPreset: (preset: FaultPresetKey) => void;
  applyPresetAndMaybeStart: (
    preset: FaultPresetKey,
    options?: { autoStart?: boolean; autoStopSeconds?: number },
  ) => Promise<void>;
  syncFaultDevicesInput: (devices: string[]) => void;
  removeFaultTargetChip: (deviceName: string) => void;
  addFaultTargetChip: (deviceName: string) => void;
  useFilteredDevicesAsTargets: () => void;
  useTopRiskDevicesAsTargets: () => void;
  useActiveFaultTargets: () => void;
  saveFaultDraftPreset: () => void;
  loadFaultDraftPreset: () => void;
  clearSavedFaultPreset: () => void;
  clearFaultTargets: () => void;
  resetFaultDraft: () => void;
  startFaultMode: () => Promise<void>;
  stopFaultMode: () => Promise<void>;
  cancelActiveDrill: () => void;
  deviceSearch: string;
  deviceFilter: string;
  clearOperatorView: () => void;
  copyActiveFaultToDraft: () => void;
  reuseLastFaultPreset: () => void;
  safeResetFaultWorkflow: () => void;
};

function actionStyle(kind: PillKind, disabled = false): React.CSSProperties {
  return {
    ...getPillStyle(kind),
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}

export default function FaultModePanel({
  faultMode,
  status,
  faultType,
  setFaultType,
  faultSeverity,
  setFaultSeverity,
  faultDevicesInput,
  setFaultDevicesInput,
  faultTargetList = [],
  availableFaultDevices = [],
  filteredVisibleDeviceNames = [],
  topRiskVisibleDeviceNames = [],
  activeFaultTargetNames = [],
  activeFaultVisibleTargets = [],
  activeFaultHiddenTargets = [],
  activeFaultPresetName,
  activeFaultAgeText,
  savedFaultPreset,
  savedFaultPresetSeverity,
  savedFaultPresetType,
  faultDrillUntil,
  faultDrillRemainingSec,
  draftDiffersFromActiveFault,
  loading,
  presetExecutionBlocked,
  formatDateTime,
  formatRemaining,
  getPresetButtonStyle,
  getPresetHint,
  applyFaultPreset,
  applyPresetAndMaybeStart,
  syncFaultDevicesInput,
  removeFaultTargetChip,
  addFaultTargetChip,
  useFilteredDevicesAsTargets,
  useTopRiskDevicesAsTargets,
  useActiveFaultTargets,
  saveFaultDraftPreset,
  loadFaultDraftPreset,
  clearSavedFaultPreset,
  clearFaultTargets,
  resetFaultDraft,
  startFaultMode,
  stopFaultMode,
  cancelActiveDrill,
  deviceSearch = "",
  deviceFilter = "all",
  clearOperatorView,
  copyActiveFaultToDraft,
  reuseLastFaultPreset,
  safeResetFaultWorkflow,
}: FaultModePanelProps) {
  const visibleDraftTargetSet = React.useMemo(
    () => new Set(filteredVisibleDeviceNames),
    [filteredVisibleDeviceNames],
  );

  const visibleDraftTargets = React.useMemo(
    () => faultTargetList.filter((name) => visibleDraftTargetSet.has(name)),
    [faultTargetList, visibleDraftTargetSet],
  );

  const hiddenDraftTargets = React.useMemo(
    () => faultTargetList.filter((name) => !visibleDraftTargetSet.has(name)),
    [faultTargetList, visibleDraftTargetSet],
  );

  const previewDraftTargets = React.useMemo(() => faultTargetList.slice(0, 10), [faultTargetList]);

  const hasDeviceViewFilters = Boolean(deviceSearch?.trim()) || (deviceFilter !== "all" && deviceFilter !== "");
  const hasActiveFault = Boolean(status?.faultMode?.enabled);
  const hasSavedPreset = savedFaultPreset.length > 0;
  const hasActiveTargets = activeFaultTargetNames.length > 0;
  const hasDraftTargets = faultTargetList.length > 0;

  const presetButtons: Array<{
    preset: FaultPresetKey;
    label: string;
    tone: PresetTone;
    filled?: boolean;
  }> = [
    { preset: "hot_spike", label: "🔥 Hot Spike", tone: "warning", filled: true },
    { preset: "sensor_freeze", label: "🧊 Sensor Freeze", tone: "neutral" },
    { preset: "drift_test", label: "📈 Drift Test", tone: "neutral" },
    { preset: "offline_drill", label: "📴 Offline Drill", tone: "critical", filled: true },
  ];

  return (
    <section className="admin-panel admin-panel-wide admin-panel-fault">
      <div className="admin-panel-header admin-panel-header-fault">
        <div>
          <h3 className="admin-panel-title">Fault Mode</h3>
          <p className="admin-panel-subtitle">Configure sustained simulated faults for selected devices.</p>
        </div>
        <span className="admin-panel-badge admin-panel-badge-fault">{hasActiveFault ? "Active" : "Advanced"}</span>
      </div>

      <div className="admin-fault-top-grid">
        <div className="admin-field">
          <label className="admin-label">Fault Type</label>
          <select className="admin-select" value={faultType} onChange={(e) => setFaultType(e.target.value as FaultType)}>
            <option value="high_temp">High Temperature</option>
            <option value="stuck_temp">Stuck Temperature</option>
            <option value="drift_up">Upward Drift</option>
            <option value="noisy">Noisy Sensor</option>
            <option value="offline">Offline Device</option>
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-label">Severity</label>
          <select
            className="admin-select"
            value={faultSeverity}
            onChange={(e) => setFaultSeverity(e.target.value as SeverityType)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="admin-fault-preset-block">
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Smart presets</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {presetButtons.map(({ preset, label, tone, filled }) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyFaultPreset(preset)}
                style={getPresetButtonStyle(tone, filled)}
                title={getPresetHint(preset)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 12, color: "#94a3b8" }}>
            <div>• Hot Spike / Offline Drill prefer top risk targets.</div>
            <div>• Freeze / Drift prefer filtered devices.</div>
            <div>• Draft targets stay first when already selected.</div>
          </div>
        </div>
      </div>

      <div className="admin-fault-action-stack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("hot_spike", { autoStart: true })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("warning", true)}
          >
            Start Hot Spike Now
          </button>

          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("sensor_freeze", { autoStart: true })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("neutral")}
          >
            Start Sensor Freeze Now
          </button>

          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("drift_test", { autoStart: true })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("neutral")}
          >
            Start Drift Test Now
          </button>

          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("offline_drill", { autoStart: true })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("critical", true)}
          >
            Start Offline Drill Now
          </button>
        </div>

        <div className="admin-inline-actions">
          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("hot_spike", { autoStart: true, autoStopSeconds: 30 })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("warning", true)}
          >
            30s Hot Spike Drill
          </button>

          <button
            type="button"
            onClick={() => applyPresetAndMaybeStart("offline_drill", { autoStart: true, autoStopSeconds: 30 })}
            disabled={presetExecutionBlocked}
            style={getPresetButtonStyle("critical", true)}
          >
            30s Offline Drill
          </button>

          {faultDrillUntil && <span style={getPillStyle("warning")}>Drill active until: {formatDateTime(faultDrillUntil)}</span>}
          {faultDrillRemainingSec != null && <span style={getPillStyle("warning")}>Countdown: {formatRemaining(faultDrillRemainingSec)}</span>}
        </div>
      </div>

      <div className="admin-field admin-field-full">
        <label className="admin-label">Target Devices</label>
        <input
          className="admin-input"
          type="text"
          value={faultDevicesInput}
          onChange={(e) => setFaultDevicesInput(e.target.value)}
          onBlur={() => syncFaultDevicesInput(faultTargetList)}
          placeholder="sensor_01,sensor_02"
        />

        {hasDraftTargets && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, marginBottom: 8 }}>
            {faultTargetList.map((device) => (
              <button
                key={device}
                type="button"
                onClick={() => removeFaultTargetChip(device)}
                style={{ ...getPillStyle("warning"), cursor: "pointer", background: "rgba(245,158,11,0.12)" }}
                title={`Remove ${device}`}
              >
                {device} ✕
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Quick add available devices</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {availableFaultDevices.length > 0 ? (
              availableFaultDevices.map((device) => {
                const alreadySelected = faultTargetList.includes(device);
                return (
                  <button
                    key={device}
                    type="button"
                    onClick={() => addFaultTargetChip(device)}
                    disabled={alreadySelected}
                    style={actionStyle(alreadySelected ? "neutral" : "healthy", alreadySelected)}
                  >
                    {alreadySelected ? `✓ ${device}` : `+ ${device}`}
                  </button>
                );
              })
            ) : (
              <span style={{ color: "#94a3b8", fontSize: 13 }}>No available devices loaded yet.</span>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 12,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(15,23,42,0.24)",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.95 }}>Target Visibility</div>

            <div className="admin-inline-actions">
              <span style={getPillStyle("neutral")}>Total: {faultTargetList.length}</span>
              <span style={getPillStyle("healthy")}>Visible: {visibleDraftTargets.length}</span>
              <span style={getPillStyle(hiddenDraftTargets.length > 0 ? "warning" : "neutral")}>Hidden: {hiddenDraftTargets.length}</span>
              <span style={getPillStyle(hasActiveTargets ? "critical" : "neutral")}>Active: {activeFaultTargetNames.length}</span>
            </div>

            {hasDraftTargets && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, opacity: 0.72 }}>Draft preview</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {previewDraftTargets.map((name) => (
                    <span key={name} style={getPillStyle(visibleDraftTargetSet.has(name) ? "healthy" : "warning")}>
                      {name}
                    </span>
                  ))}
                  {faultTargetList.length > previewDraftTargets.length && (
                    <span style={getPillStyle("neutral")}>+{faultTargetList.length - previewDraftTargets.length} more</span>
                  )}
                </div>
              </div>
            )}

            {hiddenDraftTargets.length > 0 && (
              <div
                style={{
                  border: "1px solid rgba(245,158,11,0.25)",
                  background: "rgba(245,158,11,0.08)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                <strong>Hidden targets detected.</strong> {hiddenDraftTargets.length} drafted device(s) are hidden by the current device search or filter. Starting fault mode will still affect them.
              </div>
            )}

            <div className="admin-control-block-tight">
              <div className="admin-section-caption">Quick target actions</div>
              <div className="admin-inline-actions">
                <button
                  type="button"
                  className="admin-pill-button"
                  onClick={useFilteredDevicesAsTargets}
                  style={{ ...getPillStyle("neutral"), cursor: "pointer" }}
                  title={`Use the current filtered list (${filteredVisibleDeviceNames.length}) as targets`}
                >
                  Use Filtered Devices ({filteredVisibleDeviceNames.length})
                </button>

                <button
                  type="button"
                  onClick={useTopRiskDevicesAsTargets}
                  style={{ ...getPillStyle("neutral"), cursor: "pointer" }}
                  title={`Use the current top risk list (${topRiskVisibleDeviceNames.length}) as targets`}
                >
                  Use Top Risk ({topRiskVisibleDeviceNames.length})
                </button>

                <button
                  type="button"
                  onClick={useActiveFaultTargets}
                  disabled={!hasActiveTargets}
                  style={actionStyle("neutral", !hasActiveTargets)}
                  title={hasActiveTargets ? `Reuse the ${activeFaultTargetNames.length} currently active target(s)` : "No active targets available"}
                >
                  Reuse Active Targets ({activeFaultTargetNames.length})
                </button>

                <button type="button" onClick={clearFaultTargets} disabled={!hasDraftTargets} style={actionStyle("warning", !hasDraftTargets)}>
                  Clear Targets
                </button>

                <button type="button" onClick={resetFaultDraft} style={{ ...getPillStyle("warning"), cursor: "pointer" }}>
                  Reset Draft
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.72 }}>Saved preset actions</div>
              <div className="admin-inline-actions">
                <button type="button" onClick={saveFaultDraftPreset} disabled={!hasDraftTargets} style={actionStyle("neutral", !hasDraftTargets)}>
                  Save Draft Preset
                </button>

                <button type="button" onClick={loadFaultDraftPreset} disabled={!hasSavedPreset} style={actionStyle("neutral", !hasSavedPreset)}>
                  Load Saved Preset ({savedFaultPreset.length})
                </button>

                <button type="button" onClick={clearSavedFaultPreset} disabled={!hasSavedPreset} style={actionStyle("neutral", !hasSavedPreset)}>
                  Clear Saved Preset
                </button>
              </div>
            </div>

            {hasDeviceViewFilters && (
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Current device view is filtered by search and/or status. Hidden targets may not be visible in the device intelligence list.
              </div>
            )}
          </div>

          {hasSavedPreset && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: -2, marginBottom: 2 }}>
              <span style={getPillStyle("neutral")}>Saved Preset Targets: {savedFaultPreset.length}</span>
              <span style={getPillStyle("neutral")}>Saved Type: {savedFaultPresetType}</span>
              <span style={getPillStyle("neutral")}>Saved Severity: {savedFaultPresetSeverity}</span>
            </div>
          )}

          <div
            style={{
              border: "1px solid rgba(148,163,184,0.16)",
              borderRadius: 12,
              padding: 10,
              background: "rgba(15,23,42,0.22)",
              display: "grid",
              gap: 8,
            }}
          >
            <div className="admin-inline-actions">
              <span style={getPillStyle(hasActiveFault ? "critical" : "neutral")}>Active Fault: {hasActiveFault ? "Running" : "Inactive"}</span>
              <span style={getPillStyle(hasActiveFault ? "critical" : "neutral")}>Active Preset: {hasActiveFault ? activeFaultPresetName : "None"}</span>
              <span style={getPillStyle(hasActiveFault ? "warning" : "neutral")}>Active Age: {hasActiveFault ? activeFaultAgeText : "-"}</span>
              <span style={getPillStyle(hasActiveTargets ? "critical" : "neutral")}>Active Targets: {activeFaultTargetNames.length}</span>
              <span style={getPillStyle(activeFaultVisibleTargets.length > 0 ? "healthy" : "neutral")}>Visible Active: {activeFaultVisibleTargets.length}</span>
              <span style={getPillStyle(activeFaultHiddenTargets.length > 0 ? "warning" : "neutral")}>Hidden Active: {activeFaultHiddenTargets.length}</span>
              {faultDrillRemainingSec != null && (
                <span style={getPillStyle(faultDrillRemainingSec > 0 ? "warning" : "neutral")}>Drill Countdown: {formatRemaining(faultDrillRemainingSec)}</span>
              )}
            </div>

            <div className="admin-inline-actions">
              <span style={getPillStyle(!hasActiveFault ? "neutral" : draftDiffersFromActiveFault ? "warning" : "healthy")}>
                {!hasActiveFault ? "No active fault" : draftDiffersFromActiveFault ? "Draft differs from active fault" : "Draft matches active fault"}
              </span>
            </div>

            <div className="admin-inline-actions">
              <button
                type="button"
                onClick={copyActiveFaultToDraft}
                disabled={!hasActiveTargets}
                style={actionStyle(hasActiveTargets ? "warning" : "neutral", !hasActiveTargets)}
                title={hasActiveTargets ? `Copy ${activeFaultTargetNames.length} active target(s) into the draft` : "No active fault targets to copy"}
              >
                Copy Active → Draft
              </button>

              <button
                type="button"
                onClick={useActiveFaultTargets}
                disabled={!hasActiveTargets}
                style={actionStyle("neutral", !hasActiveTargets)}
                title={hasActiveTargets ? "Reuse the currently active target set" : "No active fault targets available"}
              >
                Reuse Active Targets
              </button>
            </div>

            <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.35 }}>
              Reflects the current sustained fault state for reuse or draft recovery.
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 8, marginTop: 2 }}>
          <button className="action-btn action-btn-danger admin-action-btn-compact" onClick={startFaultMode} disabled={loading}>
            🚨 Start Sustained Fault
          </button>

          <button className="action-btn action-btn-success" onClick={stopFaultMode} disabled={loading}>
            ✅ Stop Sustained Fault
          </button>

          <button className="action-btn action-btn-warning" onClick={cancelActiveDrill} disabled={!faultDrillUntil || loading}>
            ⛔ Cancel Active Drill
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(148,163,184,0.16)",
            borderRadius: 12,
            padding: 10,
            background: "rgba(2,6,23,0.22)",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.95 }}>Operator Shortcuts</div>

          <div style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.45 }}>
            Fast recovery and repeat actions for view cleanup, preset reuse, draft recovery, and safe reset.
          </div>

          <div className="admin-inline-actions">
            <button
              type="button"
              onClick={clearOperatorView}
              style={{ ...getPillStyle("neutral"), cursor: "pointer" }}
              title="Clear search, show all devices, and remove selected device focus"
            >
              Clear View
            </button>

            <button
              type="button"
              onClick={reuseLastFaultPreset}
              disabled={!hasSavedPreset}
              style={actionStyle("neutral", !hasSavedPreset)}
              title={hasSavedPreset ? `Reuse saved preset with ${savedFaultPreset.length} target(s)` : "No saved preset available"}
            >
              Reuse Last Preset
            </button>

            <button
              type="button"
              onClick={copyActiveFaultToDraft}
              disabled={!hasActiveTargets}
              style={actionStyle(hasActiveTargets ? "warning" : "neutral", !hasActiveTargets)}
              title={hasActiveTargets ? `Copy ${activeFaultTargetNames.length} active target(s) into the draft` : "No active fault targets to copy"}
            >
              Copy Active → Draft
            </button>

            <button
              type="button"
              onClick={safeResetFaultWorkflow}
              style={{ ...getPillStyle("warning"), cursor: "pointer" }}
              title="Clear view, clear draft targets, reset the fault draft, and cancel an active drill timer"
            >
              Safe Reset
            </button>
          </div>

          <div style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.7 }}>
            <div>• Clear View resets search, filter, and selected focus.</div>
            <div>• Reuse Last Preset restores the saved preset into the draft.</div>
            <div>• Copy Active → Draft copies the active target set into the draft.</div>
            <div>• Safe Reset clears view, draft targets, draft state, and drill timer.</div>
          </div>
        </div>
      </div>
    </section>
  );
}
