import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import AdminRoute from "./AdminRoute";
import { isLoggedIn, isAdmin, isViewer, getUsername } from "./auth";
import MLMonitoringDashboard from "./components/mlmonitoring/MLMonitoringDashboard";
import MLModelTab from "./components/MLModelTab";
import PerformanceTab from "./components/PerformanceTab";
import MainDashboardTab from "./components/MainDashboardTab";
import AdminTab from "./components/AdminTab";
import keycloak from "./keycloak";

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
  | "ml-model"
  | "ml-monitoring"
  | "performance"
  | "admin";

/*
  Split backend bases:
  - Django for working telemetry/options endpoints
  - FastAPI kept for FFT endpoints for now
*/
const DJANGO_API_BASE =
  import.meta.env.VITE_DJANGO_API_BASE_URL || "http://localhost:8001";

const FASTAPI_API_BASE =
  import.meta.env.VITE_FASTAPI_API_BASE_URL || "http://localhost:8000";

const GRAFANA_SENSOR_DASHBOARD_URL =
  "http://localhost:4000/d/add6hwc/engineering-sensor-dashboard?orgId=1&from=now-2d&to=now&timezone=browser";

const GRAFANA_PROMETHEUS_DASHBOARD_URL =
  "http://localhost:4000/d/adxv56v/engineering-dashboard-prometheus-monitoring?orgId=1&from=now-1h&to=now&timezone=browser&refresh=5s";

