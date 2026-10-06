/* ════════════════════════════════════════════════════════════════════════════
   RecapStoryCards — the weekly "What changed?" letter (B-TODAY-23; first
   built W2 2.1 as the Wrapped-pattern ritual, masterplan 2026-08-11 §4).

   The primary view of the CURRENT week's report in WeeklyTab: ALWAYS four
   cards, navigated by buttons + keyboard (no gesture lib — button/keyboard/
   reduced-motion first):

     1. New this week — composeWhatChanged (the SAME composer as Today's
        "What changed since you left" card) over the calendar week the report
        id names (recapWeekStartMs): firsts, milestones noticed by title,
        approved facts, kept ideas, moments kept. Counts of parent-noticed
        things, never a total, a delta or a verdict.
     2. What helped — the parent's OWN step reports this week, grouped by
        step ("{step}: helped 2 · not today 1"). The template subject is the
        step, so "Maya is calmer" is impossible by construction.
     3. In your words — 2–3 parent-written moment texts, quoted, dir="auto",
        built client-side from the record and NEVER sent anywhere (no fetch,
        no digest field). With fewer than 3 moments this card becomes one
        promptBank question with a capture CTA (the Sunday check-in fallback).
     4. LAST — exactly ONE recommendation: the digest's tryThisWeek, CTA wired
        through the EXISTING acceptTodayAction seam (TODAY-1 guard upstream:
        WeeklyTab passes canAccept only for AI digests). Parent-mediated
        ShareButton lives on this final card ONLY.

   Gone with B-TODAY-23: the model's "what went well" paragraph, the count
   chips and the highlights/keep/watchFor block (stored digests keep them).

   Motion: slide/fade via motion.div, zeroed under useReducedMotion (plus the
   global reduced-motion CSS guard). RTL: arrow keys and chevrons flip.

   CLINICAL FIREWALL: counts and events only — pinned by recapStoryCards.test.ts
   and whatChanged.firewall.test.ts (which also pin single-recommendation-last
   and the lib/streak resettable-value ban across recap files).
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
import type { ActionOutcome } from "../../actionLoop/model";
import type { FirstsState } from "../../lib/firsts";
import { composeWhatChanged, type WhatChangedLine } from "../overview/whatChangedEvents";
import { LINE_ICON, countFor, whatChangedLineText } from "../overview/WhatChanged";

/** One step the parent tried this week, with their own outcome reports. */
export type RecapStepRow = { step: string; helped: number; somewhat: number; notToday: number };

export type RecapCard =
  | { kind: "new"; lines: WhatChangedLine[]; hiddenCount: number }
  | { kind: "helped"; steps: RecapStepRow[] }
  /** quotes.length >= 2 → the parent's words; else the promptBank fallback. */
  | { kind: "words"; quotes: string[]; promptKey: string | null }
  | { kind: "recommendation"; text: string };

/** The record slice the letter reads — all of it already on the device. */
export type RecapRecord = {
  /** recapWeekStartMs(now): the first instant of the report's calendar week. */
  weekStartMs: number;
  behaviorLogs: ReadonlyArray<{ id: string; timestamp: string; trigger?: string; notes?: string }>;
  playLogs: ReadonlyArray<{ id: string; timestamp: string; title?: string }>;
  milestones: ReadonlyArray<{ title: string; checked: boolean; observationUpdatedAt?: string }>;
  actionLoop: ReadonlyArray<{
    id: string;
    recommendation: string;
    status: "accepted" | "completed" | "superseded";
    acceptedAt: string;
    outcomeAt?: string;
    outcome?: ActionOutcome;
  }>;
  /** Parent-approved memory facts (createdAt decides the week). */
  approvedFacts: ReadonlyArray<{ createdAt: string }>;
  /** "Keep this" kept-insight rows (createdAt decides the week). */
  keptIdeas: ReadonlyArray<{ createdAt: string }>;
  firstsState: FirstsState;
  /** Milestones noticed in total — detectFirsts' input, never rendered. */
  milestoneCount: number;
  /** Today's first promptBank key — card 3's fallback question. */
  promptKey: string | null;
};

/** Card 3 shows the parent's words only from this many moments up. */
export const RECAP_WORDS_MIN_MOMENTS = 3;
export const RECAP_WORDS_MAX = 3;
export const RECAP_QUOTE_MAX = 140;
export const RECAP_STEPS_MAX = 3;
/** Card 1 holds one more line than Today (a week is longer than a visit). */
export const RECAP_NEW_MAX_LINES = 5;

const ms = (iso: string | undefined): number => {
  const v = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(v) ? v : NaN;
};
const clipQuote = (s: string): string => {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > RECAP_QUOTE_MAX ? `${clean.slice(0, RECAP_QUOTE_MAX - 1).trimEnd()}…` : clean;
};

