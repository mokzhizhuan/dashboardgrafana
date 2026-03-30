import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { MonitoringPrediction } from "./types";

type Props = {
  history?: MonitoringPrediction[];
};

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#3b82f6"];

export default function MLFaultDistributionChart({ history = [] }: Props) {
  const counts: Record<string, number> = {};

  history.forEach((item) => {
    counts[item.predictedLabel] = (counts[item.predictedLabel] || 0) + 1;
  });

  const data = Object.entries(counts).map(([name, value]) => ({ name, value }));

  return (
    <section className="panel-card">
      <h3 className="panel-title">Fault Distribution</h3>

      {data.length === 0 ? (
        <div className="status-info">No fault distribution data available.</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" outerRadius={85} label>
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      )}
    </section>
  );
}