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
import type { HubId } from "./surfaceContract";
import { usePractice7d } from "../practice/practiceWeekCount";
import { noticedMilestoneCounts } from "./record/counts";

// HubId comes from surfaceContract's HUB_IDS — the ten Heartwood hub ids that
// SC-1 asserts mirror navigation.ts SECTIONS exactly. usePulses() returns a
// Record over that SAME union, so a hub added to (or renamed in) the IA is a
// compile error here until it gets a pulse — no more silent pulse gaps.
export type { HubId };

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

/**
 * B-GROWTH-34 → B-GROWTH-35 — "how many milestones has the parent noticed"
 * lives in lib/record/counts (the ONE count reader); re-exported here for the
 * Growth pill and its existing importers.
 */
export { noticedMilestoneCounts };

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
    approvedMemoryItems,
    pendingMemoryItems,
  } = useArbor();
  const { uiLang } = useLanguage();
  // B-PLAY-04: kid-play rounds this week (practiceEvents, one subscription).
  const practice7d = usePractice7d(childProfile.id);

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

    // ── Journal: what the parent CAPTURED in the last 7 days — the moment
    //    logs (lib/signalTimeline weekMomentCount's behaviorLogs half; play is
    //    the child's, never a "moment"). NEXTLEVEL critic r1 (P0, Law 9): NO
    //    `count`, so the shell never prints this pulse ABOVE #/journal's own
    //    H1 — "5 moments this week" sat over the page's "6 moments this week".
    //    #/journal says its number once (weekMomentCount); the More-sheet row
    //    keeps this text.
    const weekAgo = nowMs - WEEK_MS;
    const journalWeek = countSince(behaviorLogs, weekAgo, nowMs);
    const journal: HubPulse =
      journalWeek > 0
        ? { key: pickCountKey("elev.pulse.journal.week", journalWeek), params: { count: journalWeek } }
        : { key: "elev.pulse.journal.empty" };

    // ── Behaviors: logged moments this week (a count, never a verdict). ────
    const behaviorsWeek = countSince(behaviorLogs, weekAgo, nowMs);
    const behaviors: HubPulse =
      behaviorsWeek > 0
        ? { key: pickCountKey("elev.pulse.behaviors.week", behaviorsWeek), params: { count: behaviorsWeek }, count: behaviorsWeek }
        : { key: "elev.pulse.behaviors.empty" };

    // ── Growth: parent-noticed milestones — B-SHELL-19: a COUNT only. The
    //    old "x of y" put the all-ages catalogue (`milestones.length`) behind
    //    the count as a denominator. B-GROWTH-34: the hub hero reads the SAME
    //    helper, so the pill and the stat row can never disagree.
    const { noticed } = noticedMilestoneCounts(milestones);
    //    W2-GROWTH r2: NO `count` — below lg the shell prints a counted pulse
    //    ABOVE the hub's H1, so #/development opened on a total ("You noticed
    //    5 milestones") the redesign cut from the body. Without `count` the
    //    shell line is the standing nav.sub.growth sentence and the page's first
    //    read is "What's new with {name}"; the More-sheet row keeps this text.
    const growth: HubPulse =
      noticed > 0
        ? { key: pickCountKey("elev.pulse.growth.noticed", noticed), params: { count: noticed } }
        : { key: "elev.pulse.growth.empty" };

    // ── Practice (B-PLAY-04): the rounds the child played this week — the
    //    return path reaching the More sheet. A count, never a verdict; the
    //    standing line at zero. Stories / Learn: no per-hub state in
    //    ArborContext yet (surface-local) — honest standing lines, like Care.
    //    Learn inherits the former Academy line (the D2 Academy split).
    const practice: HubPulse =
      practice7d > 0
        ? { key: pickCountKey("elev.pulse.practice.rounds", practice7d), params: { count: practice7d }, count: practice7d }
        : { key: "elev.pulse.practice.empty" };
    const stories: HubPulse = { key: "elev.pulse.stories.empty", params: { name } };
    const learn: HubPulse = { key: "elev.pulse.learn.empty" };

    // ── Ask Arbor: last conversation → open invitation. B-SHELL-26: the
    //    "n notes awaiting your review" line is gone — parent-written facts
    //    are kept on creation and inferences are asked inline (B-AI-07), so
    //    there is no queue to announce. `unreadCoachCount` stays an input.
    const lastConv = conversations[0]; // already sorted by updatedAt desc
    void unreadCoachCount;
    const ask: HubPulse =
      lastConv
        ? { key: "elev.pulse.ask.continue", params: { title: lastConv.title } }
        : { key: "elev.pulse.ask.empty", params: { name } };

    // ── Care: no context-held brief state since the handoff flow retired
    //    (2026-07-18; briefs are transient in the AP-056 surface) — honest
    //    standing line, like Academy. ─────────────────────────────────────────
    const care: HubPulse = { key: "elev.pulse.care.empty" };

    // ── Profile — W2-GROWTH r2: what Arbor remembers, never the album's
    //    moment total (moment counts belong to Journal, CN-007). NO `count`:
    //    below lg a counted pulse prints above the profile H1 and pushed the
    //    pending Keep toward the tab bar; the shell shows nav.sub.profile and
    //    the More-sheet row reads "Arbor remembers {n} things about {name} ·
    //    {k} waiting for you" (counts only, no comparison).
    const remembered = (approvedMemoryItems ?? []).length;
    const waiting = (pendingMemoryItems ?? []).length;
    const profile: HubPulse =
      remembered > 0 || waiting > 0
        ? {
            key: remembered === 0
              ? "elev.pulse.profile.waitingOnly"
              : `elev.pulse.profile.memory${remembered === 1 ? "One" : ""}${waiting > 0 ? "Waiting" : ""}`,
            params: { name, n: remembered, k: waiting },
          }
        : { key: "elev.pulse.profile.empty", params: { name } };

    return { today, journal, behaviors, growth, practice, stories, learn, ask, care, profile };
  }, [
    childProfile.name,
    childProfile.age,
    behaviorLogs,
    playLogs,
    milestones,
    conversations,
    unreadCoachCount,
    uiLang,
    practice7d,
    approvedMemoryItems,
    pendingMemoryItems,
  ]);
}
