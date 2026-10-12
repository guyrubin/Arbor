import React from "react";

/**
 * Persistent identity header for the active child — the one element every
 * "My Child" surface shares so the parent always knows WHO they are looking
 * at without re-establishing it on every tab. (Brief acceptance criterion #4.)
 *
 * CLINICAL FIREWALL (non-negotiable): this header carries parent-observed
 * *presence* facts only — who the child is, plus whatever recency / evidence
 * detail the caller threads into `identity`. It MUST NEVER carry a risk level,
 * score, verdict, percentile, norm-cutoff, condition label, or any diagnostic
 * implication. Those do not exist on a child at the header level. Callers pass
 * already-localized nodes so the component stays i18n- and register-agnostic.
 */
export type ChildContextHeaderProps = {
  /** Localized identity line (e.g. "Caring for Maya · age 4 · focus: sleep"). */
  identity: React.ReactNode;
  /** Right-aligned actions (search, language, ask, kid-mode, etc.). */
  actions?: React.ReactNode;
  className?: string;
};

export default function ChildContextHeader({
  identity,
  actions,
  className = "",
}: ChildContextHeaderProps) {
  return (
    /* IA-03 / MOB-26: ONE row at every width. This header used to stack
       (flex-col below sm), so at 390 the identity line and the accessory row
       were two boxes — 72 px of a 260 px chrome stack above the hub's own h1,
       on top of a separate 34 px brand row. Collapsing it to a single 44 px
       row (the accessory buttons' own height, so the row costs nothing extra)
       is most of the way to the ≤ 200 px budget, and it is what lets the
       brand mark fold in here instead of owning a row of its own.
       v3 F-SHELL-3 (IA-03): the row is the phone header now, a fixed band
       above the scrollport instead of the first thing inside it. It pads
       itself as <main> padded it (the same inline gutters), clears the
       status bar when the page runs edge to edge, and draws the Topbar's
       hairline under it. No glass: the band never overlaps content. */
    <header
      className={`flex flex-row items-center justify-between gap-2 min-w-0 flex-none px-4 sm:px-5 md:px-6 pb-2 ${className}`.trim()}
      style={{ paddingBlockStart: "max(8px, env(safe-area-inset-top, 0px))", borderBlockEnd: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex flex-1 items-center gap-2 min-w-0">{identity}</div>
      {actions && <div className="flex-shrink-0 flex items-center justify-end">{actions}</div>}
    </header>
  );
}
