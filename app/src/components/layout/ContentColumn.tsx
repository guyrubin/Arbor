import React from "react";

/**
 * Opt-in readable bound for single-column tab content (`--content-max`).
 *
 * Use when a tab is prose- or list-led and would otherwise stretch across the
 * full content track once the grid is capped. Dashboard / multi-column tabs
 * should NOT wrap their content in this — they own their own grid. Adoption is
 * per-tab as surfaces are redesigned.
 *
 * Structural only.
 */
export default function ContentColumn({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`content-col ${className}`.trim()}>{children}</div>;
}
