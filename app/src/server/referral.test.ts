import { describe, expect, it, beforeEach } from "vitest";
import { LocalReferralStore, codeForUid, isActivePaid, legacyRedemptionsFromLedgers } from "./referral.js";
import type { EntitlementRecord, EntitlementStore } from "./entitlements.js";

const SECRET = "test-salt";
const MAX = 5;

/** A writable in-memory entitlement store so we can inspect granted records. */
class FakeEntitlementStore implements EntitlementStore {
  records = new Map<string, EntitlementRecord>();
  async getPlan(uid: string) { return this.records.get(uid)?.plan ?? null; }
  async getRecord(uid: string) { return this.records.get(uid) ?? null; }
  async setEntitlement(uid: string, record: EntitlementRecord) { this.records.set(uid, record); }
}

const make = () => {
  const ent = new FakeEntitlementStore();
  const store = new LocalReferralStore(SECRET, MAX, ent);
  return { ent, store };
};

describe("referral codes (mk-p0-2)", () => {
  it("are stable per uid and ARBOR-prefixed with a non-ambiguous alphabet", async () => {
    const a = codeForUid("uid_A", SECRET);
    const b = codeForUid("uid_A", SECRET);
    expect(a).toBe(b);
    expect(a).toMatch(/^ARBOR-[2-9A-HJ-NP-Z]{8}$/);
    // The 8-char body uses a non-ambiguous alphabet (the "O" in the ARBOR- prefix is fine).
    const body = a.slice("ARBOR-".length);
    for (const ch of ["0", "O", "1", "I"]) expect(body).not.toContain(ch);
  });

  it("differ across uids and across secrets", () => {
    expect(codeForUid("uid_A", SECRET)).not.toBe(codeForUid("uid_B", SECRET));
    expect(codeForUid("uid_A", SECRET)).not.toBe(codeForUid("uid_A", "other"));
  });

  it("the store round-trips code → uid", async () => {
    const { store } = make();
    const code = await store.codeForUid("uid_A");
    expect(await store.uidForCode(code)).toBe("uid_A");
    expect(await store.uidForCode(code.toLowerCase())).toBe("uid_A"); // case-insensitive
    expect(await store.uidForCode("ARBOR-UNKNOWN")).toBeNull();
  });
});

describe("referral activation guards (mk-p0-2)", () => {
  let ctx: ReturnType<typeof make>;
  beforeEach(() => { ctx = make(); });

  it("grants one comp Plus month to BOTH parties on first activation", async () => {
    const { store, ent } = ctx;
    const code = await store.codeForUid("uid_A");
    const res = await store.activateReferral({ code, redeemerUid: "uid_B" });
    expect(res).toMatchObject({ ok: true, status: "granted", earnedMonths: 1 });

    for (const uid of ["uid_A", "uid_B"]) {
      const rec = ent.records.get(uid)!;
      expect(rec.plan).toBe("plus");
      expect(rec.provider).toBe("comp");
      expect(rec.productId).toBe("referral_month");
      expect(rec.willRenew).toBe(false);
      const end = Date.parse(rec.currentPeriodEnd!);
      const days = (end - Date.now()) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThan(31);
    }
  });

  it("rejects self-referral and grants nothing", async () => {
    const { store, ent } = ctx;
    const code = await store.codeForUid("uid_A");
    const res = await store.activateReferral({ code, redeemerUid: "uid_A" });
    expect(res).toEqual({ ok: false, status: "self_referral" });
    expect(ent.records.size).toBe(0);
  });

  it("rejects an unknown code", async () => {
    const { store } = ctx;
    const res = await store.activateReferral({ code: "ARBOR-NOPENOPE", redeemerUid: "uid_B" });
    expect(res).toEqual({ ok: false, status: "unknown_code" });
  });

  it("a second activation by the same redeemed uid is a no-op", async () => {
    const { store } = ctx;
    const code = await store.codeForUid("uid_A");
    await store.activateReferral({ code, redeemerUid: "uid_B" });
    const second = await store.activateReferral({ code, redeemerUid: "uid_B" });
    expect(second).toEqual({ ok: true, status: "already_activated" });
    expect(await store.earnedMonths("uid_A")).toBe(1); // not double-counted
  });

  it("stops granting to a referrer past the cap but still 200s", async () => {
    const { store } = ctx;
    const code = await store.codeForUid("uid_A");
    for (let i = 0; i < MAX; i++) {
      const r = await store.activateReferral({ code, redeemerUid: `redeemer_${i}` });
      expect(r).toMatchObject({ status: "granted" });
    }
    const overCap = await store.activateReferral({ code, redeemerUid: "one_too_many" });
    expect(overCap).toMatchObject({ ok: true, status: "maxed", earnedMonths: MAX });
  });

  it("extends (does not stack) an existing comp referral month for a referrer who earns again", async () => {
    const { store, ent } = ctx;
    const codeA = await store.codeForUid("uid_A");
    await store.activateReferral({ code: codeA, redeemerUid: "uid_B" });
    const firstEnd = Date.parse(ent.records.get("uid_A")!.currentPeriodEnd!);
    // uid_A's code brings a second family, uid_D: uid_A earns a second month
    await store.activateReferral({ code: codeA, redeemerUid: "uid_D" });
    const rec = ent.records.get("uid_A")!;
    expect(rec.productId).toBe("referral_month"); // single record, not stacked
    const secondEnd = Date.parse(rec.currentPeriodEnd!);
    const extraDays = (secondEnd - firstEnd) / (24 * 60 * 60 * 1000);
    expect(extraDays).toBeGreaterThan(29); // pushed out ~30d from prior end
  });

  it("never overwrites an active PAID record with a comp grant", async () => {
    const { store, ent } = ctx;
    const paid: EntitlementRecord = {
      plan: "plus",
      status: "active",
      provider: "stripe",
      productId: "plus_monthly",
      willRenew: true,
      currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    };
    ent.records.set("uid_B", paid);
    const code = await store.codeForUid("uid_A");
    const res = await store.activateReferral({ code, redeemerUid: "uid_B" });
    expect(res).toMatchObject({ ok: true });
    // uid_B's paid record is untouched; uid_A (free) still gets their comp month.
    expect(ent.records.get("uid_B")).toEqual(paid);
    expect(ent.records.get("uid_A")?.provider).toBe("comp");
  });
});

