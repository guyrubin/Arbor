/**
 * B-GROWTH-43 round 3 — a typed code follows the referral rule: it counts on
 * the family's activation (its first plan), never on the code alone.
 *
 *  · has a plan → redeemed now;
 *  · no plan → held in the SAME first-touch record a ?ref= link fills, nothing
 *    granted, then redeemed at the first plan through the link's own path;
 *  · a held code is never granted twice (the device guard, then the server's
 *    one-redemption-per-family claim).
 * Real modules end to end: lib/attribution, lib/referralActivation and the
 * server's LocalReferralStore; only localStorage and the event sink are stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/loopEvents", () => ({ trackInviteActivated: vi.fn(), hasTrackedFirstPlan: () => false }));

import { offerCodeRoute, refusalOutcome, submitTypedCode } from "./OfferCodeField";
import { clearTypedReferralRefusal, holdTypedReferralCode, loadAttribution, peekTypedReferralRefusal } from "../../lib/attribution";
import { activateCapturedReferral, LS_REFERRAL_ACTIVATED } from "../../lib/referralActivation";
import { LocalReferralStore } from "../../server/referral";
import type { EntitlementRecord, EntitlementStore } from "../../server/entitlements";

class Ent implements EntitlementStore {
  records = new Map<string, EntitlementRecord>();
  async getPlan(uid: string) { return this.records.get(uid)?.plan ?? null; }
  async getRecord(uid: string) { return this.records.get(uid) ?? null; }
  async setEntitlement(uid: string, r: EntitlementRecord) { this.records.set(uid, r); }
}

const ls = new Map<string, string>();
beforeEach(() => {
  ls.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v), removeItem: (k: string) => void ls.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const ent = new Ent();
  const server = new LocalReferralStore("salt", 5, ent);
  const code = await server.codeForUid("referrer");
  const activate = (c: string, via?: "link" | "typed") => server.activateReferral({ code: c, redeemerUid: "family", via });
  return { ent, server, code, activate };
}

describe("B-GROWTH-43 · a typed code counts on the first plan", () => {
  it("a family that already has a plan is granted now", async () => {
    const { server, code, activate, ent } = await setup();
    const { route, normalized } = offerCodeRoute(code.toLowerCase(), true);
    expect(route).toBe("redeem");
    expect(await activate(normalized, "typed")).toMatchObject({ ok: true, status: "granted" });
    expect(ent.records.get("family")?.productId).toBe("referral_month");
    expect(await server.familyRedemption("family")).toMatchObject({ via: "typed" });
  });

  it("a family with no plan has the code held — nothing granted, the referrer earns nothing — then granted at the first plan", async () => {
    const { server, code, activate, ent } = await setup();
    ls.set("arbor.attribution", JSON.stringify({ source: "practitioner", market: "il", utmCampaign: "everyday_plans", landingAt: "2026-10-28T09:00:00Z" }));
    const { route, normalized } = offerCodeRoute(code, false);
    expect(route).toBe("hold");
    expect(holdTypedReferralCode(normalized)).toBe(true);
    // Held in the link's record; the first touch is untouched.
    expect(loadAttribution()).toMatchObject({ referralCode: code, referralVia: "typed", source: "practitioner", market: "il", utmCampaign: "everyday_plans" });
    expect(ent.records.size).toBe(0);
    expect(await server.earnedMonths("referrer")).toBe(0);
    expect(await server.familyRedemption("family")).toBeNull();
    // The first plan: the link's own path redeems it, marked typed.
    await expect(activateCapturedReferral({ activate })).resolves.toBe("activated");
    expect(ent.records.get("family")?.productId).toBe("referral_month");
    expect(await server.earnedMonths("referrer")).toBe(1);
    expect(await server.familyRedemption("family")).toMatchObject({ via: "typed" });
  });

  it("a held code is never granted twice: the next plan does not post, and another device is refused by the server", async () => {
    const { server, code, activate, ent } = await setup();
    holdTypedReferralCode(code); // no record yet: one is made, then the code is held
    await expect(activateCapturedReferral({ activate })).resolves.toBe("activated");
    const end = ent.records.get("family")?.currentPeriodEnd;
    await expect(activateCapturedReferral({ activate })).resolves.toBe("already_here");
    ls.delete(LS_REFERRAL_ACTIVATED); // a second device
    await expect(activateCapturedReferral({ activate })).resolves.toBe("not_activated");
    expect(ent.records.get("family")?.currentPeriodEnd).toBe(end);
    expect(await server.earnedMonths("referrer")).toBe(1);
  });

  it("round 4: the parent's own code is refused while they type, and nothing is held", async () => {
    const { code, activate } = await setup();
    const own = await new LocalReferralStore("salt", 5, new Ent()).codeForUid("family");
    const activateSpy = vi.fn(activate);
    for (const hasPlan of [false, true]) {
      expect(await submitTypedCode({ code: own.toLowerCase(), hasPlan, ownCode: async () => own, activate: activateSpy })).toBe("self");
    }
    expect(activateSpy).not.toHaveBeenCalled();
    expect(loadAttribution()?.referralCode).toBeUndefined();
    // A failed own-code read does not block a real code.
    expect(await submitTypedCode({ code, hasPlan: false, ownCode: async () => { throw new Error("offline"); }, activate })).toBe("held");
  });

  it("round 4: a held typed code refused at the first plan is told once, and a corrected code can be typed", async () => {
    const { code, activate, ent, server } = await setup();
    // A one-character typo of a well-formed code: held, then refused at the first plan.
    expect(await submitTypedCode({ code: "ARBOR-22222222", hasPlan: false, ownCode: async () => null, activate })).toBe("held");
    await expect(activateCapturedReferral({ activate })).resolves.toBe("not_activated");
    expect(ls.has(LS_REFERRAL_ACTIVATED)).toBe(false); // the device can try again
    expect(loadAttribution()?.referralCode).toBeUndefined();
    expect(refusalOutcome(peekTypedReferralRefusal())).toBe("heldRefused");
    clearTypedReferralRefusal(); // the Plan card has shown it
    expect(peekTypedReferralRefusal()).toBeNull(); // once
    // The family now has its plan: the corrected code redeems at once, and the device is marked.
    expect(await submitTypedCode({ code, hasPlan: true, ownCode: async () => null, activate })).toBe("granted");
    expect(ls.has(LS_REFERRAL_ACTIVATED)).toBe(true);
    expect(ent.records.get("family")?.productId).toBe("referral_month");
    expect(await server.earnedMonths("referrer")).toBe(1);
    // The other refusals keep their own lines.
    expect(refusalOutcome("self")).toBe("self");
    expect(refusalOutcome("already")).toBe("already");
  });

  it("round 4: a link code waiting for the first plan survives a typed hold, and is the one that redeems", async () => {
    const { code, activate, server } = await setup();
    const other = await server.codeForUid("someone-else");
    ls.set("arbor.attribution", JSON.stringify({ referralCode: code, source: "referral", market: "il", landingAt: "2026-10-28T09:00:00Z" }));
    expect(await submitTypedCode({ code: other, hasPlan: false, ownCode: async () => null, activate })).toBe("linkSaved");
    expect(holdTypedReferralCode(other)).toBe(false);
    expect(loadAttribution()).toMatchObject({ referralCode: code, source: "referral" });
    expect(loadAttribution()?.referralVia).toBeUndefined();
    await expect(activateCapturedReferral({ activate })).resolves.toBe("activated");
    expect(await server.earnedMonths("referrer")).toBe(1);
    expect(await server.earnedMonths("someone-else")).toBe(0);
  });

  it("round 4: an immediate grant marks this device redeemed, so a link code captured earlier never posts", async () => {
    const { code, activate } = await setup();
    ls.set("arbor.attribution", JSON.stringify({ referralCode: "ARBOR-33333333", source: "referral", market: "il", landingAt: "x" }));
    expect(await submitTypedCode({ code, hasPlan: true, ownCode: async () => null, activate })).toBe("granted");
    expect(ls.has(LS_REFERRAL_ACTIVATED)).toBe(true);
    const later = vi.fn(activate);
    await expect(activateCapturedReferral({ activate: later })).resolves.toBe("already_here");
    expect(later).not.toHaveBeenCalled();
  });

  it("a code that is not one is refused before anything is held", () => {
    expect(offerCodeRoute("not-a-code", false).route).toBe("refuse");
    expect(loadAttribution()).toBeNull();
  });
});
