import type { EntitlementInfo } from "../../lib/api";
import { isVerifiedEntitlement } from "../../hooks/useEntitlement";

/**
 * ENG-21 — the in-context value preview: the pure decision that owns WHERE,
 * WHEN and HOW OFTEN a free parent is told what Plus is, BEFORE a 402 throws
 * them into the paywall mid-task.
 *
 * Today monetisation is a wall: the daily coach meter 402s (server/aiQuota.ts,
 * `feature: "coach_unlimited"`), ArborContext calls openPaywall, and the modal
 * is the FIRST time the parent hears the word Plus — at the exact moment they
 * were interrupted. This module moves that information earlier, and moves it
 * to a moment where nothing is at stake.
 *
 * Design position (all four choices are deliberate and all four live here, so
 * moving the preview is a one-line change, not a refactor):
 *
 *  WHERE  {@link VALUE_PREVIEW_SURFACE} — the Ask Arbor tab, on an EMPTY
 *         conversation, below the composer and below the hard-moment door.
 *         Nothing is in flight, no answer exists to interrupt, and an empty
 *         thread cannot be a hard-moment or escalation flow (those flows all
 *         begin by putting a turn in the thread).
 *  WHEN   the server-verified allowance says {@link VALUE_PREVIEW_NEAR_LIMIT}
 *         or fewer coach messages are left today, and at least one is left.
 *         At zero the parent has already hit the wall and the paywall owns
 *         that moment — a "preview" after the wall is just a second wall.
 *  HOW    once per local day per ACCOUNT, and never again that day once
 *  OFTEN  dismissed ({@link VALUE_PREVIEW_DISMISS_KEY}).
 *
 * Nothing here is about the child. The only numbers it can carry are the
 * ACCOUNT's own coach-message allowance — the same two the Settings plan row
 * already shows — and the copy it renders is copy that already ships.
 */

/** The one placement. Change this line (and the mount in CoachTab) to move it. */
export const VALUE_PREVIEW_SURFACE = "coach/empty-thread";

/** Show once the day's remaining coach messages drop to this or below. */
export const VALUE_PREVIEW_NEAR_LIMIT = 3;

/**
 * Per-ACCOUNT dismissal marker; the value is the local day it was dismissed.
 *
 * Per-account, not per-child, on purpose: the coach meter itself is metered on
 * the account uid (server/entitlements.ts COACH_METER), so a dismissal that
 * came back when the parent switched children would be a nag about the same
 * account-level fact. It is therefore deliberately NOT a `childScopedKey` and
 * is NOT swept by clearChildLocalState — deleting one child must not resurrect
 * an upsell. Account deletion still removes it: DeleteAccountModal drops every
 * `arbor`-prefixed localStorage key, which this is (asserted in the tests).
 *
 * One key holding a day, not one key per day: a per-day key template would
 * leave one orphan row per day forever (the exact defect the growth-month
 * marker was fixed for).
 */
export const VALUE_PREVIEW_DISMISS_KEY = "arbor.plan.previewDismissed";

/** Why the preview did or did not render — every branch is named and tested. */
export type ValuePreviewReason =
  | "shown"
  | "entitlement-loading"
  | "entitlement-unverified"
  | "already-subscribed"
  | "not-metered"
  | "not-enforced"
  | "thread-in-use"
  | "surface-busy"
  | "offline"
  | "already-at-limit"
  | "not-near-limit"
  | "dismissed-today";

export type ValuePreviewDecision =
  | { show: true; reason: "shown"; used: number; limit: number; remaining: number }
  | { show: false; reason: Exclude<ValuePreviewReason, "shown"> };

export type ValuePreviewInput = {
  entitlement: EntitlementInfo;
  /** True until the first server answer of the session. */
  entitlementLoading: boolean;
  /** True ONLY when the conversation carries no turn at all — parent or Arbor. */
  threadEmpty: boolean;
  /** True when nothing else owns the surface: no request in flight, no failure
   *  card, no voice session, no camera sheet. */
  surfaceIdle: boolean;
  online: boolean;
  /** Local day recorded by the last dismissal, or null. */
  dismissedOn: string | null;
  /** Today's local day key. */
  today: string;
  /** Override for the near-limit threshold (tests / a future owner tweak). */
  nearLimit?: number;
};

/**
 * Coach messages left today, or null when the plan is not metered at all.
 * Mirrors the server's own arithmetic in aiQuota.ts (`limit - count`, floored
 * at zero) so the client can never quote a number the server would not.
 */
export function coachRemaining(entitlement: EntitlementInfo): number | null {
  const limit = entitlement.limits.coachMessagesPerDay;
  if (limit === null) return null;
  const used = Math.max(0, entitlement.usage.coachMessagesToday);
  return Math.max(0, limit - used);
}

/**
 * The whole gate. Ordered so the three "this parent must never see an upsell"
 * checks run FIRST and cannot be reached past a cheaper condition:
 * unverified entitlement, an existing subscriber, an unmetered plan.
 */
export function decideValuePreview(input: ValuePreviewInput): ValuePreviewDecision {
  const { entitlement, entitlementLoading, threadEmpty, surfaceIdle, online, dismissedOn, today } = input;
  const nearLimit = input.nearLimit ?? VALUE_PREVIEW_NEAR_LIMIT;

  // MOB-08 discipline: a Plus family on a flaky connection reads as Free on the
  // client fallback. Never sell to someone we could not ask about.
  if (entitlementLoading) return { show: false, reason: "entitlement-loading" };
  if (!isVerifiedEntitlement(entitlement)) return { show: false, reason: "entitlement-unverified" };

  if (entitlement.plan !== "free") return { show: false, reason: "already-subscribed" };
  const limit = entitlement.limits.coachMessagesPerDay;
  if (limit === null) return { show: false, reason: "not-metered" };
  // Unenforced access (beta) never meets a wall, so there is nothing to preview.
  if (!entitlement.enforced) return { show: false, reason: "not-enforced" };

  if (!threadEmpty) return { show: false, reason: "thread-in-use" };
  if (!surfaceIdle) return { show: false, reason: "surface-busy" };
  if (!online) return { show: false, reason: "offline" };

  const remaining = coachRemaining(entitlement) ?? 0;
  if (remaining <= 0) return { show: false, reason: "already-at-limit" };
  if (remaining > nearLimit) return { show: false, reason: "not-near-limit" };

  if (dismissedOn === today) return { show: false, reason: "dismissed-today" };

  return { show: true, reason: "shown", used: Math.max(0, entitlement.usage.coachMessagesToday), limit, remaining };
}

/** Local calendar day, `YYYY-MM-DD`. The server meter is a rolling 24h window;
 *  a local day is the conservative approximation — the dismissal can outlive
 *  the window, never the other way round. */
export function localDayKey(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-");
}

type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const defaultStore = (): KeyValueStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // private window / storage disabled
  }
};

/** The day the preview was last dismissed, or null. Never throws. */
export function readValuePreviewDismissal(store: KeyValueStore | null = defaultStore()): string | null {
  try {
    return store?.getItem(VALUE_PREVIEW_DISMISS_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Record a dismissal for `day`. Best effort — a failed write only means the
 *  card may appear again, never that anything is blocked. */
export function writeValuePreviewDismissal(day: string, store: KeyValueStore | null = defaultStore()): void {
  try {
    store?.setItem(VALUE_PREVIEW_DISMISS_KEY, day);
  } catch {
    /* storage unavailable */
  }
}
