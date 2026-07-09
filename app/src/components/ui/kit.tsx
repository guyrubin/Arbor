import React from "react";
import {
  Heart, Languages, Brain, Users, Sprout, Hand, Globe,
  type LucideIcon,
} from "lucide-react";
import type { DevelopmentalDomainId } from "../../types";

/* Shared Soft-Daylight UI kit used across the new section/capability pages.
   Green = trust/growth (primary). Coral/peach = AI/action/attention. */

// Token vocabulary now lives in the typed mirror `src/lib/tokens.ts` (the single
// source of truth for TS; index.css `:root` remains the runtime source). Re-export
// so existing `import { PASTEL, cardCls } from "../ui/kit"` call sites are unchanged.
export { PASTEL, cardCls } from "../../lib/tokens";
export type { PastelKey } from "../../lib/tokens";
import { PASTEL, cardCls, T } from "../../lib/tokens";
import type { PastelKey } from "../../lib/tokens";

export function Chip({ tone = "mint", icon, children }: { tone?: PastelKey; icon?: React.ReactNode; children: React.ReactNode }) {
  const p = PASTEL[tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[var(--t-xs)] font-bold" style={{ background: p.soft, color: p.ink }}>
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
    <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[var(--t-sm)]" style={{ background: PASTEL[tone].soft, color: "var(--arbor-ink)" }}>
      {/* Clinical firewall: never a graded child verdict ("Risk: Low") on a
          parent surface — the tone wash + escalate button carry the attention,
          the text stays a posture line, not a grade. */}
      <span className="font-extrabold" style={{ color: PASTEL[tone].ink }}>
        {elevated ? "Worth a conversation with a professional" : "Parent observations — not a diagnosis"}
      </span>
      <span style={{ color: "var(--arbor-muted)" }}>Non-diagnostic guidance</span>
      <span style={{ color: "var(--arbor-muted)" }}>Escalation available</span>
      {note && <span style={{ color: "var(--arbor-muted)" }}>· {note}</span>}
      {elevated && onEscalate && (
        <button onClick={onEscalate} className="ms-auto inline-flex items-center gap-1 font-extrabold rounded-full px-3 py-1" style={{ background: PASTEL[tone].ink, color: T.onAccent }}>
          Talk to a professional →
        </button>
      )}
    </div>
  );
}

/** Lightweight scaffold marker for early-implementation capabilities. */
export function ComingSoon({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[var(--t-xs)] font-bold" style={{ background: T.paperDeep, color: T.faint }}>
      {label}
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   UC-1 shared primitives — consumed by the Wave-2 leaf agents (Today, Growth,
   Academy, Journal, Care, Profile). Added once here so per-screen agents only
   IMPORT them; they never re-implement the layout.

   CLINICAL FIREWALL: ProgressBar / RadialProgress render a COUNT of
   parent-noticed milestones (value / total), NEVER a 0–100 competence verdict,
   on-track/keep-an-eye tag, or weakest-domain pointer. The label is always a
   plain count (e.g. "3 of 7 noticed"), never a percent presented as a score.
   ════════════════════════════════════════════════════════════════════════════ */

/** Count-based horizontal progress bar. `value`/`total` are COUNTS of
 *  parent-noticed milestones — the fill is value/total, never a verdict score.
 *  `tone` picks the fill color from the layout-kit pastel set. */
export function ProgressBar({
  value,
  total,
  tone = "mint",
  height = 8,
  trackTone,
}: {
  value: number;
  total: number;
  tone?: PastelKey;
  height?: number;
  trackTone?: string;
}) {
  const p = PASTEL[tone];
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={total}
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: trackTone ?? "var(--arbor-track)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${pct}%`, background: p.ink, minWidth: value > 0 ? height : 0 }}
      />
    </div>
  );
}

/** Count-based radial progress ring. Renders `value` of `total` parent-noticed
 *  milestones as a conic fill — NOT a 0–100 competence score. Children render
 *  inside (typically the raw count, never a "%" verdict). */
export function RadialProgress({
  value,
  total,
  size = 96,
  thickness = 9,
  tone = "mint",
  children,
}: {
  value: number;
  total: number;
  size?: number;
  thickness?: number;
  tone?: PastelKey;
  children?: React.ReactNode;
}) {
  const p = PASTEL[tone];
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
  return (
    <div
      role="img"
      aria-label={`${value} of ${total}`}
      className="relative inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `conic-gradient(${p.ink} ${pct}%, var(--arbor-track) ${pct}% 100%)`,
      }}
    >
      <span
        className="absolute inline-flex items-center justify-center rounded-full"
        style={{ inset: thickness, background: "var(--arbor-paper-elevated)" }}
      >
        {children}
      </span>
    </div>
  );
}

