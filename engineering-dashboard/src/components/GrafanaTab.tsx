import React, { useEffect, useMemo, useRef, useState } from "react";
import "./grafana.css";

type Props = {
  selectedDevice: string;
  selectedSensor: string;
};

type PanelCategory =
  | "telemetry"
  | "sensorOverview"
  | "sensorAnalytics"
  | "sensorTables";

type PanelType = "telemetry" | "sensor";
type PanelDataSource = "telemetry" | "sensor_fft" | "sensor_raw" | "mixed";

type PanelKey =
  | "telemetryDelay"
  | "telemetryMessages"
  | "deviceStatus"
  | "messagesBySensor"
  | "onlineStatusTable"
  | "temperatureStat"
  | "humidityStat"
  | "overallHealthScore"
  | "activeAnomalies"
  | "maxDelay"
  | "offlineDevicesCount"
  | "topPredictedRiskDevices"
  | "lowestHealthDevices"
  | "highestDelayDevices"
  | "temperatureTrend"
  | "movingAverage"
  | "criticalTemperatureDevices"
  | "telemetryDelayIssues"
  | "predictedRisk"
  | "systemHealthScore"
  | "fft"
  | "rawSignal"
  | "tempHumidityScatter"
  | "trajectory3d"
  | "masterEngineeringTable"
  | "currentTemperatureStatus"
  | "problemDevices"
  | "recoveryStatus";

type PanelOption = {
  key: PanelKey;
  category: PanelCategory;
  label: string;
  title: string;
  description: string;
  type: PanelType;
  dashboardUid: string;
  dashboardSlug: string;
  panelId: number;
  timeFrom: string;
  timeTo?: string;
  dataSource?: PanelDataSource;
  emptyHint?: string;
};

const GRAFANA_BASE_URL =
  (import.meta.env.VITE_GRAFANA_URL || "http://localhost:4000").replace(/\/+$/, "");

const CATEGORY_OPTIONS: { key: PanelCategory; label: string }[] = [
  { key: "telemetry", label: "Telemetry" },
  { key: "sensorOverview", label: "Sensor Overview" },
  { key: "sensorAnalytics", label: "Sensor Analytics" },
  { key: "sensorTables", label: "Sensor Tables" },
];

function getCategoryLabel(category: PanelCategory) {
  return (
    CATEGORY_OPTIONS.find((item) => item.key === category)?.label ?? "Telemetry"
  );
}

