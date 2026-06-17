import React from "react";

/* Shared Soft-Daylight UI kit used across the new section/capability pages.
   Green = trust/growth (primary). Coral/peach = AI/action/attention. */

// Token vocabulary now lives in the typed mirror `src/lib/tokens.ts` (the single
// source of truth for TS; index.css `:root` remains the runtime source). Re-export
// so existing `import { PASTEL, cardCls } from "../ui/kit"` call sites are unchanged.
export { PASTEL, cardCls } from "../../lib/tokens";
export type { PastelKey } from "../../lib/tokens";
import { PASTEL, cardCls } from "../../lib/tokens";
import type { PastelKey } from "../../lib/tokens";

export function Chip({ tone = "mint", icon, children }: { tone?: PastelKey; icon?: React.ReactNode; children: React.ReactNode }) {
  const p = PASTEL[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: p.soft, color: p.ink }}>
      {icon}{children}
    </span>
  );
}

export function IconBadge({ tone = "mint", children, size = 44 }: { tone?: PastelKey; children: React.ReactNode; size?: number }) {
  const p = PASTEL[tone];
  return (
    <span className="inline-flex items-center justify-center rounded-2xl flex-shrink-0" style={{ background: p.soft, color: p.ink, width: size, height: size }}>
      {children}
    </span>
  );
}

// `eyebrow` is accepted for backward compat but no longer rendered: an uppercase
// section kicker above every page is the saturated AI tell, and the sidebar
// already shows the active section. Title carries the page on its own.
export function PageHeader({ title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
      <div>
        <h1 className="text-2xl md:text-[2rem] leading-[1.1]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-2 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionCard({ title, icon, tone = "mint", children, action }: { title?: string; icon?: React.ReactNode; tone?: PastelKey; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`${cardCls} p-6`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            {icon && <IconBadge tone={tone} size={36}>{icon}</IconBadge>}
            {title && <h2 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{title}</h2>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/** Trust & Safety strip — embedded across guidance, reports, sharing, handoffs.
 *  `risk` reflects the model's real computed risk level; when it's elevated and
 *  `onEscalate` is provided, a "Talk to a professional" action is surfaced. */
export function TrustSafetyBar({ risk = "Low", note, onEscalate }: { risk?: "Low" | "Moderate" | "High"; note?: string; onEscalate?: () => void }) {
  const tone: PastelKey = risk === "High" ? "pink" : risk === "Moderate" ? "yellow" : "mint";
  const elevated = risk !== "Low";
  return (
    <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]" style={{ background: PASTEL[tone].soft, color: "var(--arbor-ink)" }}>
      <span className="font-extrabold" style={{ color: PASTEL[tone].ink }}>Risk: {risk}</span>
      <span style={{ color: "var(--arbor-muted)" }}>Non-diagnostic guidance</span>
      <span style={{ color: "var(--arbor-muted)" }}>Escalation available</span>
      {note && <span style={{ color: "var(--arbor-muted)" }}>· {note}</span>}
      {elevated && onEscalate && (
        <button onClick={onEscalate} className="ml-auto inline-flex items-center gap-1 font-extrabold rounded-full px-3 py-1" style={{ background: PASTEL[tone].ink, color: "#fff" }}>
          Talk to a professional →
        </button>
      )}
    </div>
  );
}

/** Lightweight scaffold marker for early-implementation capabilities. */
export function ComingSoon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#eef1f0", color: "#69747f" }}>
      {label}
    </span>
  );
}
