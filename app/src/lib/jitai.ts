/* JITAI — Just-In-Time Adaptive Intervention engine.
 *
 * The wedge no competitor runs: instead of clock-based reminders, fire ONE
 * well-timed nudge off the child's own logged behavioural state. The trigger is
 * the predicted rhythm (see rhythm/predict.ts) crossed with the time of day — so
 * a "get ahead of it" prep cue lands BEFORE the hour that tends to be hard, not
 * at a fixed 7pm. Group-level cold-start (honest rules) until the rhythm read is
 * dependable, then it personalises as confidence rises. Pure + deterministic:
 * callers inject nowMs, so it is fully unit-testable and never nags.
 *
 * TJB-03 / ENG-02: the parent's Smart Reminders preferences are ENFORCED here,
 * at the one engine every consumer (bell, Today, settings preview, the future
 * push sender) calls — quiet hours → silence, the max-2/day contract → silence
 * once two distinct nudges have been shown, per-type toggles and the
 * calm-window routing → the kind is skipped and the next one considered.
 *
 * ENG-01: every `action` is a REAL route id (lib/routes ROUTE_IDS) — the old
 * "log" pseudo-route rendered Shell's error boundary. The LOG cue lands on
 * Today with `capture: "text"` so the consumer can open the quick-log there.
 */
import type { RhythmPrediction } from "../rhythm/predict";
import { hourLabel } from "../rhythm/predict";
import type { ActiveTab } from "./routes";
import { bedtimeDoorOpen } from "./timeOfDay";
import { isInQuietHours, isUnderDailyCeiling, type JitaiPrefs, type NudgeTypeKey } from "../growth/jitaiPrefs";

export type NudgeKind = "prep" | "calm" | "log" | "practice" | "bedtime";

export interface Nudge {
  kind: NudgeKind;
  /** i18n keys (resolved via t() at the render site) — never raw copy, so HE
   *  users see HE on the #1 retention surface. AP-005. */
  headlineKey: string;
  bodyKey: string;
  ctaKey: string;
  /** Interpolation vars for the keys above (e.g. {name}, {hour}). */
  vars?: Record<string, string | number>;
  /** Where the CTA goes: ALWAYS a registered route id (ENG-01). */
  action: ActiveTab;
  /** ENG-01: the LOG cue asks the landing surface to open text capture
   *  (Today's QuickLogModal via the requestCapture seam). */
  capture?: "text";
  tone: "coral" | "sky" | "mint" | "lav";
}

export interface JitaiInputs {
  nowMs: number;
  rhythm: RhythmPrediction;
  /** Moments logged so far today. */
  loggedToday: number;
  /** Moments logged in the trailing 7 days (engagement breadth proxy). */
  recent7d: number;
  childName: string;
  /** TJB-03: nudge kinds already shown today (growth/jitaiPrefs
   *  shownNudgesToday). A kind already on the list may keep showing; a NEW
   *  kind is allowed only under the max-2 ceiling. */
  shownToday?: readonly string[];
}

/**
 * TJB-03: which Smart Reminders type toggle governs each engine kind. The
 * parent's "Today's guidance" switch covers the rhythm-driven cues (prep +
 * calm). The LOG and PRACTICE cues are engagement reminders with no matching
 * toggle today — they are governed by quiet hours + the ceiling only.
 * (milestone → monitoring items and weekly → the recap line are mapped at the
 * consumer, hooks/useNotifications.)
 */
export const NUDGE_KIND_PREF: Partial<Record<NudgeKind, NudgeTypeKey>> = {
  prep: "guidance",
  calm: "guidance",
};

function kindAllowed(kind: NudgeKind, inp: JitaiInputs, prefs?: JitaiPrefs): boolean {
  const shown = inp.shownToday ?? [];
  // Max-2 contract: a kind already shown today keeps its slot; a third
  // distinct kind stays silent.
  if (!shown.includes(kind) && !isUnderDailyCeiling(shown.length)) return false;
  if (!prefs) return true;
  const pref = NUDGE_KIND_PREF[kind];
  if (pref && prefs.types[pref] === false) return false;
  // Calm-window routing: when the parent asked for calmer stretches only and
  // the rhythm has identified one, fire inside that window only. With no
  // window known yet there is nothing to route by, so the cue is not blocked.
  if (prefs.calmWindowOnly && inp.rhythm.calmWindow) {
    const hour = new Date(inp.nowMs).getHours();
    const { startHour, endHour } = inp.rhythm.calmWindow;
    if (hour < startHour || hour > endHour) return false;
  }
  return true;
}