const PANEL_OPTIONS: PanelOption[] = [
  {
    key: "telemetryDelay",
    category: "telemetry",
    label: "Telemetry Delay",
    title: "Telemetry Delay",
    description: "Latest telemetry delay for the selected device.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 1,
    timeFrom: "now-24h",
  },
  {
    key: "telemetryMessages",
    category: "telemetry",
    label: "Total Messages",
    title: "Total Telemetry Messages",
    description: "Total telemetry messages in the selected period.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 2,
    timeFrom: "now-24h",
  },
  {
    key: "deviceStatus",
    category: "telemetry",
    label: "Device Status",
    title: "Device Status",
    description: "Current status of the selected device.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 3,
    timeFrom: "now-24h",
  },
  {
    key: "messagesBySensor",
    category: "telemetry",
    label: "Messages by Sensor",
    title: "Messages by Sensor",
    description: "Telemetry message distribution by sensor.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 4,
    timeFrom: "now-24h",
  },
  {
    key: "onlineStatusTable",
    category: "telemetry",
    label: "Online Status Table",
    title: "Online Status Table",
    description: "Current online/offline table for telemetry devices.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 5,
    timeFrom: "now-24h",
  },
  {
    key: "temperatureStat",
    category: "telemetry",
    label: "Temperature",
    title: "Temperature",
    description: "Latest temperature stat for the selected device.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 6,
    timeFrom: "now-24h",
  },
  {
    key: "humidityStat",
    category: "telemetry",
    label: "Humidity",
    title: "Humidity",
    description: "Latest humidity stat for the selected device.",
    type: "telemetry",
    dashboardUid: "ad8sdbg",
    dashboardSlug: "engineering-telemetry-dashboard",
    panelId: 7,
    timeFrom: "now-24h",
  },

  {
    key: "overallHealthScore",
    category: "sensorOverview",
    label: "Overall Health",
    title: "Overall Health Score",
    description: "Overall health score for the sensor monitoring dashboard.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 1,
    timeFrom: "now-2d",
  },
  {
    key: "activeAnomalies",
    category: "sensorOverview",
    label: "Active Anomalies",
    title: "Active Anomalies",
    description: "Current anomaly count across monitored sensors.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 2,
    timeFrom: "now-2d",
  },
  {
    key: "maxDelay",
    category: "sensorOverview",
    label: "Max Delay",
    title: "Max Delay",
    description: "Maximum telemetry delay across monitored sensors.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 3,
    timeFrom: "now-2d",
  },
  {
    key: "offlineDevicesCount",
    category: "sensorOverview",
    label: "Offline Devices",
    title: "Offline Devices Count",
    description: "Count of offline devices in the sensor dashboard.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 4,
    timeFrom: "now-2d",
  },
  {
    key: "topPredictedRiskDevices",
    category: "sensorOverview",
    label: "Top Risk Devices",
    title: "Top Predicted Risk Devices",
    description: "Predicted highest-risk devices based on model output.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 6,
    timeFrom: "now-2d",
  },
  {
    key: "lowestHealthDevices",
    category: "sensorOverview",
    label: "Lowest Health",
    title: "Lowest Health Devices",
    description: "Lowest health devices currently being monitored.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 7,
    timeFrom: "now-2d",
  },
  {
    key: "highestDelayDevices",
    category: "sensorOverview",
    label: "Highest Delay",
    title: "Highest Delay Devices",
    description: "Devices with the highest telemetry delay.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 8,
    timeFrom: "now-2d",
  },
  {
    key: "criticalTemperatureDevices",
    category: "sensorOverview",
    label: "Critical Temp",
    title: "Critical Temperature Devices",
    description: "Count of current critical temperature devices.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 12,
    timeFrom: "now-2d",
  },
  {
    key: "telemetryDelayIssues",
    category: "sensorOverview",
    label: "Delay Issues",
    title: "Telemetry Delay Issues",
    description: "Current delay issue count for monitored devices.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 13,
    timeFrom: "now-2d",
  },
  {
    key: "predictedRisk",
    category: "sensorOverview",
    label: "Predicted Risk",
    title: "Predicted Risk",
    description: "Current predicted risk reading.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 15,
    timeFrom: "now-2d",
  },
  {
    key: "systemHealthScore",
    category: "sensorOverview",
    label: "System Health",
    title: "System Health Score",
    description: "Overall system health score from sensor analytics.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 16,
    timeFrom: "now-2d",
  },

  {
    key: "temperatureTrend",
    category: "sensorAnalytics",
    label: "Temperature Trend",
    title: "Temperature Trend",
    description: "Temperature trend for the selected sensor/time range.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 9,
    timeFrom: "now-6h",
  },
  {
    key: "movingAverage",
    category: "sensorAnalytics",
    label: "Moving Average",
    title: "Moving Average",
    description: "Short and longer moving average view.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 10,
    timeFrom: "now-6h",
  },
  {
    key: "fft",
    category: "sensorAnalytics",
    label: "FFT",
    title: "Vibration Frequency Analysis (FFT)",
    description: "Frequency-domain vibration view for the selected sensor.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 17,
    timeFrom: "now-1h",
    emptyHint: "Requires FFT spectrum rows for the selected sensor.",
  },
  {
    key: "rawSignal",
    category: "sensorAnalytics",
    label: "Raw Signal",
    title: "Raw Signal",
    description: "Recent raw signal window for the selected sensor.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 18,
    timeFrom: "now-15m",
    emptyHint: "Requires raw signal rows in sensor_raw for the selected sensor and time range.",
  },
  {
    key: "tempHumidityScatter",
    category: "sensorAnalytics",
    label: "Temp vs Humidity",
    title: "Temperature vs Humidity",
    description: "Scatter relationship between temperature and humidity.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 19,
    timeFrom: "now-6h",
  },
  {
    key: "trajectory3d",
    category: "sensorAnalytics",
    label: "3D Trajectory",
    title: "3D Environmental Trajectory",
    description: "3D trajectory for sensor environment movement.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 20,
    timeFrom: "now-6h",
  },

  {
    key: "masterEngineeringTable",
    category: "sensorTables",
    label: "Master Table",
    title: "Master Engineering Table",
    description: "Engineering overview table for active sensor records.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 5,
    timeFrom: "now-2d",
  },
  {
    key: "currentTemperatureStatus",
    category: "sensorTables",
    label: "Temp Status",
    title: "Current Temperature Status",
    description: "Temperature status table for current devices.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 11,
    timeFrom: "now-2d",
  },
  {
    key: "problemDevices",
    category: "sensorTables",
    label: "Problem Devices",
    title: "Problem Devices",
    description: "Devices currently flagged with major issues.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 14,
    timeFrom: "now-2d",
  },
  {
    key: "recoveryStatus",
    category: "sensorTables",
    label: "Recovery Status",
    title: "Recovery Status",
    description: "Recovery state table for recent device behavior.",
    type: "sensor",
    dashboardUid: "add6hwc",
    dashboardSlug: "engineering-sensor-dashboard",
    panelId: 21,
    timeFrom: "now-2d",
  },
];

