import React, { useMemo, useState } from "react";
import "./prometheusdashboard.css";

type Props = {
  summary?: unknown;
  filteredMetricsText?: string;
  rawSummaryText?: string;
  lastUpdatedText?: string;
  onRefresh?: () => void;
  onCopyScrapeTarget?: (value: string) => void;
};

type PrometheusPanelOption = {
  id: string;
  title: string;
  description: string;
  panelId: number;
};

type PrometheusPanelGroup = {
  id: string;
  label: string;
  panels: PrometheusPanelOption[];
};

const GRAFANA_BASE_URL = "http://localhost:4000";

const PROMETHEUS_DASHBOARD_URL =
  "http://localhost:4000/d/adxv56v/engineering-dashboard-prometheus-monitoring?orgId=1&from=now-1h&to=now&timezone=browser&refresh=5s";

const PANEL_GROUPS: PrometheusPanelGroup[] = [
  {
    id: "application",
    label: "Application",
    panels: [
      { id: "app-up", title: "App Up", description: "Backend application up status.", panelId: 1 },
      { id: "http-request-rate", title: "HTTP Request Rate", description: "Incoming backend request rate.", panelId: 9 },
      { id: "http-5xx-error-rate", title: "HTTP 5xx Error Rate", description: "Server error rate trend.", panelId: 10 },
      { id: "p95-api-latency", title: "P95 API Latency", description: "Backend API latency at p95.", panelId: 11 },
      { id: "requests-by-path", title: "Requests by Path", description: "Traffic split by endpoint path.", panelId: 13 },
    ],
  },
  {
    id: "telemetry",
    label: "Telemetry",
    panels: [
      { id: "latest-telemetry-age", title: "Latest Telemetry Age", description: "Recency of latest telemetry update.", panelId: 4 },
      { id: "telemetry-total-rows", title: "Telemetry Total Rows", description: "Total telemetry rows stored.", panelId: 5 },
      { id: "telemetry-writes-5m", title: "Telemetry Writes (5m)", description: "Recent telemetry write activity.", panelId: 6 },
      { id: "telemetry-query-avg-duration", title: "Telemetry Query Avg Duration", description: "Average telemetry query response duration.", panelId: 12 },
    ],
  },
  {
    id: "simulator-faults",
    label: "Simulator & Faults",
    panels: [
      { id: "simulator-running", title: "Simulator Running", description: "Simulator active status.", panelId: 2 },
      { id: "fault-mode-enabled", title: "Fault Mode Enabled", description: "Fault mode injection enabled status.", panelId: 3 },
      { id: "simulator-insert-failures-15m", title: "Simulator Insert Failures (15m)", description: "Recent simulator insert failures.", panelId: 7 },
      { id: "fault-events-1h", title: "Fault Events (1h)", description: "Recent fault event totals.", panelId: 8 },
      { id: "fault-events-by-type", title: "Fault Events by Type", description: "Fault events grouped by type.", panelId: 14 },
    ],
  },
  {
    id: "prometheus-core",
    label: "Prometheus Core",
    panels: [
      { id: "active-alerts", title: "Active Alerts", description: "Current Prometheus alert count.", panelId: 15 },
      { id: "prometheus-up", title: "Prometheus Up", description: "Prometheus process availability.", panelId: 16 },
      { id: "total-targets", title: "Total Targets", description: "Total configured scrape targets.", panelId: 17 },
      { id: "targets-down", title: "Targets Down", description: "Current down targets.", panelId: 18 },
      { id: "target-up", title: "Target Up", description: "Target up trend.", panelId: 20 },
      { id: "scrape-duration", title: "Scrape Duration", description: "Scrape duration trend.", panelId: 19 },
      { id: "scrape-samples", title: "Scrape Samples", description: "Scraped sample count trend.", panelId: 22 },
    ],
  },
  {
    id: "prometheus-internals",
    label: "Prometheus Internals",
    panels: [
      { id: "prometheus-tsdb-head-series", title: "Prometheus TSDB Head Series", description: "Current TSDB head series count.", panelId: 23 },
      { id: "samples-appended-rate", title: "Samples Appended Rate", description: "Prometheus sample append rate.", panelId: 24 },
      { id: "rule-evaluation-duration", title: "Rule Evaluation Duration", description: "Prometheus rule evaluation metric card.", panelId: 25 },
      { id: "prometheus-http-requests-sec", title: "Prometheus HTTP Requests/sec", description: "Prometheus HTTP request rate.", panelId: 26 },
      { id: "config-reload-success", title: "Config Reload Success", description: "Prometheus config reload success status.", panelId: 27 },
      { id: "last-config-reload-unix-time", title: "Last Config Reload Unix Time", description: "Last config reload timestamp metric.", panelId: 28 },
    ],
  },
];