describe("B-GROWTH-43 — one offer redemption per family", () => {
  let ctx: ReturnType<typeof make>;
  beforeEach(() => { ctx = make(); });

  it("a family referred by a second parent is refused: no second month, no grant to the second referrer", async () => {
    const { store, ent } = ctx;
    const codeA = await store.codeForUid("uid_A");
    const codeC = await store.codeForUid("uid_C");
    await store.activateReferral({ code: codeA, redeemerUid: "uid_B" });
    const firstEnd = ent.records.get("uid_B")!.currentPeriodEnd;
    const second = await store.activateReferral({ code: codeC, redeemerUid: "uid_B" });
    expect(second).toEqual({ ok: true, status: "already_activated" });
    expect(ent.records.get("uid_B")!.currentPeriodEnd).toBe(firstEnd);
    expect(ent.records.has("uid_C")).toBe(false);
    expect(await store.earnedMonths("uid_C")).toBe(0);
  });

  it("two devices racing with two codes grant exactly one month to the family", async () => {
    const { store, ent } = ctx;
    const codeA = await store.codeForUid("uid_A");
    const codeC = await store.codeForUid("uid_C");
    const results = await Promise.all([
      store.activateReferral({ code: codeA, redeemerUid: "uid_B" }),
      store.activateReferral({ code: codeC, redeemerUid: "uid_B" }),
    ]);
    expect(results.filter((r) => r.ok && r.status === "granted")).toHaveLength(1);
    expect(results.filter((r) => r.ok && r.status === "already_activated")).toHaveLength(1);
    const days = (Date.parse(ent.records.get("uid_B")!.currentPeriodEnd!) - Date.now()) / 86_400_000;
    expect(days).toBeLessThan(31);
  });

  it("a typed code in any case or spacing redeems the same offer, and the redemption says how it was entered", async () => {
    const { store, ent } = ctx;
    const code = await store.codeForUid("uid_A");
    const typed = `  ${code.slice("ARBOR-".length, 10).toLowerCase()} ${code.slice(10).toLowerCase()} `;
    const res = await store.activateReferral({ code: typed, redeemerUid: "uid_B", via: "typed" });
    expect(res).toMatchObject({ ok: true, status: "granted" });
    expect(ent.records.get("uid_B")?.productId).toBe("referral_month");
    expect(await store.familyRedemption("uid_B")).toMatchObject({ offerId: "referral_month", offerVersion: 1, via: "typed" });
    expect(await store.familyRedemption("uid_A")).toBeNull(); // the referrer redeemed nothing
  });

  it("an unknown or self code never uses up the family's one redemption", async () => {
    const { store } = ctx;
    const own = await store.codeForUid("uid_B");
    expect(await store.activateReferral({ code: own, redeemerUid: "uid_B" })).toEqual({ ok: false, status: "self_referral" });
    expect(await store.activateReferral({ code: "ARBOR-22222222", redeemerUid: "uid_B" })).toEqual({ ok: false, status: "unknown_code" });
    expect(await store.familyRedemption("uid_B")).toBeNull();
    const codeA = await store.codeForUid("uid_A");
    expect(await store.activateReferral({ code: codeA, redeemerUid: "uid_B" })).toMatchObject({ status: "granted" });
  });
});

