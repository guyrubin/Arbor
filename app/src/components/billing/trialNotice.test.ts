import { describe, expect, it } from "vitest";
import { en, he, translate } from "../../lib/i18n";
import { PAYWALL_FEATURES, paywallBody } from "./paywallModel";
import {
  TRIAL_NOTICE_DAYS,
  trialDaysLeft,
  trialNotice,
  trialNoticeCopy,
  trialNoticeDismissToken,
  trialNoticeFeature,
  trialStatusCopy,
  type TrialFields,
  type TrialNotice,
} from "./trialNotice";

/**
 * BD-53 follow-up: the pre-expiry trial notice. Times sit at 12:00 UTC so the
 * calendar-day math reads the same in any time zone from UTC-10 to UTC+10
 * (CI runs UTC, the dev machine Europe).
 */
const END = "2026-11-03T12:00:00.000Z";
const at = (iso: string) => Date.parse(iso);
const trial = (over: Partial<TrialFields> = {}): TrialFields => ({ source: "trial", trialEndsAt: END, accessEnded: false, isAdmin: false, ...over });
const fmt = (iso: string) => `<${iso.slice(0, 10)}>`;

describe("trialDaysLeft: calendar days, not hours", () => {
  it("counts whole days to the end day", () => {
    expect(trialDaysLeft(END, at("2026-10-20T12:00:00.000Z"))).toBe(14);
    expect(trialDaysLeft(END, at("2026-10-31T12:00:00.000Z"))).toBe(3);
    expect(trialDaysLeft(END, at("2026-11-02T12:00:00.000Z"))).toBe(1);
  });

  it("reads 0 on the end day itself, before and after the end instant", () => {
    expect(trialDaysLeft(END, at("2026-11-03T10:00:00.000Z"))).toBe(0);
    expect(trialDaysLeft(END, at("2026-11-03T13:00:00.000Z"))).toBe(0);
  });

  it("clamps a past end at 0, never negative", () => {
    expect(trialDaysLeft(END, at("2026-11-09T12:00:00.000Z"))).toBe(0);
  });

  it("is null without a usable end", () => {
    expect(trialDaysLeft(null, at(END))).toBeNull();
    expect(trialDaysLeft(undefined, at(END))).toBeNull();
    expect(trialDaysLeft("", at(END))).toBeNull();
    expect(trialDaysLeft("not a date", at(END))).toBeNull();
  });
});

describe("trialNotice: when the notice shows", () => {
  it("shows from TRIAL_NOTICE_DAYS days out, not before", () => {
    expect(TRIAL_NOTICE_DAYS).toBe(3);
    expect(trialNotice(trial(), at("2026-10-30T12:00:00.000Z"))).toBeNull();
    expect(trialNotice(trial(), at("2026-10-31T12:00:00.000Z"))).toEqual({ kind: "ending", daysLeft: 3, endsAt: END });
    expect(trialNotice(trial(), at("2026-11-03T10:00:00.000Z"))).toEqual({ kind: "ending", daysLeft: 0, endsAt: END });
  });

  it("shows 'ended' once the server says access ended", () => {
    expect(trialNotice({ source: "default", trialEndsAt: "2026-11-03T12:00:00.000Z", accessEnded: true, isAdmin: false }, at("2026-11-10T12:00:00.000Z"))).toEqual({ kind: "ended" });
  });
});

describe("trialNotice: hide rules", () => {
  const lastDay = at("2026-11-02T12:00:00.000Z");

  it("hides on an unverified (client fallback) entitlement, even one that looks ended", () => {
    expect(trialNotice({ source: "client_fallback", trialEndsAt: END }, lastDay)).toBeNull();
    expect(trialNotice({ source: "client_fallback", accessEnded: true }, lastDay)).toBeNull();
  });

  it("hides for the admin account, in trial or ended", () => {
    expect(trialNotice(trial({ isAdmin: true }), lastDay)).toBeNull();
    expect(trialNotice({ source: "default", trialEndsAt: END, accessEnded: true, isAdmin: true }, lastDay)).toBeNull();
  });

  it("hides for paying and comped accounts (source is not 'trial')", () => {
    for (const source of ["revenuecat", "stripe", "app_store", "play_store", "env", "beta", "referral"]) {
      expect(trialNotice({ source, trialEndsAt: END, accessEnded: false }, lastDay), source).toBeNull();
    }
  });

  it("hides on a plain free plan with no trial", () => {
    expect(trialNotice({ source: "default", trialEndsAt: null, accessEnded: false }, lastDay)).toBeNull();
  });

  it("hides a trial with no end date", () => {
    expect(trialNotice(trial({ trialEndsAt: null }), lastDay)).toBeNull();
  });
});

