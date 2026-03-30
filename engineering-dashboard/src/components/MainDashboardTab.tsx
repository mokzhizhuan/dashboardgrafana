import React, { useEffect, useMemo, useState } from "react";
import "./main-dashboard.css";

type OverviewCard = {
  label: string;
  value: string;
};

type Props = {
  showOverview: boolean;
  setShowOverview: React.Dispatch<React.SetStateAction<boolean>>;
  showControls: boolean;
  setShowControls: React.Dispatch<React.SetStateAction<boolean>>;
  overviewCards: OverviewCard[];
  deviceName: string;
  setDeviceName: React.Dispatch<React.SetStateAction<string>>;
  sensorName: string;
  setSensorName: React.Dispatch<React.SetStateAction<string>>;
  telemetryDeviceOptions: string[];
  sensorOptions: string[];
  autoRefreshEnabled: boolean;
  setAutoRefreshEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  autoRefreshSeconds: number;
  setAutoRefreshSeconds: React.Dispatch<React.SetStateAction<number>>;
  lastAutoRefreshAt: string;
  refreshActiveData: () => Promise<void>;
  status: string;
  telemetryCount: number;
  rawCount: number;
  fftCount: number;
  isLoadingTelemetry: boolean;
  isLoadingRaw: boolean;
  isLoadingFft: boolean;
};

