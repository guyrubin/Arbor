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
  /* ── Wave N1 (see the section at the foot of this file) ─────────────── */
  /** A model-proposed row was COMMITTED to the record (not a bar press). */
  KeepThis: "keep_this",
  /** A committed row was reversed from the frame it was kept in. */
  KeepUndone: "keep_undone",
  /** A coach answer became an actionPlans row. */
  PlanFromAnswer: "plan_from_answer",
  /** Kid Mode closed — two integers, child-generated. */
  KidSessionEnd: "kid_session_end",
  /** The browser session ended — session_open's closing partner. */
  SessionClose: "session_close",
  /** The paywall opened (once per open). */
  PaywallView: "paywall_view",
  /** Checkout was launched on web or native. */
  CheckoutStart: "checkout_start",
  /** An entitlement transitioned into an active paid tier. */
  EntitlementActive: "entitlement_active",
  /** The family returned and completed a loop on a later day. */
  Activated: "activated",
  /** A nudge passed the one scheduling choke point. */
  NudgeScheduled: "nudge_scheduled",
  /** The choke point declined to deliver, with the reason. */
  NudgeSuppressed: "nudge_suppressed",
  /** The weekly-digest email opt-in was toggled. */
  DigestEmailOptIn: "digest_email_optin",
  /** A digest send was attempted, with its fail-closed axis. */
  DigestEmailSend: "digest_email_send",
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

/* ══════════════════════════════════════════════════════════════════════════
   WAVE N1 — the loop, billing, activation, return-loop and undo families.
   ══════════════════════════════════════════════════════════════════════════

   WHY THESE ARE HERE AND NOT AT THE CALL SITES (same law as above)
   ────────────────────────────────────────────────────────────────
   Wave N1 adds thirteen event families across four builders. If each builder
   called `track()` directly, the ALLOW-LIST discipline would be re-derived
   thirteen times and would be wrong at least once — the wave's own §0 found
   that every nudge already carries a child's first name in its `vars`. So the
   projection lives here, once, and the builders import a NAME.

   THE SANITISER LAW
   ─────────────────
   Every id below passes through `shortId()` or an explicit allow-list. An
   unrecognised value becomes the sentinel `"other"` — it is NEVER emitted
   verbatim. That is what makes "free text cannot reach the sink" a property of
   the code rather than a promise in a comment: a child's name, a kept line or
   a monitoring note fails `SHORT_ID` (spaces, capitals, punctuation, length)
   and degrades to `"other"`. The guard in kpiEvents.test.ts proves it with a
   child-name fixture as the negative control.
*/

/** The sentinel an unrecognised id degrades to. Never a real id. */
export const UNKNOWN_ID = "other";

/** A short literal id: lowercase, no spaces, no punctuation beyond -_ , <= 32. */
const SHORT_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** Projects a caller's id to a safe short id, or to the sentinel. */
export function shortId(value: unknown): string {
  return typeof value === "string" && SHORT_ID.test(value) ? value : UNKNOWN_ID;
}

/**
 * A server-issued CAPABILITY id (`advancedPlans`, `coach_unlimited`,
 * `maxChildren`, …). Same law as shortId, one character class wider, because
 * these ids are camelCase and the set is open — the server can name a new
 * capability without a client release, and degrading every new one to "other"
 * would make the paywall's reason column useless within a month.
 *
 * What it still refuses is the thing the item forbids: the 402's MESSAGE. Copy
 * carries spaces and punctuation and cannot pass, in any language.
 */
export function capabilityId(value: unknown): string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,31}$/.test(value)
    ? value
    : UNKNOWN_ID;
}

/** Projects a caller's value to a member of an allow-list, or to the sentinel. */
function oneOf<T extends string>(allowed: readonly T[], value: unknown): T | typeof UNKNOWN_ID {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : UNKNOWN_ID;
}

/** Non-negative whole number. NaN/Infinity/junk degrade to 0, never to NaN. */
function count(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(0, v);
}

/* ── Loop events (N1-01) ───────────────────────────────────────────────── */

/** The fields a Keep can commit. The first three mirror KeepableField. */
export const KEEP_FIELDS = [
  "todayPlan",
  "parentScript",
  "observe",
  "journal",
  "milestone",
  "observation",
] as const;
export type KeepFieldId = (typeof KEEP_FIELDS)[number];

/** Delivery channels a nudge can take. */
export const NUDGE_CHANNELS = ["bell", "local"] as const;
export type NudgeChannel = (typeof NUDGE_CHANNELS)[number];

/** Why planNudge declined to deliver (N1-06's four reasons). */
export const NUDGE_SUPPRESS_REASONS = [
  "quiet_hours",
  "ceiling",
  "type_off",
  "no_candidate",
] as const;
export type NudgeSuppressReason = (typeof NUDGE_SUPPRESS_REASONS)[number];

/** Checkout launch channels. */
export const CHECKOUT_CHANNELS = ["web", "native"] as const;
export type CheckoutChannel = (typeof CHECKOUT_CHANNELS)[number];

