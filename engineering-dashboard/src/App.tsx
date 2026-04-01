import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import LoginPage from "./LoginPage";
import AdminRoute from "./AdminRoute";
import { clearAuth, getRole, getUsername, isLoggedIn } from "./auth";
import MLMonitoringDashboard from "./components/mlmonitoring/MLMonitoringDashboard";
import GrafanaTab from "./components/GrafanaTab";
import MLModelTab from "./components/MLModelTab";
import PerformanceTab from "./components/PerformanceTab";
import MainDashboardTab from "./components/MainDashboardTab";
import PrometheusTab, {
  type PrometheusSummary,
  type PrometheusMetricSample,
} from "./components/PrometheusTab";
import AdminTab from "./components/AdminTab";

export type TelemetryItem = {
  time: string;
  device_name: string;
  temperature: number;
  humidity: number;
};

export type RawSensorItem = {
  id: number;
  ts: string;
  sensor_name: string;
  value: number;
};

export type FFTItem = {
  frequency_hz: number;
  amplitude: number;
};

type RuntimeModuleRow = {
  module: string;
  loading: boolean;
  running: boolean;
  lastUpdated?: string | null;
  notes?: string;
};

export type PerformanceSnapshot = {
  telemetryRows: number;
  rawRows: number;
  fftRows: number;
  autoRefresh: boolean;
  lastRefresh: string | null;
  latestStatus: string;
  apiStatus: "healthy" | "warning" | "error";
  uiStatus: "ready" | "loading" | "refreshing" | "error";
  runtime: RuntimeModuleRow[];
};

