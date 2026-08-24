/**
 * CARE-5 — pricing honesty on both upgrade surfaces.
 *
 * Covers:
 *  - parity contract: the ONE client display constant (lib/pricing.ts) exactly
 *    matches the server entitlement config (server/entitlements.ts
 *    PLAN_PRICING), so the price a parent sees can never drift from the billed one
 *  - locked figures: Plus €12.99/mo, Family €19.99/mo; annual = 10× monthly
 *  - source contract: PaywallModal AND the Settings plan panel render the
 *    PlanPrices block BEFORE any checkout redirect, and the checkout-unavailable
 *    toast is "info", never "success"
 *  - i18n contract: the price/cancel-anytime copy exists in EN + HE
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_PRICES, formatEur, effectiveMonthlyEur } from "./pricing";
import { PLAN_PRICING } from "../server/entitlements.js";
import { en, he } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readSrc = (rel: string): string =>
  readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("client price constant ↔ entitlement config parity (CARE-5)", () => {
  it("the client display constant exactly matches the server entitlement config", () => {
    expect(PLAN_PRICES).toEqual(PLAN_PRICING);
  });

  it("pins the locked launch pricing: Plus €12.99 / Family €19.99 monthly", () => {
    expect(PLAN_PRICES.plus.monthlyEur).toBe(12.99);
    expect(PLAN_PRICES.family.monthlyEur).toBe(19.99);
  });

  it("annual = 10× monthly (two months free) for both plans", () => {
    expect(PLAN_PRICES.plus.annualEur).toBeCloseTo(PLAN_PRICES.plus.monthlyEur * 10, 2);
    expect(PLAN_PRICES.family.annualEur).toBeCloseTo(PLAN_PRICES.family.monthlyEur * 10, 2);
  });

  it("formats EUR deterministically and derives the effective monthly figure", () => {
    expect(formatEur(12.99)).toBe("€12.99");
    expect(formatEur(129.9)).toBe("€129.90");
    // Effective monthly (annual/12, rounded) is always below the monthly price.
    expect(effectiveMonthlyEur("plus")).toBe(10.83);
    expect(effectiveMonthlyEur("family")).toBe(16.66);
    expect(effectiveMonthlyEur("plus")).toBeLessThan(PLAN_PRICES.plus.monthlyEur);
    expect(effectiveMonthlyEur("family")).toBeLessThan(PLAN_PRICES.family.monthlyEur);
  });
});

describe("both upgrade surfaces show the price before checkout (CARE-5)", () => {
  const paywall = readSrc("components/billing/PaywallModal.tsx");
  const settings = readSrc("components/layout/SettingsModal.tsx");
  const planPrices = readSrc("components/billing/PlanPrices.tsx");
  const checkout = readSrc("hooks/useCheckout.ts");

  it("PaywallModal renders the shared PlanPrices block", () => {
    expect(paywall).toMatch(/<PlanPrices cadence=\{cadence\}/);
  });

  it("Settings plan panel renders the shared PlanPrices block", () => {
    expect(settings).toMatch(/<PlanPrices cadence=\{cadence\}/);
  });

  it("PlanPrices reads figures from the ONE client constant and covers both cadences + cancel-anytime", () => {
    expect(planPrices).toContain('from "../../lib/pricing"');
    expect(planPrices).toContain("set.plan.price.perMonth");
    expect(planPrices).toContain("set.plan.price.perMonthAnnual");
    expect(planPrices).toContain("set.plan.cancelAnytime");
    // Tokens only — no hex literals in the price block.
    expect(planPrices.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toEqual([]);
  });

  it("the checkout-unavailable toast is info, never success (single gate since STORE-2)", () => {
    // STORE-2 consolidated the Settings plan panel's duplicate inline checkout
    // into the ONE platform-gated hook, so the CARE-5 toast now has exactly one
    // home. Both surfaces must reach it through the hook — no inline re-impl.
    expect(checkout).toMatch(/t\("set\.plan\.checkoutSoon"\), "info"\)/);
    expect(checkout).not.toMatch(/checkoutSoon"\), "success"/);
    expect(settings).toMatch(/useCheckout\(\)/);
    expect(settings).not.toMatch(/checkoutSoon"\), "success"/);
    expect(paywall).toMatch(/useCheckout\(\)/);
  });
});

describe("pricing copy parity (CARE-5)", () => {
  const KEYS = [
    "set.plan.price.perMonth",
    "set.plan.price.perMonthAnnual",
    "set.plan.cancelAnytime",
  ] as const;

  it("all pricing keys exist in EN and HE (no silent fallback)", () => {
    for (const k of KEYS) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k], `he not translated for ${k}`).not.toBe(en[k]);
    }
  });

  it("the annual template carries plan, effective-monthly price AND the billed-yearly total", () => {
    for (const dict of [en, he]) {
      expect(dict["set.plan.price.perMonthAnnual"]).toContain("{plan}");
      expect(dict["set.plan.price.perMonthAnnual"]).toContain("{price}");
      expect(dict["set.plan.price.perMonthAnnual"]).toContain("{total}");
      expect(dict["set.plan.price.perMonth"]).toContain("{plan}");
      expect(dict["set.plan.price.perMonth"]).toContain("{price}");
    }
    expect(en["set.plan.price.perMonthAnnual"]).toMatch(/billed yearly/i);
  });
});