/** The fail-closed axes of the digest send route (N1-07), plus success. */
export const DIGEST_SEND_RESULTS = [
  "sent",
  "provider_disabled",
  "not_opted_in",
  "unverified_address",
  "already_sent_this_week",
  "send_failed",
] as const;
export type DigestSendResult = (typeof DIGEST_SEND_RESULTS)[number];

/**
 * A row was COMMITTED to the record from a model proposal (N1-01, critic C8).
 * `field` is which contract line landed; `surface` is a short id of where the
 * keep happened. The kept TEXT never appears — that is the whole point of the
 * event living here: contentaction { verb: "save" } measures a press, this
 * measures the record.
 */
export function trackKeepThis(args: { field: string; surface: string }): void {
  track(KpiEvent.KeepThis, {
    field: oneOf(KEEP_FIELDS, args.field),
    surface: shortId(args.surface),
  });
}

/** A Keep was reversed (N1-08). Pairs 1:1 with a preceding `keep_this`. */
export function trackKeepUndone(surface: string): void {
  track(KpiEvent.KeepUndone, { surface: shortId(surface) });
}

/**
 * A coach answer became an `actionPlans` row (N1-01). Fires ONLY on that
 * conversion — not on every save, or the rate means nothing.
 */
export function trackPlanFromAnswer(surface: string): void {
  track(KpiEvent.PlanFromAnswer, { surface: shortId(surface) });
}

/**
 * Kid Mode closed (N1-01). TWO INTEGERS, by construction (critic C9): a child
 * generated this event, so there is nothing here that could carry a child's
 * content even if a call site wanted it to. `KID_MODE_PROP` in lib/analytics
 * tags and strips at the one choke point; this wave does not touch it.
 */
export function trackKidSessionEnd(args: { seconds: number; activities: number }): void {
  track(KpiEvent.KidSessionEnd, {
    seconds: count(args.seconds),
    activities: count(args.activities),
  });
}

/** The browser session ended (N1-01). The closing partner of `session_open`. */
export function trackSessionClose(seconds: number): void {
  track(KpiEvent.SessionClose, { seconds: count(seconds) });
}

/* ── Billing funnel (N1-02) ────────────────────────────────────────────── */

/**
 * The paywall opened (N1-02). Once per OPEN, never per render. `reason` is the
 * 402 capability id — never its message, never a price, never an email.
 */
export function trackPaywallView(args: { plan: string; reason: string }): void {
  track(KpiEvent.PaywallView, { plan: shortId(args.plan), reason: capabilityId(args.reason) });
}

/** Checkout was launched (N1-02). No amount, no currency, no customer id. */
export function trackCheckoutStart(args: { plan: string; channel: string }): void {
  track(KpiEvent.CheckoutStart, {
    plan: shortId(args.plan),
    channel: oneOf(CHECKOUT_CHANNELS, args.channel),
  });
}

/**
 * An entitlement became active (N1-02). Fired from `recordBillingTransition`
 * on a TIER CHANGE only — firing it on every read of the entitlement would
 * inflate the funnel's last stage and make the one real purchase unreadable
 * (critic C13). `from` is the previous tier id.
 */
export function trackEntitlementActive(args: { plan: string; from: string }): void {
  track(KpiEvent.EntitlementActive, { plan: shortId(args.plan), from: shortId(args.from) });
}

/* ── Activation (N1-03) ────────────────────────────────────────────────── */

/**
 * The family activated (N1-03). `via` is the qualifying event NAME, `day_offset`
 * the whole-day gap from the onboarding day. Fires at most once per family.
 * Never rendered back to a parent: a parent who has not returned is not failing.
 */
export function trackActivated(args: { dayOffset: number; via: string }): void {
  track(KpiEvent.Activated, { day_offset: count(args.dayOffset), via: shortId(args.via) });
}

/* ── Return loop (N1-06, N1-07) ────────────────────────────────────────── */

/** A nudge passed planNudge and was delivered on a channel (N1-06). */
export function trackNudgeScheduled(args: { kind: string; channel: string }): void {
  track(KpiEvent.NudgeScheduled, {
    kind: shortId(args.kind),
    channel: oneOf(NUDGE_CHANNELS, args.channel),
  });
}

/** planNudge declined to deliver (N1-06). The contract's audit trail. */
export function trackNudgeSuppressed(args: { kind: string; reason: string }): void {
  track(KpiEvent.NudgeSuppressed, {
    kind: shortId(args.kind),
    reason: oneOf(NUDGE_SUPPRESS_REASONS, args.reason),
  });
}

/** The weekly-digest email opt-in was toggled (N1-07). A boolean, nothing else. */
export function trackDigestEmailOptIn(on: boolean): void {
  track(KpiEvent.DigestEmailOptIn, { on: !!on });
}

/** A digest send was attempted (N1-07). `result` is a fail-closed axis or "sent". */
export function trackDigestEmailSend(result: string): void {
  track(KpiEvent.DigestEmailSend, { result: oneOf(DIGEST_SEND_RESULTS, result) });
}
