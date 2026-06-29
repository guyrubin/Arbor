import { describe, expect, it } from "vitest";
import {
  cosmeticUnlockEligible,
  DEVELOPMENT_ACTION_TRIGGERS,
  FORBIDDEN_TRIGGERS,
} from "./achievements";

/* CI-12 / PHI-04 — cosmetics earned by development only.
 *
 * The invariant: NO cosmetic / badge unlock may fire on a streak-as-login,
 * login-count, time-in-app, purchase, or entitlement-change event. An unlock
 * fires ONLY from a logged development action. This is the meaning-over-
 * engagement rule made enforceable: if a future growth experiment wires a
 * streak or purchase reward into the unlock path, one of these assertions goes
 * red and CI blocks it. A documented principle would not. */
describe("cosmetics earned by development only — no streak/login/time/purchase trigger fires an unlock", () => {
  it("rejects every forbidden engagement / purchase trigger", () => {
    for (const trigger of FORBIDDEN_TRIGGERS) {
      expect(cosmeticUnlockEligible(trigger), trigger).toBe(false);
    }
  });

  it("rejects unknown, aliased, and mis-cased strings (no bypass via spelling)", () => {
    const sneaky = [
      "streak",
      "login",
      "PURCHASE",
      "subscription_purchased",
      "iap_completed",
      "trial_start",
      "entitlement_granted",
      "days_in_app",
      "time_spent",
      "",
      "session_start",
      "Streak-Count",
      "Mission-Completed", // wrong case of a real trigger must NOT pass
      "purchase ", // trailing space must NOT pass
    ];
    for (const s of sneaky) {
      expect(cosmeticUnlockEligible(s), s).toBe(false);
    }
  });

  it("allows every named logged-development-action trigger", () => {
    for (const trigger of DEVELOPMENT_ACTION_TRIGGERS) {
      expect(cosmeticUnlockEligible(trigger), trigger).toBe(true);
    }
  });

  it("keeps the forbidden and development lists from being silently trimmed", () => {
    // A completeness guard: shrinking either list below its floor (e.g. removing
    // 'purchase' so a purchase reward slips through) fails CI here.
    expect(FORBIDDEN_TRIGGERS.length).toBeGreaterThanOrEqual(5);
    expect(DEVELOPMENT_ACTION_TRIGGERS.length).toBeGreaterThanOrEqual(5);
    // The forbidden set must explicitly contain the four dark-pattern vectors
    // the advisor named: streak, login, time-in-app, purchase.
    expect(FORBIDDEN_TRIGGERS).toContain("streak-count");
    expect(FORBIDDEN_TRIGGERS).toContain("login-count");
    expect(FORBIDDEN_TRIGGERS).toContain("time-in-app");
    expect(FORBIDDEN_TRIGGERS).toContain("purchase");
  });

  it("has no overlap between development-action and forbidden triggers", () => {
    const dev = new Set<string>(DEVELOPMENT_ACTION_TRIGGERS);
    for (const f of FORBIDDEN_TRIGGERS) {
      expect(dev.has(f), `forbidden trigger ${f} must never be a development action`).toBe(false);
    }
  });
});
