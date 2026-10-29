/**
 * B-RESID-05 — the referred side of the share → activation chain
 * (lib/referralActivation, moved out of ArborContext unchanged except that a
 * first-time activation past the referrer's cap ("maxed": this family still
 * got its month) now counts as an activation too).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const h = vi.hoisted(() => ({ code: "ABC2345" as string | undefined, via: "link" as "link" | "typed", activated: [] as string[] }));
// B-GROWTH-43: + how the held code was entered (a code typed in Settings before the first plan).
vi.mock("./attribution", () => ({ consumeReferralCode: () => h.code, consumeReferralVia: () => h.via }));
vi.mock("./loopEvents", () => ({ trackInviteActivated: (role: string) => { h.activated.push(role); } }));

import { activateCapturedReferral, LS_REFERRAL_ACTIVATED } from "./referralActivation";

const store = new Map<string, string>();
beforeEach(() => {
  h.code = "ABC2345"; h.via = "link"; h.activated = []; store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});
afterEach(() => vi.unstubAllGlobals());

describe("B-RESID-05 · a referred family's first activation", () => {
  it.each([
    ["granted", { ok: true, status: "granted", earnedMonths: 1, periodEnd: "2026-11-28T00:00:00.000Z" }],
    ["maxed", { ok: true, status: "maxed", earnedMonths: 5 }],
  ] as const)("%s: one invite_activated, the entitlement refreshes, and the device redeems once", async (_s, result) => {
    const activate = vi.fn(async () => result);
    const onActivated = vi.fn();
    await expect(activateCapturedReferral({ activate, onActivated })).resolves.toBe("activated");
    expect(activate).toHaveBeenCalledExactlyOnceWith("ABC2345");
    expect(h.activated).toEqual(["referred"]);
    expect(onActivated).toHaveBeenCalledOnce();
    expect(store.has(LS_REFERRAL_ACTIVATED)).toBe(true);
    await expect(activateCapturedReferral({ activate, onActivated })).resolves.toBe("already_here");
    expect(activate).toHaveBeenCalledOnce();
    expect(h.activated).toEqual(["referred"]);
  });

  it.each([
    [{ ok: true, status: "already_activated" }],
    [{ ok: false, status: "self_referral" }],
    [{ ok: false, status: "unknown_code" }],
  ] as const)("%o: no event, no refresh", async (result) => {
    const onActivated = vi.fn();
    await expect(activateCapturedReferral({ activate: async () => result, onActivated })).resolves.toBe("not_activated");
    expect(h.activated).toEqual([]);
    expect(onActivated).not.toHaveBeenCalled();
  });

  it("a transient failure rolls the device guard back so the next plan retries; no code does nothing", async () => {
    await expect(activateCapturedReferral({ activate: async () => { throw new Error("offline"); } })).resolves.toBe("failed");
    expect(store.has(LS_REFERRAL_ACTIVATED)).toBe(false);
    await expect(activateCapturedReferral({ activate: async () => ({ ok: true, status: "granted", earnedMonths: 1, periodEnd: "x" }) })).resolves.toBe("activated");
    h.code = undefined; store.clear();
    const activate = vi.fn();
    await expect(activateCapturedReferral({ activate })).resolves.toBe("no_code");
    expect(activate).not.toHaveBeenCalled();
  });

  it("B-GROWTH-43: a code typed before the first plan redeems here, marked typed", async () => {
    h.via = "typed";
    const activate = vi.fn(async () => ({ ok: true, status: "granted", earnedMonths: 1, periodEnd: "x" }) as const);
    await expect(activateCapturedReferral({ activate })).resolves.toBe("activated");
    expect(activate).toHaveBeenCalledExactlyOnceWith("ABC2345", "typed");
  });

  it("ArborContext fires it with the first plan, through the real API call, refreshing the entitlement", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const ctx = readFileSync(path.join(here, "..", "context", "ArborContext.tsx"), "utf8");
    expect(ctx).toContain("await activateCapturedReferral({ activate: api.referralActivate, onActivated: () => { void refreshEntitlement(); } });");
    expect(ctx).toMatch(/trackFirstPlan\(planProps\);[^\n]*\n\s*void maybeActivateReferral\(\);/);
    expect(ctx).not.toContain("trackInviteActivated");
  });
});
