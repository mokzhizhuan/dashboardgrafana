import React from "react";

type Props = {
  enabled: boolean;
  interval: number;
  onToggle: () => void;
};

export default function MLAutoRefreshToggle({
  enabled,
  interval,
  onToggle,
}: Props) {
  return (
    <div className="auto-refresh-control">
      <label className="auto-refresh-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
        />
        Auto Refresh ({interval}s)
      </label>
    </div>
  );
}