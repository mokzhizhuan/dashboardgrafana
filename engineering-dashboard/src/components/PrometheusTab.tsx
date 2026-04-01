import React, { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import "./prometheus-tab.css";

type BadgeInfo = {
  text: string;
  className: string;
};

type PrometheusSummary = {
  app?: {
    up?: boolean;
    metrics_path?: string;
    summary_path?: string;
  };
  telemetry?: {
    total_rows?: number;
    writes_total?: number;
    reads_all_total?: number;
    latest_age_seconds?: number;
    latest_timestamp_seconds?: number;
    read_query_avg_seconds?: number;
    export_query_avg_seconds?: number;
    read_query_count?: number;
    export_query_count?: number;
  };
  simulator?: {
    running?: boolean;
    paused?: boolean;
    insert_failures_total?: number;
    rows_inserted_total?: number;
    last_insert_timestamp_seconds?: number;
  };
  fault?: {
    enabled?: boolean;
    active_fault_type?: string;
    apply_events_total?: number;
  };
  database?: {
    failures_telemetry_write?: number;
    failures_telemetry_read?: number;
    failures_telemetry_export?: number;
  };
  prometheus?: {
    up?: boolean;
    targets_up?: number;
    targets_down?: number;
    last_scrape_duration_seconds?: number;
    scrape_samples?: number;
    job_name?: string;
    job_found?: boolean;
    base_url?: string;
    last_error?: string;
  };
};

type Props = {
  summary: PrometheusSummary | null;
  filteredMetricsText: string;
  rawSummaryText: string;
  lastUpdatedText: string;
  onRefresh: () => void;
  onCopyScrapeTarget?: (value: string) => void;
};

type StatusCardItem = {
  label: string;
  badge: BadgeInfo;
  value: string;
  meta: string;
  valueClassName?: string;
};

type InfoCardItem = {
  label: string;
  value: string;
  subvalue?: string;
  mono?: boolean;
  valueClassName?: string;
  cardClassName?: string;
};

type MetricPreviewPoint = {
  timestamp: number;
  value: number;
};

type MetricPreviewResponse = {
  metric: string;
  points: MetricPreviewPoint[];
  error?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function formatUnavailableText(value?: string | null): string {
  if (value == null || value.trim() === "") return "Unavailable";
  return value;
}

function formatCount(value?: number, fallback = "Unavailable"): string {
  if (value == null || Number.isNaN(value)) return fallback;
  return new Intl.NumberFormat().format(value);
}

function formatDuration(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "Unavailable";
  if (seconds < 60) return `${Math.floor(seconds)}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatSecondsCompact(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "Unavailable";
  if (seconds < 1) return `${seconds.toFixed(3)}s`;
  if (seconds < 10) return `${seconds.toFixed(2)}s`;
  return `${seconds.toFixed(1)}s`;
}

function formatEpochSeconds(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
    return "Unavailable";
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return "Unavailable";

  return date.toLocaleString();
}

function formatLastRefreshText(value?: string, hasSummary?: boolean): string {
  if (!value || !value.trim()) {
    return hasSummary ? "Loaded, timestamp unavailable" : "Not refreshed yet";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function yesNoUnavailable(value?: boolean): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "Unavailable";
}

function getFreshnessBadge(seconds?: number): BadgeInfo {
  if (seconds == null || Number.isNaN(seconds)) {
    return { text: "Unavailable", className: "prometheus-tab__badge--neutral" };
  }
  if (seconds <= 300) {
    return { text: "Fresh", className: "prometheus-tab__badge--ok" };
  }
  if (seconds <= 1800) {
    return { text: "Warning", className: "prometheus-tab__badge--warn" };
  }
  return { text: "Stale", className: "prometheus-tab__badge--danger" };
}

function getFreshnessValueClass(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "";
  if (seconds <= 300) return "prometheus-tab__status-value--ok";
  if (seconds <= 1800) return "prometheus-tab__status-value--warn";
  return "prometheus-tab__status-value--danger";
}

function getFreshnessSummaryText(seconds?: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "Unavailable";
  if (seconds <= 300) return "Fresh";
  if (seconds <= 1800) return "Warning";
  return "Stale";
}

function getAppHealthBadge(value?: boolean): BadgeInfo {
  if (value === true) {
    return { text: "Healthy", className: "prometheus-tab__badge--ok" };
  }
  if (value === false) {
    return { text: "Down", className: "prometheus-tab__badge--danger" };
  }
  return { text: "Unavailable", className: "prometheus-tab__badge--neutral" };
}

function getEnabledBadge(value?: boolean): BadgeInfo {
  if (value === true) {
    return { text: "Enabled", className: "prometheus-tab__badge--ok" };
  }
  if (value === false) {
    return { text: "Disabled", className: "prometheus-tab__badge--danger" };
  }
  return { text: "Unavailable", className: "prometheus-tab__badge--neutral" };
}

function getRunningBadge(value?: boolean): BadgeInfo {
  if (value === true) {
    return { text: "Running", className: "prometheus-tab__badge--ok" };
  }
  if (value === false) {
    return { text: "Stopped", className: "prometheus-tab__badge--danger" };
  }
  return { text: "Unavailable", className: "prometheus-tab__badge--neutral" };
}

function getEndpointBadge(summary: PrometheusSummary | null): BadgeInfo {
  if (summary) {
    return { text: "Healthy", className: "prometheus-tab__badge--ok" };
  }
  return { text: "Unavailable", className: "prometheus-tab__badge--neutral" };
}

async function fetchMetricPreview(
  metric: string,
  minutes = 30,
): Promise<MetricPreviewResponse> {
  const url = `${API_BASE_URL}/prometheus/metric-preview?metric=${encodeURIComponent(metric)}&minutes=${minutes}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new Error(`Metric preview request failed: ${response.status}`);
  }

  try {
    return JSON.parse(rawText) as MetricPreviewResponse;
  } catch {
    throw new Error("Metric preview endpoint did not return JSON. Check VITE_API_BASE_URL or backend route.");
  }
}

function StatusCard({
  label,
  badge,
  value,
  meta,
  valueClassName = "",
}: StatusCardItem) {
  return (
    <div className="prometheus-tab__status-card">
      <div className="prometheus-tab__status-label">{label}</div>
      <span className={`prometheus-tab__badge ${badge.className}`}>{badge.text}</span>
      <div className={`prometheus-tab__status-value ${valueClassName}`.trim()}>{value}</div>
      <div className="prometheus-tab__status-meta">{meta}</div>
    </div>
  );
}

function InfoCard({
  label,
  value,
  subvalue,
  mono = false,
  valueClassName = "",
  cardClassName = "",
}: InfoCardItem) {
  const cardValueClassName = [
    "prometheus-tab__card-value",
    mono ? "prometheus-tab__mono" : "",
    valueClassName,
  ]
    .join(" ")
    .trim();

  const cardClassNames = ["prometheus-tab__card", cardClassName].join(" ").trim();

  return (
    <div className={cardClassNames}>
      <div className="prometheus-tab__card-label">{label}</div>
      <div className={cardValueClassName}>{value}</div>
      {subvalue ? <div className="prometheus-tab__card-subvalue">{subvalue}</div> : null}
    </div>
  );
}

function InfoSection({
  title,
  subtitle,
  cards,
}: {
  title: string;
  subtitle?: string;
  cards: InfoCardItem[];
}) {
  return (
    <section className="prometheus-tab__section">
      <h2 className="prometheus-tab__section-title">{title}</h2>
      {subtitle ? <p className="prometheus-tab__section-subtitle">{subtitle}</p> : null}

      <div className="prometheus-tab__grid">
        {cards.map((card) => (
          <InfoCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}

export default function PrometheusTab({
  summary,
  filteredMetricsText,
  rawSummaryText,
  lastUpdatedText,
  onRefresh,
  onCopyScrapeTarget,
}: Props) {
  const [copyFeedback, setCopyFeedback] = useState<"" | "Copied!" | "Copy failed">("");
  const [copyToast, setCopyToast] = useState<"" | "Scrape target copied">("");
  const [selectedPreviewMetric, setSelectedPreviewMetric] = useState("scrape_duration_seconds");
  const [metricPreview, setMetricPreview] = useState<MetricPreviewResponse | null>(null);
  const [metricPreviewLoading, setMetricPreviewLoading] = useState(false);
  const [metricPreviewError, setMetricPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const timers: number[] = [];

    if (copyFeedback) {
      timers.push(window.setTimeout(() => setCopyFeedback(""), 1800));
    }

    if (copyToast) {
      timers.push(window.setTimeout(() => setCopyToast(""), 2200));
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [copyFeedback, copyToast]);

  useEffect(() => {
    let isActive = true;

    const loadMetricPreview = async () => {
      setMetricPreviewLoading(true);
      setMetricPreviewError(null);

      try {
        const payload = await fetchMetricPreview(selectedPreviewMetric, 30);

        if (!isActive) return;

        if (payload.error) {
          setMetricPreview(null);
          setMetricPreviewError(payload.error);
          return;
        }

        setMetricPreview(payload);
      } catch (error) {
        if (!isActive) return;

        setMetricPreview(null);
        setMetricPreviewError(
          error instanceof Error ? error.message : "Failed to load metric preview.",
        );
      } finally {
        if (isActive) {
          setMetricPreviewLoading(false);
        }
      }
    };

    void loadMetricPreview();

    return () => {
      isActive = false;
    };
  }, [selectedPreviewMetric, lastUpdatedText]);

  const prometheusBaseUrl =
    summary?.prometheus?.base_url ||
    import.meta.env.VITE_PROMETHEUS_URL ||
    "Unavailable";
  const displayScrapeTarget = summary?.app?.metrics_path || "/prometheus/metrics";
  const safeScrapeTarget =
    summary?.app?.metrics_path
      ? `${window.location.origin}${summary.app.metrics_path}`
      : prometheusBaseUrl;

  const latestAge = summary?.telemetry?.latest_age_seconds;

  const dbFailuresTotal =
    (summary?.database?.failures_telemetry_write ?? 0) +
    (summary?.database?.failures_telemetry_read ?? 0) +
    (summary?.database?.failures_telemetry_export ?? 0);

  const freshnessBadge = getFreshnessBadge(latestAge);
  const freshnessValueClass = getFreshnessValueClass(latestAge);
  const appHealthBadge = getAppHealthBadge(summary?.app?.up);
  const simulatorBadge = getRunningBadge(summary?.simulator?.running);
  const faultBadge = getEnabledBadge(summary?.fault?.enabled);
  const endpointBadge = getEndpointBadge(summary);

  const freshnessMeta =
    latestAge == null || Number.isNaN(latestAge)
      ? "No recent telemetry timestamp available"
      : "Warning after 5 min, stale after 30 min without telemetry";

  const endpointMeta = summary
    ? "Summary API reachable"
    : "Refresh to load Prometheus summary";

  const metricsPathText = formatUnavailableText(summary?.app?.metrics_path);
  const summaryPathText = formatUnavailableText(summary?.app?.summary_path);

  const totalRowsText = summary ? formatCount(summary.telemetry?.total_rows, "0") : "Unavailable";
  const writesText = summary ? formatCount(summary.telemetry?.writes_total, "0") : "Unavailable";
  const readsText = summary ? formatCount(summary.telemetry?.reads_all_total, "0") : "Unavailable";

  const simulatorRunningText =
    summary == null ? "Unavailable" : yesNoUnavailable(summary.simulator?.running);
  const simulatorPausedText =
    summary == null ? "Unavailable" : yesNoUnavailable(summary.simulator?.paused);
  const insertFailuresText =
    summary == null ? "Unavailable" : formatCount(summary.simulator?.insert_failures_total, "0");

  const faultModeText =
    summary == null ? "Unavailable" : summary.fault?.enabled ? "Enabled" : "Disabled";

  const activeFaultTypeText =
    summary == null
      ? "Unavailable"
      : formatUnavailableText(summary.fault?.active_fault_type ?? "Unavailable");

  const applyEventsText =
    summary == null ? "Unavailable" : formatCount(summary.fault?.apply_events_total, "0");

  const dbFailuresText = summary == null ? "Unavailable" : formatCount(dbFailuresTotal, "0");

  const prometheusUpText =
    summary == null
      ? "Unavailable"
      : summary.prometheus?.up === true
        ? "Healthy"
        : summary.prometheus?.up === false
          ? "Down"
          : "Unavailable";

  const targetsUpValue = summary == null ? null : summary.prometheus?.targets_up ?? null;
  const targetsDownValue = summary == null ? null : summary.prometheus?.targets_down ?? null;

  const targetsUpText =
    summary == null ? "Unavailable" : formatCount(summary.prometheus?.targets_up, "Unavailable");

  const targetsDownText =
    summary == null
      ? "Unavailable"
      : formatCount(summary.prometheus?.targets_down, "Unavailable");

  const targetsUpValueClass =
    targetsUpValue != null && targetsUpValue > 0 ? "prometheus-tab__card-value--ok" : "";

  const targetsDownValueClass =
    targetsDownValue != null && targetsDownValue > 0
      ? "prometheus-tab__card-value--danger"
      : "";

  const targetsDownCardClass =
    targetsDownValue != null && targetsDownValue > 0
      ? "prometheus-tab__card--danger-soft"
      : "";

  const scrapeDurationText =
    summary == null
      ? "Unavailable"
      : formatSecondsCompact(summary.prometheus?.last_scrape_duration_seconds);

  const scrapeSamplesText =
    summary == null
      ? "Unavailable"
      : formatCount(summary.prometheus?.scrape_samples, "Unavailable");

  const latestTelemetryTimestampText =
    summary == null
      ? "Unavailable"
      : formatEpochSeconds(summary.telemetry?.latest_timestamp_seconds);

  const lastInsertTimestampText =
    summary == null
      ? "Unavailable"
      : formatEpochSeconds(summary.simulator?.last_insert_timestamp_seconds);

  const readQueryAvgDurationText =
    summary == null
      ? "Unavailable"
      : formatSecondsCompact(summary.telemetry?.read_query_avg_seconds);

  const exportQueryAvgDurationText =
    summary == null
      ? "Unavailable"
      : formatSecondsCompact(summary.telemetry?.export_query_avg_seconds);

  const readQueryCountText =
    summary == null ? "Unavailable" : formatCount(summary.telemetry?.read_query_count, "0");

  const exportQueryCountText =
    summary == null ? "Unavailable" : formatCount(summary.telemetry?.export_query_count, "0");

  const rowsInsertedTotalText =
    summary == null ? "Unavailable" : formatCount(summary.simulator?.rows_inserted_total, "0");

  const prometheusBaseUrlText = prometheusBaseUrl;
  const prometheusJobNameText = formatUnavailableText(summary?.prometheus?.job_name);

  const prometheusJobFoundText =
    summary == null
      ? "Unavailable"
      : summary.prometheus?.job_found === true
        ? "Healthy"
        : summary.prometheus?.job_found === false
          ? "Not found"
          : "Unavailable";

  const metricChartData = useMemo(() => {
    if (!metricPreview?.points?.length) return [];

    return metricPreview.points
      .filter(
        (point) =>
          typeof point?.timestamp === "number" &&
          !Number.isNaN(point.timestamp) &&
          typeof point?.value === "number" &&
          !Number.isNaN(point.value),
      )
      .map((point) => ({
        time: new Date(point.timestamp * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        value: point.value,
      }));
  }, [metricPreview]);

  const selectedPreviewMetricLabel =
    selectedPreviewMetric === "scrape_duration_seconds"
      ? "Scrape Duration"
      : selectedPreviewMetric === "scrape_samples"
        ? "Scrape Samples"
        : selectedPreviewMetric === "targets_up"
          ? "Targets Up"
          : selectedPreviewMetric;
  const latestMetricPreviewTimestamp = useMemo(
  () => getLatestMetricPreviewTimestamp(metricPreview),
  [metricPreview],
);

const lastSummaryRefreshText = latestMetricPreviewTimestamp
  ? formatDisplayDateTime(latestMetricPreviewTimestamp)
  : formatDisplayDateTime(lastUpdatedText);
  function formatDisplayDateTime(value?: string | number | null): string {
  if (value == null || value === "") return "Not refreshed yet";

  const date =
    typeof value === "number" ? new Date(value * 1000) : new Date(value);

  if (Number.isNaN(date.getTime())) return "Not refreshed yet";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getLatestMetricPreviewTimestamp(
  preview: MetricPreviewResponse | null,
): number | null {
  if (!preview?.points?.length) return null;

  const validTimestamps = preview.points
    .map((point) => point.timestamp)
    .filter((ts) => typeof ts === "number" && !Number.isNaN(ts));

  if (!validTimestamps.length) return null;

  return Math.max(...validTimestamps);
}
  const handleCopyScrapeTarget = async () => {
    try {
      await navigator.clipboard.writeText(safeScrapeTarget);
      onCopyScrapeTarget?.(safeScrapeTarget);
      setCopyFeedback("Copied!");
      setCopyToast("Scrape target copied");
    } catch (error) {
      console.error("Failed to copy scrape target:", error);
      setCopyFeedback("Copy failed");
    }
  };

  const overviewCards: StatusCardItem[] = [
    {
      label: "App Health",
      badge: appHealthBadge,
      value:
        summary?.app?.up === true
          ? "Healthy"
          : summary?.app?.up === false
            ? "Down"
            : "Unavailable",
      meta: "FastAPI metrics endpoint availability",
    },
    {
      label: "Telemetry Freshness",
      badge: freshnessBadge,
      value:
        latestAge == null || Number.isNaN(latestAge)
          ? "Unavailable"
          : `${getFreshnessSummaryText(latestAge)} · ${formatDuration(latestAge)}`,
      meta: freshnessMeta,
      valueClassName: freshnessValueClass,
    },
    {
      label: "Simulator",
      badge: simulatorBadge,
      value:
        summary?.simulator?.running === true
          ? "Running"
          : summary?.simulator?.running === false
            ? "Stopped"
            : "Unavailable",
      meta: `Paused: ${simulatorPausedText}`,
    },
    {
      label: "Fault Mode",
      badge: faultBadge,
      value: faultModeText,
      meta:
        activeFaultTypeText === "Unavailable"
          ? "No active fault detail available"
          : `Active fault: ${activeFaultTypeText}`,
    },
    {
      label: "Summary Endpoint",
      badge: endpointBadge,
      value: summary ? "Healthy" : "Unavailable",
      meta: endpointMeta,
    },
  ];

  const telemetryCards: InfoCardItem[] = [
    {
      label: "Metrics Path",
      value: metricsPathText,
      mono: true,
    },
    {
      label: "Total Telemetry Rows",
      value: totalRowsText,
    },
    {
      label: "Telemetry Writes",
      value: writesText,
    },
    {
      label: "Telemetry Reads",
      value: readsText,
    },
    {
      label: "Latest Telemetry Timestamp",
      value: latestTelemetryTimestampText,
      subvalue:
        latestAge == null || Number.isNaN(latestAge)
          ? "Telemetry freshness unavailable"
          : `Age: ${formatDuration(latestAge)}`,
    },
    {
      label: "Read Query Avg Duration",
      value: readQueryAvgDurationText,
      subvalue: `Read query count: ${readQueryCountText}`,
    },
    {
      label: "Export Query Avg Duration",
      value: exportQueryAvgDurationText,
      subvalue: `Export query count: ${exportQueryCountText}`,
    },
  ];

  const simulatorCards: InfoCardItem[] = [
    {
      label: "Simulator Running",
      value: simulatorRunningText,
      subvalue: `Paused: ${simulatorPausedText}`,
    },
    {
      label: "Rows Inserted Total",
      value: rowsInsertedTotalText,
      subvalue: `Insert failures: ${insertFailuresText}`,
    },
    {
      label: "Last Insert Timestamp",
      value: lastInsertTimestampText,
    },
    {
      label: "Fault Mode",
      value: faultModeText,
    },
    {
      label: "Active Fault Type",
      value: activeFaultTypeText,
      subvalue: `Apply events: ${applyEventsText}`,
    },
    {
      label: "Database Failures",
      value: dbFailuresText,
    },
  ];

  const scrapeHealthCards: InfoCardItem[] = [
    {
      label: "Prometheus Base URL",
      value: prometheusBaseUrlText,
      mono: true,
    },
    {
      label: "Prometheus Job Name",
      value: prometheusJobNameText,
      mono: true,
    },
    {
      label: "Job Found",
      value: prometheusJobFoundText,
      subvalue: summary?.prometheus?.last_error
        ? `Last error: ${summary.prometheus.last_error}`
        : prometheusJobFoundText === "Healthy"
          ? "Prometheus job present in summary"
          : "Job details unavailable from summary",
    },
    {
      label: "Prometheus Up",
      value: prometheusUpText,
      subvalue:
        prometheusUpText === "Healthy"
          ? "Prometheus endpoint responding"
          : prometheusUpText === "Down"
            ? "Prometheus endpoint down"
            : "Prometheus status unavailable",
    },
    {
      label: "Targets Up",
      value: targetsUpText,
      valueClassName: targetsUpValueClass,
      subvalue: "Healthy scrape targets",
    },
    {
      label: "Targets Down",
      value: targetsDownText,
      valueClassName: targetsDownValueClass,
      cardClassName: targetsDownCardClass,
      subvalue:
        targetsDownValue != null && targetsDownValue > 0
          ? "One or more scrape targets are down"
          : "No scrape targets currently down",
    },
    {
      label: "Last Scrape Duration",
      value: scrapeDurationText,
    },
    {
      label: "Scrape Samples",
      value: scrapeSamplesText,
    },
    {
      label: "Summary Path",
      value: summaryPathText,
      mono: true,
    },
  ];

  const summaryLoadedText = summary ? "Loaded" : "Unavailable";

  const lastFetchCards: InfoCardItem[] = [
    {
      label: "Last Summary Refresh",
      value: lastSummaryRefreshText,
      subvalue: latestMetricPreviewTimestamp
        ? "Latest timestamp from metric preview data"
        : summary
          ? "Latest Prometheus summary refresh timestamp"
          : "Refresh the summary to load the first timestamp",
    },
    {
      label: "Summary Status",
      value: summaryLoadedText,
      subvalue: summary
        ? "Summary endpoint returned monitoring data"
        : "Summary data is currently unavailable",
    },
  ];

  return (
    <section className="prometheus-tab">
      <section className="prometheus-tab__hero">
        <div className="prometheus-tab__header">
          <div className="prometheus-tab__title-group">
            <h1 className="prometheus-tab__title">Prometheus Monitoring</h1>
            <p className="prometheus-tab__subtitle">
              Monitor internal FastAPI metrics, telemetry freshness, simulator activity, and
              Prometheus scrape health from one compact operational view.
            </p>
            <div className="prometheus-tab__meta">
              Last updated: {lastSummaryRefreshText}
            </div>
          </div>

          <div className="prometheus-tab__actions">
            <button
              type="button"
              className="prometheus-tab__button prometheus-tab__button--primary"
              onClick={onRefresh}
            >
              Refresh Summary
            </button>

            <div className="prometheus-tab__copy-group">
              <button
                type="button"
                className="prometheus-tab__button"
                onClick={handleCopyScrapeTarget}
              >
                {copyFeedback === "Copied!" ? "Copied!" : "Copy Scrape Target"}
              </button>

              {copyFeedback && copyFeedback !== "Copied!" ? (
                <span className="prometheus-tab__copy-feedback">{copyFeedback}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {!summary ? (
        <section className="prometheus-tab__empty-state">
          <div className="prometheus-tab__empty-state-title">Prometheus summary unavailable</div>
          <div className="prometheus-tab__empty-state-text">
            Refresh the summary to load Prometheus health, telemetry freshness, and scrape details.
          </div>
        </section>
      ) : null}

      <section className="prometheus-tab__section prometheus-tab__section--overview">
        <h2 className="prometheus-tab__section-title">Overview</h2>
        <p className="prometheus-tab__section-subtitle">
          Core service state, telemetry freshness, and monitoring readiness.
        </p>

        <div className="prometheus-tab__status-strip prometheus-tab__status-strip--compact">
          {overviewCards.map((card) => (
            <StatusCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      <InfoSection
        title="Application & Telemetry"
        subtitle="Telemetry activity, freshness, and backend query performance."
        cards={telemetryCards}
      />

      <InfoSection
        title="Simulator & Fault"
        subtitle="Simulator state, insert activity, and active fault controls."
        cards={simulatorCards}
      />

      <InfoSection
        title="Scrape Health"
        subtitle="Prometheus scrape connectivity, target health, and scrape details."
        cards={scrapeHealthCards}
      />

      <section className="prometheus-tab__section prometheus-tab__section--debug">
        <h2 className="prometheus-tab__section-title">Troubleshooting</h2>
        <p className="prometheus-tab__section-subtitle">
          Secondary monitoring details for fetch verification and metric inspection.
        </p>

        <div className="prometheus-tab__grid">
          {lastFetchCards.map((card) => (
            <InfoCard key={card.label} {...card} />
          ))}
        </div>

        <div className="prometheus-tab__debug-panel">
          <div className="prometheus-tab__debug-panel-header">
            <div>
              <h3 className="prometheus-tab__debug-panel-title">Filtered Metric Preview</h3>
              <p className="prometheus-tab__debug-panel-subtitle">
                Trend preview for the selected Prometheus metric over the last 30 minutes.
              </p>
            </div>

            <div className="prometheus-tab__debug-controls">
              <select
                className="prometheus-tab__select"
                value={selectedPreviewMetric}
                onChange={(event) => setSelectedPreviewMetric(event.target.value)}
              >
                <option value="scrape_duration_seconds">Scrape Duration</option>
                <option value="scrape_samples">Scrape Samples</option>
                <option value="targets_up">Targets Up</option>
              </select>
            </div>
          </div>

          <div className="prometheus-tab__chart-meta">
            <span>{selectedPreviewMetricLabel}</span>
            <span>{metricChartData.length > 0 ? `${metricChartData.length} point(s)` : "0 points"}</span>
          </div>

          {metricPreviewLoading ? (
            <div className="prometheus-tab__debug-empty">Loading metric preview...</div>
          ) : metricPreviewError ? (
            <div className="prometheus-tab__debug-empty">{metricPreviewError}</div>
          ) : metricChartData.length === 0 ? (
            <div className="prometheus-tab__debug-empty">
              No metric preview data available for the selected metric yet.
            </div>
          ) : (
            <div className="prometheus-tab__chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metricChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {copyToast ? (
        <div className="prometheus-tab__toast" role="status" aria-live="polite">
          {copyToast}
        </div>
      ) : null}
    </section>
  );
}