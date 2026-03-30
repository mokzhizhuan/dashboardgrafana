import React from "react";
import type { DeviceRow, PillKind, StreamMode, SimulatorStatus } from "./AdminTypes";
import { panelStyle, miniCardStyle, labelStyle, valueStyle, getPillStyle, SectionHeader } from "./AdminUi";

type Props = {
  streamMode: StreamMode;
  status: SimulatorStatus | null;
  visibleDeviceRows: DeviceRow[];
  deviceIntelligenceRows: DeviceRow[];
  activeFaultTargetNames: string[];
  deviceIntelCollapsed: boolean;
  setDeviceIntelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  deviceCounts: {
    all: number;
    online: number;
    stale: number;
    offline: number;
    fault: number;
    topRisk: number;
  };
  deviceFilter: "all" | "online" | "stale" | "offline" | "fault";
  setDeviceFilter: React.Dispatch<React.SetStateAction<"all" | "online" | "stale" | "offline" | "fault">>;
  staleThresholdSec: number;
  deviceSort: "priority_desc" | "name_asc" | "delay_desc" | "status";
  setDeviceSort: React.Dispatch<React.SetStateAction<"priority_desc" | "name_asc" | "delay_desc" | "status">>;
  deviceSearch: string;
  setDeviceSearch: React.Dispatch<React.SetStateAction<string>>;
  showTopRiskOnly: boolean;
  setShowTopRiskOnly: React.Dispatch<React.SetStateAction<boolean>>;
  clearDeviceFocus: () => void;
  selectedDevice: string;
  copiedDevice: string;
  lastTargetedDevice: string;
  topRiskNames: Set<string>;
  getDeviceRowStyle: (row: DeviceRow) => React.CSSProperties;
  getStatusPill: (status: DeviceRow["uiStatus"]) => React.CSSProperties;
  copyDeviceName: (name: string) => void;
  targetFaultForDevice: (name: string) => void;
  isolateDevice: (name: string) => void;
  isCompactLayout: boolean;
};

