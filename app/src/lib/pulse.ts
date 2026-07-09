/* ════════════════════════════════════════════════════════════════════════════
   pulse.ts — E1 hub "live pulse" helpers + usePulses().

   One tiny line per hub, computed from state the app ALREADY holds (useArbor +
   the rhythm engine) so the sidebar/hero surfaces read as a live map of the
   child. Pure helpers are exported for tests; the hook memoizes one O(n) pass.

   CLINICAL FIREWALL: every pulse is a COUNT or a plain activity fact — never a
   percentage, verdict tag, trend delta, intensity series, or deficit framing.
   Strings resolve through t(): each pulse is an i18n KEY + params (keys live in
   src/lib/i18nElevation/foundation.ts); callers render t(pulse.key, pulse.params).
   ════════════════════════════════════════════════════════════════════════════ */
import { useMemo } from "react";
import { useArbor } from "../context/ArborContext";
import { useLanguage } from "../context/LanguageContext";
import { predictRhythm, hourLabel } from "../rhythm/predict";
import type { UiLang } from "./i18n";

export type HubId =
  | "today"
  | "journal"
  | "behaviors"
  | "growth"
  | "academy"
  | "ask"
  | "care"
  | "profile";

export interface HubPulse {
  /** i18n key (always "elev.pulse.*"); render with t(key, params). */
  key: string;
  params?: Record<string, string | number>;
  /** The underlying count when the pulse is count-shaped (badge affordance). */
  count?: number;
}

export type HubPulses = Record<HubId, HubPulse>;

const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

/** Epoch ms of an ISO (or epoch) timestamp; NaN-safe → 0. */
export const tsMs = (ts: string | number): number => {
  const t = typeof ts === "number" ? ts : new Date(ts).getTime();
  return Number.isFinite(t) ? t : 0;
};

/** Count of items whose timestamp falls in [sinceMs, nowMs]. One O(n) pass. */
export function countSince(
  items: ReadonlyArray<{ timestamp: string | number }>,
  sinceMs: number,
  nowMs: number
): number {
  let n = 0;
  for (const it of items) {
    const t = tsMs(it.timestamp);
    if (t >= sinceMs && t <= nowMs) n++;
  }
  return n;
}

/** Picks the singular key variant ("<base>One") when count === 1. */
export const pickCountKey = (base: string, count: number): string =>
  count === 1 ? `${base}One` : base;

/** Hour → display time in the UI language (en "5pm", he 24h "17:00"). */
export const formatHour = (hour: number, lang: UiLang): string =>
  lang === "he" ? `${((hour % 24) + 24) % 24}:00` : hourLabel(hour);

/**
 * Per-hub live pulses from existing context. Counts/activity only, graceful
 * empty-state keys when there is no data yet. Memoized; recomputes only when
 * the underlying collections change (each pass is O(n) over ≤ ~500 items).
 */
export function usePulses(): HubPulses {
  const {
    childProfile,
    behaviorLogs,
    playLogs,
    milestones,
    conversations,
    unreadCoachCount,
    schoolBrief,
  } = useArbor();
  const { uiLang } = useLanguage();

  return useMemo<HubPulses>(() => {
    const nowMs = Date.now();
    const name = childProfile.name;

    // ── Today: the Day-Windows read from the family's own rhythm. ──────────
    const rhythm = predictRhythm(
      behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
      nowMs,
      { ageYears: childProfile.age }
    );
    const nowHour = new Date(nowMs).getHours();
    const dayStartMs = new Date(nowMs).setHours(0, 0, 0, 0); // local calendar "today"
    const capturedToday = countSince(behaviorLogs, dayStartMs, nowMs) + countSince(playLogs, dayStartMs, nowMs);
    let today: HubPulse;
    if (
      (rhythm.confidence === "medium" || rhythm.confidence === "high") &&
      rhythm.calmWindow &&
      nowHour >= rhythm.calmWindow.startHour &&
      nowHour <= rhythm.calmWindow.endHour
    ) {
      // calmWindow.endHour is the last calm hour → the window closes at :00 of the next.
      today = { key: "elev.pulse.today.calmUntil", params: { time: formatHour(rhythm.calmWindow.endHour + 1, uiLang) } };
    } else if (rhythm.windDownHour != null && nowHour < rhythm.windDownHour && rhythm.confidence !== "none") {
      today = { key: "elev.pulse.today.windDown", params: { time: formatHour(rhythm.windDownHour, uiLang) } };
    } else if (capturedToday > 0) {
      today = { key: pickCountKey("elev.pulse.today.captured", capturedToday), params: { count: capturedToday }, count: capturedToday };
    } else {
      today = { key: "elev.pulse.today.empty", params: { name } };
    }

    // ── Journal: all captured moments (logs + play wins) in the last 7 days.
    const weekAgo = nowMs - WEEK_MS;
    const journalWeek = countSince(behaviorLogs, weekAgo, nowMs) + countSince(playLogs, weekAgo, nowMs);
    const journal: HubPulse =
      journalWeek > 0
        ? { key: pickCountKey("elev.pulse.journal.week", journalWeek), params: { count: journalWeek }, count: journalWeek }
        : { key: "elev.pulse.journal.empty" };

    // ── Behaviors: logged moments this week (a count, never a verdict). ────
    const behaviorsWeek = countSince(behaviorLogs, weekAgo, nowMs);
    const behaviors: HubPulse =
      behaviorsWeek > 0
        ? { key: pickCountKey("elev.pulse.behaviors.week", behaviorsWeek), params: { count: behaviorsWeek }, count: behaviorsWeek }
        : { key: "elev.pulse.behaviors.empty" };

    // ── Growth: parent-noticed milestones as "x of y" (the canonical count).
    const noticed = milestones.filter((m) => m.checked).length;
    const growth: HubPulse =
      noticed > 0
        ? { key: "elev.pulse.growth.noticed", params: { count: noticed, total: milestones.length }, count: noticed }
        : { key: "elev.pulse.growth.empty" };

    // ── Academy: no per-course state in context yet — honest standing line.
    const academy: HubPulse = { key: "elev.pulse.academy.empty" };

    // ── Ask Arbor: review queue → last conversation → open invitation. ─────
    const lastConv = conversations[0]; // already sorted by updatedAt desc
    const ask: HubPulse =
      unreadCoachCount > 0
        ? { key: pickCountKey("elev.pulse.ask.review", unreadCoachCount), params: { count: unreadCoachCount }, count: unreadCoachCount }
        : lastConv
        ? { key: "elev.pulse.ask.continue", params: { title: lastConv.title } }
        : { key: "elev.pulse.ask.empty", params: { name } };

    // ── Care: a generated brief is a shareable activity fact. ──────────────
    const care: HubPulse = schoolBrief
      ? { key: "elev.pulse.care.briefReady" }
      : { key: "elev.pulse.care.empty" };

    // ── Profile: the album motif — total captured moments across time. ─────
    const albumTotal = behaviorLogs.length + playLogs.length;
    const profile: HubPulse =
      albumTotal > 0
        ? { key: pickCountKey("elev.pulse.profile.album", albumTotal), params: { count: albumTotal }, count: albumTotal }
        : { key: "elev.pulse.profile.empty", params: { name } };

    return { today, journal, behaviors, growth, academy, ask, care, profile };
  }, [
    childProfile.name,
    childProfile.age,
    behaviorLogs,
    playLogs,
    milestones,
    conversations,
    unreadCoachCount,
    schoolBrief,
    uiLang,
  ]);
}