/** ~54px rounded-15 tinted initials tile — the shared avatar motif for pro /
 *  care-team / family-member rows. `name` is reduced to up to two initials. */
export function InitialsTile({
  name,
  tone = "sky",
  size = 54,
  radius = 15,
}: {
  name: string;
  tone?: PastelKey;
  size?: number;
  radius?: number;
}) {
  const p = PASTEL[tone];
  const initials = (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("") || "?";
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center justify-center font-extrabold flex-shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: p.soft, color: p.ink, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

/** Tinted label/value inset row — the packet/summary row treatment. Optional
 *  leading `check` slot (the include-toggle affordance) and trailing `trailing`
 *  slot. `excluded` strikes through + dims the value without removing it. */
export function InsetRow({
  label,
  value,
  check,
  trailing,
  excluded = false,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  check?: React.ReactNode;
  trailing?: React.ReactNode;
  excluded?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[13px] px-3.5 py-2.5"
      style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }}
    >
      {check}
      <div className="min-w-0 flex-1">
        <div className="text-[var(--t-xs)] font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{label}</div>
        {value != null && (
          <div
            className="text-[var(--t-sm)] font-bold truncate"
            style={{ color: "var(--arbor-ink)", textDecoration: excluded ? "line-through" : undefined, opacity: excluded ? 0.5 : 1 }}
          >
            {value}
          </div>
        )}
      </div>
      {trailing}
    </div>
  );
}

/** Two-pane master/detail split. Collapses to a single stacked column below
 *  `md`. `ratio` is the desktop grid-template-columns value (default 1fr/1.4fr). */
export function Split({
  left,
  right,
  ratio = "1fr 1.4fr",
  gap = 20,
  className = "",
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  ratio?: string;
  gap?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 ${className}`.trim()} style={{ gap }}>
      <div className="contents md:grid" style={{ gridTemplateColumns: ratio, gap }}>
        <div className="min-w-0">{left}</div>
        <div className="min-w-0">{right}</div>
      </div>
    </div>
  );
}

/** Generalized badge slot — a small count/dot pill in a tone. Used by the
 *  sidebar (unread coach count) and card headers (Live, counts). `dot` renders
 *  a bare colored dot instead of text. */
export function Badge({
  children,
  tone = "mint",
  dot = false,
}: {
  children?: React.ReactNode;
  tone?: PastelKey;
  dot?: boolean;
}) {
  const p = PASTEL[tone];
  if (dot) {
    return <span aria-hidden="true" className="inline-block rounded-full" style={{ width: 8, height: 8, background: p.ink }} />;
  }
  return (
    <span className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[var(--t-xs)] font-extrabold" style={{ background: p.soft, color: p.ink, minWidth: 18 }}>
      {children}
    </span>
  );
}

/* ── Development Map domain → {lucide icon, layout-kit tone} ──────────────────
   The single source of truth for how each of the 7 framework.json clinical
   domains is rendered across Growth, Academy, Journal, Care and Today. Tones are
   drawn from the layout-kit set ONLY (mint|coral|lav|yellow|pink|sky) — never a
   PlayKit tone (clay/peach), which would render blank on these parent surfaces.
   7 domains over 6 tones: ecosystem reuses `mint` (its framing is whole-system,
   like attachment). framework.json labels remain the source of truth for text. */
export type DomainVisual = { icon: LucideIcon; tone: PastelKey };

export const DOMAIN_VISUALS: Record<DevelopmentalDomainId, DomainVisual> = {
  attachment_regulation:        { icon: Heart,     tone: "mint" },
  language_communication:       { icon: Languages, tone: "sky" },
  cognition_executive_function: { icon: Brain,     tone: "lav" },
  social_development:           { icon: Users,     tone: "coral" },
  independence_adaptive_skills: { icon: Sprout,    tone: "yellow" },
  sensory_motor_patterns:       { icon: Hand,      tone: "pink" },
  ecosystem_stressors:          { icon: Globe,     tone: "mint" },
};

/** Lookup the icon+tone for a domain id, with a safe mint/Sprout fallback for
 *  any non-canonical id so consumers never render blank. */
export function domainVisual(id: string): DomainVisual {
  return DOMAIN_VISUALS[id as DevelopmentalDomainId] ?? { icon: Sprout, tone: "mint" };
}
