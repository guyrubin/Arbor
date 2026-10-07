import React from "react";
import { Icon } from "./Icon";

/**
 * B-DESIGN-02 (P7-DESIGN framer decision, 7 Oct; DESIGN.md §Components) — the
 * editorial section head: a kicker row of glyph + title + a hairline rule that
 * runs to the end edge, with an optional muted sub-line. Flex row, logical
 * spacing only, so it mirrors in Hebrew. The title is an h2 (display face by the
 * app-wide heading rule) at --t-lg. Not mounted yet (B-DESIGN-03/04 adopt it).
 */
export function SectionHead({
  title,
  icon,
  sub,
  as: Tag = "h2",
  id,
  className = "",
}: {
  title: string;
  /** Material Symbols ligature; must be in the shipped icon subset. */
  icon?: string;
  sub?: string;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div data-testid="section-head" className={className}>
      <div className="flex items-center gap-2.5">
        {icon ? <Icon name={icon} size={20} style={{ color: "var(--arbor-clay)" }} /> : null}
        <Tag id={id} className="m-0 whitespace-nowrap t-lg" style={{ color: "var(--arbor-ink)" }}>
          {title}
        </Tag>
        <span aria-hidden="true" data-section-rule="" className="h-px min-w-6 flex-1" style={{ background: "var(--arbor-rule)" }} />
      </div>
      {sub ? (
        <p className="mt-1 t-sm font-medium" style={{ color: "var(--arbor-muted)" }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export default SectionHead;
