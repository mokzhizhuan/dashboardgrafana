import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  FeedbackState,
  FeedbackTone,
  SimulatorSource,
  SimulatorStatus,
  StreamMode,
} from "./AdminTypes";
import {
  postAdminAction,
  readSimulatorDevices,
  readSimulatorStatus,
} from "./adminSimulatorApi";

function normalizeStatus(raw: any): SimulatorStatus {
  return {
    running: raw?.running ?? raw?.is_running ?? false,
    paused: raw?.paused ?? false,
    pausedAt: raw?.pausedAt ?? raw?.paused_at ?? null,
    csvFile: raw?.csvFile ?? raw?.csv_file ?? null,
    interval: raw?.interval ?? raw?.interval_seconds ?? 5,
    loop: raw?.loop ?? true,

    rowsInserted: raw?.rowsInserted ?? raw?.rows_inserted ?? 0,
    rowsSkipped: raw?.rowsSkipped ?? raw?.rows_skipped ?? 0,
    faultRowsApplied: raw?.faultRowsApplied ?? raw?.fault_rows_applied ?? 0,
    offlineEvents: raw?.offlineEvents ?? raw?.offline_events ?? 0,

    currentIndex: raw?.currentIndex ?? raw?.current_index ?? 0,
    totalRows: raw?.totalRows ?? raw?.total_rows ?? 0,

    startedAt: raw?.startedAt ?? raw?.started_at ?? null,
    stoppedAt: raw?.stoppedAt ?? raw?.stopped_at ?? null,
    lastInsertTime: raw?.lastInsertTime ?? raw?.last_insert_time ?? null,
    lastInsertedRow: raw?.lastInsertedRow ?? raw?.last_inserted_row ?? null,

    lastDevice: raw?.lastDevice ?? raw?.last_device ?? null,
    error: raw?.error ?? null,

    legacyHighTempMode:
      raw?.legacyHighTempMode ?? raw?.legacy_high_temp_mode ?? false,

    faultMode: raw?.faultMode ?? raw?.fault_mode ?? null,
    source: raw?.source ?? "csv",

    deviceLastSeen: raw?.deviceLastSeen ?? raw?.device_last_seen ?? {},
    deviceStatus: raw?.deviceStatus ?? raw?.device_status ?? {},
    deviceCount: raw?.deviceCount ?? raw?.device_count ?? 0,
  };
}

