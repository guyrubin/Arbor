import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { PASTEL, type PastelKey } from "../../lib/tokens";
import { prefersReducedMotion } from "../../lib/devscore";

/* ════════════════════════════════════════════════════════════════════════════
   HubHero — the shared Elevation Wave hub-hero primitive (E2 substrate).

   The prototype block grammar, once, for all 8 hubs: uppercase eyebrow →
   job-sentence title (+ optional subtitle) → ONE primary CTA → optional living
   stat trio (COUNTS ONLY) → optional oversized ghost icon at the inline-end.

   CLINICAL FIREWALL: `stats` values are counts / plain activity numbers.
   Callers must NEVER pass percentages, verdicts, or trend deltas.
   RTL: logical properties only (inset-inline-end, text-start, ms/me).
   Motion: the single rise-fade entrance is gated on prefers-reduced-motion.
   All strings arrive pre-translated (callers use t()); no literals here.
   ════════════════════════════════════════════════════════════════════════════ */

export interface HubHeroStat {
  /** A COUNT or plain activity number — never a %, score, or delta. */
  value: number | string;
  /** Short translated label under the number. */
  label: string;
}

export interface HubHeroProps {
  /** Uppercase kicker naming the hub, translated (e.g. t("elev.hero.journal.eyebrow")). */
  eyebrow: string;
  /** The job sentence in outcome language — what this surface does for the family. */
  title: string;
  subtitle?: string;
  /** Parent-kit tone; drives the wash, eyebrow, CTA and ghost icon color. */
  tone?: PastelKey;
  /** THE one primary action of the hub. Exactly one — never a button row. */
  cta?: { label: string; onClick: () => void; icon?: React.ReactNode; testId?: string };
  /** Living stat trio (0–3 shown). Counts only — see firewall note above. */
  stats?: HubHeroStat[];
  /** Oversized, faint lucide glyph rendered at the inline-end. Decorative. */
  icon?: LucideIcon;
  testId?: string;
  className?: string;
}

export function HubHero({
  eyebrow,
  title,
  subtitle,
  tone = "mint",
  cta,
  stats,
  icon: GhostIcon,
  testId,
  className = "",
}: HubHeroProps) {
  const p = PASTEL[tone];

  // Single rise-fade entrance; collapses to an instant render under
  // prefers-reduced-motion (entered starts true → no transition ever fires).
  const [entered, setEntered] = useState(() => prefersReducedMotion());
  useEffect(() => {
    if (entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);

  const trio = (stats ?? []).slice(0, 3);

  return (
    <section
      data-testid={testId}
      className={`relative max-w-full overflow-hidden rounded-[24px] p-6 md:p-8 mb-6 text-start ${className}`.trim()}
      style={{
        background: p.soft,
        border: "1px solid var(--arbor-rule)",
        boxShadow: "var(--shadow-sm)",
        opacity: entered ? 1 : 0,
        transform: entered ? "none" : "translateY(10px)",
        transition: "opacity 0.45s ease, transform 0.45s ease",
      }}
    >
      {GhostIcon && (
        <GhostIcon
          aria-hidden="true"
          size={150}
          strokeWidth={1.1}
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 hidden sm:block"
          style={{ insetInlineEnd: "-1.25rem", color: p.ink, opacity: 0.1 }}
        />
      )}

      <div className="relative max-w-3xl min-w-0" style={{ zIndex: 1 }}>
        <div
          className="text-[11px] font-extrabold uppercase"
          style={{ color: p.ink, letterSpacing: "0.14em" }}
        >
          {eyebrow}
        </div>

        <h1
          className="mt-2 text-2xl md:text-[32px] leading-[1.1] break-words"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {title}
        </h1>

        {subtitle && (
          <p className="mt-2 text-[var(--t-sm)]" style={{ color: "var(--arbor-muted)" }}>
            {subtitle}
          </p>
        )}

        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            data-testid={cta.testId}
            className="mt-5 inline-flex max-w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl px-6 py-3 text-[var(--t-base)] font-extrabold transition motion-safe:hover:-translate-y-0.5 active:scale-[0.98] whitespace-normal text-center"
            style={{ background: "var(--arbor-gradient-primary)", color: "var(--arbor-on-accent)", boxShadow: "var(--arbor-clay-glow)" }}
          >
            {cta.icon}
            {cta.label}
          </button>
        )}

        {trio.length > 0 && (
          <div className="mt-5 grid grid-cols-1 min-[420px]:grid-cols-3 gap-2.5">
            {trio.map((s, i) => (
              <div
                key={i}
                className="min-w-0 px-4 py-2.5 first:ps-0"
                style={{ borderInlineStart: i === 0 ? "none" : "1px solid var(--arbor-rule)" }}
              >
                <div
                  className="text-lg font-extrabold leading-none tabular-nums"
                  style={{ color: p.ink }}
                >
                  {s.value}
                </div>
                <div className="mt-1 text-[var(--t-xs)] font-bold" style={{ color: "var(--arbor-muted)" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default HubHero;
