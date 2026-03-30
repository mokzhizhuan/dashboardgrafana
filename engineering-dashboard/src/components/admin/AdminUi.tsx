import React from "react";
import type { HeaderChip, MetricCardItem, DetailCardItem, PillKind } from "./AdminTypes";

export const compactMiniCardMinHeight = 72;
export const compactCardPadding = 12;
export const panelSectionGap = 14;
export const infoSectionSpacingTop = 18;

export const panelStyle: React.CSSProperties = {
  border: "1px solid #2a3441",
  borderRadius: 12,
  padding: 16,
  background: "#111827",
  marginTop: 16,
};

export const miniCardStyle: React.CSSProperties = {
  border: "1px solid #243041",
  borderRadius: 10,
  padding: 10,
  background: "#0f172a",
  minHeight: compactMiniCardMinHeight,
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 6,
};

export const valueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#e5e7eb",
};

export const detailLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  marginBottom: 4,
};

export const detailValueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#e5e7eb",
  lineHeight: 1.45,
};

export const infoSectionCardStyle: React.CSSProperties = {
  border: "1px solid #243041",
  borderRadius: 12,
  padding: compactCardPadding,
  background: "#0b1220",
};

export const sectionHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

export const sectionHeaderTextWrapStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

export const compactChipWrapStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

export const compactMetricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

export const compactDetailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  gap: 10,
};

export const compactListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

export const compactRowCardStyle: React.CSSProperties = {
  ...miniCardStyle,
  display: "grid",
  gap: 8,
};

export const infoSectionTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#f8fafc",
  marginBottom: 2,
  lineHeight: 1.25,
};

export const infoSectionHintStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 0,
  lineHeight: 1.4,
};

export const infoEmptyCardStyle: React.CSSProperties = {
  border: "1px dashed #334155",
  borderRadius: 12,
  padding: 14,
  background: "rgba(15, 23, 42, 0.45)",
  color: "#94a3b8",
  fontSize: 13,
  lineHeight: 1.45,
};

export function getPillStyle(kind: PillKind): React.CSSProperties {
  const map = {
    healthy: {
      background: "rgba(34,197,94,0.15)",
      color: "#4ade80",
      border: "1px solid rgba(34,197,94,0.35)",
    },
    warning: {
      background: "rgba(245,158,11,0.15)",
      color: "#fbbf24",
      border: "1px solid rgba(245,158,11,0.35)",
    },
    critical: {
      background: "rgba(239,68,68,0.15)",
      color: "#f87171",
      border: "1px solid rgba(239,68,68,0.35)",
    },
    neutral: {
      background: "rgba(148,163,184,0.15)",
      color: "#cbd5e1",
      border: "1px solid rgba(148,163,184,0.35)",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    ...map[kind],
  };
}

export function SectionHeader({
  title,
  subtitle,
  chips,
}: {
  title: string;
  subtitle: string;
  chips?: HeaderChip[];
}) {
  return (
    <div style={sectionHeaderRowStyle}>
      <div style={sectionHeaderTextWrapStyle}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#94a3b8" }}>{subtitle}</div>
      </div>

      {chips && chips.length > 0 && (
        <div style={compactChipWrapStyle}>
          {chips.map((chip) => (
            <span key={`${chip.kind}-${chip.label}`} style={getPillStyle(chip.kind)}>
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ items }: { items: MetricCardItem[] }) {
  return (
    <div style={compactMetricGridStyle}>
      {items.map((item) => (
        <div key={String(item.label)} style={miniCardStyle}>
          <div style={labelStyle}>{item.label}</div>
          <div style={{ ...valueStyle, fontSize: 18, ...(item.valueStyle ?? {}) }}>
            {item.value}
          </div>
          {item.hint ? (
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>{item.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DetailGrid({ items }: { items: DetailCardItem[] }) {
  return (
    <div style={compactDetailGridStyle}>
      {items.map((item) => (
        <div key={String(item.label)} style={miniCardStyle}>
          <div style={detailLabelStyle}>{item.label}</div>
          <div style={{ ...detailValueStyle, ...(item.valueStyle ?? {}) }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function EmptyInfo({ children }: { children: React.ReactNode }) {
  return <div style={infoEmptyCardStyle}>{children}</div>;
}

export function InfoSection({
  title,
  subtitle,
  chips,
  marginTop,
  children,
}: {
  title: string;
  subtitle: string;
  chips?: HeaderChip[];
  marginTop?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...infoSectionCardStyle, marginTop }}>
      <SectionHeader title={title} subtitle={subtitle} chips={chips} />
      {children}
    </div>
  );
}