export default function App() {
  const loggedIn = isLoggedIn();

  const username = getUsername() || "Unknown";
  const admin = isAdmin();
  const viewer = isViewer();
  const role = admin ? "admin" : viewer ? "viewer" : "user";
 
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

  const [performanceData, setPerformanceData] = useState<PerformanceSnapshot | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);
  const [isRefreshingPerformance, setIsRefreshingPerformance] = useState(false);

  const telemetryAbortRef = useRef<AbortController | null>(null);
  const rawAbortRef = useRef<AbortController | null>(null);
  const fftAbortRef = useRef<AbortController | null>(null);
  const refreshingRef = useRef(false);
  useEffect(() => {
    if (mainTab === "admin" && !admin) {
      setMainTab("main");
    }
  }, [mainTab, admin]);
  async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  await keycloak.updateToken(30);
    
  if (!keycloak.token) {
    throw new Error("Missing Keycloak token");
  }

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${keycloak.token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
  const openGrafanaDashboard = useCallback((url: string, label: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus(`${label} opened in Grafana`);
  }, []);

  const setDeviceOptionsFromTelemetry = useCallback(
    (rows: TelemetryItem[], preferredDevice?: string) => {
      setDeviceName((prev) => {
        const current = preferredDevice ?? prev;
        if (current) return current;
        return rows.find((row) => row.device_name)?.device_name ?? "";
      });
    },
    []
  );

  const syncSelectedSensor = useCallback((preferredSensor?: string) => {
    setSensorName((prev) => preferredSensor ?? prev ?? "");
  }, []);

  const loadTelemetry = useCallback(
    async (selectedDevice?: string) => {
      const device =
        selectedDevice && selectedDevice !== "all" ? selectedDevice : "";

      telemetryAbortRef.current?.abort();
      const controller = new AbortController();
      telemetryAbortRef.current = controller;

      try {
        setIsLoadingTelemetry(true);

        const url = device
          ? `${DJANGO_API_BASE}/telemetry/?device=${encodeURIComponent(device)}`
          : `${DJANGO_API_BASE}/telemetry/`;

        const res = await authFetch(url, { signal: controller.signal });

        if (!res.ok) {
          throw new Error(`Telemetry request failed: ${res.status}`);
        }

        const data = await res.json();
        const nextItems = Array.isArray(data) ? data : [];

        setItems(nextItems);
        setDeviceOptionsFromTelemetry(nextItems, device || undefined);

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
    [setDeviceOptionsFromTelemetry]
  );

  const loadMainDashboardOptions = useCallback(async () => {
    try {
      const res = await authFetch(`${DJANGO_API_BASE}/main-dashboard/options/`)

      if (!res.ok) {
        throw new Error(`Main dashboard options request failed: ${res.status}`);
      }

      const data = await res.json();

      const dbTelemetryOptions = Array.isArray(data?.telemetry_devices)
        ? data.telemetry_devices
        : [];

      const dbSensorOptions = Array.isArray(data?.sensors)
        ? data.sensors
        : [];

      const nextTelemetryOptions = ["all", ...dbTelemetryOptions.filter((v) => v && v !== "all")];
      const nextSensorOptions = ["all", ...dbSensorOptions.filter((v) => v && v !== "all")];

      setTelemetryDeviceOptions(nextTelemetryOptions);
      setSensorOptions(nextSensorOptions);

      const nextDefaultDevice = nextTelemetryOptions.includes("all")
        ? "all"
        : nextTelemetryOptions[0] ?? "";

      const nextDefaultSensor = nextSensorOptions.includes("all")
        ? "all"
        : nextSensorOptions[0] ?? "";

      setDeviceName((prev) =>
        nextTelemetryOptions.includes(prev) ? prev : nextDefaultDevice
      );

      setSensorName((prev) =>
        nextSensorOptions.includes(prev) ? prev : nextDefaultSensor
      );
    } catch (error) {
      console.error(error);
      setTelemetryDeviceOptions([]);
      setSensorOptions([]);
    }
  }, []);

  const loadRawSensorData = useCallback(
    async (selectedSensor?: string) => {
      const sensor =
        selectedSensor && selectedSensor !== "all" ? selectedSensor : "";

      if (!sensor) {
        setRawItems([]);
        return [];
      }

      rawAbortRef.current?.abort();
      const controller = new AbortController();
      rawAbortRef.current = controller;

      try {
        setIsLoadingRaw(true);

        const res = await authFetch(
          `${FASTAPI_API_BASE}/fft/raw?sensor_name=${encodeURIComponent(sensor)}&limit=50`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Raw sensor request failed: ${res.status}`);
        }

        const data = await res.json();
        const nextItems = Array.isArray(data) ? data : [];

        setRawItems(nextItems);
        syncSelectedSensor(sensor || undefined);

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
    [syncSelectedSensor]
  );

  const loadFftSpectrum = useCallback(async (selectedSensor?: string) => {
    const sensor =
      selectedSensor && selectedSensor !== "all" ? selectedSensor : "";

    if (!sensor) {
      setFftItems([]);
      return [];
    }

    fftAbortRef.current?.abort();
    const controller = new AbortController();
    fftAbortRef.current = controller;

    try {
      setIsLoadingFft(true);

      const res = await authFetch(
        `${FASTAPI_API_BASE}/fft/spectrum?sensor_name=${encodeURIComponent(sensor)}`,
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
      if (!loggedIn || refreshingRef.current) return;

      refreshingRef.current = true;

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

        if (mainTab === "ml-model") {
          setStatus("Loading ML model data...");

          if (!sensorOptions.length) {
            await loadMainDashboardOptions();
          }

          if (sensorName) {
            await Promise.allSettled([
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
            await Promise.allSettled([
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

        if (mainTab === "admin") {
          setStatus("Admin workspace ready");
          return;
        }

        setStatus("Ready");
      } catch (error) {
        console.error(error);
        setStatus("Failed to refresh active data");
      } finally {
        refreshingRef.current = false;
      }
    },
    [
      loggedIn,
      mainTab,
      deviceName,
      sensorName,
      sensorOptions.length,
      loadTelemetry,
      loadMainDashboardOptions,
      loadRawSensorData,
      loadFftSpectrum,
      fetchPerformanceData,
    ]
  );

  useEffect(() => {
    if (!loggedIn) return;

    void (async () => {
      await loadMainDashboardOptions();
      await loadTelemetry();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    void refreshActiveData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    if (mainTab !== "main") return;
    if (!deviceName) return;

    void loadTelemetry(deviceName);
  }, [loggedIn, deviceName, mainTab, loadTelemetry]);

  useEffect(() => {
    if (!loggedIn) return;

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

    void loadRawSensorData(sensorName);
    void loadFftSpectrum(sensorName);
  }, [loggedIn, sensorName, mainTab, loadRawSensorData, loadFftSpectrum]);

  useEffect(() => {
    if (!loggedIn) return;
    if (!autoRefreshEnabled) return;

    const interval = window.setInterval(async () => {
      await refreshActiveData(true);
      setLastAutoRefreshAt(new Date().toLocaleTimeString());
    }, Math.max(5, autoRefreshSeconds) * 1000);

    return () => window.clearInterval(interval);
  }, [loggedIn, autoRefreshEnabled, autoRefreshSeconds, refreshActiveData]);

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

  if (!loggedIn) {
  return (
    <div className="login-screen">
      <div className="login-screen-inner">
        <header className="hero-card login-hero-card">
          <div className="login-hero-copy">
            <p className="login-kicker">Engineering Monitoring Workspace</p>
            <h1 className="hero-title login-hero-title">Winsys Monitoring Platform</h1>
            <p className="hero-subtitle login-hero-subtitle">
              Redirecting to secure login...
            </p>
          </div>
        </header>
      </div>
    </div>
  );
}

  return (
    <div className="dashboard-shell">
      <header className="hero-card">
        <div>
          <h1 className="hero-title">Winsys Monitoring Platform</h1>
          <p className="hero-subtitle">
            Database-driven monitoring platform for Grafana analytics, ML model
            insights, and system performance.
          </p>

          <p className="hero-subtitle" style={{ marginTop: 8 }}>
            Signed in as <strong>{username}</strong> ({role})
          </p>
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => {
              keycloak.logout({
                redirectUri: window.location.origin,
              });
            }}
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="top-tabs">
        <button
          className={`top-tab ${mainTab === "main" ? "active" : ""}`}
          onClick={() => setMainTab("main")}
        >
          Main
        </button>

        <button
          className="top-tab"
          onClick={() =>
            openGrafanaDashboard(
              GRAFANA_SENSOR_DASHBOARD_URL,
              "Monitoring dashboard"
            )
          }
        >
          Monitoring
        </button>

        <button
          className="top-tab"
          onClick={() =>
            openGrafanaDashboard(
              GRAFANA_PROMETHEUS_DASHBOARD_URL,
              "Prometheus monitoring dashboard"
            )
          }
        >
          Metrics
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

        {admin && (
          <button
            className={`top-tab ${mainTab === "admin" ? "active" : ""}`}
            onClick={() => setMainTab("admin")}
          >
            Admin
          </button>
        )}
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

      {mainTab === "admin" &&
        (admin ? (
          <AdminTab />
        ) : (
          <div style={{ maxWidth: 520, margin: "40px auto", padding: 24 }}>
            <div className="panel-card">
              <h2 style={{ marginBottom: 8 }}>Admin Access Required</h2>
              <p style={{ marginBottom: 0, opacity: 0.8 }}>
                You are signed in as <strong>{username}</strong> ({role}), but this
                section requires an admin account.
              </p>
            </div>
          </div>
        ))}
    </div>
  );
}