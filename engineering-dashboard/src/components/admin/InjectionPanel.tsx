import React from "react";

type Props = {
  loading: boolean;
  injectHighTemp: () => void | Promise<void>;
  injectOfflineGap: () => void | Promise<void>;
};

export default function InjectionPanel({
  loading,
  injectHighTemp,
  injectOfflineGap,
}: Props) {
  return (
    <section className="admin-panel admin-panel-injection">
      <div className="admin-panel-header admin-panel-header-injection">
        <div className="admin-panel-heading">
          <div className="admin-panel-title-row">
            <div>
              <div className="admin-panel-kicker">Injection</div>
              <div className="admin-panel-title">Manual Injection</div>
            </div>
          </div>
          <p className="admin-panel-subcopy">
            Trigger one-off simulator events for fast testing, validation, and dashboard checks.
          </p>
        </div>
        <span className="admin-panel-badge admin-panel-badge-injection">
          Quick Test
        </span>
      </div>

      <div className="admin-action-grid">
        <button
          className="action-btn action-btn-warning"
          onClick={() => void injectHighTemp()}
          disabled={loading}
        >
          🌡 Inject High Temp
        </button>

        <button
          className="action-btn action-btn-warning"
          onClick={() => void injectOfflineGap()}
          disabled={loading}
        >
          ⏸ Inject Offline Gap
        </button>
      </div>
    </section>
  );
}
