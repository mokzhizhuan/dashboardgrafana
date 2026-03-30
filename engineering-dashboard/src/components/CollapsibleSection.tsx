import React, { useState } from "react";
import "./ml-ui.css";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
};

export default function CollapsibleSection({
  title,
  subtitle,
  children,
  defaultOpen = false,
  rightSlot,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="ml-collapsible-card">
      <button
        type="button"
        className={`ml-collapsible-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="ml-collapsible-left">
          <span className={`ml-collapsible-arrow ${open ? "open" : ""}`}>▶</span>

          <div className="ml-collapsible-text">
            <div className="ml-collapsible-title">{title}</div>
            {subtitle ? (
              <div className="ml-collapsible-subtitle">{subtitle}</div>
            ) : null}
          </div>
        </div>

        {rightSlot ? <div className="ml-collapsible-right">{rightSlot}</div> : null}
      </button>

      {open && <div className="ml-collapsible-body">{children}</div>}
    </section>
  );
}