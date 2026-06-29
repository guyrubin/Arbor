/* JITAI — Just-In-Time Adaptive Intervention engine.
 *
 * The wedge no competitor runs: instead of clock-based reminders, fire ONE
 * well-timed nudge off the child's own logged behavioural state. The trigger is
 * the predicted rhythm (see rhythm/predict.ts) crossed with the time of day — so
 * a "get ahead of it" prep cue lands BEFORE the hour that tends to be hard, not
 * at a fixed 7pm. Group-level cold-start (honest rules) until the rhythm read is
 * dependable, then it personalises as confidence rises. Pure + deterministic:
 * callers inject nowMs, so it is fully unit-testable and never nags.
 */
import type { RhythmPrediction } from "../rhythm/predict";
import { hourLabel } from "../rhythm/predict";

export type NudgeKind = "prep" | "calm" | "log" | "practice";

export interface Nudge {
  kind: NudgeKind;
  /** i18n keys (resolved via t() at the render site) — never raw copy, so HE
   *  users see HE on the #1 retention surface. AP-005. */
  headlineKey: string;
  bodyKey: string;
  ctaKey: string;
  /** Interpolation vars for the keys above (e.g. {name}, {hour}). */
  vars?: Record<string, string | number>;
  /** Where the CTA goes: an ActiveTab id, or "log" to open the quick-log. */
  action: string;
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
}

/**
 * Choose the single best nudge for right now, or null (stay quiet — silence is a
 * feature, not a gap). Priority: an anticipatory PREP cue before a predicted hard
 * window > a wind-down CALM cue at the wind-down hour > a gentle LOG cue if the
 * day is uncaptured > a PRACTICE cue if engagement is thin.
 */
export function nextNudge(inp: JitaiInputs): Nudge | null {
  const { rhythm, childName } = inp;
  const name = childName || "your child";
  const hour = new Date(inp.nowMs).getHours();
  const dependable = rhythm.confidence === "medium" || rhythm.confidence === "high";

  // 1) PREP — fire in the 2h window before the predicted friction peak.
  if (dependable && rhythm.frictionPeak) {
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

  // 2) CALM — at the wind-down hour, offer a settling routine.
  if (dependable && rhythm.windDownHour != null && hour === rhythm.windDownHour) {
    return {
      kind: "calm",
      headlineKey: "nudge.calm.headline",
      bodyKey: "nudge.calm.body",
      ctaKey: "nudge.calm.cta",
      vars: { name },
      action: "feelings",
      tone: "sky",
    };
  }

  // 3) LOG — afternoon/evening and nothing captured yet today.
  if (inp.loggedToday === 0 && hour >= 15) {
    return {
      kind: "log",
      headlineKey: "nudge.log.headline",
      bodyKey: "nudge.log.body",
      ctaKey: "nudge.log.cta",
      vars: { name },
      action: "log",
      tone: "mint",
    };
  }

  // 4) PRACTICE — thin engagement this week, during the day.
  if (inp.recent7d < 3 && hour >= 8 && hour <= 19) {
    return {
      kind: "practice",
      headlineKey: "nudge.practice.headline",
      bodyKey: "nudge.practice.body",
      ctaKey: "nudge.practice.cta",
      vars: { name },
      action: "practice",
      tone: "lav",
    };
  }

  return null;
}
