import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { BehaviorLog, BehaviorContext } from "../../types";
import { cardCls } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";

/**
 * Moments recall card (Wave-3 clinical subtraction, 2026-06-26).
 *
 * Replaces the prior 6-month behavior-INTENSITY LineChart + "milestone
 * readiness %" badge. Both were per-child verdicts across time (an emotion/
 * behavior-intensity trend + a milestone-share percentage) = forbidden by the
 * CI-22/23/24 firewall.
 *
 * The replacement EMITS NOTHING about the child as a verdict:
 *   - `N` is a flat count of the parent's own `BehaviorLog` entries in the
 *     window (NOT a sum/avg, NOT a percentage, NOT a score).
 *   - `[top trigger]` is the parent-tagged `context` chip the parent used most
 *     often — a fixed-taxonomy category from `BehaviorContext`, never a
 *     free-text `trigger`/`notes` field (so no PII echo). If no context has
 *     been tagged, the clause is omitted.
 *
 * Safe-interpretation primitive: parent observation only. No score, no %, no
 * trend, no norm-cutoff, no condition name, no effect-size claim.
 */
export default function TrendsChart({ logs }: { logs: BehaviorLog[] }) {
  const { t } = useLanguage();

  const { count, topContext } = useMemo(() => {
    const cutoff = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000; // ~6 months
    const inWindow = logs.filter((l) => {
      const ts = new Date(l.timestamp).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
    // Top context = most-frequent fixed-taxonomy chip (NOT free-text trigger).
    const tally = new Map<BehaviorContext, number>();
    for (const l of inWindow) {
      if (l.context) tally.set(l.context, (tally.get(l.context) ?? 0) + 1);
    }
    let best: BehaviorContext | null = null;
    let bestN = 0;
    for (const [ctx, n] of tally) {
      if (n > bestN) {
        best = ctx;
        bestN = n;
      }
    }
    return { count: inWindow.length, topContext: best };
  }, [logs]);

  return (
    <div className={`${cardCls} p-6 space-y-3`}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
          <Icon name="menu_book" size={14} /> {t("trends.eyebrow")}
        </span>
      </div>
      <h3 className="text-lg font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
        {t("trends.title")}
      </h3>
      {count > 0 ? (
        <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>
          {topContext
            ? t("trends.recall", { count, context: topContext })
            : t("trends.recall.noContext", { count })}
        </p>
      ) : (
        <div className="h-24 flex items-center justify-center text-center text-xs rounded-2xl" style={{ color: "var(--arbor-muted)", border: "1px dashed var(--arbor-rule-strong)" }}>
          {t("trends.empty")}
        </div>
      )}
    </div>
  );
}
