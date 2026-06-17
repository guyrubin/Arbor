import { afterEach, describe, expect, it } from "vitest";
import { PLAN_LIMITS, entitlementsEnforced, resolveEntitlement, type EntitlementStore } from "./entitlements.js";

const nullStore: EntitlementStore = { async getPlan() { return null; } };
const plusStore: EntitlementStore = { async getPlan() { return "plus"; } };

const ENV_KEYS = ["ARBOR_ENV", "ENFORCE_ENTITLEMENTS", "ARBOR_PLUS_UIDS", "ARBOR_PLUS_EMAILS"];

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("entitlement layer (MON-1)", () => {
  it("is unenforced by default — everyone resolves to Plus (beta posture)", async () => {
    expect(entitlementsEnforced()).toBe(false);
    const e = await resolveEntitlement(nullStore, { uid: "u1", email: null });
    expect(e.plan).toBe("plus");
    expect(e.enforced).toBe(false);
    expect(e.limits.coachMessagesPerDay).toBeNull();
  });

  it("defaults to enforced in prod so missing env cannot leak Plus", async () => {
    process.env.ARBOR_ENV = "prod";
    expect(entitlementsEnforced()).toBe(true);
    const e = await resolveEntitlement(nullStore, { uid: "u1", email: null });
    expect(e.plan).toBe("free");
    expect(e.source).toBe("default");
    expect(e.enforced).toBe(true);
  });

  it("enforced: unknown users default to free with metered coach + single child", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "true";
    const e = await resolveEntitlement(nullStore, { uid: "u1", email: null });
    expect(e.plan).toBe("free");
    expect(e.enforced).toBe(true);
    expect(e.limits.maxChildren).toBe(1);
    expect(e.limits.professionalReports).toBe(false);
    expect(typeof e.limits.coachMessagesPerDay).toBe("number");
  });

  it("enforced: env allowlists grant Plus by uid or email", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "true";
    process.env.ARBOR_PLUS_UIDS = "founder-uid, tester-uid";
    process.env.ARBOR_PLUS_EMAILS = "guy@example.com";
    expect((await resolveEntitlement(nullStore, { uid: "founder-uid", email: null })).plan).toBe("plus");
    expect((await resolveEntitlement(nullStore, { uid: "x", email: "Guy@Example.com" })).plan).toBe("plus");
    expect((await resolveEntitlement(nullStore, { uid: "x", email: "other@example.com" })).plan).toBe("free");
  });

  it("enforced: the store (billing webhook seam) wins for unknown env users", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "true";
    const e = await resolveEntitlement(plusStore, { uid: "paying-user", email: null });
    expect(e.plan).toBe("plus");
    expect(e.source).toBe("store");
    expect(e.limits.professionalReports).toBe(true);
  });

  it("plan limits express the Plus pitch: unlimited coach, reports, plans, multi-child", () => {
    expect(PLAN_LIMITS.plus.coachMessagesPerDay).toBeNull();
    expect(PLAN_LIMITS.plus.professionalReports).toBe(true);
    expect(PLAN_LIMITS.plus.advancedPlans).toBe(true);
    expect(PLAN_LIMITS.plus.maxChildren).toBeGreaterThan(PLAN_LIMITS.free.maxChildren);
  });

  it("Family adds a co-parent seat on top of everything Plus has", () => {
    expect(PLAN_LIMITS.family.coParentSeats).toBe(1);
    expect(PLAN_LIMITS.plus.coParentSeats).toBe(0);
    expect(PLAN_LIMITS.free.coParentSeats).toBe(0);
    expect(PLAN_LIMITS.family.coachMessagesPerDay).toBeNull();
    expect(PLAN_LIMITS.family.professionalReports).toBe(true);
  });

  it("enforced: a stored Family record resolves to Family with its seat", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "true";
    const familyStore: EntitlementStore = {
      async getPlan() { return "family"; },
      async getRecord() {
        return { plan: "family", status: "active", provider: "stripe", willRenew: true, currentPeriodEnd: "2999-01-01T00:00:00Z" };
      },
    };
    const e = await resolveEntitlement(familyStore, { uid: "paying-family", email: null });
    expect(e.plan).toBe("family");
    expect(e.source).toBe("store");
    expect(e.limits.coParentSeats).toBe(1);
    expect(e.status).toBe("active");
  });

  it("enforced: a lapsed (canceled + past period, no renew) record drops to Free", async () => {
    process.env.ENFORCE_ENTITLEMENTS = "true";
    const lapsedStore: EntitlementStore = {
      async getPlan() { return "plus"; },
      async getRecord() {
        return { plan: "plus", status: "canceled", willRenew: false, currentPeriodEnd: "2000-01-01T00:00:00Z" };
      },
    };
    const e = await resolveEntitlement(lapsedStore, { uid: "lapsed", email: null });
    expect(e.plan).toBe("free");
    expect(e.source).toBe("default");
  });
});
