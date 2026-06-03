import React from "react";

/* Shared Soft-Daylight UI kit used across the new section/capability pages.
   Green = trust/growth (primary). Coral/peach = AI/action/attention. */

export const PASTEL = {
  mint:   { soft: "#e4f4ec", ink: "#1f8a5a" },
  coral:  { soft: "#fdeada", ink: "#cf6f37" },
  lav:    { soft: "#ece9fb", ink: "#6354c4" },
  yellow: { soft: "#fbf1d4", ink: "#a9780f" },
  pink:   { soft: "#fce2ec", ink: "#bd4f74" },
  sky:    { soft: "#e5f0fb", ink: "#2f7bbf" },
} as const;
export type PastelKey = keyof typeof PASTEL;

export const cardCls =
  "bg-white rounded-[22px] border border-[rgba(41,51,63,0.06)] shadow-[0_2px_10px_rgba(41,51,63,0.05)]";

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

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "#1f8a5a" }}>{eyebrow}</span>}
        <h1 className="text-2xl md:text-[2rem] font-extrabold leading-[1.12] mt-1" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1.5 max-w-2xl" style={{ color: "var(--arbor-muted)" }}>{subtitle}</p>}
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

/** Trust & Safety strip — embedded across guidance, reports, sharing, handoffs. */
export function TrustSafetyBar({ risk = "Low", note }: { risk?: "Low" | "Moderate" | "High"; note?: string }) {
  const tone: PastelKey = risk === "High" ? "pink" : risk === "Moderate" ? "yellow" : "mint";
  return (
    <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]" style={{ background: PASTEL[tone].soft, color: "var(--arbor-ink)" }}>
      <span className="font-extrabold" style={{ color: PASTEL[tone].ink }}>Risk: {risk}</span>
      <span style={{ color: "var(--arbor-muted)" }}>Non-diagnostic guidance</span>
      <span style={{ color: "var(--arbor-muted)" }}>Escalation available</span>
      {note && <span style={{ color: "var(--arbor-muted)" }}>· {note}</span>}
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
