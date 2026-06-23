/**
 * jitaiPrefs.ts — AP-058: Smart Reminders parent preference store.
 *
 * PARENT PREFERENCES ONLY. This module:
 *   - Reads/writes to localStorage (key: "arbor.jitai.prefs")
 *   - Never writes to Firestore or any child-data path
 *   - Never touches consent, redaction, or GDPR surfaces
 *   - Carries NO child diagnostic data — purely scheduling preferences
 *
 * The preferences wire to the existing JITAI engine (lib/jitai.ts) at the
 * render/dispatch site. No new nudge engine is created.
 *
 * MAX-2 CONTRACT: at most 2 nudges per day. This is a hard ceiling enforced by
 * the engine; the UI makes it explicit and visible.
 *
 * CLINICAL FRAMING (board-cleared, AP-058):
 *   - Quiet-hours framing: parent's chosen boundary, not surveillance
 *   - Calm-window: routes nudges to calmer stretches, does not "watch" the child
 *   - No copy implying more nudges = better development
 *   - No copy implying the app monitors/surveils the child
 */

export type NudgeTypeKey = "guidance" | "milestone" | "weekly";

export interface JitaiPrefs {
  /** Per-type on/off toggles. */
  types: Record<NudgeTypeKey, boolean>;
  /** Quiet-hours: no nudges between quietStart and quietEnd (24h local hours). */
  quietStart: number; // default 21 (9pm)
  quietEnd: number;   // default 8  (8am)
  /** Calm-window scheduling: only route nudges to JITAI calm-window periods. */
  calmWindowOnly: boolean;
}

const LS_KEY = "arbor.jitai.prefs";

export const DEFAULT_PREFS: JitaiPrefs = {
  types: {
    guidance: true,
    milestone: true,
    weekly: true,
  },
  quietStart: 21,
  quietEnd: 8,
  calmWindowOnly: false,
};

export function loadPrefs(): JitaiPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } };
    const parsed = JSON.parse(raw) as Partial<JitaiPrefs>;
    return {
      types: {
        guidance: parsed.types?.guidance ?? DEFAULT_PREFS.types.guidance,
        milestone: parsed.types?.milestone ?? DEFAULT_PREFS.types.milestone,
        weekly: parsed.types?.weekly ?? DEFAULT_PREFS.types.weekly,
      },
      quietStart: parsed.quietStart ?? DEFAULT_PREFS.quietStart,
      quietEnd: parsed.quietEnd ?? DEFAULT_PREFS.quietEnd,
      calmWindowOnly: parsed.calmWindowOnly ?? DEFAULT_PREFS.calmWindowOnly,
    };
  } catch {
    return { ...DEFAULT_PREFS, types: { ...DEFAULT_PREFS.types } };
  }
}

export function savePrefs(prefs: JitaiPrefs): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage blocked — silent */
  }
}

/**
 * Apply quiet-hours gate: returns true if the current local hour is inside
 * the parent-configured quiet window. A nudge should be suppressed if this
 * returns true.
 *
 * Handles midnight wraps: quietStart=21, quietEnd=8 → blocked 21–08.
 */
export function isInQuietHours(prefs: JitaiPrefs, nowMs: number): boolean {
  const hour = new Date(nowMs).getHours();
  const { quietStart, quietEnd } = prefs;
  if (quietStart < quietEnd) {
    // Simple range (e.g. 01–06)
    return hour >= quietStart && hour < quietEnd;
  }
  // Wraps midnight (e.g. 21–08): blocked if OUTSIDE quietEnd..quietStart
  return hour >= quietStart || hour < quietEnd;
}

/**
 * MAX-2 CONTRACT: Given a count of nudges already sent today, returns true
 * if another nudge is permitted. The contract is max 2 per calendar day.
 */
export function isUnderDailyCeiling(sentToday: number): boolean {
  return sentToday < 2;
}

/** Format a 24h local hour as "HH:00" (e.g. 9 → "9:00 am", 21 → "9:00 pm"). */
export function formatHour(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:00 ${period}`;
}
