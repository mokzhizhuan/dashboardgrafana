import React from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

type Props = {
  label: string;
  value: React.ReactNode;
  helper?: string;
  badgeText?: string;
  tone?: Tone;
  loading?: boolean;
};

export default React.memo(function StatCard({
  label,
  value,
  helper,
  badgeText,
  tone = "default",
  loading = false,
}: Props) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {badgeText ? <span className={`status-pill pill-${tone}`}>{badgeText}</span> : null}
      </div>

      {loading ? (
        <div className="stat-skeleton-wrap">
          <div className="skeleton skeleton-value" />
          <div className="skeleton skeleton-helper" />
        </div>
      ) : (
        <>
          <div className="stat-card-value">{value}</div>
          {helper ? <div className="stat-card-helper">{helper}</div> : null}
        </>
      )}
    </article>
  );
});