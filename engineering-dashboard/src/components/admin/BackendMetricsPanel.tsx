import React from "react";
import type { SimulatorStatus, PillKind } from "./AdminTypes";
import { panelStyle, miniCardStyle, labelStyle, valueStyle, SectionHeader } from "./AdminUi";

type BackendMetrics = {
  activeDevices?: number;
  lastInsertAge?: string;
  onlineCount?: number;
  staleCount?: number;
  offlineCount?: number;
  faultPressure?: string;
  loopHealth?: PillKind;
  loopHealthText?: string;
  summaryMessages?: string[];
};

type Props = {
  backendMetrics: BackendMetrics | null | undefined;
  status: SimulatorStatus | null;
  formatDateTime: (value?: string | null) => string;
  isCompactLayout: boolean;
};

const SAFE_PILL_KINDS: PillKind[] = ["healthy", "warning", "critical", "neutral"];

function normalizePillKind(value: unknown): PillKind {
  return SAFE_PILL_KINDS.includes(value as PillKind) ? (value as PillKind) : "neutral";
}

export default function BackendMetricsPanel({
  backendMetrics,
  status,
  formatDateTime,
  isCompactLayout,
}: Props) {
  const safeLoopHealth = normalizePillKind(backendMetrics?.loopHealth);
  const safeLoopHealthText = backendMetrics?.loopHealthText || "Unknown";
  const safeActiveDevices = backendMetrics?.activeDevices ?? 0;
  const safeLastInsertAge = backendMetrics?.lastInsertAge || "--";
  const safeOnlineCount = backendMetrics?.onlineCount ?? 0;
  const safeStaleCount = backendMetrics?.staleCount ?? 0;
  const safeOfflineCount = backendMetrics?.offlineCount ?? 0;
  const safeFaultPressure = backendMetrics?.faultPressure || "No fault pressure data";
  const safeSummaryMessages = Array.isArray(backendMetrics?.summaryMessages) && backendMetrics.summaryMessages.length > 0
    ? backendMetrics.summaryMessages
    : ["No backend notes yet. Waiting for simulator and heartbeat metrics."];

  return (
    <div style={panelStyle}>
      <SectionHeader
        title="Backend / System Metrics"
        subtitle="Loop health, insertion counters, and simulator runtime diagnostics"
        chips={[{ label: safeLoopHealthText, kind: safeLoopHealth }]}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
        }}
      >
        <div style={miniCardStyle}><div style={labelStyle}>Rows Inserted</div><div style={valueStyle}>{status?.rowsInserted ?? 0}</div></div>
        <div style={miniCardStyle}><div style={labelStyle}>Rows Skipped</div><div style={valueStyle}>{status?.rowsSkipped ?? 0}</div></div>
        <div style={miniCardStyle}><div style={labelStyle}>Fault Rows Applied</div><div style={valueStyle}>{status?.faultRowsApplied ?? 0}</div></div>
        <div style={miniCardStyle}><div style={labelStyle}>Offline Events</div><div style={valueStyle}>{status?.offlineEvents ?? 0}</div></div>
        <div style={miniCardStyle}><div style={labelStyle}>Active Devices</div><div style={valueStyle}>{safeActiveDevices}</div></div>
        <div style={miniCardStyle}><div style={labelStyle}>Last Insert Age</div><div style={valueStyle}>{safeLastInsertAge}</div></div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isCompactLayout ? "1fr" : "1.4fr 1fr",
          gap: 10,
          marginTop: 10,
        }}
      >
        <div style={miniCardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Runtime Details</div>
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
            <div><strong style={{ color: "#f8fafc" }}>Running:</strong> {status?.running ? "Yes" : "No"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Paused:</strong> {status?.paused ? "Yes" : "No"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Source:</strong> {status?.source ?? "--"}</div>
            <div><strong style={{ color: "#f8fafc" }}>Interval:</strong> {status?.interval ?? "--"}s</div>
            <div><strong style={{ color: "#f8fafc" }}>Device Count:</strong> {safeActiveDevices}</div>
            <div><strong style={{ color: "#f8fafc" }}>Started At:</strong> {formatDateTime(status?.startedAt)}</div>
            <div><strong style={{ color: "#f8fafc" }}>Last Insert:</strong> {formatDateTime(status?.lastInsertTime)}</div>
          </div>
        </div>

        <div style={miniCardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Health Summary</div>
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#cbd5e1" }}>
            <div><strong style={{ color: "#f8fafc" }}>Loop Health:</strong> {safeLoopHealthText}</div>
            <div><strong style={{ color: "#f8fafc" }}>Fault Pressure:</strong> {safeFaultPressure}</div>
            <div><strong style={{ color: "#f8fafc" }}>Online:</strong> {safeOnlineCount}</div>
            <div><strong style={{ color: "#f8fafc" }}>Stale:</strong> {safeStaleCount}</div>
            <div><strong style={{ color: "#f8fafc" }}>Offline:</strong> {safeOfflineCount}</div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={miniCardStyle}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Backend Notes</div>
          <div style={{ display: "grid", gap: 8 }}>
            {safeSummaryMessages.map((item, idx) => (
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
      </div>
    </div>
  );
}
