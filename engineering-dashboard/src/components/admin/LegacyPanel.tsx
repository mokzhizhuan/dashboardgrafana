import React from "react";

type Props = {
  loading: boolean;
  legacyHighTempMode: boolean;
  startHighTempMode: () => void | Promise<void>;
  stopHighTempMode: () => void | Promise<void>;
};

export default function LegacyPanel({
  loading,
  legacyHighTempMode,
  startHighTempMode,
  stopHighTempMode,
}: Props) {
  return (
    <section className="admin-panel admin-panel-legacy">
      <div className="admin-panel-header admin-panel-header-legacy">
        <div className="admin-panel-heading">
          <div className="admin-panel-title-row">
            <div>
              <div className="admin-panel-kicker">Legacy</div>
              <div className="admin-panel-title">Legacy High Temp Mode</div>
            </div>
          </div>
         <p className="admin-panel-subcopy">
            Control the legacy sustained high-temperature mode used for compatibility and fallback tests.
          </p>
        </div>
        <span className="admin-panel-badge admin-panel-badge-legacy">
          Compatibility
        </span>
      </div>

      <div className="admin-chip-row">
        <div className={`admin-chip ${legacyHighTempMode ? "danger" : "success"}`}>
          {legacyHighTempMode ? "Legacy High Temp: ON" : "Legacy High Temp: OFF"}
        </div>
      </div>

      <div className="admin-action-grid">
        <button
          className="action-btn action-btn-legacy"
          onClick={() => void startHighTempMode()}
          disabled={loading}
        >
          🔥 Start High Temp Mode
        </button>

        <button
          className="action-btn action-btn-neutral"
          onClick={() => void stopHighTempMode()}
          disabled={loading}
        >
          ❄ Stop High Temp Mode
        </button>
      </div>
    </section>
  );
}
