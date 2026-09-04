/* kpiEvents — ENG-22: the funnel families that were missing, as typed helpers.
 *
 * THE DEFECT THIS CLOSES
 * ──────────────────────
 * Six KPI families were live (lib/kpiEvents.test.ts pins them) and the growth
 * loop had its own (lib/loopEvents.ts). Between them, three whole surfaces
 * emitted NOTHING: the notification bell, the end of onboarding, and the
 * capture path — the three moments the week-2-return driver is made of. With
 * no `bell_open`, no `onboarding_completed` and no `capture_*`, D1/D7/D30 was
 * not computable from anything except `session_open`, and no funnel step
 * between "installed" and "first plan" could be seen at all.
 *
 * WHY THE HELPERS LIVE HERE AND NOT AT THE CALL SITES
 * ───────────────────────────────────────────────────
 * One choke point per family, exactly as lib/jitaiTelemetry.ts does it: the
 * projection to props is an explicit ALLOW-LIST, never a spread of a caller's
 * object. Capture and bell call sites hold a child's name and a verbatim
 * monitoring note in the very objects they would otherwise spread; a spread
 * would ship both to the analytics sink the day someone adds a field.
 *
 * CLINICAL FIREWALL / PRIVACY
 * ───────────────────────────
 * Every prop below is an ID or a COUNT. No child name, no note text, no log
 * body, no intensity, no score, no verdict, no free text of any kind. These
 * numbers describe the PRODUCT for the product team; none of them is ever
 * rendered back to a parent as a judgement about their family.
 */
import { track } from "./analytics";

export const KpiEvent = {
  /** The bell panel was opened (the in-app notification surface's reach). */
  BellOpen: "bell_open",
  /** A row inside the bell panel was tapped through to its route. */
  BellItemTap: "bell_item_tap",
  /** Setup finished and the profile was stamped complete. */
  OnboardingCompleted: "onboarding_completed",
  /** A capture was requested in some mode (voice/photo/text/ai-draft). */
  CaptureStarted: "capture_started",
  /** A capture actually landed as a row. */
  CaptureSaved: "capture_saved",
  /** The OS permission prompt is about to be shown. */
  PushPrompted: "push_prompted",
  PushGranted: "push_granted",
  PushDenied: "push_denied",
} as const;

/** The capture entry modes (mirrors ArborContext's CaptureMode union). */
export type CaptureModeId = "voice" | "photo" | "text" | "ai-draft";

/** Where a saved capture came from — a short literal id, never copy. */
export type CaptureSource = "moment" | "log";

/** Bell row classes (mirrors useNotifications' AppNotification.kind). */
export type BellItemKind = "nudge" | "monitoring";

/* ── Bell ──────────────────────────────────────────────────────────────── */

/** The panel was opened. `visible` is a COUNT of rows on screen — never the
 *  rows themselves (a monitoring row carries a verbatim note about a child). */
export function trackBellOpen(visibleCount: number): void {
  track(KpiEvent.BellOpen, { visible: Math.max(0, Math.trunc(visibleCount) || 0) });
}

/** A row was tapped. `kind` is the row class; `action` is a ROUTE id. The
 *  headline, body and note never leave the component. */
export function trackBellItemTap(kind: BellItemKind, action: string): void {
  track(KpiEvent.BellItemTap, { kind, action });
}

/* ── Onboarding ────────────────────────────────────────────────────────── */

/** Setup completed. Counts and booleans only — never the child's name, age,
 *  or the concern domains' labels (those are free text once localized). */
export function trackOnboardingCompleted(args: { domainCount: number; hasAvatar: boolean }): void {
  track(KpiEvent.OnboardingCompleted, {
    domain_count: Math.max(0, Math.trunc(args.domainCount) || 0),
    avatar: !!args.hasAvatar,
  });
}

/* ── Capture ───────────────────────────────────────────────────────────── */

/**
 * The mode of the capture currently in flight. A save happens in a different
 * component from the request (bar/bell → hub → composer → save), so the mode
 * is carried here rather than threaded through four props. Module state, not
 * storage: a mode that never resolves into a save simply dies with the tab.
 */
let pendingCaptureMode: CaptureModeId | null = null;

/** Test seam — resets the in-flight mode. */
export function resetCaptureFunnel(): void {
  pendingCaptureMode = null;
}

/** Someone asked for a capture in this entry mode (bar, bell nudge, link). */
export function trackCaptureStarted(mode: CaptureModeId): void {
  pendingCaptureMode = mode;
  track(KpiEvent.CaptureStarted, { mode });
}

/**
 * A capture landed. The reported mode is the one that started it, when a
 * request is known — otherwise "text", the direct-composer path. Consumes the
 * in-flight request so a second save is not attributed to the same one.
 */
export function trackCaptureSaved(source: CaptureSource): void {
  const mode: CaptureModeId = pendingCaptureMode ?? "text";
  pendingCaptureMode = null;
  track(KpiEvent.CaptureSaved, { mode, source });
}

/* ── Push permission ───────────────────────────────────────────────────── */

/** The OS prompt is about to be shown (the denominator of opt-in rate). */
export function trackPushPrompted(): void {
  track(KpiEvent.PushPrompted);
}

/** Resolve the prompt. Anything that is not a grant is counted as a decline —
 *  "unavailable" outcomes never reach here (see lib/push.ts). */
export function trackPushOutcome(granted: boolean): void {
  track(granted ? KpiEvent.PushGranted : KpiEvent.PushDenied);
}
