import React, { useMemo } from "react";
import type { FFTItem } from "../App";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Props = {
  sensorName: string;
  setSensorName: React.Dispatch<React.SetStateAction<string>>;
  samplingRate: string;
  setSamplingRate: React.Dispatch<React.SetStateAction<string>>;
  windowSize: string;
  setWindowSize: React.Dispatch<React.SetStateAction<string>>;
  fftItems?: FFTItem[];
  onRunFft: () => Promise<void>;
  onRefreshFft: () => void;
  isLoadingFft: boolean;
  isRunningFft: boolean;
};

const CHART_LIMIT = 120;
const TABLE_LIMIT = 80;

export default function FftTab({
  sensorName,
  setSensorName,
  samplingRate,
  setSamplingRate,
  windowSize,
  setWindowSize,
  fftItems = [],
  onRunFft,
  onRefreshFft,
  isLoadingFft,
  isRunningFft,
}: Props) {
  const safeFftItems = Array.isArray(fftItems) ? fftItems : [];

  const chartData = useMemo(() => {
    return safeFftItems
      .slice(0, CHART_LIMIT)
      .map((item) => ({
        frequency_hz: Number(item.frequency_hz),
        amplitude: Number(item.amplitude),
      }))
      .filter((item) => Number.isFinite(item.frequency_hz) && Number.isFinite(item.amplitude));
  }, [safeFftItems]);

  const tableData = useMemo(() => safeFftItems.slice(0, TABLE_LIMIT), [safeFftItems]);

  return (
    <>
      <section className="chart-card">
        <h2 className="panel-title">FFT Spectrum Chart</h2>

        {isLoadingFft ? (
          <div className="chart-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading FFT chart...</span>
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="empty-state">No FFT chart data yet.</div>
        ) : (
          <>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="frequency_hz" tickFormatter={(value) => Number(value).toFixed(1)} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => Number(value).toFixed(4)}
                    labelFormatter={(label) => `Frequency: ${Number(label).toFixed(2)} Hz`}
                  />
                  <Legend />
                  <Bar dataKey="amplitude" name="Amplitude" fill="#7b1fa2" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-note">Showing the first {chartData.length} FFT points for faster rendering.</div>
          </>
        )}
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Run FFT</h2>

        <div className="form-grid">
          <label>
            <span className="field-label">Sensor Name</span>
            <input className="text-input" value={sensorName} onChange={(e) => setSensorName(e.target.value)} disabled={isRunningFft} />
          </label>

          <label>
            <span className="field-label">Sampling Rate (Hz)</span>
            <input
              className="text-input"
              type="number"
              step="0.1"
              value={samplingRate}
              onChange={(e) => setSamplingRate(e.target.value)}
              disabled={isRunningFft}
            />
          </label>

          <label>
            <span className="field-label">Window Size</span>
            <input
              className="text-input"
              type="number"
              step="1"
              value={windowSize}
              onChange={(e) => setWindowSize(e.target.value)}
              disabled={isRunningFft}
            />
          </label>

          <div className="toolbar" style={{ marginBottom: 0 }}>
            <button onClick={onRunFft} className="btn btn-primary" type="button" disabled={isRunningFft}>
              {isRunningFft ? "Running FFT..." : "Run FFT"}
            </button>

            <button onClick={onRefreshFft} className="btn" type="button" disabled={isLoadingFft}>
              {isLoadingFft ? "Refreshing..." : "Refresh FFT Spectrum"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">FFT Spectrum</h2>

        {isLoadingFft ? (
          <div className="table-loading-box">
            <div className="loading-inline">
              <span className="spinner" />
              <span>Loading FFT table...</span>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Frequency (Hz)</th>
                  <th>Amplitude</th>
                </tr>
              </thead>
              <tbody>
                {tableData.length === 0 ? (
                  <tr>
                    <td colSpan={2}>No FFT data yet</td>
                  </tr>
                ) : (
                  tableData.map((item, idx) => (
                    <tr key={`${item.frequency_hz}-${idx}`}>
                      <td>{Number(item.frequency_hz).toFixed(4)}</td>
                      <td>{Number(item.amplitude).toFixed(6)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {safeFftItems.length > TABLE_LIMIT && (
          <div className="chart-note">Showing the first {TABLE_LIMIT} rows for faster loading.</div>
        )}
      </section>
    </>
  );
}