describe("copy", () => {
  const ending = (daysLeft: number): TrialNotice => ({ kind: "ending", daysLeft, endsAt: END });

  it("picks the plural, one-day, today and ended lines", () => {
    expect(trialNoticeCopy(ending(3), fmt)).toEqual({ key: "trial.notice.days", vars: { n: 3, date: "<2026-11-03>" } });
    expect(trialNoticeCopy(ending(1), fmt)).toEqual({ key: "trial.notice.days.one", vars: { date: "<2026-11-03>" } });
    expect(trialNoticeCopy(ending(0), fmt)).toEqual({ key: "trial.notice.endsToday", vars: {} });
    expect(trialNoticeCopy({ kind: "ended" }, fmt)).toEqual({ key: "trial.notice.ended", vars: {} });
  });

  it("gives Settings a days-left line on every trial day", () => {
    expect(trialStatusCopy(END, at("2026-10-20T12:00:00.000Z"), fmt)).toEqual({ key: "set.plan.trialLeft", vars: { n: 14, date: "<2026-11-03>" } });
    expect(trialStatusCopy(END, at("2026-11-02T12:00:00.000Z"), fmt)).toEqual({ key: "set.plan.trialLeft.one", vars: { date: "<2026-11-03>" } });
    expect(trialStatusCopy(END, at("2026-11-03T10:00:00.000Z"), fmt)).toEqual({ key: "set.plan.trialEndsToday", vars: {} });
    expect(trialStatusCopy(null, at(END), fmt)).toBeNull();
  });

  const KEYS = ["trial.notice.days", "trial.notice.days.one", "trial.notice.endsToday", "trial.notice.ended", "trial.notice.cta", "trial.notice.dismiss", "set.plan.trialLeft", "set.plan.trialLeft.one", "set.plan.trialEndsToday", "pw.body.trialEnding"];

  it("every key exists in EN and HE, and HE is Hebrew", () => {
    for (const k of KEYS) {
      expect(en[k], `en ${k}`).toBeTruthy();
      expect(he[k], `he ${k}`).toBeTruthy();
      expect(/[֐-׿]/.test(he[k]), `he ${k} is Hebrew`).toBe(true);
    }
  });

  it("fills every placeholder in both languages", () => {
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "trial.notice.days", { n: 3, date: "Nov 3, 2026" })).not.toMatch(/\{\w+\}/);
      expect(translate(lang, "trial.notice.days.one", { date: "Nov 3, 2026" })).not.toMatch(/\{\w+\}/);
      expect(translate(lang, "set.plan.trialLeft", { n: 9, date: "Nov 3, 2026" })).not.toMatch(/\{\w+\}/);
      expect(translate(lang, "set.plan.trialLeft.one", { date: "Nov 3, 2026" })).not.toMatch(/\{\w+\}/);
    }
  });

  it("uses no pressure language: no exclamation, countdown or urgency words", () => {
    const PRESSURE = /!|hurry|last chance|don't miss|act now|expires?\b|\blose\b|urgent|only \d|מהרו|הזדמנות אחרונה|אל תפספס|תאבדו|דחוף/i;
    for (const k of KEYS) {
      expect(en[k], `en ${k}`).not.toMatch(PRESSURE);
      expect(he[k], `he ${k}`).not.toMatch(PRESSURE);
    }
  });

  it("the ending and ended lines promise saved data stays the parent's", () => {
    expect(en["trial.notice.ended"]).toMatch(/stays yours/);
    expect(en["pw.body.trialEnding"]).toMatch(/stays yours/);
  });
});

describe("paywall wiring", () => {
  it("the button opens a registered paywall trigger with its own body", () => {
    expect(trialNoticeFeature({ kind: "ending", daysLeft: 2, endsAt: END })).toBe("trial_ending");
    expect(trialNoticeFeature({ kind: "ended" })).toBe("trial_ended");
    for (const f of ["trial_ending", "trial_ended"] as const) {
      expect(PAYWALL_FEATURES).toContain(f);
      expect(paywallBody(f).key).not.toBe("pw.body");
    }
    expect(paywallBody("trial_ending")).toEqual({ key: "pw.body.trialEnding", source: "t" });
  });
});

describe("dismissal", () => {
  it("an ending dismissal lasts the calendar day; ended lasts for good", () => {
    const n: TrialNotice = { kind: "ending", daysLeft: 2, endsAt: END };
    const morning = trialNoticeDismissToken(n, at("2026-11-01T10:00:00.000Z"));
    expect(trialNoticeDismissToken(n, at("2026-11-01T13:00:00.000Z"))).toBe(morning);
    expect(trialNoticeDismissToken(n, at("2026-11-02T12:00:00.000Z"))).not.toBe(morning);
    expect(trialNoticeDismissToken({ kind: "ended" }, at("2026-11-01T12:00:00.000Z"))).toBe(trialNoticeDismissToken({ kind: "ended" }, at("2027-01-01T12:00:00.000Z")));
  });
});