export default function MainDashboardTab({
  showOverview,
  setShowOverview,
  showControls,
  setShowControls,
  overviewCards,
  deviceName,
  setDeviceName,
  sensorName,
  setSensorName,
  telemetryDeviceOptions,
  sensorOptions,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  autoRefreshSeconds,
  setAutoRefreshSeconds,
  lastAutoRefreshAt,
  refreshActiveData,
  status,
  telemetryCount,
  rawCount,
  fftCount,
  isLoadingTelemetry,
  isLoadingRaw,
  isLoadingFft,
}: Props) {
  const isBusy = isLoadingTelemetry || isLoadingRaw || isLoadingFft;
  const hasTelemetryOptions = telemetryDeviceOptions.length > 0;
  const hasSensorOptions = sensorOptions.length > 0;
  const memoCards = useMemo(() => overviewCards, [overviewCards]);
  const hasOverviewCards = memoCards.length > 0;

  return (
     <div className={`main-dashboard ${isBusy ? "loading" : ""}`} style={{ position: "relative" }}>
      <section className="main-section">
        <div className="main-section-header">
          <div>
            <h2 className="main-section-title">Main Dashboard Overview</h2>
            <p className="main-section-subtitle">
              Lightweight summary view for telemetry, raw sensor values, and FFT snapshot data.
            </p>
          </div>

          <div className="main-inline-actions">
            <button
              className="action-btn"
              type="button"
              onClick={() => setShowOverview((v) => !v)}
            >
              {showOverview ? "Hide Overview" : "Show Overview"}
            </button>

            <button
              className="action-btn"
              type="button"
              onClick={() => setShowControls((v) => !v)}
            >
              {showControls ? "Hide Controls" : "Show Controls"}
            </button>
          </div>
        </div>

        {showOverview && (
            hasOverviewCards ? (
              <div className="main-overview-grid">
                {memoCards.map((card) => (
                  <article className="main-summary-card" key={card.label}>
                    <div className="main-summary-label">{card.label}</div>
                    <div className="main-summary-value">{card.value}</div>
                    <div className="main-summary-helper">Current dashboard snapshot</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="main-empty-state">
                Overview data not ready yet.
              </div>
            )
          )}
      </section>

      {showControls && (
        <section className="main-section">
          <div className="main-section-header">
            <div>
              <h2 className="main-section-title">Controls</h2>
              <p className="main-section-subtitle">
                Configure active device, sensor source, and refresh behaviour.
              </p>
            </div>
          </div>

          <div className="main-controls-grid">
            <div className="main-control-card">
              <h3 className="main-control-title">Selection</h3>

              <div className="main-form-grid">
                <label className="main-field">
                  <span className="main-field-label">Telemetry Device</span>
                  <select
                    className="main-select"
                    value={hasTelemetryOptions ? deviceName : ""}
                    onChange={(e) => setDeviceName(e.target.value)}
                    disabled={!hasTelemetryOptions}
                  >
                    {!hasTelemetryOptions ? (
                      <option value="">No devices available</option>
                    ) : (
                      telemetryDeviceOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))
                    )}
                  </select>
                </label>

                <label className="main-field">
                  <span className="main-field-label">Sensor</span>
                  <select
                    className="main-select"
                    value={hasSensorOptions ? sensorName : ""}
                    onChange={(e) => setSensorName(e.target.value)}
                    disabled={!hasSensorOptions}
                  >
                    {!hasSensorOptions ? (
                      <option value="">No sensors available</option>
                    ) : (
                      sensorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))
                    )}
                  </select>
                </label>
              </div>
            </div>

            <div className="main-control-card">
              <h3 className="main-control-title">Refresh Settings</h3>

              <div className="main-form-grid">
                <label className="main-field">
                  <span className="main-field-label">Auto Refresh Seconds</span>
                  <input
                    className="main-input"
                    type="number"
                    min={5}
                    value={autoRefreshSeconds}
                    onChange={(e) => setAutoRefreshSeconds(Number(e.target.value) || 5)}
                  />
                </label>

                <label className="main-field">
                  <span className="main-field-label">Refresh Mode</span>
                  <div className="main-chip-row">
                    <span className={`main-chip ${autoRefreshEnabled ? "success" : "info"}`}>
                      {autoRefreshEnabled ? "Auto Refresh Enabled" : "Manual Refresh"}
                    </span>
                  </div>
                </label>
              </div>

              <div className="main-inline-actions">
                <button
                  className="action-btn"
                  type="button"
                  onClick={refreshActiveData}
                  disabled={isBusy}
                >
                  {isBusy ? "Refreshing..." : "Refresh Current View"}
                </button>

                <label className="main-chip">
                  <input
                    type="checkbox"
                    checked={autoRefreshEnabled}
                    onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
                  />
                  <span>Auto Refresh</span>
                </label>
              </div>

              <div className="main-status-row">
                <span className="main-status-text">
                  Last auto refresh: {lastAutoRefreshAt || "--"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="main-section">
        <div className="main-section-header">
          <div>
            <h2 className="main-section-title">Quick Status</h2>
            <p className="main-section-subtitle">
              Fast operational summary for current frontend data state.
            </p>
          </div>
        </div>

        <div className="main-overview-grid">
          <article className="main-summary-card">
            <div className="main-summary-label">Telemetry Rows</div>
            <div className="main-summary-value">{telemetryCount}</div>
            <div className="main-summary-helper">Telemetry records loaded</div>
          </article>

          <article className="main-summary-card">
            <div className="main-summary-label">Raw Rows</div>
            <div className="main-summary-value">{rawCount}</div>
            <div className="main-summary-helper">Raw sensor records loaded</div>
          </article>

          <article className="main-summary-card">
            <div className="main-summary-label">FFT Rows</div>
            <div className="main-summary-value">{fftCount}</div>
            <div className="main-summary-helper">FFT spectrum records loaded</div>
          </article>

          <article className="main-summary-card">
            <div className="main-summary-label">Status</div>
            <div className="main-summary-value">{status || "--"}</div>
            <div className="main-summary-helper">Current dashboard state</div>
          </article>

          <article className="main-summary-card">
            <div className="main-summary-label">Telemetry Loading</div>
            <div className="main-summary-value">{isLoadingTelemetry ? "Yes" : "No"}</div>
            <div className="main-summary-helper">Telemetry request state</div>
          </article>

          <article className="main-summary-card">
            <div className="main-summary-label">Raw / FFT Loading</div>
            <div className="main-summary-value">
              {isLoadingRaw || isLoadingFft ? "Yes" : "No"}
            </div>
            <div className="main-summary-helper">Signal pipeline loading state</div>
          </article>
        </div>
      </section>
    </div>
  );
}