/**
 * Choose the single best nudge for right now, or null (stay quiet — silence is a
 * feature, not a gap). Priority: an anticipatory PREP cue before a predicted hard
 * window > a wind-down CALM cue at the wind-down hour > a BEDTIME cue once the
 * evening door is open (ENG-10) > a gentle LOG cue if the day is uncaptured >
 * a PRACTICE cue if engagement is thin.
 *
 * `prefs` (TJB-03): the parent's Smart Reminders preferences. Quiet hours win
 * over everything; a disabled kind is skipped and the next one considered.
 */
export function nextNudge(inp: JitaiInputs, prefs?: JitaiPrefs): Nudge | null {
  const { rhythm, childName } = inp;
  const name = childName || "your child";
  const hour = new Date(inp.nowMs).getHours();
  const dependable = rhythm.confidence === "medium" || rhythm.confidence === "high";

  // 0) QUIET HOURS — the parent's boundary. Nothing fires inside it.
  if (prefs && isInQuietHours(prefs, inp.nowMs)) return null;

  // 1) PREP — fire in the 2h window before the predicted friction peak.
  if (dependable && rhythm.frictionPeak && kindAllowed("prep", inp, prefs)) {
    const peak = rhythm.frictionPeak.hour;
    if (hour >= peak - 2 && hour <= peak) {
      return {
        kind: "prep",
        headlineKey: "nudge.prep.headline",
        bodyKey: "nudge.prep.body",
        ctaKey: "nudge.prep.cta",
        vars: { name, hour: hourLabel(peak) },
        action: "coach",
        tone: "coral",
      };
    }
  }

  // 2) CALM — at the wind-down hour, offer a settling routine (the parent-run
  //    Routines library, never a kid-register drill — ENG-01).
  if (dependable && rhythm.windDownHour != null && hour === rhythm.windDownHour && kindAllowed("calm", inp, prefs)) {
    return {
      kind: "calm",
      headlineKey: "nudge.calm.headline",
      bodyKey: "nudge.calm.body",
      ctaKey: "nudge.calm.cta",
      vars: { name },
      action: "routines",
      tone: "sky",
    };
  }

  // 3) BEDTIME — ENG-10, the evening door. `bedtimeDoorOpen` consumes
  //    dayPartFor: from 18:00 for everyone, and earlier only when the family's
  //    OWN wind-down hour says so. Deliberately NOT gated on rhythm
  //    confidence — the evening is a fact of the clock, not a prediction, and a
  //    day-1 family deserves the bedtime surface as much as a day-30 one.
  //    It sits ABOVE the LOG cue because after 18:00 the honest next move is
  //    tonight's story, not "capture the day you are still living"; the
  //    15:00–17:59 LOG window is MOSTLY untouched — the exception is a family
  //    whose own windDownHour resolves to 17 (predict.ts can derive
  //    max(17, eveningPeak - 1)), who get BEDTIME at 17:00 instead of LOG.
  //    That is their own rhythm rather than an invented early evening, but the
  //    window is not unconditional and this comment used to claim it was.
  //    Quiet hours (default 21:00) close it again. The max-2 ceiling applies —
  //    though note RhythmCue reads the ledger without spending it, so on Today
  //    and Ask the ceiling binds only via the bell.
  if (bedtimeDoorOpen(hour, rhythm.windDownHour) && kindAllowed("bedtime", inp, prefs)) {
    return {
      kind: "bedtime",
      headlineKey: "elev.evening.nudge.headline",
      bodyKey: "elev.evening.nudge.body",
      ctaKey: "elev.evening.nudge.cta",
      vars: { name },
      action: "bedtime-stories",
      tone: "lav",
    };
  }

  // 4) LOG — afternoon and nothing captured yet today → Today, with
  //    the quick-log asked to open there.
  if (inp.loggedToday === 0 && hour >= 15 && kindAllowed("log", inp, prefs)) {
    return {
      kind: "log",
      headlineKey: "nudge.log.headline",
      bodyKey: "nudge.log.body",
      ctaKey: "nudge.log.cta",
      vars: { name },
      action: "overview",
      capture: "text",
      tone: "mint",
    };
  }

  // 5) PRACTICE — thin engagement this week, during the day → the
  //    parent-mediated Daily Play hub (not the kid Practice Studio).
  if (inp.recent7d < 3 && hour >= 8 && hour <= 19 && kindAllowed("practice", inp, prefs)) {
    return {
      kind: "practice",
      headlineKey: "nudge.practice.headline",
      bodyKey: "nudge.practice.body",
      ctaKey: "nudge.practice.cta",
      vars: { name },
      action: "daily-play",
      tone: "lav",
    };
  }

  return null;
}
