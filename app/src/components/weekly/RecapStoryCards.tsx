/* ════════════════════════════════════════════════════════════════════════════
   RecapStoryCards — W2 2.1 (masterplan ARBOR-UI-MASTERPLAN-2026-08-11 §4 ·
   Maytal Row-1 #2 + #4 · the Wrapped-pattern weekly ritual).

   The primary view of the CURRENT week's report in WeeklyTab: 3–5
   full-screen-ish story cards, one stat/insight per card, navigated by
   buttons + keyboard (no gesture lib — masterplan explicitly button/keyboard/
   reduced-motion first):

     1. what went well — hero headline + the digest's warm summary
     2. evidence — COUNT CHIPS ONLY (Maytal's frame drew per-domain trend
        arrows; the concept-translation doc bans them: activity evidence,
        never direction — and previousWeekMoments never renders here, a
        side-by-side week count is a trend by inspection)
     3. the three-block summary — progress / keep doing / worth attention,
        the attention block in neutral conversation framing ("שווה שיחה"),
        never warning colors
     4. LAST — exactly ONE recommendation, CTA wired through the EXISTING
        digest tryThisWeek → acceptTodayAction seam (TODAY-1 guard upstream:
        WeeklyTab passes canAccept only for AI digests). Parent-mediated
        ShareButton lives on this final card ONLY.

   Motion: slide/fade via motion.div, zeroed under useReducedMotion (plus the
   global reduced-motion CSS guard). RTL: arrow keys and chevrons flip.

   CLINICAL FIREWALL: counts only, no trend deltas, no scores — pinned by
   recapStoryCards.test.ts (which also pins single-recommendation-last and
   the lib/streak resettable-value ban across recap/strip files).
   ════════════════════════════════════════════════════════════════════════════ */