export function useSimulatorRuntimeController() {
  const [status, setStatus] = useState<SimulatorStatus | null>(null);
  const [availableDevices, setAvailableDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [streamConnected, setStreamConnected] = useState(false);
  const [streamMode, setStreamMode] = useState<StreamMode>("polling");

  const [source, setSource] = useState<SimulatorSource>("random");
  const [deviceCount, setDeviceCount] = useState(3);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [csvFile, setCsvFile] = useState("telemetry_simulation.csv");

  const [feedback, setFeedbackState] = useState<FeedbackState | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearFeedback = useCallback(() => {
    setFeedbackState(null);
  }, []);

  const setFeedback = useCallback((tone: FeedbackTone, text: string) => {
    setFeedbackState({ tone, text });
  }, []);

  useEffect(() => {
    if (!feedback) return;

    const timeoutMs =
      feedback.tone === "error"
        ? 5500
        : feedback.tone === "warning"
        ? 4200
        : feedback.tone === "info"
        ? 3500
        : 3200;

    const timer = window.setTimeout(() => {
      setFeedbackState(null);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const clearPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await readSimulatorStatus();
      setStatus(normalizeStatus(data));
    } catch (error: any) {
      console.error(error);
      setFeedback("error", error?.message || "Failed to fetch simulator status");
    }
  }, [setFeedback]);

  const fetchAvailableDevices = useCallback(async () => {
    try {
      const data = await readSimulatorDevices();

      if (Array.isArray(data)) {
        setAvailableDevices(
          data.filter(
            (name): name is string =>
              typeof name === "string" && name.trim().length > 0,
          ),
        );
        return;
      }

      if (Array.isArray((data as any)?.devices)) {
        const names = (data as any).devices
          .map((item: any) => (typeof item === "string" ? item : item?.device_name))
          .filter(
            (name: unknown): name is string =>
              typeof name === "string" && name.trim().length > 0,
          );

        setAvailableDevices(names);
        return;
      }

      setAvailableDevices([]);
    } catch (error) {
      console.error(error);
      setAvailableDevices([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchStatus(), fetchAvailableDevices()]);
  }, [fetchStatus, fetchAvailableDevices]);

  const startPolling = useCallback(() => {
    clearPolling();
    setStreamConnected(false);
    setStreamMode("polling");

    pollTimerRef.current = window.setInterval(() => {
      fetchStatus().catch((error) => console.error(error));
    }, 3000);
  }, [clearPolling, fetchStatus]);

  const postAction = useCallback(
    async (
      endpoint: string,
      body?: Record<string, unknown>,
      successFallback = "Action completed",
      errorFallback = "Action failed",
    ) => {
      setLoading(true);
      try {
        const data = await postAdminAction(endpoint, body);
        setFeedback("success", data?.message || successFallback);
        await refreshAll();
        return data;
      } catch (error: any) {
        console.error(error);
        setFeedback("error", error?.message || errorFallback);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [refreshAll, setFeedback],
  );

  useEffect(() => {
    refreshAll().catch((error) => console.error(error));
    startPolling();

    return () => {
      clearPolling();
    };
  }, [refreshAll, startPolling, clearPolling]);

  const startSimulator = useCallback(async () => {
    const body =
      source === "random"
        ? {
            source: "random",
            interval_seconds: Math.max(1, intervalSeconds),
            loop: true,
            device_count: Math.max(1, deviceCount),
          }
        : {
            source: "csv",
            csv_file: csvFile?.trim() || "telemetry_simulation.csv",
            interval_seconds: Math.max(1, intervalSeconds),
            loop: true,
          };

    await postAction(
      "/simulator/start",
      body,
      "Simulator started",
      "Failed to start simulator",
    );
  }, [source, intervalSeconds, deviceCount, csvFile, postAction]);

  const pauseSimulator = useCallback(async () => {
    await postAction(
      "/simulator/pause",
      undefined,
      "Simulator paused",
      "Failed to pause simulator",
    );
  }, [postAction]);

  const resumeSimulator = useCallback(async () => {
    await postAction(
      "/simulator/resume",
      undefined,
      "Simulator resumed",
      "Failed to resume simulator",
    );
  }, [postAction]);

  const stopSimulator = useCallback(async () => {
    await postAction(
      "/simulator/stop",
      undefined,
      "Simulator stopped",
      "Failed to stop simulator",
    );
  }, [postAction]);

  const injectHighTemp = useCallback(async () => {
    await postAction(
      "/simulator/inject/high-temp",
      undefined,
      "High temperature anomaly injected",
      "Failed to inject high temperature anomaly",
    );
  }, [postAction]);

  const startHighTempMode = useCallback(async () => {
    await postAction(
      "/simulator/inject/high-temp/start",
      undefined,
      "High temp mode ON",
      "Failed to start high temp mode",
    );
  }, [postAction]);

  const stopHighTempMode = useCallback(async () => {
    await postAction(
      "/simulator/inject/high-temp/stop",
      undefined,
      "High temp mode OFF",
      "Failed to stop high temp mode",
    );
  }, [postAction]);

  const injectOfflineGap = useCallback(async () => {
    await postAction(
      "/simulator/inject/offline-gap",
      undefined,
      "Offline gap injected",
      "Failed to inject offline gap",
    );
  }, [postAction]);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      await refreshAll();
      setFeedback("info", "Status refreshed");
    } catch (error: any) {
      console.error(error);
      setFeedback("error", error?.message || "Failed to refresh status");
    } finally {
      setLoading(false);
    }
  }, [refreshAll, setFeedback]);

  const rate = useMemo(() => {
    if (!status?.interval || status.interval <= 0) return 0;

    const activeDevices = status.deviceCount || deviceCount || 0;
    return status.running && !status.paused
      ? Number((activeDevices / status.interval).toFixed(2))
      : 0;
  }, [status, deviceCount]);

  return {
    status,
    availableDevices,
    loading,
    feedback,

    streamConnected,
    streamMode,

    source,
    setSource,
    deviceCount,
    setDeviceCount,
    intervalSeconds,
    setIntervalSeconds,
    csvFile,
    setCsvFile,

    rate,

    fetchStatus,
    fetchAvailableDevices,
    refreshAll,
    refreshStatus,
    postAction,

    setFeedback,
    clearFeedback,

    startSimulator,
    pauseSimulator,
    resumeSimulator,
    stopSimulator,

    injectHighTemp,
    startHighTempMode,
    stopHighTempMode,
    injectOfflineGap,
  };
}