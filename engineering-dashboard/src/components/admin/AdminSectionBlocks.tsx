import React from "react";
import type { HeartbeatRow, SimulatorStatus, HeaderChip } from "./AdminTypes";
import {
  InfoSection,
  MetricGrid,
  DetailGrid,
  EmptyInfo,
  compactListStyle,
  compactRowCardStyle,
  panelSectionGap,
  getPillStyle,
} from "./AdminUi";

type DeviceHeartbeatSectionProps = {
  heartbeatRows: HeartbeatRow[];
  deviceSearch: string;
  deviceFilter: string;
  isCompactLayout: boolean;
  formatDateTime: (value?: string | null) => string;
  formatDelay: (delaySec: number | null) => string;
  getHeartbeatLabel: (row: HeartbeatRow) => string;
};

export function DeviceHeartbeatSection({
  heartbeatRows,
  deviceSearch,
  deviceFilter,
  isCompactLayout,
  formatDateTime,
  formatDelay,
  getHeartbeatLabel,
}: DeviceHeartbeatSectionProps) {
  const chips: HeaderChip[] = [
    { label: `Rows: ${heartbeatRows.length}`, kind: "neutral" },
    {
      label: `Online: ${heartbeatRows.filter((r) => r.uiStatus === "online").length}`,
      kind: "healthy",
    },
    {
      label: `Stale: ${heartbeatRows.filter((r) => r.uiStatus === "stale").length}`,
      kind: "warning",
    },
    {
      label: `Offline: ${heartbeatRows.filter((r) => r.uiStatus === "offline").length}`,
      kind: "critical",
    },
  ];

  return (
    <InfoSection
      title="Device Heartbeat"
      subtitle="Live heartbeat rows for the current Device Intelligence selection and simulator state."
      chips={chips}
      marginTop={panelSectionGap}
    >
      {(deviceSearch || deviceFilter !== "all") && (
        <div className="admin-field-help" style={{ marginBottom: 12 }}>
          Showing heartbeat rows for the current Device Intelligence filter/search selection.
        </div>
      )}

      <MetricGrid
        items={[
          { label: "Shown Rows", value: heartbeatRows.length },
          {
            label: "Online",
            value: heartbeatRows.filter((r) => r.uiStatus === "online").length,
          },
          {
            label: "Stale",
            value: heartbeatRows.filter((r) => r.uiStatus === "stale").length,
          },
          {
            label: "Offline",
            value: heartbeatRows.filter((r) => r.uiStatus === "offline").length,
          },
        ]}
      />
      <div style={{ marginTop: 14 }}>
        {heartbeatRows.length === 0 ? (
          <EmptyInfo>
            No device heartbeat data yet. Start the simulator and refresh status to populate
            online, stale, and offline heartbeat rows.
          </EmptyInfo>
        ) : !isCompactLayout ? (
          <div className="admin-heartbeat-table-wrap">
            <table className="admin-heartbeat-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Delay</th>
                </tr>
              </thead>
              <tbody>
                {heartbeatRows.map((row) => (
                  <tr key={row.device}>
                    <td className="admin-heartbeat-device">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>{row.device}</span>
                        {row.isLive && <span style={getPillStyle("healthy")}>LIVE</span>}
                        {row.isFaultTarget && <span style={getPillStyle("warning")}>FAULT TARGET</span>}
                        {row.isOfflineSimulated && <span style={getPillStyle("critical")}>OFFLINE SIM</span>}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-heartbeat-badge admin-heartbeat-badge-${row.uiStatus}`}>
                        {getHeartbeatLabel(row)}
                      </span>
                    </td>
                    <td>{formatDateTime(row.lastSeen)}</td>
                    <td>{formatDelay(row.delaySec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={compactListStyle}>
            {heartbeatRows.map((row) => (
              <div key={`${row.device}-heartbeat`} style={compactRowCardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ color: "#f8fafc" }}>{row.device}</strong>
                    <span style={getPillStyle(row.uiStatus === "online" ? "healthy" : row.uiStatus === "stale" ? "warning" : "critical")}>
                      {getHeartbeatLabel(row).toUpperCase()}
                    </span>
                    {row.isLive && <span style={getPillStyle("healthy")}>LIVE</span>}
                    {row.isFaultTarget && <span style={getPillStyle("warning")}>FAULT TARGET</span>}
                    {row.isOfflineSimulated && <span style={getPillStyle("critical")}>OFFLINE SIM</span>}
                  </div>
                </div>

                <DetailGrid
                  items={[
                    { label: "Last Seen", value: formatDateTime(row.lastSeen) },
                    { label: "Delay", value: formatDelay(row.delaySec) },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </InfoSection>
  );
}

type LastInsertedRowSectionProps = {
  lastRow: SimulatorStatus["lastInsertedRow"];
  status: SimulatorStatus | null;
  formatDateTime: (value?: string | null) => string;
};

export function LastInsertedRowSection({
  lastRow,
  status,
  formatDateTime,
}: LastInsertedRowSectionProps) {
  const chips: HeaderChip[] = [
    {
      label: lastRow ? (lastRow.skipped ? "Insert Skipped" : "Insert Written") : "No Insert Yet",
      kind: lastRow?.skipped ? "warning" : "healthy",
    },
    { label: `Device: ${lastRow?.device_name ?? "--"}`, kind: "neutral" },
    ...(lastRow?.faultApplied ? [{ label: `Fault: ${lastRow.faultApplied}`, kind: "critical" as const }] : []),
  ];

  return (
    <InfoSection
      title="Last Inserted Row"
      subtitle="Latest telemetry row written by the simulator, including applied fault metadata."
      chips={chips}
      marginTop={panelSectionGap}
    >
      <MetricGrid
        items={[
          { label: "Device", value: lastRow?.device_name ?? "--" },
          { label: "Time", value: lastRow ? formatDateTime(lastRow.time) : "--" },
          {
            label: "Temperature",
            value:
              !lastRow
                ? "--"
                : lastRow.temperature != null
                ? `${lastRow.temperature} °C`
                : lastRow.skipped
                ? "Skipped"
                : "--",
            valueStyle: {
              color: !lastRow
                ? "#94a3b8"
                : lastRow.skipped
                ? "#fbbf24"
                : lastRow.temperature != null && lastRow.temperature > 30
                ? "#f87171"
                : "#e5e7eb",
            },
          },
          {
            label: "Humidity",
            value:
              !lastRow
                ? "--"
                : lastRow.humidity != null
                ? `${lastRow.humidity} %`
                : lastRow.skipped
                ? "Skipped"
                : "--",
            valueStyle: { color: !lastRow ? "#94a3b8" : "#e5e7eb" },
          },
        ]}
      />
      <div style={{ marginTop: 14 }}>
        <DetailGrid
          items={[
            {
              label: "Fault Applied",
              value: lastRow?.faultApplied ?? "None",
              valueStyle: { color: lastRow?.faultApplied ? "#f87171" : "#e5e7eb" },
            },
            {
              label: "Skipped Insert",
              value: !lastRow ? "--" : lastRow.skipped ? "Yes" : "No",
              valueStyle: {
                color: !lastRow ? "#94a3b8" : lastRow.skipped ? "#fbbf24" : "#4ade80",
              },
            },
            {
              label: "Simulator State",
              value: status?.running ? (status?.paused ? "Paused" : "Running") : "Stopped",
            },
            {
              label: "Rows Inserted",
              value: status?.rowsInserted ?? 0,
            },
          ]}
        />
      </div>

      {!lastRow && (
        <div style={{ marginTop: 10 }}>
          <EmptyInfo>
            No telemetry row has been inserted yet. Start the simulator or run an injection to
            populate the latest inserted row details.
          </EmptyInfo>
        </div>
      )}
    </InfoSection>
  );
}

type FaultModeStatusSectionProps = {
  faultMode: SimulatorStatus["faultMode"];
  activeFaultPresetName: string;
  activeFaultAgeText: string;
  activeFaultVisibleTargets: string[];
  activeFaultHiddenTargets: string[];
  faultDrillRemainingSec: number | null;
  draftDiffersFromActiveFault: boolean;
  formatDateTime: (value?: string | null) => string;
  formatRemaining: (seconds: number | null) => string;
  status: SimulatorStatus | null;
};

export function FaultModeStatusSection({
  faultMode,
  activeFaultPresetName,
  activeFaultAgeText,
  activeFaultVisibleTargets,
  activeFaultHiddenTargets,
  faultDrillRemainingSec,
  draftDiffersFromActiveFault,
  formatDateTime,
  formatRemaining,
  status,
}: FaultModeStatusSectionProps) {
  const chips: HeaderChip[] = [
    {
      label: faultMode?.enabled ? "Fault Mode Enabled" : "Fault Mode Disabled",
      kind: faultMode?.enabled ? "critical" : "healthy",
    },
    { label: `Type: ${faultMode?.fault_type ?? "--"}`, kind: "neutral" },
    { label: `Severity: ${faultMode?.severity ?? "--"}`, kind: "neutral" },
    { label: `Preset: ${activeFaultPresetName}`, kind: "neutral" },
    ...(faultDrillRemainingSec != null
      ? [{ label: `Drill: ${formatRemaining(faultDrillRemainingSec)}`, kind: "warning" as const }]
      : []),
  ];

  return (
    <InfoSection
      title="Sustained Fault Mode Status"
      subtitle="Current active fault profile, target visibility, and drill countdown status."
      chips={chips}
      marginTop={panelSectionGap}
    >
      <MetricGrid
        items={[
          {
            label: "Enabled",
            value: faultMode?.enabled ? "Yes" : "No",
            valueStyle: { color: faultMode?.enabled ? "#f87171" : "#4ade80" },
          },
          { label: "Fault Type", value: faultMode?.fault_type ?? "--" },
          { label: "Severity", value: faultMode?.severity ?? "--" },
          { label: "Fault Age", value: activeFaultAgeText },
        ]}
      />
      <div style={{ marginTop: 14 }}>
        <DetailGrid
          items={[
            { label: "Started At", value: formatDateTime(faultMode?.started_at) },
            {
              label: "Target Devices",
              value: faultMode?.target_devices?.length ? faultMode.target_devices.join(", ") : "--",
            },
            {
              label: "Visible Targets",
              value:
                status?.faultMode?.enabled
                  ? activeFaultVisibleTargets.length > 0
                    ? activeFaultVisibleTargets.join(", ")
                    : "--"
                  : "--",
            },
            {
              label: "Hidden Targets",
              value:
                status?.faultMode?.enabled
                  ? activeFaultHiddenTargets.length > 0
                    ? activeFaultHiddenTargets.join(", ")
                    : "--"
                  : "--",
            },
            {
              label: "Drill Countdown",
              value: faultDrillRemainingSec != null ? formatRemaining(faultDrillRemainingSec) : "--",
            },
            {
              label: "Draft Differs From Active",
              value: draftDiffersFromActiveFault ? "Yes" : "No",
              valueStyle: { color: draftDiffersFromActiveFault ? "#fbbf24" : "#4ade80" },
            },
          ]}
        />
      </div>
    </InfoSection>
  );
}