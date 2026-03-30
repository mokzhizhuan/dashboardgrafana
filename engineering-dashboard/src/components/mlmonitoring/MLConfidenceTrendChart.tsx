import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonitoringPrediction } from "./types";

type Props = {
  history?: MonitoringPrediction[];
};

export default function MLConfidenceTrendChart({ history = [] }: Props) {
  const data = history
    .slice()
    .reverse()
    .map((item) => ({
      time: new Date(item.time).toLocaleTimeString(),
      confidence: item.confidence * 100,
    }));

  return (
    <section className="panel-card">
      <h3 className="panel-title">Confidence Trend</h3>

      {data.length === 0 ? (
        <div className="status-info">No confidence trend data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="confidence" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}