import React, { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import Icon from "../ui/Icon";
import ShareButton from "../ui/ShareButton";
import { useLanguage } from "../../context/LanguageContext";
import { track } from "../../lib/analytics";
import { rcString } from "./recapStrings";
import { resolveRecapMove } from "../../lib/recapMove";
import type { WeeklyReport } from "../../hooks/useWeeklyRecap";
import type { WeeklyDigest } from "../../lib/api";

export type RecapCard =
  | { kind: "wentwell"; body: string }
  | { kind: "evidence"; chips: Array<{ key: "moments" | "days" | "resolved" | "milestones"; n: number }> }
  | { kind: "summary"; progress: string[]; keep: string[]; attention: string[] }
  | { kind: "recommendation"; text: string };

/**
 * Pure card builder (unit-tested): always 4 cards, the LAST is the single
 * recommendation. Counts only on the evidence card — previousWeekMoments is
 * deliberately never read here.
 */
export function buildRecapCards(report: WeeklyReport & { digest: WeeklyDigest }): RecapCard[] {
  const d = report.digest;
  const s = d.stats;
  const chips: Array<{ key: "moments" | "days" | "resolved" | "milestones"; n: number }> = [
    { key: "moments" as const, n: s.momentsLogged },
    { key: "days" as const, n: s.daysCovered },
    { key: "resolved" as const, n: s.resolvedCount },
    { key: "milestones" as const, n: s.milestonesDone },
  ].filter((c) => c.n > 0);
  if (chips.length === 0) chips.push({ key: "moments", n: 0 });

  const highlights = d.highlights.filter((h) => h.trim().length > 0);
  return [
    { kind: "wentwell", body: d.summary },
    { kind: "evidence", chips },
    {
      kind: "summary",
      progress: highlights.slice(0, 2),
      keep: highlights.length > 2 ? highlights.slice(2) : [d.summary],
      attention: d.watchFor.filter((w) => w.trim().length > 0),
    },
    { kind: "recommendation", text: d.tryThisWeek },
  ];
}

const CARD_ICON: Record<RecapCard["kind"], string> = {
  wentwell: "favorite",
  evidence: "photo_camera",
  summary: "checklist",
  recommendation: "task_alt",
};

export default function RecapStoryCards({
  report,
  childName,
  canAccept,
  accepted,
  onAccept,
}: {
  report: WeeklyReport & { digest: WeeklyDigest };
  childName: string;
  /** TODAY-1 guard, decided by WeeklyTab: AI digests only. */
  canAccept: boolean;
  /** Today's step already IS this recommendation (honest done-state). */
  accepted: boolean;
  onAccept: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const rtl = uiLang === "he";
  const reduce = useReducedMotion();
  const rc = (key: string, vars?: Record<string, string | number>) => rcString(t, uiLang, key, vars);

  const cards = useMemo(() => buildRecapCards(report), [report]);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);

  useEffect(() => {
    track("recap_opened", { week: report.id });
  }, [report.id]);

  useEffect(() => {
    track("recap_card_view", { i: index });
  }, [index]);

  const go = (next: number) => {
    if (next < 0 || next >= cards.length) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // In RTL the "forward" arrow is ArrowLeft.
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) { e.preventDefault(); go(index + 1); }
    else if (e.key === backward) { e.preventDefault(); go(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); go(0); }
    else if (e.key === "End") { e.preventDefault(); go(cards.length - 1); }
  };

  const card = cards[index];
  const last = index === cards.length - 1;
  const first = childName.split(" ")[0];

  const chipLabel = (c: { key: string; n: number }) => rc(`elev.recap.chip.${c.key}`, { n: c.n });

  return (
    <section
      role="group"
      aria-roledescription="carousel"
      aria-label={rc("elev.recap.aria")}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="rounded-[26px] p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arbor-clay)]"
      data-testid="recap-story-cards"
    >
      <motion.div
        key={index}
        initial={reduce ? false : { opacity: 0, x: (rtl ? -dir : dir) * 28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduce ? 0 : 0.22, ease: "easeOut" }}
        className="rounded-[24px] p-6 sm:p-8 min-h-[380px] flex flex-col"
        style={{
          background:
            card.kind === "wentwell" ? "var(--arbor-lav-soft)" :
            card.kind === "recommendation" ? "var(--arbor-green-soft)" :
            "var(--arbor-paper-elevated)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-muted)" }}>
          <Icon name={CARD_ICON[card.kind]} size={15} />
          {card.kind === "wentwell" && rc("elev.recap.wentwell.eyebrow")}
          {card.kind === "evidence" && rc("elev.recap.evidence.title")}
          {card.kind === "summary" && rc("elev.recap.summary.title")}
          {card.kind === "recommendation" && rc("elev.recap.try.eyebrow")}
        </div>

        {card.kind === "wentwell" && (
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="text-[26px] sm:text-[32px] leading-tight" style={{ color: "var(--arbor-lav-ink)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {rc("elev.recap.wentwell.title")}
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
              {card.body}
            </p>
          </div>
        )}

        {card.kind === "evidence" && (
          <div className="flex-1 flex flex-col justify-center">
            {/* Count chips ONLY — activity evidence, never direction (no trend
                arrows: the firewall translation of Maytal's frame 2). */}
            <div className="flex flex-wrap gap-2.5">
              {card.chips.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 text-[14px] font-extrabold"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  {chipLabel(c)}
                </span>
              ))}
            </div>
          </div>
        )}

        {card.kind === "summary" && (
          <div className="flex-1 flex flex-col justify-center gap-3 mt-3">
            {([
              ["progress", card.progress] as const,
              ["keep", card.keep] as const,
              ["attention", card.attention] as const,
            ]).map(([block, lines]) => (
              /* Three blocks in ONE neutral tone — the "attention" block is a
                 conversation opener, never a warning surface. */
              <div key={block} className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)" }}>
                <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>
                  {rc(`elev.recap.block.${block}`)}
                </div>
                {lines.length > 0 ? (
                  <ul className="mt-1.5 space-y-1 text-[13.5px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {lines.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-[13px]" style={{ color: "var(--arbor-muted)" }}>
                    {rc("elev.recap.block.attention.empty")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {card.kind === "recommendation" && (
          <div className="flex-1 flex flex-col justify-center">
            <h3 className="text-[22px] leading-tight" style={{ color: "var(--arbor-green-ink)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
              {rc("elev.recap.try.title")}
            </h3>
            <p className="mt-3 text-[15px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>
              {card.text}
            </p>
            {/* TJB-11: the card's action state is RESOLVED, never a
                fall-through. The old shape rendered the CTA for `canAccept`,
                a done-state for `accepted`, and NOTHING otherwise — so a
                fallback week showed the week's only move with a blank space
                where the button lives, unexplained. `note` is now a named
                outcome: the suggestion stays readable and says why it is not
                a button. TODAY-1 is untouched — only an AI digest gets
                `accept`, so built-in copy still never reaches actionLoops. */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {(() => {
                const move = resolveRecapMove({ text: card.text, canAccept, accepted });
                if (move.kind === "accepted") return (
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold" style={{ color: "var(--arbor-green-ink)" }} role="status">
                    <Icon name="check_circle" size={16} /> {t("wk.todayStepSet")}
                  </span>
                );
                if (move.kind === "accept") return (
                  <button
                    type="button"
                    onClick={() => {
                      track("recap_try_accept", { week: report.id });
                      onAccept();
                    }}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold text-white transition active:scale-[0.98]"
                    style={{ background: "var(--arbor-gradient-primary)" }}
                  >
                    <Icon name="task_alt" size={16} /> {t("today.action.make")}
                    <Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" />
                  </button>
                );
                if (move.kind === "note") return (
                  <p
                    data-testid="recap-move-note"
                    className="basis-full text-[12px] leading-relaxed"
                    style={{ color: "var(--arbor-muted)" }}
                    role="note"
                  >
                    <Icon name="info" size={13} className="inline-block align-[-1px] me-1.5" style={{ color: "var(--arbor-green-ink)" }} />
                    {t(move.noteKey)} {t(move.whyKey)}
                  </p>
                );
                return null;
              })()}
              {/* Parent-mediated share — the FINAL card only. */}
              <ShareButton
                artifact="growth_card"
                surface="weekly-recap"
                childName={first}
                getCardOpts={() => ({
                  name: first,
                  headline: report.digest.title,
                  sub: chipLabel({ key: "moments", n: report.digest.stats.momentsLogged }),
                })}
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Button + keyboard navigation (no gesture lib). */}
      <div className="mt-3 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label={rc("elev.recap.nav.prev")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full transition active:scale-[0.96] disabled:opacity-35"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="chevron_left" size={20} className="rtl:-scale-x-100" />
        </button>

        <div className="flex items-center gap-1.5" aria-hidden>
          {cards.map((c, i) => (
            <span
              key={c.kind}
              className="rounded-full transition-all"
              style={{
                width: i === index ? 18 : 7,
                height: 7,
                background: i === index ? "var(--arbor-green-ink)" : "var(--arbor-rule-strong)",
              }}
            />
          ))}
        </div>
        <span className="sr-only" aria-live="polite">
          {rc("elev.recap.card.count", { i: index + 1, n: cards.length })}
        </span>

        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={last}
          aria-label={rc("elev.recap.nav.next")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full transition active:scale-[0.96] disabled:opacity-35"
          style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
        >
          <Icon name="chevron_right" size={20} className="rtl:-scale-x-100" />
        </button>
      </div>
    </section>
  );
}