export default function DeviceIntelligencePanel(props: Props) {
  const {
    streamMode,
    status,
    visibleDeviceRows,
    deviceIntelligenceRows,
    activeFaultTargetNames,
    deviceIntelCollapsed,
    setDeviceIntelCollapsed,
    deviceCounts,
    deviceFilter,
    setDeviceFilter,
    staleThresholdSec,
    deviceSort,
    setDeviceSort,
    deviceSearch,
    setDeviceSearch,
    showTopRiskOnly,
    setShowTopRiskOnly,
    clearDeviceFocus,
    selectedDevice,
    copiedDevice,
    lastTargetedDevice,
    topRiskNames,
    getDeviceRowStyle,
    getStatusPill,
    copyDeviceName,
    targetFaultForDevice,
    isolateDevice,
    isCompactLayout,
  } = props;

  const streamKind: PillKind =
    streamMode === "stream" ? "healthy" : streamMode === "polling" ? "warning" : "neutral";

  return (
    <div style={panelStyle}>
      <SectionHeader
        title="Device Intelligence"
        subtitle="Ranked live diagnostics for device heartbeat, simulated faults, and delay"
        chips={[
          {
            label: streamMode === "stream" ? "LIVE FEED" : streamMode === "polling" ? "POLLING" : "CONNECTING",
            kind: streamKind,
          },
          {
            label: `${visibleDeviceRows.length}/${deviceIntelligenceRows.length} visible`,
            kind: "neutral",
          },
          ...(status?.faultMode?.enabled
            ? [{ label: `Active fault targets: ${activeFaultTargetNames.length}`, kind: "warning" as const }]
            : []),
        ]}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <div className="admin-inline-actions">
          {([
            ["all", `All (${deviceCounts.all})`],
            ["online", `Online (${deviceCounts.online})`],
            ["stale", `Stale (${deviceCounts.stale})`],
            ["offline", `Offline (${deviceCounts.offline})`],
            ["fault", `Fault Targets (${deviceCounts.fault})`],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setDeviceFilter(key)}
              style={{
                ...(deviceFilter === key ? getPillStyle("healthy") : getPillStyle("neutral")),
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={getPillStyle("warning")}>Stale &gt; {staleThresholdSec}s</span>
          <span style={getPillStyle("critical")}>Offline = simulated gap</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}>
            <span>Sort</span>
            <select
              value={deviceSort}
              onChange={(e) => setDeviceSort(e.target.value as typeof deviceSort)}
              style={{
                background: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #243041",
                borderRadius: 8,
                padding: "8px 10px",
              }}
            >
              <option value="priority_desc">Priority</option>
              <option value="status">Status</option>
              <option value="delay_desc">Delay</option>
              <option value="name_asc">Name</option>
            </select>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 13 }}>
            <span>Search</span>
            <input
              type="text"
              value={deviceSearch}
              onChange={(e) => setDeviceSearch(e.target.value)}
              placeholder="sensor_01"
              style={{
                background: "#0b1220",
                color: "#e5e7eb",
                border: "1px solid #243041",
                borderRadius: 8,
                padding: "8px 10px",
                minWidth: 140,
              }}
            />
          </label>
          {(deviceSearch || deviceFilter !== "all" || showTopRiskOnly) && (
            <button
              type="button"
              onClick={clearDeviceFocus}
              style={{
                ...getPillStyle("neutral"),
                cursor: "pointer",
              }}
            >
              Clear Focus
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowTopRiskOnly((prev) => !prev)}
            style={{
              ...(showTopRiskOnly ? getPillStyle("warning") : getPillStyle("neutral")),
              cursor: "pointer",
            }}
          >
            {showTopRiskOnly ? "Showing Top Risk Only" : `Top Risk Only (${deviceCounts.topRisk})`}
          </button>
          <button
            type="button"
            onClick={() => setDeviceIntelCollapsed((prev) => !prev)}
            style={{
              ...getPillStyle(deviceIntelCollapsed ? "neutral" : "healthy"),
              cursor: "pointer",
            }}
          >
            {deviceIntelCollapsed ? "Expand Panel" : "Collapse Panel"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          ["Shown Devices", visibleDeviceRows.length],
          ["Online", visibleDeviceRows.filter((r) => r.uiStatus === "online").length],
          ["Stale", visibleDeviceRows.filter((r) => r.uiStatus === "stale").length],
          ["Offline", visibleDeviceRows.filter((r) => r.uiStatus === "offline").length],
          ["Fault Targets", visibleDeviceRows.filter((r) => r.isFaultTarget).length],
        ].map(([label, value]) => (
          <div key={String(label)} style={miniCardStyle}>
            <div style={labelStyle}>{label}</div>
            <div style={{ ...valueStyle, fontSize: 18 }}>{value}</div>
          </div>
        ))}
      </div>

      {(selectedDevice || copiedDevice || lastTargetedDevice) && (
        <div
          style={{
            ...miniCardStyle,
            marginBottom: 14,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {selectedDevice && <span style={getPillStyle("healthy")}>Focused: {selectedDevice}</span>}
          {copiedDevice && <span style={getPillStyle("healthy")}>Copied: {copiedDevice}</span>}
          {lastTargetedDevice && <span style={getPillStyle("warning")}>Queued Fault: {lastTargetedDevice}</span>}
        </div>
      )}

      {deviceIntelCollapsed ? (
        <div
          style={{
            color: "#94a3b8",
            fontSize: 14,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid #243041",
            background: "#0b1220",
          }}
        >
          Device Intelligence is collapsed. Expand the panel to review ranked device diagnostics.
        </div>
      ) : deviceIntelligenceRows.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 14 }}>
          No device intelligence data yet. Start the simulator and refresh status.
        </div>
      ) : !isCompactLayout ? (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 13,
              color: "#e5e7eb",
              minWidth: 1000,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid #243041" }}>
                <th style={{ textAlign: "left", padding: "10px 8px", position: "sticky", top: 0, background: "#111827", zIndex: 2 }}>Device</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>UI Status</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Raw Status</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Last Seen</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Delay</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Fault Target</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Offline Sim</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Priority</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleDeviceRows.map((row) => (
                <tr
                  key={row.deviceName}
                  style={{
                    borderBottom: "1px solid #1f2a3a",
                    ...getDeviceRowStyle(row),
                    ...(selectedDevice === row.deviceName
                      ? {
                          outline: "1px solid rgba(34,197,94,0.65)",
                          boxShadow: "inset 0 0 0 1px rgba(34,197,94,0.25)",
                          background: "rgba(34,197,94,0.08)",
                        }
                      : {}),
                  }}
                >
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span>{row.deviceName}</span>
                      {row.isLive && <span style={getPillStyle("healthy")}>LIVE</span>}
                      {topRiskNames.has(row.deviceName) && <span style={getPillStyle("warning")}>TOP RISK</span>}
                      {selectedDevice === row.deviceName && <span style={getPillStyle("healthy")}>FOCUSED</span>}
                      {copiedDevice === row.deviceName && <span style={getPillStyle("healthy")}>COPIED</span>}
                      {lastTargetedDevice === row.deviceName && <span style={getPillStyle("warning")}>QUEUED</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px 8px" }}><span style={getStatusPill(row.uiStatus)}>{row.uiStatus}</span></td>
                  <td style={{ padding: "10px 8px", color: "#cbd5e1" }}>{row.rawStatus}</td>
                  <td style={{ padding: "10px 8px", color: "#cbd5e1" }}>{row.lastSeenText}</td>
                  <td style={{ padding: "10px 8px", color: "#cbd5e1" }}>{row.delayText}</td>
                  <td style={{ padding: "10px 8px" }}><span style={getPillStyle(row.isFaultTarget ? "warning" : "neutral")}>{row.isFaultTarget ? "YES" : "NO"}</span></td>
                  <td style={{ padding: "10px 8px" }}><span style={getPillStyle(row.isOfflineSimulated ? "critical" : "neutral")}>{row.isOfflineSimulated ? "YES" : "NO"}</span></td>
                  <td style={{ padding: "10px 8px", fontWeight: 700 }}>{row.priority}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" onClick={() => copyDeviceName(row.deviceName)} style={{ ...getPillStyle("neutral"), cursor: "pointer", background: "#0b1220" }}>📋 Copy</button>
                      <button type="button" onClick={() => targetFaultForDevice(row.deviceName)} style={{ ...getPillStyle("warning"), cursor: "pointer", background: "rgba(245,158,11,0.12)" }}>🎯 Target Fault</button>
                      <button type="button" onClick={() => isolateDevice(row.deviceName)} style={{ ...getPillStyle("healthy"), cursor: "pointer", background: "rgba(34,197,94,0.12)" }}>🔎 Isolate</button>
                      {selectedDevice === row.deviceName && (
                        <button type="button" onClick={clearDeviceFocus} style={{ ...getPillStyle("neutral"), cursor: "pointer" }}>✖ Clear</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visibleDeviceRows.map((row) => (
            <div
              key={`${row.deviceName}-compact`}
              style={{
                ...miniCardStyle,
                ...getDeviceRowStyle(row),
                ...(selectedDevice === row.deviceName
                  ? {
                      outline: "1px solid rgba(34,197,94,0.65)",
                      boxShadow: "inset 0 0 0 1px rgba(34,197,94,0.25)",
                      background: "rgba(34,197,94,0.08)",
                    }
                  : {}),
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: "#f8fafc" }}>{row.deviceName}</strong>
                  <span style={getStatusPill(row.uiStatus)}>{row.uiStatus}</span>
                  {row.isLive && <span style={getPillStyle("healthy")}>LIVE</span>}
                  {row.isFaultTarget && <span style={getPillStyle("warning")}>FAULT TARGET</span>}
                  {row.isOfflineSimulated && <span style={getPillStyle("critical")}>OFFLINE SIM</span>}
                  {topRiskNames.has(row.deviceName) && <span style={getPillStyle("warning")}>TOP RISK</span>}
                  {selectedDevice === row.deviceName && <span style={getPillStyle("healthy")}>FOCUSED</span>}
                  {copiedDevice === row.deviceName && <span style={getPillStyle("healthy")}>COPIED</span>}
                  {lastTargetedDevice === row.deviceName && <span style={getPillStyle("warning")}>QUEUED</span>}
                </div>
                <span style={getPillStyle("neutral")}>Priority {row.priority}</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  fontSize: 13,
                  color: "#cbd5e1",
                }}
              >
                <div><strong style={{ color: "#f8fafc" }}>Raw:</strong> {row.rawStatus}</div>
                <div><strong style={{ color: "#f8fafc" }}>Last Seen:</strong> {row.lastSeenText}</div>
                <div><strong style={{ color: "#f8fafc" }}>Delay:</strong> {row.delayText}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <button type="button" onClick={() => copyDeviceName(row.deviceName)} style={{ ...getPillStyle("neutral"), cursor: "pointer", background: "#0b1220" }}>📋 Copy</button>
                <button type="button" onClick={() => targetFaultForDevice(row.deviceName)} style={{ ...getPillStyle("warning"), cursor: "pointer", background: "rgba(245,158,11,0.12)" }}>🎯 Target Fault</button>
                <button type="button" onClick={() => isolateDevice(row.deviceName)} style={{ ...getPillStyle("healthy"), cursor: "pointer", background: "rgba(34,197,94,0.12)" }}>🔎 Isolate</button>
                {selectedDevice === row.deviceName && (
                  <button type="button" onClick={clearDeviceFocus} style={{ ...getPillStyle("neutral"), cursor: "pointer" }}>✖ Clear</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
