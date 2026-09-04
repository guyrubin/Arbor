/* jitaiTelemetry — ENG-11: the timed nudge, finally MEASURED.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * The JITAI engine (lib/jitai.ts) is the product's retention wedge, and it
 * enforces a hard max-2-per-day ceiling. Two nudges a day is a tiny budget, so
 * which cue we spend it on is the highest-leverage decision in the app — and
 * it was being made blind: nothing recorded that a cue was shown, and nothing
 * recorded whether the parent took it. `growth/jitaiPrefs.recordNudgeShown`
 * writes a localStorage counter to ENFORCE the ceiling; it is not telemetry
 * and never leaves the device.
 *
 * CLINICAL FIREWALL / PRIVACY
 * ───────────────────────────
 * These events describe the CUE, never the child. `Nudge.vars` carries the
 * child's first name (and sometimes an hour of their hardest stretch) for
 * interpolation — none of it is emitted here, and `nudgeEventProps` is a pure
 * allow-list projection, not a spread of the nudge object, so a future field
 * added to `Nudge` cannot leak by default. No fact text, no log content, no
 * intensity, no score, no verdict.
 */
import { track } from "./analytics";
import { dayPartFor, type DayPart } from "./timeOfDay";
import type { Nudge, NudgeKind } from "./jitai";
import type { ActiveTab } from "./routes";

export const NUDGE_SHOWN_EVENT = "jitai_nudge_shown";
export const NUDGE_ACTED_EVENT = "jitai_nudge_acted";
export const NUDGE_DISMISSED_EVENT = "jitai_nudge_dismissed";

/** Where the cue was rendered — so bell reach and in-surface reach are
 *  separable, which is the whole question ENG-11 exists to answer. */
export type NudgeSurface = "coach" | "today" | "bell" | "settings-preview";

export interface NudgeEventProps extends Record<string, unknown> {
  nudge_kind: NudgeKind;
  /** The route the cue points at (always a real ROUTE_ID — ENG-01). */
  nudge_action: ActiveTab;
  surface: NudgeSurface;
  day_part: DayPart;
}

/**
 * The ONE projection from a Nudge to event props. Allow-list only — see the
 * firewall note above. `hour` is injected so the function stays pure.
 */
export function nudgeEventProps(nudge: Nudge, surface: NudgeSurface, hour: number): NudgeEventProps {
  return {
    nudge_kind: nudge.kind,
    nudge_action: nudge.action,
    surface,
    day_part: dayPartFor(hour),
  };
}

const hourNow = (nowMs?: number) => new Date(nowMs ?? Date.now()).getHours();

/** The cue was rendered where a parent could actually see it. */
export function trackNudgeShown(nudge: Nudge, surface: NudgeSurface, nowMs?: number): void {
  track(NUDGE_SHOWN_EVENT, nudgeEventProps(nudge, surface, hourNow(nowMs)));
}

/** The parent took the cue — this is the number the ceiling is spent for. */
export function trackNudgeActed(nudge: Nudge, surface: NudgeSurface, nowMs?: number): void {
  track(NUDGE_ACTED_EVENT, nudgeEventProps(nudge, surface, hourNow(nowMs)));
}

/** The parent said not now. A dismissal is a signal, not a failure. */
export function trackNudgeDismissed(nudge: Nudge, surface: NudgeSurface, nowMs?: number): void {
  track(NUDGE_DISMISSED_EVENT, nudgeEventProps(nudge, surface, hourNow(nowMs)));
}
