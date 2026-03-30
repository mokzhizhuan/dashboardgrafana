import React from "react";
import type { SimulatorStatus, SimulatorSource } from "./AdminTypes";

type Props = {
  status: SimulatorStatus | null;
  source: SimulatorSource;
  setSource: (value: SimulatorSource) => void;
  deviceCount: number;
  setDeviceCount: (value: number) => void;
  intervalSeconds: number;
  setIntervalSeconds: (value: number) => void;
  csvFile: string;
  setCsvFile: (value: string) => void;
  loading: boolean;
  startSimulator: () => void | Promise<void>;
  pauseSimulator: () => void | Promise<void>;
  resumeSimulator: () => void | Promise<void>;
  stopSimulator: () => void | Promise<void>;
  fetchStatus: () => void | Promise<void>;
};

export default function SimulatorControlsPanel({
  status,
  source,
  setSource,
  deviceCount,
  setDeviceCount,
  intervalSeconds,
  setIntervalSeconds,
  csvFile,
  setCsvFile,
  loading,
  startSimulator,
  pauseSimulator,
  resumeSimulator,
  stopSimulator,
  fetchStatus,
}: Props) {
  return (
    <section className="admin-panel admin-panel-simulator">
      <div className="admin-panel-header admin-panel-header-simulator">
        <div>
          <h3 className="admin-panel-title">Simulator</h3>
          <p className="admin-panel-subtitle">
            Main simulator controls and live backend status.
          </p>
        </div>
        <span className="admin-panel-badge admin-panel-badge-simulator">
          {status?.paused ? "Paused" : "Core"}
        </span>
      </div>

      <div className="admin-form-grid admin-form-grid-compact">
        <div className="admin-field">
          <label className="admin-label">Source</label>
          <select
            className="admin-select"
            value={source}
            onChange={(e) => setSource(e.target.value as SimulatorSource)}
            disabled={loading || Boolean(status?.running)}
          >
            <option value="csv">CSV Replay</option>
            <option value="random">Random Live</option>
          </select>
        </div>

        {source === "random" ? (
          <div className="admin-field">
            <label className="admin-label">Device Count</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              max={8}
              value={deviceCount}
              onChange={(e) => setDeviceCount(Number(e.target.value) || 1)}
              disabled={loading || Boolean(status?.running)}
            />
          </div>
        ) : (
          <div className="admin-field">
            <label className="admin-label">CSV File</label>
            <input
              className="admin-input"
              type="text"
              value={csvFile}
              onChange={(e) => setCsvFile(e.target.value)}
              placeholder="telemetry_simulation.csv"
              disabled={loading || Boolean(status?.running)}
            />
          </div>
        )}

        <div className="admin-field">
          <label className="admin-label">Interval (s)</label>
          <div className="admin-field-help">
            Interval can only be changed before starting the simulator.
          </div>
          <input
            className="admin-input"
            type="number"
            min={1}
            step={1}
            value={intervalSeconds}
            onChange={(e) => setIntervalSeconds(Number(e.target.value) || 1)}
            disabled={loading || Boolean(status?.running)}
          />
        </div>
      </div>

      <div className="admin-action-grid">
        <button
          className="action-btn action-btn-success"
          onClick={() => void startSimulator()}
          disabled={Boolean(status?.running) || loading}
        >
          {loading ? "Starting..." : "▶ Start Simulator"}
        </button>

        <button
          className="action-btn action-btn-warning"
          onClick={() => void pauseSimulator()}
          disabled={!status?.running || Boolean(status?.paused) || loading}
        >
          ⏸ Pause
        </button>

        <button
          className="action-btn action-btn-success"
          onClick={() => void resumeSimulator()}
          disabled={!status?.running || !status?.paused || loading}
        >
          ▶ Resume
        </button>

        <button
          className="action-btn action-btn-danger"
          onClick={() => void stopSimulator()}
          disabled={!status?.running || loading}
        >
          {loading ? "Stopping..." : "⏹ Stop Simulator"}
        </button>

        <button
          className="action-btn action-btn-neutral"
          onClick={() => void fetchStatus()}
          disabled={loading}
        >
          🔄 Refresh Status
        </button>
      </div>
    </section>
  );
}