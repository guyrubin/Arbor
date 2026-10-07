import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { buildFirstMonthKeepsake, FIRST_MONTH_DAYS } from "../../lib/firstMonthKeepsake";
import { FIRST_MONTH_MIN_MOMENTS, lifecycleDay } from "../../lib/lifecycle";

/** The first-month keepsake as #/memory shows it: the day it was kept and its lines. */
export interface FirstMonthKeepsakeRowModel {
  /** Local YYYY-MM-DD: the day the first month closed (day FIRST_MONTH_DAYS after onboarding). */
  keptOn: string;
  /** The ENG-L4 tiles, as i18n keys + vars (the same lines the lifecycle card carried). */
  lines: ReadonlyArray<{ id: "moments" | "days"; key: string; vars?: Record<string, number> }>;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * B-SHELL-NEW-keepsake — PASS A5 retired the LifecycleMomentCard body from
 * Today; the first-month keepsake keeps its home here, in #/memory's keepsakes
 * section beside "Things {name} said". Pure: the window and its counts come
 * from lib/firstMonthKeepsake (the closed day 0…29 window, read-only reuse);
 * the floor is lib/lifecycle's FIRST_MONTH_MIN_MOMENTS (a keepsake needs
 * something to be a keepsake OF). Null before the month has closed, for a
 * legacy account with no anchor, and for an empty window.
 */
export function firstMonthKeepsakeRow(input: {
  onboardingCompletedAt?: string | null;
  timestamps: readonly (string | number)[];
  now: Date;
}): FirstMonthKeepsakeRowModel | null {
  const day = lifecycleDay(input.onboardingCompletedAt, input.now.getTime());
  if (day === null || day < FIRST_MONTH_DAYS) return null;
  const k = buildFirstMonthKeepsake({ onboardingCompletedAt: input.onboardingCompletedAt, timestamps: input.timestamps });
  if (!k.hasWindow || k.momentsKept < FIRST_MONTH_MIN_MOMENTS) return null;
  const a = new Date(Date.parse(input.onboardingCompletedAt as string));
  const closed = new Date(a.getFullYear(), a.getMonth(), a.getDate() + FIRST_MONTH_DAYS);
  return {
    keptOn: `${closed.getFullYear()}-${pad(closed.getMonth() + 1)}-${pad(closed.getDate())}`,
    lines: [
      k.momentsKept === 1 ? { id: "moments", key: "elev.l4.moments.one" } : { id: "moments", key: "elev.l4.moments.many", vars: { n: k.momentsKept } },
      k.daysWritten === 1 ? { id: "days", key: "elev.l4.days.one" } : { id: "days", key: "elev.l4.days.many", vars: { n: k.daysWritten } },
    ],
  };
}

/** "3 Sept 2026" / "3 בספט׳ 2026" — the keepsake's own date. */
export function keptOnLabel(day: string, lang: "en" | "he"): string {
  const d = new Date(`${day}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * ONE row in the keepsake row shell (the ThingsSaid shape: an inline-start
 * rule, the editorial serif, the date under it). Rendered once, with its own
 * date; no Today mount, no celebration, no share prompt, nothing added to the
 * ENG-L4 lines.
 */
export default function FirstMonthKeepsakeRow({ now }: { now?: Date } = {}) {
  const { childProfile, behaviorLogs, playLogs } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const at = now ?? new Date();
  const row = useMemo(
    () =>
      firstMonthKeepsakeRow({
        onboardingCompletedAt: childProfile?.onboardingCompletedAt,
        timestamps: [...(behaviorLogs ?? []).map((l) => l.timestamp), ...(playLogs ?? []).map((p) => p.timestamp)],
        now: at,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childProfile?.onboardingCompletedAt, behaviorLogs, playLogs, at.toDateString()],
  );
  if (!row) return null;
  const name = (childProfile?.name || "").split(" ")[0] || t("today.record.childFallback");
  const title = t("elev.l4.keepsake.title", { name });
  return (
    <section data-testid="memory-first-month" aria-label={t("elev.l4.aria", { name })} className="space-y-2">
      <h3 className="font-semibold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontSize: "var(--t-lg)" }}>
        {title}
      </h3>
      <figure data-testid="memory-first-month-row" className="min-w-0">
        <blockquote className="space-y-1 border-s-2 ps-3 text-[16px] leading-snug" style={{ borderColor: "var(--arbor-clay)", color: "var(--arbor-ink)", fontFamily: "var(--font-editorial)" }}>
          {row.lines.map((line) => (
            <p key={line.id} data-testid={`memory-first-month-${line.id}`}>{t(line.key, line.vars)}</p>
          ))}
        </blockquote>
        <figcaption data-testid="memory-first-month-date" className="mt-1 ps-3 text-[12px]" style={{ color: "var(--arbor-muted)" }}>
          {keptOnLabel(row.keptOn, lang)}
        </figcaption>
      </figure>
    </section>
  );
}