/** Card 2: the parent's step reports this week, grouped by step, newest first. */
export function weekStepRows(actionLoop: RecapRecord["actionLoop"], weekStartMs: number): RecapStepRow[] {
  const groups = new Map<string, RecapStepRow & { latest: number }>();
  for (const a of actionLoop) {
    const at = ms(a.outcomeAt);
    if (a.status !== "completed" || !a.outcome || !(at >= weekStartMs)) continue;
    const step = a.recommendation.replace(/\s+/g, " ").trim();
    if (!step) continue;
    const g = groups.get(step) ?? { step, helped: 0, somewhat: 0, notToday: 0, latest: 0 };
    if (a.outcome === "helped") g.helped += 1;
    else if (a.outcome === "somewhat") g.somewhat += 1;
    else g.notToday += 1;
    g.latest = Math.max(g.latest, at);
    groups.set(step, g);
  }
  return [...groups.values()]
    .sort((x, y) => y.latest - x.latest)
    .slice(0, RECAP_STEPS_MAX)
    .map((g) => ({ step: g.step, helped: g.helped, somewhat: g.somewhat, notToday: g.notToday }));
}

/** Card 3: up to 3 parent-written moment texts this week, newest first. */
export function weekQuotes(logs: RecapRecord["behaviorLogs"], weekStartMs: number): string[] {
  const week = logs
    .map((l) => ({ at: ms(l.timestamp), text: (l.trigger || l.notes || "").trim() }))
    .filter((l) => l.at >= weekStartMs);
  if (week.length < RECAP_WORDS_MIN_MOMENTS) return [];
  const quotes = week
    .filter((l) => l.text.length > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, RECAP_WORDS_MAX)
    .map((l) => clipQuote(l.text));
  return quotes.length >= 2 ? quotes : [];
}

/**
 * Pure card builder (unit-tested): ALWAYS 4 cards, the LAST is the single
 * recommendation. The digest contributes only tryThisWeek; every other card
 * is the parent's own record over the report's calendar week.
 */
export function buildRecapCards(report: WeeklyReport & { digest: WeeklyDigest }, record: RecapRecord): RecapCard[] {
  const inWeek = (iso: string) => ms(iso) >= record.weekStartMs;
  const changed = composeWhatChanged({
    previousVisitAt: new Date(record.weekStartMs - 1).toISOString(),
    behaviorLogs: record.behaviorLogs,
    playLogs: record.playLogs,
    milestones: record.milestones,
    actionLoop: record.actionLoop,
    approvedFactsSince: record.approvedFacts.filter((f) => inWeek(f.createdAt)).length,
    keptIdeasSince: record.keptIdeas.filter((k) => inWeek(k.createdAt)).length,
    includeSteps: false,
    firstsState: record.firstsState,
    firstsCounts: { milestoneCount: record.milestoneCount },
    maxLines: RECAP_NEW_MAX_LINES,
  });
  const quotes = weekQuotes(record.behaviorLogs, record.weekStartMs);
  return [
    { kind: "new", lines: changed.lines, hiddenCount: changed.hiddenCount },
    { kind: "helped", steps: weekStepRows(record.actionLoop, record.weekStartMs) },
    { kind: "words", quotes, promptKey: quotes.length > 0 ? null : record.promptKey },
    { kind: "recommendation", text: report.digest.tryThisWeek },
  ];
}

const CARD_ICON: Record<RecapCard["kind"], string> = {
  new: "auto_awesome",
  helped: "task_alt",
  words: "format_quote",
  recommendation: "lightbulb",
};