function buildPanelUrl(
  panel: PanelOption,
  selectedDevice: string,
  selectedSensor: string
) {
  const params = new URLSearchParams({
    orgId: "1",
    panelId: String(panel.panelId),
    from: panel.timeFrom,
    to: panel.timeTo ?? "now",
    timezone: "browser",
  });

  if (panel.type === "telemetry") {
    params.set("var-device", selectedDevice);
    params.set("var-device_label", selectedDevice.replace("sensor_", "Sensor "));
  }

  if (panel.type === "sensor") {
    params.set("var-sensor", selectedSensor);
  }

  return `${GRAFANA_BASE_URL}/d-solo/${panel.dashboardUid}/${panel.dashboardSlug}?${params.toString()}`;
}

export default function GrafanaTab({ selectedDevice, selectedSensor }: Props) {
  const [activeCategory, setActiveCategory] =
    useState<PanelCategory>("telemetry");
  const [activePanelKey, setActivePanelKey] =
    useState<PanelKey>("telemetryDelay");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const visiblePanels = useMemo(
    () => PANEL_OPTIONS.filter((panel) => panel.category === activeCategory),
    [activeCategory]
  );

  useEffect(() => {
    const firstPanel = visiblePanels[0];
    if (firstPanel) {
      setActivePanelKey(firstPanel.key);
    }
  }, [visiblePanels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activePanel =
    visiblePanels.find((panel) => panel.key === activePanelKey) ??
    visiblePanels[0];

  const activeUrl = useMemo(() => {
    if (!activePanel) return "";
    return buildPanelUrl(activePanel, selectedDevice, selectedSensor);
  }, [activePanel, selectedDevice, selectedSensor]);

  useEffect(() => {
    if (!activeUrl) return;
    setIframeLoading(true);
    setIframeError(null);
  }, [activeUrl]);

  const openGrafana = () => {
    if (!activeUrl) return;
    window.open(activeUrl, "_blank", "noopener,noreferrer");
  };

  const refreshEmbed = () => {
    if (!iframeRef.current || !activeUrl) return;

    setIframeLoading(true);
    setIframeError(null);
    iframeRef.current.src = activeUrl;
  };

  if (!activePanel) {
    return null;
  }

  return (
    <div className="grafana-dashboard">
      <section className="grafana-section grafana-section--hero">
        <div className="grafana-sticky-shell">
          <div className="grafana-section-header grafana-section-header--stack">
            <div>
              <h2 className="grafana-section-title">Grafana Monitoring</h2>
              <p className="grafana-section-subtitle">
                Select one Grafana panel at a time for a larger, cleaner
                monitoring view. The selected panel loads automatically.
              </p>
            </div>

            <div className="grafana-inline-actions grafana-inline-actions--top">
              <button
                className="grafana-secondary-btn"
                type="button"
                onClick={refreshEmbed}
                disabled={!activeUrl}
              >
                Refresh Panel
              </button>

              <button
                className="grafana-secondary-btn"
                type="button"
                onClick={openGrafana}
                disabled={!activeUrl}
              >
                Open Full Page
              </button>
            </div>
          </div>

          <div className="grafana-category-dropdown" ref={dropdownRef}>
            <button
              type="button"
              className="grafana-category-trigger"
              onClick={() => setShowCategoryMenu((prev) => !prev)}
              aria-expanded={showCategoryMenu}
              aria-haspopup="menu"
            >
              <span>Main Category:</span>
              <strong>{getCategoryLabel(activeCategory)}</strong>
              <span className="grafana-category-caret">
                {showCategoryMenu ? "▴" : "▾"}
              </span>
            </button>

            {showCategoryMenu && (
              <div className="grafana-category-menu" role="menu">
                {CATEGORY_OPTIONS.map((category) => (
                  <button
                    key={category.key}
                    type="button"
                    className={`grafana-category-menu-item ${
                      activeCategory === category.key ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveCategory(category.key);
                      setShowCategoryMenu(false);
                    }}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grafana-subtab-box">
            <div className="grafana-subtab-box-header">
              <span className="grafana-subtab-box-title">
                {getCategoryLabel(activeCategory)} Panels
              </span>
            </div>

            <div
              className="grafana-view-selector"
              role="tablist"
              aria-label="Grafana panel selector"
            >
              {visiblePanels.map((panel) => (
                <button
                  key={panel.key}
                  type="button"
                  role="tab"
                  aria-selected={activePanelKey === panel.key}
                  className={`grafana-view-chip ${
                    activePanelKey === panel.key ? "active" : ""
                  }`}
                  onClick={() => setActivePanelKey(panel.key)}
                >
                  {panel.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grafana-meta-row grafana-meta-row--tight">
            <span className="grafana-chip">
              <strong>Active Panel:</strong> {activePanel.label}
            </span>
            <span className="grafana-chip info">
              <strong>Telemetry Device:</strong> {selectedDevice}
            </span>
            <span className="grafana-chip info">
              <strong>Sensor:</strong> {selectedSensor}
            </span>
            <span className="grafana-chip success">
              <strong>Mode:</strong> Single Panel Auto Load
            </span>
            <span className="grafana-chip">
              <strong>Data Source:</strong> {activePanel.dataSource ?? "mixed"}
            </span>
          </div>
        </div>
      </section>

      <section className="grafana-section grafana-section--panel">
        <div className="grafana-panel-card grafana-panel-card--hero">
          <div className="grafana-panel-header grafana-panel-header--stack grafana-panel-header--compact">
            <div>
              <h3 className="grafana-panel-title">{activePanel.title}</h3>
              <p className="grafana-panel-subtitle">{activePanel.description}</p>
            </div>
          </div>
                {activePanel.emptyHint ? (
              <p className="grafana-panel-subtitle">{activePanel.emptyHint}</p>
            ) : null}
          <div className="grafana-frame-shell grafana-frame-shell--hero">
            {iframeLoading && !iframeError ? (
              <div className="grafana-frame-state">
                <div className="grafana-frame-state-title">Loading Grafana panel...</div>
                <div className="grafana-frame-state-subtitle">
                  Waiting for the selected dashboard panel to render.
                </div>
              </div>
            ) : null}

            {iframeError ? (
              <div className="grafana-frame-state grafana-frame-state--error">
                <div className="grafana-frame-state-title">Unable to load Grafana panel</div>
                <div className="grafana-frame-state-subtitle">{iframeError}</div>
              </div>
            ) : null}

            <iframe
              ref={iframeRef}
              id="grafana-panel-iframe"
              key={`${activePanel.key}-${selectedDevice}-${selectedSensor}`}
              src={activeUrl}
              className={`grafana-frame grafana-frame--hero ${
                iframeLoading || iframeError ? "grafana-frame--hidden" : ""
              }`}
              title={activePanel.title}
              onLoad={() => {
                setIframeLoading(false);
                setIframeError(null);
              }}
              onError={() => {
                setIframeLoading(false);
                setIframeError(
                  "The Grafana iframe could not be loaded. Check the Grafana URL, dashboard UID, panel ID, and iframe permissions."
                );
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}