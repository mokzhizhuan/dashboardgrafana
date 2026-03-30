import React from "react";
import type { SimulatorStatus, PillKind } from "./AdminTypes";
import { panelStyle, miniCardStyle, labelStyle, valueStyle, getPillStyle, SectionHeader } from "./AdminUi";

type IntelligenceData = {
  score?: number;
  health?: PillKind;
  online?: number;
  stale?: number;
  offline?: number;
  totalDevices?: number;
  heartbeatFreshness?: string;
  modeText?: string;
  advice?: string[];
  dbText?: string;
  ingestText?: string;
};

type Props = {
  intelligence: IntelligenceData | null | undefined;
  status: SimulatorStatus | null;
  activeFaultPresetName: string;
  activeFaultAgeText: string;
  faultDrillRemainingSec: number | null;
  formatAgo: (ts?: string | null) => string;
  formatRemaining: (seconds: number | null) => string;
  isCompactLayout: boolean;
};

const SAFE_PILL_KINDS: PillKind[] = ["healthy", "warning", "critical", "neutral"];

function normalizePillKind(value: unknown): PillKind {
  return SAFE_PILL_KINDS.includes(value as PillKind) ? (value as PillKind) : "neutral";
}

export default function SystemIntelligencePanel({
  intelligence,
  status,
  activeFaultPresetName,
  activeFaultAgeText,
  faultDrillRemainingSec,
  formatAgo,
  formatRemaining,
  isCompactLayout,
}: Props) {
  const safeHealth = normalizePillKind(intelligence?.health);
  const safeScore = typeof intelligence?.score === "number" ? intelligence.score : 0;
  const safeOnline = intelligence?.online ?? 0;
  const safeStale = intelligence?.stale ?? 0;
  const safeOffline = intelligence?.offline ?? 0;
  const safeTotalDevices = intelligence?.totalDevices ?? 0;
  const safeHeartbeatFreshness = intelligence?.heartbeatFreshness || "No heartbeat data";
  const safeModeText = intelligence?.modeText || "Mode unavailable";
  const safeDbText = intelligence?.dbText || "Database state unavailable";
  const safeIngestText = intelligence?.ingestText || "No ingest data";
  const safeAdvice = Array.isArray(intelligence?.advice) && intelligence.advice.length > 0
    ? intelligence.advice
    : ["No recommendations yet. Waiting for runtime and heartbeat data."];
  const healthLabel = `${safeHealth} • ${safeScore}/100`;

  return (
    <div style={panelStyle}>
      <SectionHeader
        title="System Intelligence"
        subtitle="Live health summary from simulator, heartbeats, faults, and ingest flow"
        chips={[
          {
            label: healthLabel,
            kind: safeHealth,
          },
        ]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}
      >
        <div style={miniCardStyle}>
          <div style={labelStyle}>System Health</div>
          <div style={valueStyle}>{safeScore}/100</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Overall runtime confidence</div>
        </div>

        <div style={miniCardStyle}>
          <div style={labelStyle}>Heartbeat State</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <span style={getPillStyle(safeOnline > 0 ? "healthy" : "neutral")}>Online {safeOnline}</span>
            <span style={getPillStyle(safeStale > 0 ? "warning" : "neutral")}>Stale {safeStale}</span>
            <span style={getPillStyle(safeOffline > 0 ? "critical" : "neutral")}>Offline {safeOffline}</span>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 10 }}>Freshest heartbeat: {safeHeartbeatFreshness}</div>
        </div>

        <div style={miniCardStyle}>
          <div style={labelStyle}>Ingest Intelligence</div>
          <div style={valueStyle}>{safeIngestText}</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Rows inserted rate</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>Inserted rows: {status?.rowsInserted ?? 0}</div>
        </div>

        <div style={miniCardStyle}>
          <div style={labelStyle}>Runtime / Source State</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#e5e7eb", lineHeight: 1.5 }}>{safeDbText}</div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>{safeModeText}</div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactLayout ? "1fr" : "minmax(0, 2fr) minmax(280px, 1fr)",
          gap: 10,
          marginTop: 10,
        }}
      >
        <div style={miniCardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Recommendations</div>
          <div style={{ display: "grid", gap: 8 }}>
            {safeAdvice.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#0b1220",
                  border: "1px solid #1f2a3a",
                  color: "#cbd5e1",
                  fontSize: 13,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={miniCardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Live Snapshot</div>
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
            <div><strong style={{ color: "#f8fafc" }}>Running:</strong> {status?.running ? "Yes" : "No"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Paused:</strong> {status?.paused ? "Yes" : "No"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Last insert:</strong> {formatAgo(status?.lastInsertTime)}</div>
            <div><strong style={{ color: "#f8fafc" }}>Fault mode:</strong> {status?.faultMode?.enabled ? `${status.faultMode.fault_type ?? "active"}` : "Off"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Active preset:</strong> {activeFaultPresetName || "None"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Fault age:</strong> {activeFaultAgeText || "--"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Drill countdown:</strong> {faultDrillRemainingSec != null ? formatRemaining(faultDrillRemainingSec) : "--"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Tracked devices:</strong> {safeTotalDevices}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
