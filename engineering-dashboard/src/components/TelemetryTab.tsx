import React, { useMemo } from "react";
import type { TelemetryItem } from "../App";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type Props = {
  deviceName: string;
  setDeviceName: React.Dispatch<React.SetStateAction<string>>;
  temperature: string;
  setTemperature: React.Dispatch<React.SetStateAction<string>>;
  humidity: string;
  setHumidity: React.Dispatch<React.SetStateAction<string>>;
  items: TelemetryItem[];
  onSubmitTelemetry: (e: React.FormEvent) => Promise<void>;
  onRefreshTelemetry: () => void;
  onExportCsv: () => void;
  isLoadingTelemetry: boolean;
  isSubmittingTelemetry: boolean;
};

export default function TelemetryTab({
  deviceName,
  temperature,
  setTemperature,
  humidity,
  setHumidity,
  items,
  onSubmitTelemetry,
  onRefreshTelemetry,
  onExportCsv,
  isLoadingTelemetry,
  isSubmittingTelemetry,
}: Props) {
  const chartData = useMemo(() => {
    return [...items]
      .slice()
      .reverse()
      .map((item, index) => ({
        index: index + 1,
        time: formatShortTime(item.time),
        temperature: Number(item.temperature),
        humidity: Number(item.humidity),
      }));
  }, [items]);

  return (
    <>
      <section className="chart-card">
        <h2 className="panel-title">Telemetry Trend</h2>

        {isLoadingTelemetry ? (
          <div className="chart-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading telemetry chart...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">No telemetry chart data yet.</div>
        ) : (
          <>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" minTickGap={24} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature"
                    stroke="#1976d2"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    name="Humidity"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-note">
              Latest telemetry readings plotted by sequence.
            </div>
          </>
        )}
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Send Telemetry</h2>

        <form onSubmit={onSubmitTelemetry} className="form-grid">
          <label>
            <span className="field-label">Device Name</span>
            <input
              className="text-input"
              value={deviceName}
              readOnly
              disabled
            />
          </label>

          <label>
            <span className="field-label">Temperature</span>
            <input
              className="text-input"
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              disabled={isSubmittingTelemetry}
            />
          </label>

          <label>
            <span className="field-label">Humidity</span>
            <input
              className="text-input"
              type="number"
              step="0.1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              disabled={isSubmittingTelemetry}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={isSubmittingTelemetry}>
            {isSubmittingTelemetry ? "Submitting..." : "Submit Telemetry"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Recent Telemetry</h2>

        <div className="toolbar">
          <button
            onClick={onRefreshTelemetry}
            className="btn"
            type="button"
            disabled={isLoadingTelemetry}
          >
            {isLoadingTelemetry ? "Refreshing..." : "Refresh Telemetry"}
          </button>

          <button onClick={onExportCsv} className="btn" type="button">
            Export Dashboard CSV
          </button>
        </div>

        {isLoadingTelemetry ? (
          <div className="table-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading telemetry table...</span>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Temperature</th>
                  <th>Humidity</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No telemetry yet</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.time}</td>
                      <td>{item.device_name}</td>
                      <td>{item.temperature}</td>
                      <td>{item.humidity}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatShortTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}