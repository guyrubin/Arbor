/**
 * BD-53 (Guy, 20 Oct 2026): 14 days of full Plus from sign-up, no card, then
 * Arbor's AI needs a subscription. Pins the trial clock, the states it yields,
 * the founder/admin exemption and the 402 every gate returns once it is over.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRIAL_DAYS,
  TRIAL_ENDED_BODY,
  TRIAL_LAUNCHED_AT,
  accessEnded,
  createCoachMeter,
  entitlementForRequest,
  requireActiveAccess,
  requirePlusFeature,
  resolveEntitlement,
  trialEndsAtFor,
  type EntitlementRecord,
  type EntitlementStore,
} from "./entitlements.js";
import { createCoachGate } from "./aiQuota.js";
import { imagePlanFor } from "./imageQuota.js";
import { MemoryCounterStore } from "./quotaStore.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-12-01T12:00:00.000Z");
const ENV_KEYS = ["ENFORCE_ENTITLEMENTS", "ARBOR_FAMILY_EMAILS", "ARBOR_ADMIN_EMAILS", "ARBOR_PLUS_EMAILS"];

const storeWith = (createdAt: number | null, record: EntitlementRecord | null = null): EntitlementStore => ({
  async getPlan() { return record?.plan ?? null; },
  async getRecord() { return record; },
  async accountCreatedAt() { return createdAt; },
});

const fakeRes = () => {
  const res: any = { statusCode: 200, body: undefined as unknown, headers: {} as Record<string, string> };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
  return res;
};
const reqFor = (uid = "family-uid", email: string | null = "parent@family.test") => ({ user: { uid, email }, ip: "1.2.3.4", baseUrl: "", path: "", originalUrl: "" });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.ENFORCE_ENTITLEMENTS = "true";
});
afterEach(() => {
  vi.useRealTimers();
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("trial clock", () => {
  it("is 14 days", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("an account created after launch gets 14 days from sign-up", () => {
    const created = Date.parse("2026-11-01T09:00:00.000Z");
    expect(trialEndsAtFor(created)).toBe(created + 14 * DAY);
  });

  it("an account that existed before launch gets 14 days from launch, not from sign-up", () => {
    const created = Date.parse("2026-06-01T09:00:00.000Z");
    expect(trialEndsAtFor(created)).toBe(TRIAL_LAUNCHED_AT + 14 * DAY);
  });
});

describe("resolveEntitlement with the trial", () => {
  it("inside the trial: full Plus, in_trial, with the end date", async () => {
    const e = await resolveEntitlement(storeWith(NOW - 3 * DAY), { uid: "u", email: null });
    expect(e.plan).toBe("plus");
    expect(e.source).toBe("trial");
    expect(e.status).toBe("in_trial");
    expect(e.limits.coachMessagesPerDay).toBeNull();
    expect(e.trialEndsAt).toBe(new Date(NOW + 11 * DAY).toISOString());
    expect(e.currentPeriodEnd).toBe(e.trialEndsAt);
    expect(accessEnded(e)).toBe(false);
  });

  it("after the trial with nothing paid: access ended", async () => {
    const e = await resolveEntitlement(storeWith(NOW - 15 * DAY), { uid: "u", email: null });
    expect(e.plan).toBe("free");
    expect(e.trialEndsAt).toBe(new Date(NOW - DAY).toISOString());
    expect(accessEnded(e)).toBe(true);
  });

  it("a paid subscription wins over an ended trial", async () => {
    const paid: EntitlementRecord = { plan: "plus", status: "active", provider: "stripe", willRenew: true, currentPeriodEnd: new Date(NOW + 20 * DAY).toISOString() };
    const e = await resolveEntitlement(storeWith(NOW - 40 * DAY, paid), { uid: "u", email: null });
    expect(e.plan).toBe("plus");
    expect(e.source).toBe("store");
    expect(accessEnded(e)).toBe(false);
  });

  it("an unreadable trial clock keeps the legacy free limits and never locks the family out", async () => {
    const e = await resolveEntitlement(storeWith(null), { uid: "u", email: null });
    expect(e.plan).toBe("free");
    expect(e.trialEndsAt).toBeNull();
    expect(accessEnded(e)).toBe(false);
  });

  it("the founder/admin account (bguy) never meets the trial or the paywall — even off the Family comp list", async () => {
    process.env.ARBOR_ADMIN_EMAILS = "bguy.rubin@gmail.com";
    const e = await resolveEntitlement(storeWith(NOW - 400 * DAY), { uid: "guy-uid", email: "BGuy.Rubin@gmail.com" });
    expect(e.plan).toBe("family");
    expect(e.source).toBe("env");
    expect(accessEnded(e)).toBe(false);
  });

  it("the Family comp list is exempt too", async () => {
    process.env.ARBOR_FAMILY_EMAILS = "bguy.rubin@gmail.com";
    const e = await resolveEntitlement(storeWith(NOW - 400 * DAY), { uid: "guy-uid", email: "bguy.rubin@gmail.com" });
    expect(e.plan).toBe("family");
    expect(accessEnded(e)).toBe(false);
  });

  it("unenforced (sandbox/beta) never ends access", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "false";
    const e = await resolveEntitlement(storeWith(NOW - 400 * DAY), { uid: "u", email: null });
    expect(accessEnded(e)).toBe(false);
  });
});

describe("every gate answers 402 trial_ended once the trial is over", () => {
  const ended = storeWith(NOW - 30 * DAY);
  const running = storeWith(NOW - DAY);

  it("requireActiveAccess: ended → 402 trial_ended; running → next()", async () => {
    const res = fakeRes();
    const next = vi.fn();
    await requireActiveAccess(ended)(reqFor() as any, res, next);
    expect(res.statusCode).toBe(402);
    expect(res.body).toEqual(TRIAL_ENDED_BODY);
    expect(next).not.toHaveBeenCalled();

    const res2 = fakeRes();
    const next2 = vi.fn();
    await requireActiveAccess(running)(reqFor() as any, res2, next2);
    expect(next2).toHaveBeenCalledOnce();
    expect(res2.statusCode).toBe(200);
  });

  it("requireActiveAccess passes through when resolution throws (downstream gates still apply)", async () => {
    const broken: EntitlementStore = { async getPlan() { return null; }, async getRecord() { throw new Error("down"); } };
    const next = vi.fn();
    await requireActiveAccess(broken)(reqFor() as any, fakeRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("the coach gate (chat/council) answers 402 trial_ended before metering", async () => {
    const counters = new MemoryCounterStore();
    const res = fakeRes();
    const next = vi.fn();
    await createCoachGate(counters, ended, { exemptHourly: true })(reqFor() as any, res, next);
    expect(res.statusCode).toBe(402);
    expect((res.body as any).upgrade.feature).toBe("trial_ended");
    expect(next).not.toHaveBeenCalled();
  });

  it("the coach gate lets a trial family through without the daily meter", async () => {
    const res = fakeRes();
    const next = vi.fn();
    await createCoachGate(new MemoryCounterStore(), running, { exemptHourly: true })(reqFor() as any, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["X-Coach-Limit"]).toBeUndefined();
  });

  it("the legacy coach meter and the Plus feature gates agree", async () => {
    const res = fakeRes();
    await createCoachMeter(ended, new MemoryCounterStore())(reqFor() as any, res, vi.fn());
    expect((res.body as any).upgrade.feature).toBe("trial_ended");
    const res2 = fakeRes();
    await requirePlusFeature(ended, "professionalReports", "Professional reports")(reqFor() as any, res2, vi.fn());
    expect((res2.body as any).upgrade.feature).toBe("trial_ended");
  });

  it("images: a family past its trial is charged to the zero row", async () => {
    expect(await imagePlanFor(reqFor(), ended)).toBe("signed_out");
    expect(await imagePlanFor(reqFor(), running)).toBe("plus");
  });

  it("the entitlement is resolved once per request and shared by the gates", async () => {
    const getRecord = vi.fn(async () => null);
    const store: EntitlementStore = { async getPlan() { return null; }, getRecord, async accountCreatedAt() { return NOW - DAY; } };
    const req = reqFor();
    await entitlementForRequest(req, store);
    await imagePlanFor(req, store);
    await requireActiveAccess(store)(req as any, fakeRes(), vi.fn());
    expect(getRecord).toHaveBeenCalledOnce();
  });
});