describe("B-GROWTH-43 — families that redeemed before the claim existed, and failed grants", () => {
  it("a family a referrer ledger already credits is refused, and its claim is written as legacy", async () => {
    const { store, ent } = make();
    store.seedLegacyLedger("uid_A", ["uid_B"]); // uid_B redeemed uid_A's code before offerRedemptions existed
    const codeC = await store.codeForUid("uid_C");
    expect(await store.activateReferral({ code: codeC, redeemerUid: "uid_B", via: "typed" })).toEqual({ ok: true, status: "already_activated" });
    expect(await store.familyRedemption("uid_B")).toMatchObject({ offerId: "referral_month", legacy: true });
    expect(ent.records.size).toBe(0);
    expect(await store.earnedMonths("uid_C")).toBe(0);
  });

  it("legacyRedemptionsFromLedgers lists every credited family once, ignoring junk", () => {
    expect(legacyRedemptionsFromLedgers([{ activatedBy: ["a", "b"] }, { activatedBy: ["b", "", 3] }, {}, { activatedBy: "x" }])).toEqual(["a", "b"]);
  });

  it("a failed family grant releases the claim and the ledger entry, so the retry succeeds", async () => {
    const ent = new FakeEntitlementStore();
    let failFor: string | null = "uid_B";
    const set = ent.setEntitlement.bind(ent);
    ent.setEntitlement = async (uid: string, record: EntitlementRecord) => {
      if (uid === failFor) throw new Error("firestore unavailable");
      return set(uid, record);
    };
    const store = new LocalReferralStore(SECRET, MAX, ent);
    const code = await store.codeForUid("uid_A");
    await expect(store.activateReferral({ code, redeemerUid: "uid_B" })).rejects.toThrow("firestore unavailable");
    expect(await store.familyRedemption("uid_B")).toBeNull();
    expect(await store.earnedMonths("uid_A")).toBe(0);
    failFor = null;
    expect(await store.activateReferral({ code, redeemerUid: "uid_B" })).toMatchObject({ ok: true, status: "granted", earnedMonths: 1 });
    expect(ent.records.get("uid_B")?.productId).toBe("referral_month");
  });

  it("a failed referrer grant never undoes the family's month", async () => {
    const ent = new FakeEntitlementStore();
    const set = ent.setEntitlement.bind(ent);
    ent.setEntitlement = async (uid: string, record: EntitlementRecord) => {
      if (uid === "uid_A") throw new Error("firestore unavailable");
      return set(uid, record);
    };
    const store = new LocalReferralStore(SECRET, MAX, ent);
    const code = await store.codeForUid("uid_A");
    expect(await store.activateReferral({ code, redeemerUid: "uid_B" })).toMatchObject({ ok: true, status: "granted" });
    expect(ent.records.get("uid_B")?.productId).toBe("referral_month");
    expect(await store.familyRedemption("uid_B")).not.toBeNull();
  });
});

describe("isActivePaid", () => {
  it("is true for an active stripe/app_store/play_store record", () => {
    for (const provider of ["stripe", "app_store", "play_store"] as const) {
      expect(isActivePaid({ plan: "plus", provider, status: "active" })).toBe(true);
    }
  });
  it("is false for comp, none, null, or an expired paid record", () => {
    expect(isActivePaid(null)).toBe(false);
    expect(isActivePaid({ plan: "plus", provider: "comp" })).toBe(false);
    expect(isActivePaid({ plan: "free", provider: "none" })).toBe(false);
    expect(isActivePaid({ plan: "plus", provider: "stripe", status: "expired" })).toBe(false);
  });
});
