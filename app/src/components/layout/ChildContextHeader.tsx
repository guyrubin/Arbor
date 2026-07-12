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
    <header className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 min-w-0 ${className}`.trim()}>
      <div className="flex w-full sm:flex-1 items-center gap-2.5 min-w-0">{identity}</div>
      {actions && <div className="w-full sm:w-auto min-w-0 flex justify-start sm:justify-end">{actions}</div>}
    </header>
  );
}
