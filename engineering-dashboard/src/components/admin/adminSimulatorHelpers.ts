import type {
  DeviceRow,
  FaultType,
  HeartbeatRow,
  PillKind,
  SeverityType,
  SimulatorStatus,
  StreamMode,
} from "./AdminTypes";
import { getPillStyle } from "./AdminUi";

export function secondsSince(ts?: string | null): number {
  if (!ts) return Number.POSITIVE_INFINITY;
  const parsed = new Date(ts).getTime();
  if (Number.isNaN(parsed)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

export function formatAgo(ts?: string | null): string {
  if (!ts) return "-";
  const sec = secondsSince(ts);
  if (!Number.isFinite(sec)) return "-";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

export function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString() : "--";
}

export function getDelaySec(value?: string | null): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}

export function formatDelay(delaySec: number | null): string {
  if (delaySec == null) return "--";
  if (delaySec < 60) return `${delaySec}s`;
  const min = Math.floor(delaySec / 60);
  const sec = delaySec % 60;
  return `${min}m ${sec}s`;
}

export function formatRemaining(seconds: number | null): string {
  if (seconds == null) return "--";
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec}s`;
}

export function getHeartbeatLabel(row: HeartbeatRow): string {
  if (row.uiStatus === "offline") return "Offline";
  if (row.uiStatus === "stale") return "Stale";
  return "Online";
}

export function buildIntelligence(
  status: SimulatorStatus | null,
  rate: number,
) {
  if (!status) {
    return {
      score: 0,
      health: "neutral" as PillKind,
      online: 0,
      stale: 0,
      offline: 0,
      totalDevices: 0,
      heartbeatFreshness: "-",
      modeText: "-",
      advice: ["Waiting for simulator status..."],
      dbText: "Backend status only",
      ingestText: "-",
    };
  }

  const lastSeenMap = status.deviceLastSeen ?? {};
  const statusMap = status.deviceStatus ?? {};

  const devices = Array.from(new Set([...Object.keys(lastSeenMap), ...Object.keys(statusMap)]))
    .sort()
    .map((deviceName) => {
      const lastSeen = lastSeenMap[deviceName] ?? null;
      const rawStatus = statusMap[deviceName] ?? "unknown";
      const ageSec = secondsSince(lastSeen);

      let state: "online" | "stale" | "offline" = "online";
      if (rawStatus === "offline_simulated") {
        state = "offline";
      } else if (Number.isFinite(ageSec) && ageSec > Math.max(15, (status.interval ?? 5) * 3)) {
        state = "stale";
      }

      return { deviceName, lastSeen, ageSec, rawStatus, state };
    });

  const online = devices.filter((d) => d.state === "online").length;
  const stale = devices.filter((d) => d.state === "stale").length;
  const offline = devices.filter((d) => d.state === "offline").length;
  const totalDevices = devices.length;

  const freshest = [...devices].filter((d) => d.lastSeen).sort((a, b) => a.ageSec - b.ageSec)[0];
  const heartbeatFreshness = freshest?.lastSeen ? formatAgo(freshest.lastSeen) : "-";

  let score = 100;
  if (!status.running) score -= 40;
  if (status.paused) score -= 20;
  if (offline > 0) score -= Math.min(30, offline * 10);
  if (stale > 0) score -= Math.min(15, stale * 5);
  if (status.faultMode?.enabled) score -= 15;
  if (status.error) score -= 20;
  if (status.running && !status.paused && rate <= 0) score -= 10;
  score = Math.max(0, Math.round(score));

  let health: PillKind = "healthy";
  if (score < 55) health = "critical";
  else if (score < 80) health = "warning";

  const advice: string[] = [];
  if (!status.running) advice.push("Simulator is stopped. Start it to resume ingestion.");
  else if (status.paused) advice.push("Simulator is paused. Resume when ready.");
  else advice.push("Ingestion loop is active.");

  if (offline > 0) advice.push(`${offline} device(s) are under offline simulation.`);
  if (stale > 0) advice.push(`${stale} device(s) have stale heartbeat.`);
  if (status.faultMode?.enabled) {
    advice.push(`Fault mode active: ${status.faultMode.fault_type ?? "unknown"} (${status.faultMode.severity ?? "n/a"}).`);
  }
  if (status.error) advice.push(`Backend error detected: ${status.error}`);
  if (rate <= 0 && status.running && !status.paused) {
    advice.push("Insert rate is low. Check simulator loop or backend insertion flow.");
  }
  if (advice.length === 0) advice.push("System looks stable.");

  const modeText =
    status.source === "random"
      ? [
          "Source: random",
          typeof status.interval === "number" ? `Interval: ${status.interval}s` : null,
          typeof status.deviceCount === "number" ? `Devices: ${status.deviceCount}` : null,
          "Mode: Live",
        ]
          .filter(Boolean)
          .join(" • ")
      : [
          status.source ? `Source: ${status.source}` : null,
          typeof status.interval === "number" ? `Interval: ${status.interval}s` : null,
          typeof status.currentIndex === "number" ? `Index: ${status.currentIndex}` : null,
          typeof status.totalRows === "number" ? `Total Rows: ${status.totalRows}` : null,
        ]
          .filter(Boolean)
          .join(" • ");

  return {
    score,
    health,
    online,
    stale,
    offline,
    totalDevices,
    heartbeatFreshness,
    modeText: modeText || "-",
    advice,
    dbText: "Backend status only",
    ingestText: `${rate.toFixed(2)} rows/s`,
  };
}

export function buildDeviceIntelligenceRows(
  status: SimulatorStatus | null,
  staleThresholdSec: number,
  streamMode: StreamMode,
): DeviceRow[] {
  if (!status) return [];

  const lastSeenMap = status.deviceLastSeen ?? {};
  const statusMap = status.deviceStatus ?? {};
  const targetDevices = new Set((status.faultMode?.target_devices ?? []).map((d) => d.trim()));
  const deviceNames = Array.from(new Set([...Object.keys(lastSeenMap), ...Object.keys(statusMap)])).sort();

  return deviceNames.map((deviceName) => {
    const lastSeen = lastSeenMap[deviceName] ?? null;
    const rawStatus = statusMap[deviceName] ?? "unknown";
    const delaySec = secondsSince(lastSeen);

    let uiStatus: "online" | "stale" | "offline" = "online";
    if (rawStatus === "offline_simulated") uiStatus = "offline";
    else if (Number.isFinite(delaySec) && delaySec > staleThresholdSec) uiStatus = "stale";

    const isFaultTarget = targetDevices.has(deviceName);
    const isOfflineSimulated = rawStatus === "offline_simulated";
    const isLive =
      streamMode === "stream" &&
      uiStatus === "online" &&
      Number.isFinite(delaySec) &&
      delaySec <= Math.max(3, Math.min(staleThresholdSec, (status.interval ?? 5) * 2));

    let priority = 0;
    if (uiStatus === "offline") priority += 100;
    else if (uiStatus === "stale") priority += 60;
    else priority += 20;
    if (isFaultTarget) priority += 20;
    if (isOfflineSimulated) priority += 20;
    if (Number.isFinite(delaySec)) priority += Math.min(30, Math.floor(delaySec / 10));

    return {
      deviceName,
      uiStatus,
      rawStatus,
      lastSeen,
      delaySec,
      delayText: !Number.isFinite(delaySec) ? "-" : delaySec < 60 ? `${delaySec}s` : `${Math.floor(delaySec / 60)}m ${delaySec % 60}s`,
      lastSeenText: formatAgo(lastSeen),
      isFaultTarget,
      isOfflineSimulated,
      isLive,
      priority,
    };
  });
}

export function buildVisibleDeviceRows(
  deviceIntelligenceRows: DeviceRow[],
  deviceFilter: "all" | "online" | "stale" | "offline" | "fault",
  deviceSort: "priority_desc" | "name_asc" | "delay_desc" | "status",
  deviceSearch: string,
  showTopRiskOnly: boolean,
): DeviceRow[] {
  const search = deviceSearch.trim().toLowerCase();
  const filtered = deviceIntelligenceRows.filter((row) => {
    const matchesFilter =
      deviceFilter === "all" ? true : deviceFilter === "fault" ? row.isFaultTarget : row.uiStatus === deviceFilter;
    const matchesSearch = search.length === 0 || row.deviceName.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });

  const statusRank: Record<string, number> = { offline: 0, stale: 1, online: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (deviceSort === "name_asc") return a.deviceName.localeCompare(b.deviceName);
    if (deviceSort === "delay_desc") {
      const aDelay = Number.isFinite(a.delaySec) ? a.delaySec : -1;
      const bDelay = Number.isFinite(b.delaySec) ? b.delaySec : -1;
      return bDelay - aDelay || a.deviceName.localeCompare(b.deviceName);
    }
    if (deviceSort === "status") {
      return statusRank[a.uiStatus] - statusRank[b.uiStatus] || b.priority - a.priority || a.deviceName.localeCompare(b.deviceName);
    }
    return b.priority - a.priority || a.deviceName.localeCompare(b.deviceName);
  });

  return showTopRiskOnly ? sorted.filter((row) => row.priority >= 60) : sorted;
}

export function buildDeviceCounts(deviceIntelligenceRows: DeviceRow[]) {
  return {
    all: deviceIntelligenceRows.length,
    online: deviceIntelligenceRows.filter((r) => r.uiStatus === "online").length,
    stale: deviceIntelligenceRows.filter((r) => r.uiStatus === "stale").length,
    offline: deviceIntelligenceRows.filter((r) => r.uiStatus === "offline").length,
    fault: deviceIntelligenceRows.filter((r) => r.isFaultTarget).length,
    topRisk: deviceIntelligenceRows.filter((r) => r.priority >= 60).length,
  };
}

export function buildBackendMetrics(status: SimulatorStatus | null, rate: number) {
  if (!status) {
    return {
      loopHealth: "neutral" as PillKind,
      loopHealthText: "Waiting",
      lastInsertAge: "-",
      activeDevices: 0,
      onlineCount: 0,
      staleCount: 0,
      offlineCount: 0,
      faultPressure: "None",
      summaryMessages: ["Waiting for simulator metrics..."],
    };
  }

  const lastSeenMap = status.deviceLastSeen ?? {};
  const statusMap = status.deviceStatus ?? {};
  const devices = Array.from(new Set([...Object.keys(lastSeenMap), ...Object.keys(statusMap)]));

  let onlineCount = 0;
  let staleCount = 0;
  let offlineCount = 0;
  for (const device of devices) {
    const lastSeen = lastSeenMap[device] ?? null;
    const rawStatus = statusMap[device] ?? "unknown";
    const ageSec = secondsSince(lastSeen);
    if (rawStatus === "offline_simulated") offlineCount += 1;
    else if (Number.isFinite(ageSec) && ageSec > Math.max(15, (status.interval ?? 5) * 3)) staleCount += 1;
    else onlineCount += 1;
  }

  let loopHealth: PillKind = "healthy";
  let loopHealthText = "Healthy";
  if (!status.running) {
    loopHealth = "critical";
    loopHealthText = "Stopped";
  } else if (status.paused) {
    loopHealth = "warning";
    loopHealthText = "Paused";
  } else if (rate <= 0) {
    loopHealth = "warning";
    loopHealthText = "Low Throughput";
  }

  const faultRowsApplied = status.faultRowsApplied ?? 0;
  const offlineEvents = status.offlineEvents ?? 0;
  const faultActive = Boolean(status.faultMode?.enabled);
  let faultPressure = "None";
  if (faultActive || offlineEvents > 0 || faultRowsApplied > 0) {
    const pressureScore = faultRowsApplied + offlineEvents;
    if (pressureScore > 50) faultPressure = "High";
    else if (pressureScore > 10) faultPressure = "Medium";
    else faultPressure = "Low";
  }

  const summaryMessages: string[] = [];
  if (!status.running) summaryMessages.push("Simulator loop is stopped.");
  else if (status.paused) summaryMessages.push("Simulator loop is paused.");
  else summaryMessages.push("Simulator loop is active.");
  if ((status.rowsSkipped ?? 0) > 0) summaryMessages.push(`${status.rowsSkipped} row(s) skipped.`);
  if ((status.faultRowsApplied ?? 0) > 0) summaryMessages.push(`${status.faultRowsApplied} fault-applied row(s) inserted.`);
  if ((status.offlineEvents ?? 0) > 0) summaryMessages.push(`${status.offlineEvents} offline event(s) recorded.`);
  if (offlineCount > 0) summaryMessages.push(`${offlineCount} device(s) currently offline.`);
  else if (staleCount > 0) summaryMessages.push(`${staleCount} device(s) currently stale.`);
  else summaryMessages.push("Heartbeat status looks stable.");

  return {
    loopHealth,
    loopHealthText,
    lastInsertAge: formatAgo(status.lastInsertTime),
    activeDevices: status.deviceCount ?? devices.length,
    onlineCount,
    staleCount,
    offlineCount,
    faultPressure,
    summaryMessages,
  };
}

export function buildTopRiskNames(visibleDeviceRows: DeviceRow[]): Set<string> {
  return new Set(visibleDeviceRows.filter((r) => r.priority >= 60).slice(0, 3).map((r) => r.deviceName));
}

export function buildFaultTargetList(faultDevicesInput: string): string[] {
  return Array.from(new Set(faultDevicesInput.split(",").map((d) => d.trim()).filter(Boolean)));
}

export function buildAvailableFaultDevices(
  availableDevices?: string[],
  deviceIntelligenceRows?: DeviceRow[]
): string[] {
  const safeAvailableDevices = Array.isArray(availableDevices) ? availableDevices : [];
  const safeDeviceRows = Array.isArray(deviceIntelligenceRows) ? deviceIntelligenceRows : [];

  return safeAvailableDevices.length > 0
    ? safeAvailableDevices
    : Array.from(
        new Set(
          safeDeviceRows
            .map((row) => row?.deviceName)
            .filter((name): name is string => typeof name === "string" && name.length > 0)
        )
      ).sort();
}

export function buildFilteredVisibleDeviceNames(visibleDeviceRows: DeviceRow[]): string[] {
  return Array.from(new Set(visibleDeviceRows.map((row) => row.deviceName))).sort();
}

export function buildTopRiskVisibleDeviceNames(visibleDeviceRows: DeviceRow[]): string[] {
  return Array.from(new Set(visibleDeviceRows.filter((row) => row.priority >= 60).map((row) => row.deviceName))).sort();
}

export function buildActiveFaultTargetNames(status: SimulatorStatus | null): string[] {
  return Array.from(new Set((status?.faultMode?.target_devices ?? []).map((d) => d.trim()).filter(Boolean))).sort();
}

export function buildDraftDiffersFromActiveFault(
  status: SimulatorStatus | null,
  faultTargetList: string[],
  faultType: FaultType,
  faultSeverity: SeverityType,
): boolean {
  const activeTargets = Array.from(new Set((status?.faultMode?.target_devices ?? []).map((d) => d.trim()).filter(Boolean))).sort();
  const draftTargets = [...faultTargetList].sort();
  const sameType = (status?.faultMode?.fault_type ?? "") === faultType;
  const sameSeverity = (status?.faultMode?.severity ?? "") === faultSeverity;
  const sameTargets = activeTargets.length === draftTargets.length && activeTargets.every((target, idx) => target === draftTargets[idx]);
  if (!status?.faultMode?.enabled) return false;
  return !(sameType && sameSeverity && sameTargets);
}

export function buildActiveFaultAgeSec(status: SimulatorStatus | null): number | null {
  if (!status?.faultMode?.enabled || !status?.faultMode?.started_at) return null;
  const started = new Date(status.faultMode.started_at).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((Date.now() - started) / 1000));
}

export function buildActiveFaultAgeText(activeFaultAgeSec: number | null): string {
  if (activeFaultAgeSec == null) return "--";
  if (activeFaultAgeSec < 60) return `${activeFaultAgeSec}s`;
  const min = Math.floor(activeFaultAgeSec / 60);
  const sec = activeFaultAgeSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

export function buildActiveFaultPresetName(status: SimulatorStatus | null): string {
  const type = status?.faultMode?.fault_type;
  const severity = status?.faultMode?.severity;
  if (!status?.faultMode?.enabled || !type) return "--";
  if (type === "high_temp" && severity === "high") return "Hot Spike";
  if (type === "stuck_temp" && severity === "medium") return "Sensor Freeze";
  if (type === "drift_up" && severity === "medium") return "Drift Test";
  if (type === "offline" && severity === "high") return "Offline Drill";
  return `${type}${severity ? ` / ${severity}` : ""}`;
}

export function buildActiveFaultVisibleTargets(activeFaultTargetNames: string[], visibleDeviceRows: DeviceRow[]): string[] {
  const visibleNames = new Set(visibleDeviceRows.map((row) => row.deviceName));
  return activeFaultTargetNames.filter((name) => visibleNames.has(name));
}

export function buildActiveFaultHiddenTargets(activeFaultTargetNames: string[], visibleDeviceRows: DeviceRow[]): string[] {
  const visibleNames = new Set(visibleDeviceRows.map((row) => row.deviceName));
  return activeFaultTargetNames.filter((name) => !visibleNames.has(name));
}

export function buildHeartbeatRows(visibleDeviceRows: DeviceRow[], status: SimulatorStatus | null): HeartbeatRow[] {
  const faultTargets = new Set((status?.faultMode?.target_devices ?? []).map((d) => d.trim()));
  return visibleDeviceRows.map((row) => ({
    device: row.deviceName,
    status: row.rawStatus,
    lastSeen: row.lastSeen,
    delaySec: Number.isFinite(row.delaySec) ? row.delaySec : null,
    uiStatus: row.uiStatus,
    isFaultTarget: faultTargets.has(row.deviceName),
    isOfflineSimulated: row.isOfflineSimulated,
    isLive: row.isLive,
  }));
}

export function getDeviceRowStyle(row: {
  uiStatus: "online" | "stale" | "offline";
  isFaultTarget: boolean;
  isOfflineSimulated: boolean;
}): React.CSSProperties {
  if (row.uiStatus === "offline") return { background: "rgba(239, 68, 68, 0.10)" };
  if (row.uiStatus === "stale") return { background: "rgba(245, 158, 11, 0.10)" };
  if (row.isFaultTarget || row.isOfflineSimulated) return { background: "rgba(59, 130, 246, 0.08)" };
  return {};
}

export function getStatusPill(kind: "online" | "stale" | "offline" | "neutral"): React.CSSProperties {
  return getPillStyle(kind === "online" ? "healthy" : kind === "stale" ? "warning" : kind === "offline" ? "critical" : "neutral");
}

export function splitDevicesInput(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function parseIdList(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((num) => Number.isInteger(num) && num > 0),
    ),
  );
}
