import type { EntitlementInfo } from "../../lib/api";

/**
 * BD-53 follow-up: warn parents before the 14-day trial ends.
 *
 * The pure view-model behind the Shell's trial notice and the Settings trial
 * line (node-testable, no React). The server owns the trial
 * (server/entitlements.ts trialEndsAtFor / accessEnded); the client only reads
 * `source`, `trialEndsAt`, `accessEnded` and `isAdmin` from /api/entitlement
 * and never computes a trial of its own.
 *
 * Hide rules, in order:
 *  1. unverified (client_fallback): the plan is not known, so say nothing;
 *  2. admin (ARBOR_ADMIN_EMAILS): the operator account is never sold to;
 *  3. ended (accessEnded): the "ended" notice;
 *  4. anything that is not a running trial: paid, comped (source "env"),
 *     family, plain free;
 *  5. no end date, or more than TRIAL_NOTICE_DAYS calendar days left.
 *
 * No countdown clock, no red, no "last chance": one calm line, dismissible,
 * that says when the trial ends and that saved data stays the parent's.
 */
export const TRIAL_NOTICE_DAYS = 3;

export type TrialNotice =
  | { kind: "ending"; daysLeft: number; endsAt: string }
  | { kind: "ended" };

export type TrialFields = Pick<EntitlementInfo, "source" | "trialEndsAt" | "accessEnded" | "isAdmin">;

/** An i18n key plus the vars `t()` fills. */
export type TrialCopy = { key: string; vars: Record<string, string | number> };

const DAY_MS = 86_400_000;

const startOfLocalDay = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/**
 * Calendar days from today to the trial's end day, in the parent's own time
 * zone: 0 = ends today, 1 = tomorrow. Clamped at 0, so an entitlement whose
 * end has just passed reads "today" until the server reports `accessEnded`.
 * null when the end is missing or unparseable.
 */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: number): number | null {
  if (!trialEndsAt) return null;
  const end = Date.parse(trialEndsAt);
  if (!Number.isFinite(end)) return null;
  // Math.round absorbs the 23- and 25-hour days around a DST change.
  return Math.max(0, Math.round((startOfLocalDay(end) - startOfLocalDay(now)) / DAY_MS));
}

export function trialNotice(e: TrialFields, now: number = Date.now()): TrialNotice | null {
  if (e.source === "client_fallback") return null;
  if (e.isAdmin === true) return null;
  if (e.accessEnded === true) return { kind: "ended" };
  if (e.source !== "trial") return null;
  const daysLeft = trialDaysLeft(e.trialEndsAt, now);
  if (daysLeft === null || daysLeft > TRIAL_NOTICE_DAYS) return null;
  return { kind: "ending", daysLeft, endsAt: e.trialEndsAt as string };
}

/** The notice line. `fmtDate` is formatDate.fmtDay bound to the UI language. */
export function trialNoticeCopy(n: TrialNotice, fmtDate: (iso: string) => string): TrialCopy {
  if (n.kind === "ended") return { key: "trial.notice.ended", vars: {} };
  if (n.daysLeft === 0) return { key: "trial.notice.endsToday", vars: {} };
  if (n.daysLeft === 1) return { key: "trial.notice.days.one", vars: { date: fmtDate(n.endsAt) } };
  return { key: "trial.notice.days", vars: { n: n.daysLeft, date: fmtDate(n.endsAt) } };
}

/**
 * The Settings plan line for a running trial, every day of it: "N days left,
 * ends {date}". Falls back to the plain "ends {date}" line when the days math
 * has no end date; null when there is no date at all.
 */
export function trialStatusCopy(trialEndsAt: string | null | undefined, now: number, fmtDate: (iso: string) => string): TrialCopy | null {
  if (!trialEndsAt) return null;
  const daysLeft = trialDaysLeft(trialEndsAt, now);
  const date = fmtDate(trialEndsAt);
  if (daysLeft === null) return date ? { key: "set.plan.trial", vars: { date } } : null;
  if (daysLeft === 0) return { key: "set.plan.trialEndsToday", vars: {} };
  if (daysLeft === 1) return { key: "set.plan.trialLeft.one", vars: { date } };
  return { key: "set.plan.trialLeft", vars: { n: daysLeft, date } };
}

/** The paywall trigger the notice's button opens (PAYWALL_FEATURES). */
export const trialNoticeFeature = (n: TrialNotice): "trial_ending" | "trial_ended" =>
  n.kind === "ended" ? "trial_ended" : "trial_ending";

export const TRIAL_NOTICE_DISMISS_KEY = "arbor.trialNotice.dismissed";

/**
 * What a dismissal stores. An "ending" notice comes back the next calendar
 * day, so a parent sees it at most four times (3, 2, 1 days, today). "ended"
 * is dismissed for good: the 402 trial_ended paywall still opens at the
 * moment an answer is actually asked for.
 */
export function trialNoticeDismissToken(n: TrialNotice, now: number): string {
  if (n.kind === "ended") return "ended";
  const d = new Date(now);
  return `ending:${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
