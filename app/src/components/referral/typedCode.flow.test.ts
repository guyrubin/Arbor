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

vi.mock("../../lib/loopEvents", () => ({ trackInviteActivated: vi.fn() }));

import { offerCodeRoute } from "./OfferCodeField";
import { holdTypedReferralCode, loadAttribution } from "../../lib/attribution";
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

  it("a code that is not one is refused before anything is held", () => {
    expect(offerCodeRoute("not-a-code", false).route).toBe("refuse");
    expect(loadAttribution()).toBeNull();
  });
});
