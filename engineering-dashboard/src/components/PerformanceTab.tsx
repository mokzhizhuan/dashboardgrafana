import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StatCard from "./StatCard";
import "./performance.css";
import {
  fetchPerformanceSnapshot,
  type PerformanceSnapshot,
  type RuntimeModuleRow,
} from "./performanceApi";

type Props = {
  data?: PerformanceSnapshot | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
};

type ViewState = "idle" | "loading" | "refreshing" | "success" | "empty" | "error";

const REFRESH_INTERVAL_MS = 10000;

const FALLBACK_ERROR_SNAPSHOT: PerformanceSnapshot = {
  telemetryRows: 0,
  rawRows: 0,
  fftRows: 0,
  autoRefresh: false,
  lastRefresh: null,
  latestStatus: "Backend unavailable",
  apiStatus: "error",
  uiStatus: "error",
  runtime: [],
};

function formatMs(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${value.toFixed(2)} ms`;
}

function formatAgeSeconds(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Math.round(value)}s`;
}

function formatDisplayTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString();
}

function normalizeText(value?: string | null) {
  return (value ?? "").trim();
}

function isMissingTableMessage(value?: string | null) {
  const text = normalizeText(value).toLowerCase();
  return (
    text.includes("undefinedtable") ||
    text.includes('relation "') ||
    text.includes("does not exist") ||
    text.includes("sql:")
  );
}

function isBackendUnavailableMessage(value?: string | null) {
  const text = normalizeText(value).toLowerCase();
  return (
    text.includes("operationalerror") ||
    text.includes("connection refused") ||
    text.includes("backend unavailable") ||
    text.includes("failed to fetch")
  );
}