export default function RecapStoryCards({
  report,
  record,
  childName,
  canAccept,
  accepted,
  onAccept,
  onCapture,
  initialIndex = 0,
  acceptStamp,
}: {
  report: WeeklyReport & { digest: WeeklyDigest };
  /** The parent's own record for the report's week (client-side only). */
  record: RecapRecord;
  childName: string;
  /** TODAY-1 guard, decided by WeeklyTab: AI digests only. */
  canAccept: boolean;
  /** Today's step already IS this recommendation (honest done-state). */
  accepted: boolean;
  onAccept: () => void;
  /** Card 3's fallback: open the ONE capture sheet in place (WeeklyTab). */
  onCapture: () => void;
  /** The card the letter opens on (0 = "New this week"). */
  initialIndex?: number;
  /** B-OCCL-02: the route's primary-move stamp (WeeklyTab ACCEPT_STAMP), set
   *  as ONE data attribute on the accept button itself — never on the
   *  letter, and never as a spread (whiteLabelContrast must prove the
   *  button's fill and ink: a prop spread could override them). */
  acceptStamp?: { readonly "data-primary-move": string };
}) {
  const { t, uiLang } = useLanguage();
  const rtl = uiLang === "he";
  const reduce = useReducedMotion();
  const rc = (key: string, vars?: Record<string, string | number>) => rcString(t, uiLang, key, vars);

  const cards = useMemo(() => buildRecapCards(report, record), [report, record]);
  const [index, setIndex] = useState(() => Math.min(Math.max(0, initialIndex), 3));
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

  const num = (n: number) => countFor(n, uiLang);

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
          background: card.kind === "recommendation" ? "var(--arbor-green-soft)" : "var(--arbor-paper-elevated)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-muted)" }}>
          <Icon name={CARD_ICON[card.kind]} size={15} />
          {card.kind === "new" && rc("elev.recap.new.eyebrow")}
          {card.kind === "helped" && rc("elev.recap.helped.eyebrow")}
          {card.kind === "words" && rc("elev.recap.words.eyebrow")}
          {card.kind === "recommendation" && rc("elev.recap.try.eyebrow")}
        </div>

        {card.kind === "new" && (
          <div className="flex-1 flex flex-col justify-center" data-testid="recap-card-new">
            {card.lines.length > 0 ? (
              <ul className="space-y-2">
                {card.lines.map((line, i) => {
                  // The quote belongs to card 3 ("In your words"): one place
                  // for the parent's words, so card 1 carries the count only.
                  const { title, sub } = whatChangedLineText(line, t, uiLang, first);
                  return (
                    <li key={`${line.kind}.${i}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{ background: "var(--arbor-paper-deep)" }}>
                      <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-green-ink)" }}>
                        <Icon name={LINE_ICON[line.kind]} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span dir="auto" className="block text-[14px] font-bold leading-snug" style={{ color: "var(--arbor-ink)" }}>{title}</span>
                        {sub && line.kind !== "moments" && (
                          <span dir="auto" className="mt-0.5 block text-[12.5px]" style={{ color: "var(--arbor-muted)" }}>{sub}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
                {card.hiddenCount > 0 && (
                  <li className="px-1 text-[12.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                    {t("elev.sincevisit.more", { n: num(card.hiddenCount) })}
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{rc("elev.recap.new.empty")}</p>
            )}
          </div>
        )}

        {card.kind === "helped" && (
          <div className="flex-1 flex flex-col justify-center" data-testid="recap-card-helped">
            {card.steps.length > 0 ? (
              <ul className="space-y-2.5">
                {/* The STEP is the subject of every line — never the child. */}
                {card.steps.map((row) => (
                  <li key={row.step} className="rounded-2xl p-4" style={{ background: "var(--arbor-paper-deep)" }}>
                    <p dir="auto" className="text-[14px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{row.step}</p>
                    <p className="mt-1 text-[12.5px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                      {[
                        row.helped > 0 ? rc("elev.recap.helped.helped", { n: num(row.helped) }) : null,
                        row.somewhat > 0 ? rc("elev.recap.helped.somewhat", { n: num(row.somewhat) }) : null,
                        row.notToday > 0 ? rc("elev.recap.helped.notToday", { n: num(row.notToday) }) : null,
                      ].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{rc("elev.recap.helped.empty")}</p>
            )}
          </div>
        )}

        {card.kind === "words" && (
          <div className="flex-1 flex flex-col justify-center" data-testid="recap-card-words">
            {card.quotes.length > 0 ? (
              /* The parent's own words, rendered from the device record only:
                 nothing on this card is ever sent to the network. */
              <ul className="space-y-3">
                {card.quotes.map((q, i) => (
                  <li key={i}>
                    <blockquote dir="auto" className="border-s-2 ps-3 text-[15px] leading-relaxed" style={{ color: "var(--arbor-ink)", borderColor: "var(--arbor-rule-strong)" }}>
                      “{q}”
                    </blockquote>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <h3 className="text-[13px] font-extrabold" style={{ color: "var(--arbor-muted)" }}>{rc("elev.recap.words.prompt")}</h3>
                {card.promptKey && (
                  <p dir="auto" className="mt-2 text-[20px] leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                    {t(card.promptKey, { name: first })}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    track("recap_words_capture", { week: report.id });
                    onCapture();
                  }}
                  data-testid="recap-words-capture"
                  className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 text-[13px] font-extrabold transition active:scale-[0.98]"
                  style={{ background: "transparent", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)" }}
                >
                  <Icon name="add" size={16} /> {rc("elev.recap.words.capture")}
                </button>
              </div>
            )}
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
                    data-primary-move={acceptStamp?.["data-primary-move"]}
                    data-testid="recap-accept"
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
                captionKey="elev.share.caption.week"
                childName={first}
                getCardOpts={() => ({
                  name: first,
                  headline: report.digest.title,
                  sub: rc("elev.recap.chip.moments", { n: num(report.digest.stats.momentsLogged) }),
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