function buildSoloPanelUrl(panelId: number): string {
  const dashboardUrl = new URL(PROMETHEUS_DASHBOARD_URL);
  const orgId = dashboardUrl.searchParams.get("orgId") || "1";
  const from = dashboardUrl.searchParams.get("from") || "now-1h";
  const to = dashboardUrl.searchParams.get("to") || "now";
  const timezone = dashboardUrl.searchParams.get("timezone") || "browser";
  const refresh = dashboardUrl.searchParams.get("refresh") || "5s";

  return `${GRAFANA_BASE_URL}/d-solo/adxv56v/engineering-dashboard-prometheus-monitoring?orgId=${encodeURIComponent(
    orgId,
  )}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(
    to,
  )}&timezone=${encodeURIComponent(timezone)}&refresh=${encodeURIComponent(
    refresh,
  )}&theme=dark&panelId=${panelId}`;
}

export default function PrometheusDashboard({ lastUpdatedText, onRefresh }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(PANEL_GROUPS[0].id);
  const [selectedPanelId, setSelectedPanelId] = useState<string>(PANEL_GROUPS[0].panels[0].id);

  const selectedGroup = useMemo(
    () => PANEL_GROUPS.find((group) => group.id === selectedGroupId) || PANEL_GROUPS[0],
    [selectedGroupId],
  );

  const selectedPanel = useMemo(() => {
    const panelFromGroup = selectedGroup.panels.find((panel) => panel.id === selectedPanelId);
    return panelFromGroup || selectedGroup.panels[0];
  }, [selectedGroup, selectedPanelId]);

  const panelUrl = useMemo(
    () => buildSoloPanelUrl(selectedPanel.panelId),
    [selectedPanel.panelId],
  );

  const handleGroupChange = (groupId: string) => {
    const nextGroup = PANEL_GROUPS.find((group) => group.id === groupId);
    if (!nextGroup) return;

    setSelectedGroupId(groupId);
    setSelectedPanelId(nextGroup.panels[0].id);
  };

  return (
    <section className="prometheus-tab">
      <section className="prometheus-tab__hero">
        <div className="prometheus-tab__hero-copy">
          <div className="prometheus-tab__eyebrow">Prometheus Monitoring</div>
          <h1 className="prometheus-tab__title">Prometheus Monitoring</h1>
          <p className="prometheus-tab__subtitle">
            View one Grafana Prometheus panel at a time using a cleaner grouped layout.
            First choose a category, then select the panel within that group.
          </p>
          <div className="prometheus-tab__meta">
            Last updated: {lastUpdatedText || "Unavailable"}
          </div>
        </div>

        <div className="prometheus-tab__actions">
          {onRefresh ? (
            <button
              type="button"
              className="prometheus-tab__button"
              onClick={onRefresh}
            >
              Refresh Summary
            </button>
          ) : null}

          <a
            href={PROMETHEUS_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="prometheus-tab__button prometheus-tab__button--primary"
          >
            Open Full Dashboard
          </a>
        </div>
      </section>

      <section className="prometheus-tab__selector-section">
        <div className="prometheus-tab__selector-header">
          <div>
            <h2 className="prometheus-tab__section-title">Category</h2>
            <p className="prometheus-tab__section-subtitle">
              Choose a Prometheus monitoring category first.
            </p>
          </div>
        </div>

        <div className="prometheus-tab__group-list">
          {PANEL_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`prometheus-tab__group-chip ${
                selectedGroup.id === group.id ? "prometheus-tab__group-chip--active" : ""
              }`}
              onClick={() => handleGroupChange(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </section>

      <section className="prometheus-tab__selector-section">
        <div className="prometheus-tab__selector-header">
          <div>
            <h2 className="prometheus-tab__section-title">Panel Selector</h2>
            <p className="prometheus-tab__section-subtitle">
              Showing panels under <strong>{selectedGroup.label}</strong>.
            </p>
          </div>
        </div>

        <div className="prometheus-tab__chip-list">
          {selectedGroup.panels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`prometheus-tab__chip ${
                selectedPanel.id === panel.id ? "prometheus-tab__chip--active" : ""
              }`}
              onClick={() => setSelectedPanelId(panel.id)}
            >
              {panel.title}
            </button>
          ))}
        </div>
      </section>

      <section className="prometheus-tab__panel-section">
        <div className="prometheus-tab__panel-header">
          <div>
            <h2 className="prometheus-tab__section-title">{selectedPanel.title}</h2>
            <p className="prometheus-tab__section-subtitle">{selectedPanel.description}</p>
          </div>

          <a
            href={PROMETHEUS_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
            className="prometheus-tab__panel-link"
          >
            Open Full Dashboard
          </a>
        </div>

        <div className="prometheus-tab__frame-shell">
          <iframe
            title={selectedPanel.title}
            src={panelUrl}
            className="prometheus-tab__frame"
          />
        </div>
      </section>
    </section>
  );
}