type MainTab =
  | "main"
  | "grafana"
  | "prometheus"
  | "ml-model"
  | "ml-monitoring"
  | "performance"
  | "admin";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [mainTab, setMainTab] = useState<MainTab>("main");
  const [showOverview, setShowOverview] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const [deviceName, setDeviceName] = useState("");
  const [sensorName, setSensorName] = useState("");

  const [items, setItems] = useState<TelemetryItem[]>([]);
  const [rawItems, setRawItems] = useState<RawSensorItem[]>([]);
  const [fftItems, setFftItems] = useState<FFTItem[]>([]);

  const [telemetryDeviceOptions, setTelemetryDeviceOptions] = useState<string[]>([]);
  const [sensorOptions, setSensorOptions] = useState<string[]>([]);

  const [status, setStatus] = useState("Ready");
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(10);
  const [lastAutoRefreshAt, setLastAutoRefreshAt] = useState("");

  const [isLoadingTelemetry, setIsLoadingTelemetry] = useState(false);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [isLoadingFft, setIsLoadingFft] = useState(false);
  const [isRunningFft] = useState(false);

  const [prometheusSummary, setPrometheusSummary] =
    useState<PrometheusSummary | null>(null);
  const [prometheusMetrics, setPrometheusMetrics] = useState<PrometheusMetricSample[]>([]);
  const [isLoadingPrometheus, setIsLoadingPrometheus] = useState(false);
  const [prometheusError, setPrometheusError] = useState<string | null>(null);

  const [performanceData, setPerformanceData] =
    useState<PerformanceSnapshot | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isRefreshingPerformance, setIsRefreshingPerformance] = useState(false);

  const [adminLoginMessage, setAdminLoginMessage] = useState("");

  const telemetryAbortRef = useRef<AbortController | null>(null);
  const rawAbortRef = useRef<AbortController | null>(null);
  const fftAbortRef = useRef<AbortController | null>(null);

  const role = getRole();
  const username = getUsername();

  const setDeviceOptionsFromTelemetry = useCallback(
    (rows: TelemetryItem[], preferredDevice?: string) => {
      setDeviceName((prev) => {
        const current = preferredDevice ?? prev;
        if (current) return current;

        const fallback = rows.find((row) => row.device_name)?.device_name ?? "";
        return fallback;
      });
    },
    []
  );

  const syncSelectedSensor = useCallback((preferredSensor?: string) => {
  setSensorName((prev) => preferredSensor ?? prev ?? "");
}, []);

  const loadTelemetry = useCallback(
    async (selectedDevice?: string) => {
      const device = selectedDevice ?? deviceName;

      telemetryAbortRef.current?.abort();
      const controller = new AbortController();
      telemetryAbortRef.current = controller;

      try {
        setIsLoadingTelemetry(true);

        const url = device
          ? `${API_BASE}/telemetry?device=${encodeURIComponent(device)}`
          : `${API_BASE}/telemetry`;

        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          throw new Error(`Telemetry request failed: ${res.status}`);
        }

        const data = await res.json();
        const nextItems = Array.isArray(data) ? data : [];

        setItems(nextItems);
        setDeviceOptionsFromTelemetry(nextItems, device);

        return nextItems;
      } catch (error) {
        if ((error as Error).name === "AbortError") return [];
        console.error(error);
        setItems([]);
        setTelemetryDeviceOptions([]);
        return [];
      } finally {
        if (telemetryAbortRef.current === controller) {
          telemetryAbortRef.current = null;
        }
        setIsLoadingTelemetry(false);
      }
    },
    [deviceName, setDeviceOptionsFromTelemetry]
  );

  const loadMainDashboardOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/main-dashboard/options`);

      if (!res.ok) {
        throw new Error(`Main dashboard options request failed: ${res.status}`);
      }

      const data = await res.json();

      const nextTelemetryOptions = Array.isArray(data?.telemetry_devices)
        ? data.telemetry_devices
        : [];

      const nextSensorOptions = Array.isArray(data?.sensors)
        ? data.sensors
        : [];

      setTelemetryDeviceOptions(nextTelemetryOptions);
      setSensorOptions(nextSensorOptions);

      setDeviceName((prev) =>
        nextTelemetryOptions.includes(prev) ? prev : nextTelemetryOptions[0] ?? ""
      );

      setSensorName((prev) =>
        nextSensorOptions.includes(prev) ? prev : nextSensorOptions[0] ?? ""
      );
    } catch (error) {
      console.error(error);
    }
  }, []);

 const loadRawSensorData = useCallback(
    async (selectedSensor?: string) => {
      const sensor = selectedSensor ?? sensorName;

      if (!sensor) {
        setRawItems([]);
        return [];
      }

      rawAbortRef.current?.abort();
      const controller = new AbortController();
      rawAbortRef.current = controller;

      try {
        setIsLoadingRaw(true);

        const res = await fetch(
          `${API_BASE}/fft/raw?sensor_name=${encodeURIComponent(sensor)}&limit=50`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Raw sensor request failed: ${res.status}`);
        }

        const data = await res.json();
        const nextItems = Array.isArray(data) ? data : [];

        setRawItems(nextItems);
        syncSelectedSensor(sensor);

        return nextItems;
      } catch (error) {
        if ((error as Error).name === "AbortError") return [];
        console.error(error);
        setRawItems([]);
        return [];
      } finally {
        if (rawAbortRef.current === controller) {
          rawAbortRef.current = null;
        }
        setIsLoadingRaw(false);
      }
    },
    [sensorName, syncSelectedSensor]
  );
  const loadFftSpectrum = useCallback(
    async (selectedSensor?: string) => {
      const sensor = selectedSensor ?? sensorName;

      if (!sensor) {
        setFftItems([]);
        return [];
      }

      fftAbortRef.current?.abort();
      const controller = new AbortController();
      fftAbortRef.current = controller;

      try {
        setIsLoadingFft(true);

        const res = await fetch(
          `${API_BASE}/fft/spectrum?sensor_name=${encodeURIComponent(sensor)}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`FFT request failed: ${res.status}`);
        }

        const data = await res.json();
        const nextItems = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        const trimmedItems = nextItems.slice(0, 300);
        setFftItems(trimmedItems);

        return trimmedItems;
      } catch (error) {
        if ((error as Error).name === "AbortError") return [];
        console.error(error);
        setFftItems([]);
        return [];
      } finally {
        if (fftAbortRef.current === controller) {
          fftAbortRef.current = null;
        }
        setIsLoadingFft(false);
      }
    },
    [sensorName]
  );

  const loadPrometheusSummary = useCallback(async () => {
    try {
      setIsLoadingPrometheus(true);
      setPrometheusError(null);

      const [summaryRes, metricsRes] = await Promise.all([
        fetch(`${API_BASE}/prometheus/summary`),
        fetch(`${API_BASE}/prometheus/metrics-data?limit=200`),
      ]);

      if (!summaryRes.ok) {
        throw new Error(`Prometheus summary request failed: ${summaryRes.status}`);
      }

      const summaryData = await summaryRes.json();
      setPrometheusSummary(summaryData);

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setPrometheusMetrics(Array.isArray(metricsData) ? metricsData : []);
      } else {
        setPrometheusMetrics([]);
      }
    } catch (error) {
      console.error(error);
      setPrometheusSummary(null);
      setPrometheusMetrics([]);
      setPrometheusError(
        error instanceof Error ? error.message : "Failed to load Prometheus data"
      );
    } finally {
      setIsLoadingPrometheus(false);
    }
  }, []);

  const fetchPerformanceData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setIsRefreshingPerformance(true);
      } else {
        setIsLoadingPerformance(true);
      }

      try {
        const now = new Date().toISOString();

        const data: PerformanceSnapshot = {
          telemetryRows: items.length,
          rawRows: rawItems.length,
          fftRows: fftItems.length,
          autoRefresh: autoRefreshEnabled,
          lastRefresh: now,
          latestStatus: status,
          apiStatus: "healthy",
          uiStatus: isRefresh ? "refreshing" : "ready",
          runtime: [
            {
              module: "Telemetry",
              loading: isLoadingTelemetry,
              running: false,
              lastUpdated: now,
              notes: items.length ? "Telemetry loaded" : "No telemetry data",
            },
            {
              module: "Raw Sensor",
              loading: isLoadingRaw,
              running: false,
              lastUpdated: now,
              notes: rawItems.length ? "Raw sensor loaded" : "No raw sensor data",
            },
            {
              module: "FFT",
              loading: isLoadingFft,
              running: isRunningFft,
              lastUpdated: now,
              notes: fftItems.length ? "FFT spectrum ready" : "No FFT data",
            },
          ],
        };

        setPerformanceData({
          ...data,
          uiStatus: "ready",
        });
      } catch (error) {
        console.error(error);
        setPerformanceData((prev) =>
          prev
            ? {
                ...prev,
                apiStatus: "error",
                uiStatus: "error",
                latestStatus: "Failed to refresh performance data",
              }
            : {
                telemetryRows: 0,
                rawRows: 0,
                fftRows: 0,
                autoRefresh: false,
                lastRefresh: null,
                latestStatus: "Failed to load performance data",
                apiStatus: "error",
                uiStatus: "error",
                runtime: [],
              }
        );
      } finally {
        setIsLoadingPerformance(false);
        setIsRefreshingPerformance(false);
      }
    },
    [
      items.length,
      rawItems.length,
      fftItems.length,
      autoRefreshEnabled,
      status,
      isLoadingTelemetry,
      isLoadingRaw,
      isLoadingFft,
      isRunningFft,
    ]
  );

  const refreshActiveData = useCallback(
    async (isManual = false) => {
      try {
        if (mainTab === "main") {
          setStatus("Loading main dashboard...");

          await loadTelemetry(deviceName || undefined);

          if (sensorName) {
            await Promise.allSettled([
              loadRawSensorData(sensorName),
              loadFftSpectrum(sensorName),
            ]);
          } else {
            setRawItems([]);
            setFftItems([]);
          }

          setStatus("Main dashboard ready");
          return;
        }

        if (mainTab === "grafana") {
          if (!deviceName) {
            await loadTelemetry();
          }
          if (!sensorOptions.length) {
            await loadMainDashboardOptions();
          }
          setStatus("Grafana ready");
          return;
        }

        if (mainTab === "ml-model") {
          setStatus("Loading ML model data...");

          if (!sensorOptions.length) {
            await loadMainDashboardOptions();
          }

          if (sensorName) {
            await Promise.all([
              loadRawSensorData(sensorName),
              loadFftSpectrum(sensorName),
            ]);
          } else {
            setRawItems([]);
            setFftItems([]);
          }

          setStatus("ML model data ready");
          return;
        }

        if (mainTab === "ml-monitoring") {
          setStatus("ML monitoring dashboard ready");
          return;
        }

        if (mainTab === "performance") {
          setStatus("Loading performance data...");

          await loadTelemetry(deviceName || undefined);

          if (!sensorOptions.length) {
            await loadMainDashboardOptions();
          }

          if (sensorName) {
            await Promise.all([
              loadRawSensorData(sensorName),
              loadFftSpectrum(sensorName),
            ]);
          } else {
            setRawItems([]);
            setFftItems([]);
          }

          await fetchPerformanceData(isManual);
          setStatus("Performance data ready");
          return;
        }

        if (mainTab === "prometheus") {
          setStatus("Loading Prometheus monitoring...");
          await loadPrometheusSummary();
          setStatus("Prometheus monitoring ready");
          return;
        }

        if (mainTab === "admin") {
          setStatus("Admin workspace ready");
          return;
        }

        setStatus("Ready");
      } catch (error) {
        console.error(error);
        setStatus("Failed to refresh active data");
      }
    },
    [
      mainTab,
      deviceName,
      sensorName,
      sensorOptions.length,
      loadTelemetry,
      loadMainDashboardOptions,
      loadRawSensorData,
      loadFftSpectrum,
      loadPrometheusSummary,
      fetchPerformanceData,
    ]
  );

  useEffect(() => {
    loadTelemetry();
    loadMainDashboardOptions();
  }, [loadTelemetry, loadMainDashboardOptions]);

  useEffect(() => {
    refreshActiveData(false);
  }, [mainTab, refreshActiveData]);

  useEffect(() => {
    if (mainTab !== "main") return;
    if (!deviceName) return;
    loadTelemetry(deviceName);
  }, [deviceName, mainTab, loadTelemetry]);

  useEffect(() => {
    if (
      mainTab !== "main" &&
      mainTab !== "ml-model" &&
      mainTab !== "performance"
    ) {
      return;
    }

    if (!sensorName) {
      setRawItems([]);
      setFftItems([]);
      return;
    }

    loadRawSensorData(sensorName);
    loadFftSpectrum(sensorName);
  }, [sensorName, mainTab, loadRawSensorData, loadFftSpectrum]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const interval = window.setInterval(async () => {
      await refreshActiveData(true);
      setLastAutoRefreshAt(new Date().toLocaleTimeString());
    }, Math.max(5, autoRefreshSeconds) * 1000);

    return () => window.clearInterval(interval);
  }, [autoRefreshEnabled, autoRefreshSeconds, refreshActiveData]);

  useEffect(() => {
    return () => {
      telemetryAbortRef.current?.abort();
      rawAbortRef.current?.abort();
      fftAbortRef.current?.abort();
    };
  }, []);

  const latestTelemetry = items[0] ?? null;
  const latestRaw = rawItems[0] ?? null;

  const overviewCards = useMemo(
    () => [
      { label: "Selected Device", value: deviceName || "--" },
      {
        label: "Latest Temperature",
        value: latestTelemetry ? `${latestTelemetry.temperature}` : "--",
      },
      {
        label: "Latest Humidity",
        value: latestTelemetry ? `${latestTelemetry.humidity}` : "--",
      },
      { label: "Selected Sensor", value: sensorName || "--" },
      {
        label: "Latest Raw Value",
        value: latestRaw ? `${latestRaw.value}` : "--",
      },
      { label: "FFT Points", value: `${fftItems.length}` },
    ],
    [deviceName, latestTelemetry, sensorName, latestRaw, fftItems.length]
  );

  return (
    <div className="dashboard-shell">
      <header className="hero-card">
        <div>
          <h1 className="hero-title">Main Grafana Monitoring Dashboard</h1>
          <p className="hero-subtitle">
            Database-driven monitoring platform for Grafana analytics, ML model
            insights, and system performance.
          </p>

          {loggedIn && (
            <p className="hero-subtitle" style={{ marginTop: 8 }}>
              Signed in as <strong>{username}</strong> ({role})
            </p>
          )}
        </div>

        {loggedIn && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => {
                clearAuth();
                setLoggedIn(false);
                setMainTab("main");
                setAdminLoginMessage("");
              }}
            >
              Logout
            </button>
          </div>
        )}
      </header>

      <nav className="top-tabs">
        <button
          className={`top-tab ${mainTab === "main" ? "active" : ""}`}
          onClick={() => setMainTab("main")}
        >
          Main
        </button>

        <button
          className={`top-tab ${mainTab === "grafana" ? "active" : ""}`}
          onClick={() => setMainTab("grafana")}
        >
          Grafana
        </button>

        <button
          className={`top-tab ${mainTab === "ml-model" ? "active" : ""}`}
          onClick={() => setMainTab("ml-model")}
        >
          ML Model
        </button>

        <button
          className={`top-tab ${mainTab === "performance" ? "active" : ""}`}
          onClick={() => setMainTab("performance")}
        >
          Performance
        </button>

        <button
          className={`top-tab ${mainTab === "admin" ? "active" : ""}`}
          onClick={() => setMainTab("admin")}
        >
          Admin
        </button>

        <button
          className={`top-tab ${mainTab === "prometheus" ? "active" : ""}`}
          onClick={() => setMainTab("prometheus")}
        >
          Prometheus
        </button>
      </nav>

      {mainTab === "main" && (
        <MainDashboardTab
          showOverview={showOverview}
          setShowOverview={setShowOverview}
          showControls={showControls}
          setShowControls={setShowControls}
          overviewCards={overviewCards}
          deviceName={deviceName}
          setDeviceName={setDeviceName}
          sensorName={sensorName}
          setSensorName={setSensorName}
          telemetryDeviceOptions={telemetryDeviceOptions}
          sensorOptions={sensorOptions}
          autoRefreshEnabled={autoRefreshEnabled}
          setAutoRefreshEnabled={setAutoRefreshEnabled}
          autoRefreshSeconds={autoRefreshSeconds}
          setAutoRefreshSeconds={setAutoRefreshSeconds}
          lastAutoRefreshAt={lastAutoRefreshAt}
          refreshActiveData={() => refreshActiveData(true)}
          status={status}
          telemetryCount={items.length}
          rawCount={rawItems.length}
          fftCount={fftItems.length}
          isLoadingTelemetry={isLoadingTelemetry}
          isLoadingRaw={isLoadingRaw}
          isLoadingFft={isLoadingFft}
        />
      )}

      {mainTab === "grafana" && (
        <GrafanaTab selectedDevice={deviceName} selectedSensor={sensorName} />
      )}

      {mainTab === "ml-model" && (
        <MLModelTab onOpenMonitoringDashboard={() => setMainTab("ml-monitoring")} />
      )}

      {mainTab === "ml-monitoring" && (
        <MLMonitoringDashboard onBackToModels={() => setMainTab("ml-model")} />
      )}

      {mainTab === "performance" && (
        <PerformanceTab
          data={performanceData}
          isLoading={isLoadingPerformance}
          isRefreshing={isRefreshingPerformance}
        />
      )}

      {mainTab === "admin" && (
        <>
          {!loggedIn ? (
            <LoginPage
              onLoginSuccess={() => {
                setLoggedIn(true);
                setAdminLoginMessage("");
              }}
              message={adminLoginMessage}
            />
          ) : role !== "admin" ? (
            <div style={{ maxWidth: 520, margin: "40px auto", padding: 24 }}>
              <div className="panel-card">
                <h2 style={{ marginBottom: 8 }}>Admin Access Required</h2>
                <p style={{ marginBottom: 0, opacity: 0.8 }}>
                  You are signed in as <strong>{username}</strong> ({role}), but this section
                  requires an admin account.
                </p>
              </div>
            </div>
          ) : (
            <AdminRoute
              onExpired={() => {
                clearAuth();
                setLoggedIn(false);
                setMainTab("main");
                setAdminLoginMessage("Your session expired. Please log in again.");
              }}
            >
              <AdminTab />
            </AdminRoute>
          )}
        </>
      )}

      {mainTab === "prometheus" && (
        <PrometheusTab
          summary={prometheusSummary}
          metrics={prometheusMetrics}
          loading={isLoadingPrometheus}
          error={prometheusError}
          onRefresh={() => loadPrometheusSummary()}
        />
      )}
    </div>
  );
}