function getHealthTone(status: string) {
  switch (status) {
    case "healthy":
    case "ready":
    case "success":
      return "success" as const;
    case "warning":
    case "refreshing":
      return "warning" as const;
    case "error":
    case "danger":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function getModuleStatus(row: RuntimeModuleRow) {
  if (row.loading) return { text: "Loading", tone: "warning" as const };
  if (row.running) return { text: "Running", tone: "info" as const };
  return { text: "Ready", tone: "success" as const };
}

function getFreshness(lastRefresh?: string | null) {
  if (!lastRefresh) {
    return {
      value: "Unknown",
      helper: "No refresh history available",
      badgeText: "UNKNOWN",
      tone: "default" as const,
    };
  }

  const timestamp = new Date(lastRefresh).getTime();
  if (Number.isNaN(timestamp)) {
    return {
      value: "Unknown",
      helper: `Last update ${lastRefresh}`,
      badgeText: "UNKNOWN",
      tone: "default" as const,
    };
  }

  const ageSeconds = Math.floor((Date.now() - timestamp) / 1000);

  if (ageSeconds <= 15) {
    return {
      value: "Fresh",
      helper: `Updated ${ageSeconds}s ago at ${formatDisplayTime(lastRefresh)}`,
      badgeText: "SYNCED",
      tone: "success" as const,
    };
  }

  if (ageSeconds <= 60) {
    return {
      value: "Aging",
      helper: `Updated ${ageSeconds}s ago at ${formatDisplayTime(lastRefresh)}`,
      badgeText: "CHECK",
      tone: "warning" as const,
    };
  }

  return {
    value: "Stale",
    helper: `Updated ${ageSeconds}s ago at ${formatDisplayTime(lastRefresh)}`,
    badgeText: "STALE",
    tone: "danger" as const,
  };
}

function getSafeSystemHealthValue(snapshot?: PerformanceSnapshot | null) {
  const latestStatus = normalizeText(snapshot?.latestStatus);

  if (!latestStatus) return "--";
  if (isMissingTableMessage(latestStatus)) return "Data unavailable";
  if (isBackendUnavailableMessage(latestStatus)) return "Backend unavailable";

  return latestStatus;
}

function getSafeSystemHealthHelper(
  snapshot?: PerformanceSnapshot | null,
  errorMessage?: string | null,
) {
  if (errorMessage) return errorMessage;

  const latestStatus = normalizeText(snapshot?.latestStatus);

  if (isMissingTableMessage(latestStatus)) {
    return "Required monitoring tables are not ready yet.";
  }

  if (isBackendUnavailableMessage(latestStatus)) {
    return "Backend or database connection is unavailable.";
  }

  return "Current performance monitor state";
}

function getSafeStatusLabel(value?: string | null) {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return "--";
  if (isMissingTableMessage(normalized)) return "no_data";
  if (isBackendUnavailableMessage(normalized)) return "error";

  return normalized;
}

function getSafeStatusHelper(kind: "ui" | "api", snapshot?: PerformanceSnapshot | null) {
  const source = kind === "ui" ? snapshot?.uiStatus : snapshot?.apiStatus;
  const normalized = normalizeText(source);

  if (isMissingTableMessage(normalized)) {
    return "Monitoring tables are not available yet.";
  }

  if (isBackendUnavailableMessage(normalized)) {
    return kind === "api"
      ? "Backend endpoint is currently unavailable."
      : "Frontend is waiting for backend data.";
  }

  return kind === "ui" ? "Frontend rendering state" : "Backend endpoint health";
}

function getViewState(args: {
  effectiveLoading: boolean;
  effectiveRefreshing: boolean;
  errorMessage: string | null;
  current: PerformanceSnapshot | null;
}) {
  const { effectiveLoading, effectiveRefreshing, errorMessage, current } = args;

  if (effectiveLoading) return "loading" as const;
  if (effectiveRefreshing) return "refreshing" as const;
  if (errorMessage && !current) return "error" as const;

  const telemetryRows = current?.telemetryRows ?? 0;
  const rawRows = current?.rawRows ?? 0;
  const fftRows = current?.fftRows ?? 0;
  const runtimeRows = current?.runtime?.length ?? 0;
  const latestStatus = normalizeText(current?.latestStatus);

  const hasAnyData =
    telemetryRows > 0 || rawRows > 0 || fftRows > 0 || runtimeRows > 0;

  if (hasAnyData) return "success" as const;

  if (isMissingTableMessage(latestStatus)) return "empty" as const;
  if (errorMessage) return "error" as const;

  return "empty" as const;
}

function getStateBanner(viewState: ViewState, errorMessage: string | null, current: PerformanceSnapshot | null) {
  if (viewState === "loading" || viewState === "refreshing" || viewState === "success") {
    return null;
  }

  if (viewState === "error") {
    return {
      className: "performance-empty-banner performance-empty-banner-error",
      text: errorMessage || "Performance data could not be loaded.",
    };
  }

  const latestStatus = normalizeText(current?.latestStatus);

  if (isMissingTableMessage(latestStatus)) {
    return {
      className: "performance-empty-banner",
      text: "Monitoring tables are not ready yet. The dashboard is available, but raw and FFT data sources have not been initialized.",
    };
  }

  return {
    className: "performance-empty-banner",
    text: "Monitoring data is not available yet. Start telemetry or refresh after data is inserted.",
  };
}

export default function PerformanceTab({
  data = null,
  isLoading = false,
  isRefreshing = false,
}: Props) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(data);
  const [loading, setLoading] = useState(!data);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDocumentVisible, setIsDocumentVisible] = useState<boolean>(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );

  const hasLoadedOnce = useRef(Boolean(data));
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const current = snapshot ?? data;

  const loadPerformance = useCallback(async () => {
    const nextRequestId = requestIdRef.current + 1;
    requestIdRef.current = nextRequestId;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage(null);

    if (hasLoadedOnce.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchPerformanceSnapshot({ signal: controller.signal });

      if (requestIdRef.current !== nextRequestId) {
        return;
      }

      setSnapshot(result);
      hasLoadedOnce.current = true;
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error("Performance snapshot load failed:", error);

      const nextErrorMessage =
        error instanceof Error ? error.message : "Failed to load performance snapshot.";

      setErrorMessage(nextErrorMessage);

      if (!hasLoadedOnce.current) {
        setSnapshot(FALLBACK_ERROR_SNAPSHOT);
        hasLoadedOnce.current = true;
      }
    } finally {
      if (requestIdRef.current === nextRequestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (data) {
      setSnapshot(data);
      hasLoadedOnce.current = true;
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
  const handleVisibilityChange = () => {
    const visible = !document.hidden;
    setIsDocumentVisible(visible);

    if (visible) {
      void loadPerformance();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
}, [loadPerformance]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsDocumentVisible(visible);

      if (visible) {
        void loadPerformance();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadPerformance]);

  useEffect(() => {
    if (!current?.autoRefresh || !isDocumentVisible) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadPerformance();
    }, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [current?.autoRefresh, isDocumentVisible, loadPerformance]);

  const effectiveLoading = loading || (isLoading && !hasLoadedOnce.current);
  const effectiveRefreshing = refreshing || isRefreshing;

  const runtimeRows = useMemo(() => current?.runtime ?? [], [current]);
  const freshness = useMemo(() => getFreshness(current?.lastRefresh), [current?.lastRefresh]);

  const viewState = useMemo(
    () =>
      getViewState({
        effectiveLoading,
        effectiveRefreshing,
        errorMessage,
        current,
      }),
    [effectiveLoading, effectiveRefreshing, errorMessage, current],
  );

  const stateBanner = useMemo(
    () => getStateBanner(viewState, errorMessage, current),
    [viewState, errorMessage, current],
  );

  const summaryCards = useMemo(
    () => [
      {
        label: "Telemetry Rows",
        value: current?.telemetryRows ?? 0,
        helper: "Latest synced telemetry dataset",
        tone: "info" as const,
      },
      {
        label: "Raw Rows",
        value: current?.rawRows ?? 0,
        helper:
          (current?.rawRows ?? 0) > 0
            ? "Latest raw sensor records"
            : "No raw sensor data available yet",
        tone: "info" as const,
      },
      {
        label: "FFT Rows",
        value: current?.fftRows ?? 0,
        helper:
          (current?.fftRows ?? 0) > 0
            ? "Latest FFT spectrum records"
            : "No FFT spectrum data available yet",
        tone: "info" as const,
      },
      {
        label: "Auto Refresh",
        value: current ? (current.autoRefresh ? "On" : "Off") : "--",
        helper: current?.autoRefresh
          ? isDocumentVisible
            ? `Polling every ${REFRESH_INTERVAL_MS / 1000}s`
            : "Paused while tab is hidden"
          : "Manual refresh mode",
        badgeText: current?.autoRefresh ? (isDocumentVisible ? "ACTIVE" : "PAUSED") : "OFF",
        tone: current?.autoRefresh
          ? (isDocumentVisible ? "success" : "warning")
          : ("default" as const),
      },
      {
        label: "Last Refresh",
        value: formatDisplayTime(current?.lastRefresh),
        helper: effectiveRefreshing ? "Refreshing performance snapshot..." : "Last successful update",
        badgeText: effectiveRefreshing ? "REFRESHING" : "STABLE",
        tone: effectiveRefreshing ? ("warning" as const) : ("default" as const),
      },
      {
        label: "System Health",
        value: getSafeSystemHealthValue(current),
        helper: getSafeSystemHealthHelper(current, errorMessage),
        badgeText: current?.uiStatus ? getSafeStatusLabel(current.uiStatus).toUpperCase() : "UNKNOWN",
        tone: getHealthTone(getSafeStatusLabel(current?.uiStatus)),
      },
    ],
    [current, effectiveRefreshing, errorMessage, isDocumentVisible],
  );

  const insightCards = useMemo(
    () => [
      {
        label: "UI Status",
        value: getSafeStatusLabel(current?.uiStatus),
        helper: getSafeStatusHelper("ui", current),
        badgeText: current?.uiStatus ? getSafeStatusLabel(current.uiStatus).toUpperCase() : "UNKNOWN",
        tone: getHealthTone(getSafeStatusLabel(current?.uiStatus)),
      },
      {
        label: "API Status",
        value: getSafeStatusLabel(current?.apiStatus),
        helper: getSafeStatusHelper("api", current),
        badgeText: current?.apiStatus ? getSafeStatusLabel(current.apiStatus).toUpperCase() : "UNKNOWN",
        tone: getHealthTone(getSafeStatusLabel(current?.apiStatus)),
      },
      {
        label: "API Response",
        value: formatMs(current?.apiResponseMs),
        helper: "End-to-end snapshot request time",
        badgeText: current?.cacheHit ? "CACHE" : "LIVE",
        tone: current?.cacheHit ? ("info" as const) : ("default" as const),
      },
      {
        label: "DB Query Time",
        value: formatMs(current?.dbQueryMs),
        helper: "Database aggregation execution time",
        badgeText: "DB",
        tone: "info" as const,
      },
      {
        label: "Refresh Mode",
        value: current ? (current.autoRefresh ? "Auto" : "Manual") : "--",
        helper: current?.autoRefresh
          ? isDocumentVisible
            ? "Running scheduled background refresh"
            : "Waiting for tab to become visible"
          : "Manual refresh mode only",
        badgeText: current?.autoRefresh ? "AUTO" : "MANUAL",
        tone: current?.autoRefresh ? ("success" as const) : ("default" as const),
      },
      {
        label: "Data Freshness",
        value: freshness.value,
        helper: freshness.helper,
        badgeText: freshness.badgeText,
        tone: freshness.tone,
      },
      {
        label: "Data Age",
        value: formatAgeSeconds(current?.dataAgeSeconds),
        helper: current?.latestDataTimestamp
          ? `Latest data at ${formatDisplayTime(current.latestDataTimestamp)}`
          : "No dataset timestamp available",
        badgeText: current?.dataFreshness
          ? current.dataFreshness.toUpperCase()
          : "UNKNOWN",
        tone:
          current?.dataFreshness === "fresh"
            ? ("success" as const)
            : current?.dataFreshness === "aging"
              ? ("warning" as const)
              : current?.dataFreshness === "stale"
                ? ("danger" as const)
                : ("default" as const),
      },
    ],
    [current, freshness, isDocumentVisible],
  );

  return (
    <div className="prometheus-page">
      <div className="prometheus-page-inner">
        <section
          className={`dashboard-section ${
            effectiveLoading || effectiveRefreshing ? "loading" : ""
          }`}
          style={{ position: "relative" }}
        >
          <div className="section-header-row">
            <div>
              <h2 className="section-title">Performance</h2>
              <p className="section-subtitle">
                Operational status of frontend actions, refresh flow, and data loading state.
              </p>
            </div>

            <div className="section-header-actions">
              <div className="section-header-meta">
                {effectiveRefreshing ? (
                  <span className="refresh-indicator">
                    <span className="refresh-dot" />
                    Refreshing data
                  </span>
                ) : hasLoadedOnce.current ? (
                  <span className={`refresh-indicator ${errorMessage ? "error" : "stable"}`}>
                    <span className="refresh-dot" />
                    {errorMessage ? "Using last good snapshot" : "Data stable"}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                className="performance-refresh-button"
                onClick={() => void loadPerformance()}
                disabled={effectiveRefreshing}
              >
                {effectiveRefreshing ? "Refreshing..." : "Refresh Performance"}
              </button>
            </div>
          </div>

          {stateBanner ? (
            <div className={stateBanner.className}>
              {stateBanner.text}
            </div>
          ) : null}

          <div className="stats-grid">
            {summaryCards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={card.value}
                helper={card.helper}
                badgeText={card.badgeText}
                tone={card.tone}
                loading={effectiveLoading}
              />
            ))}
          </div>

          <div className="dashboard-subsection">
            <h3 className="subsection-title">Runtime State</h3>

            <div className="table-shell">
              <table className="runtime-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Status</th>
                    <th>Loading</th>
                    <th>Running</th>
                    <th>Last Updated</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {effectiveLoading ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <tr key={index}>
                        <td><div className="skeleton skeleton-table" /></td>
                        <td><div className="skeleton skeleton-table" /></td>
                        <td><div className="skeleton skeleton-table" /></td>
                        <td><div className="skeleton skeleton-table" /></td>
                        <td><div className="skeleton skeleton-table" /></td>
                        <td><div className="skeleton skeleton-table" /></td>
                      </tr>
                    ))
                  ) : runtimeRows.length ? (
                    runtimeRows.map((row) => {
                      const status = getModuleStatus(row);
                      return (
                        <tr key={row.module}>
                          <td data-label="Module">{row.module}</td>
                          <td data-label="Status">
                            <span className={`status-pill pill-${status.tone}`}>{status.text}</span>
                          </td>
                          <td data-label="Loading">
                            <span className={`status-pill ${row.loading ? "pill-warning" : "pill-success"}`}>
                              {row.loading ? "Yes" : "No"}
                            </span>
                          </td>
                          <td data-label="Running">
                            <span className={`status-pill ${row.running ? "pill-info" : "pill-default"}`}>
                              {row.running ? "Yes" : "No"}
                            </span>
                          </td>
                          <td data-label="Last Updated">{formatDisplayTime(row.lastUpdated)}</td>
                          <td data-label="Notes">{row.notes || "--"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        {viewState === "error"
                          ? "Runtime data could not be loaded."
                          : "No runtime information available yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-subsection">
            <h3 className="subsection-title">Performance Insights</h3>
            <div className="stats-grid stats-grid-insights">
              {insightCards.map((card) => (
                <StatCard
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  helper={card.helper}
                  badgeText={card.badgeText}
                  tone={card.tone}
                  loading={effectiveLoading}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}