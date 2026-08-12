/**
 * Masterplan 3.6 — free-vs-Plus clarity.
 *
 *  1) featurePlan(): the client feature→plan map resolves exactly the keys the
 *     server names in 402 payloads, and unknown keys yield NO badge (null).
 *  2) Server pin: FEATURE_PLANS mirrors src/server/entitlements.ts PLAN_LIMITS —
 *     every mapped "plus" feature is genuinely free-blocked/plus-granted, the
 *     ONLY family-over-plus gate is coParentSeats, and every real free→plus
 *     limit difference is represented (no invented gating, no missing gating).
 *  3) planclarity i18n parity: EN/HE key sets match, HE is transcreated (real
 *     Hebrew), and the "six children" bullet is pinned to the server limit.
 *  4) Source contracts (repo runs vitest in node, no jsdom — same style as
 *     TrustPanel.test.ts): PlanBadge carries an aria-label and no raw hex;
 *     PaywallModal renders the free/plus/family split and mounts the badge.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FEATURE_PLANS, featurePlan, badgeLabel, badgeAria } from "./PlanBadge";
import { PLAN_LIMITS } from "../../server/entitlements.js";
import * as planclarity from "../../lib/i18nElevation/planclarity";

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), "src", ...parts), "utf8");

describe("featurePlan — feature→plan resolution", () => {
  it("resolves the three server-emitted 402 feature keys to plus", () => {
    expect(featurePlan("coach_unlimited")).toBe("plus");
    expect(featurePlan("professionalReports")).toBe("plus");
    expect(featurePlan("advancedPlans")).toBe("plus");
  });

  it("resolves the client-enforced limit gates", () => {
    expect(featurePlan("maxChildren")).toBe("plus");
    expect(featurePlan("coParentSeats")).toBe("family");
  });

  it("unknown feature keys resolve to null → no badge, never a wrong badge", () => {
    expect(featurePlan("avatarGenerate")).toBeNull();
    expect(featurePlan("")).toBeNull();
    expect(featurePlan("adventureGenerate")).toBeNull();
  });
});

describe("FEATURE_PLANS pins to server PLAN_LIMITS (no invented gating)", () => {
  it("plus-mapped boolean features are free-blocked and plus-granted", () => {
    expect(PLAN_LIMITS.free.professionalReports).toBe(false);
    expect(PLAN_LIMITS.plus.professionalReports).toBe(true);
    expect(PLAN_LIMITS.free.advancedPlans).toBe(false);
    expect(PLAN_LIMITS.plus.advancedPlans).toBe(true);
  });

  it("coach_unlimited: free is metered, plus is unmetered", () => {
    expect(typeof PLAN_LIMITS.free.coachMessagesPerDay).toBe("number");
    expect(PLAN_LIMITS.plus.coachMessagesPerDay).toBeNull();
  });

  it("maxChildren: plus raises the free single-child limit", () => {
    expect(PLAN_LIMITS.free.maxChildren).toBe(1);
    expect(PLAN_LIMITS.plus.maxChildren).toBeGreaterThan(PLAN_LIMITS.free.maxChildren);
  });

  it("coParentSeats is the ONLY family-over-plus gate (family = plus + co-parent seat)", () => {
    expect(PLAN_LIMITS.family.coParentSeats).toBeGreaterThan(PLAN_LIMITS.plus.coParentSeats);
    const familyOnlyDiffs = (Object.keys(PLAN_LIMITS.plus) as Array<keyof typeof PLAN_LIMITS.plus>)
      .filter((k) => PLAN_LIMITS.plus[k] !== PLAN_LIMITS.family[k]);
    expect(familyOnlyDiffs).toEqual(["coParentSeats"]);
  });

  it("every free→plus limit difference is represented in the map (completeness)", () => {
    const freePlusDiffs = (Object.keys(PLAN_LIMITS.free) as Array<keyof typeof PLAN_LIMITS.free>)
      .filter((k) => PLAN_LIMITS.free[k] !== PLAN_LIMITS.plus[k])
      .map(String);
    for (const limitKey of freePlusDiffs) {
      // coachMessagesPerDay is surfaced under the server's own 402 key name.
      const mapKey = limitKey === "coachMessagesPerDay" ? "coach_unlimited" : limitKey;
      expect(featurePlan(mapKey), `PLAN_LIMITS free≠plus on "${limitKey}" but FEATURE_PLANS has no entry`).toBe("plus");
    }
  });

  it("map keys the server 402s actually emit exist verbatim in server source", () => {
    const serverSrc = src("server", "entitlements.ts") + src("server", "aiQuota.ts") + src("server", "createApp.ts");
    for (const key of ["coach_unlimited", "professionalReports", "advancedPlans"]) {
      expect(serverSrc).toContain(key);
    }
  });
});

describe("planclarity i18n parity + copy pins", () => {
  it("EN and HE expose identical key sets, all elev.plan.* namespaced, all non-empty", () => {
    const enKeys = Object.keys(planclarity.en).sort();
    const heKeys = Object.keys(planclarity.he).sort();
    expect(enKeys).toEqual(heKeys);
    expect(enKeys.length).toBeGreaterThan(0);
    for (const k of enKeys) {
      expect(k.startsWith("elev.plan."), `non-namespaced key "${k}"`).toBe(true);
      expect(planclarity.en[k].trim().length).toBeGreaterThan(0);
      expect(planclarity.he[k].trim().length).toBeGreaterThan(0);
    }
  });

  it("HE values are transcreated Hebrew (never copied EN), except brand-neutral badge labels", () => {
    const hebrew = /[א-ת]/;
    for (const [k, v] of Object.entries(planclarity.he)) {
      expect(hebrew.test(v), `HE value for "${k}" has no Hebrew: "${v}"`).toBe(true);
    }
  });

  it("no interpolation placeholders — so none can be broken by edits", () => {
    for (const dict of [planclarity.en, planclarity.he]) {
      for (const v of Object.values(dict)) expect(v).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });

  it('the "up to six children" bullet matches the server limit', () => {
    expect(PLAN_LIMITS.plus.maxChildren).toBe(6);
    expect(planclarity.en["elev.plan.plus.4"]).toMatch(/six children/i);
    expect(planclarity.he["elev.plan.plus.4"]).toContain("שישה ילדים");
  });

  it("badge label/aria helpers resolve in both languages", () => {
    expect(badgeLabel("plus", "en")).toBe("Plus");
    expect(badgeLabel("family", "en")).toBe("Family");
    expect(badgeLabel("plus", "he")).toBe("פלוס");
    expect(badgeLabel("family", "he")).toBe("משפחה");
    for (const plan of ["plus", "family"] as const) {
      for (const lang of ["en", "he"] as const) {
        expect(badgeAria(plan, lang).length).toBeGreaterThan(badgeLabel(plan, lang).length);
      }
    }
  });
});

describe("source contracts (node env — same style as TrustPanel.test.ts)", () => {
  const badge = src("components", "ui", "PlanBadge.tsx");
  const modal = src("components", "billing", "PaywallModal.tsx");

  it("PlanBadge renders an aria-label and returns null for unresolvable plans", () => {
    expect(badge).toContain("aria-label={aria}");
    expect(badge).toContain("if (!resolved) return null;");
  });

  it("PlanBadge uses kit PASTEL tones — no raw hex literal (holds the hex floor)", () => {
    const hex = badge.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex).toEqual([]);
    expect(badge).toContain("PASTEL");
  });

  it("PaywallModal states the free/plus/family split plainly (3.6)", () => {
    for (const key of ["freeTitle", "plusTitle", "familyTitle", "free.1", "plus.1", "family.1"]) {
      expect(modal, `PaywallModal missing planclarity slot "${key}"`).toContain(key);
    }
    // Split renders BEFORE the cadence toggle / price block (clarity precedes the pitch).
    expect(modal.indexOf("freeTitle")).toBeLessThan(modal.indexOf("set.plan.monthly"));
  });

  it("PaywallModal mounts PlanBadge for both paid plans", () => {
    expect(modal).toContain('<PlanBadge plan="plus" />');
    expect(modal).toContain('<PlanBadge plan="family" />');
  });

  it("PaywallModal keeps price literals out of copy (prices stay in PlanPrices/pricing.ts)", () => {
    expect(modal).not.toMatch(/€\s?\d/);
    expect(modal).toContain("<PlanPrices");
  });
});
