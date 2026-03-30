import React, { useMemo } from "react";
import type { RawSensorItem } from "../App";
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
  sensorName: string;
  setSensorName: React.Dispatch<React.SetStateAction<string>>;
  rawValue: string;
  setRawValue: React.Dispatch<React.SetStateAction<string>>;
  rawItems?: RawSensorItem[];
  onSubmitRawSensor: (e: React.FormEvent) => Promise<void>;
  onRefreshRawData: () => void;
  isLoadingRaw: boolean;
  isSubmittingRaw: boolean;
};

export default function RawSensorTab({
  sensorName,
  rawValue,
  setRawValue,
  rawItems = [],
  onSubmitRawSensor,
  onRefreshRawData,
  isLoadingRaw,
  isSubmittingRaw,
}: Props) {
  const safeRawItems = Array.isArray(rawItems) ? rawItems : [];

  const chartData = useMemo(() => {
    return safeRawItems
      .slice()
      .reverse()
      .map((item, index) => ({
        index: index + 1,
        time: formatShortTime(item.ts),
        value: Number(item.value),
      }));
  }, [safeRawItems]);

  return (
    <>
      <section className="chart-card">
        <h2 className="panel-title">Raw Signal Trend</h2>

        {isLoadingRaw ? (
          <div className="chart-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading raw signal chart...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">No raw signal chart data yet.</div>
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
                    dataKey="value"
                    name="Raw Value"
                    stroke="#ef6c00"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-note">
              Latest raw sensor values plotted by sequence.
            </div>
          </>
        )}
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Send Raw Sensor Data</h2>

        <form onSubmit={onSubmitRawSensor} className="form-grid">
          <label>
            <span className="field-label">Sensor Name</span>
            <input
              className="text-input"
              value={sensorName}
              readOnly
              disabled
            />
          </label>

          <label>
            <span className="field-label">Raw Value</span>
            <input
              className="text-input"
              type="number"
              step="0.01"
              value={rawValue}
              onChange={(e) => setRawValue(e.target.value)}
              disabled={isSubmittingRaw}
            />
          </label>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmittingRaw}
          >
            {isSubmittingRaw ? "Submitting..." : "Submit Raw Sensor"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Raw Sensor Data</h2>

        <div className="toolbar">
          <button
            onClick={onRefreshRawData}
            className="btn"
            type="button"
            disabled={isLoadingRaw}
          >
            {isLoadingRaw ? "Refreshing..." : "Refresh Raw Data"}
          </button>
        </div>

        {isLoadingRaw ? (
          <div className="table-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading raw sensor table...</span>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Time</th>
                  <th>Sensor</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {safeRawItems.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No raw sensor data yet</td>
                  </tr>
                ) : (
                  safeRawItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.ts}</td>
                      <td>{item.sensor_name}</td>
                      <td>{item.value}</td>
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