import React from "react";

/**
 * Right-rail shell for contextual insight — Arbor's read on the current view
 * (next best action, what to watch, share). A reusable track (sticky,
 * scrollable, `--rail-width` wide) that redesigned surfaces fill with dynamic
 * content. Distinct from `AiRail`, which is the static behind-the-answer trust
 * panel and stays as-is.
 *
 * Structural only — callers bring the content (and any localized copy). The
 * rail hides below `xl` and is rendered as the grid's third track by the shell.
 */
export type InsightRailProps = {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Right-aligned header affordance (e.g. a collapse button). */
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

export default function InsightRail({
  title,
  subtitle,
  icon,
  headerAction,
  children,
  footer,
  className = "",
}: InsightRailProps) {
  return (
    <aside
      className={`hidden xl:flex flex-col gap-5 p-5 h-screen sticky top-0 overflow-y-auto z-20 w-[340px] 2xl:w-[365px] bg-white ${className}`.trim()}
      style={{ borderLeft: "1px solid var(--arbor-rule)" }}
    >
      {(title || headerAction) && (
        <div
          className="flex items-center justify-between gap-2 pb-4"
          style={{ borderBottom: "1px solid var(--arbor-rule)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <div className="min-w-0">
              {title && (
                <h3
                  className="font-extrabold text-sm truncate"
                  style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-[11px] truncate" style={{ color: "var(--arbor-muted)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {headerAction}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col gap-4">{children}</div>
      {footer}
    </aside>
  );
}
