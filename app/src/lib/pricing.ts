/**
 * CARE-5 (pricing honesty): the ONE client-side pricing constant. Both upgrade
 * surfaces (PaywallModal + the Settings plan panel) read their figures from
 * here, and pricing.test.ts pins this record to the server entitlement config
 * (server/entitlements.ts PLAN_PRICING) so the displayed price can never drift
 * from the billed one.
 *
 * Locked launch pricing: Plus €12.99/mo, Family €19.99/mo; annual = 10× monthly
 * (two months free). Display-only — the hosted RevenueCat/Stripe checkout stays
 * the binding price at the moment of purchase.
 */
export type PaidPlan = "plus" | "family";
export type PlanPrice = { monthlyEur: number; annualEur: number };

export const PLAN_PRICES: Record<PaidPlan, PlanPrice> = {
  plus: { monthlyEur: 12.99, annualEur: 129.9 },
  family: { monthlyEur: 19.99, annualEur: 199.9 },
};

/** Deterministic "€12.99" — no locale machinery, embeds cleanly in EN and HE copy. */
export const formatEur = (amount: number): string => `€${amount.toFixed(2)}`;

/** Annual cadence is shown as its effective per-month figure + "billed yearly". */
export const effectiveMonthlyEur = (plan: PaidPlan): number =>
  Math.round((PLAN_PRICES[plan].annualEur / 12) * 100) / 100;

/**
 * BD-53 / P2 (Guy, 20 Oct 2026): the Israeli price — Plus ₪69.90/month or
 * ₪549/year, tax-inclusive, annual the default. Family is not sold (P3), so it
 * has no shekel price. RevenueCat holds the binding figure; the server offers
 * ILS only once BILLING_CURRENCIES names it (after the dashboard has the price).
 */
export type BillingCurrency = "EUR" | "ILS";
export const ILS_PRICES: Partial<Record<PaidPlan, { monthly: number; annual: number }>> = {
  plus: { monthly: 69.9, annual: 549 },
};

/** The ONE currency rule, shared by the price on screen and the checkout link
 *  (server/billing.ts names it to RevenueCat, which would otherwise pick by the
 *  buyer's location): Hebrew → ₪ once the server offers ILS, else €. */
export const checkoutCurrency = (lang: string | null | undefined, offered: readonly string[] | null | undefined): BillingCurrency =>
  lang === "he" && (offered ?? []).includes("ILS") ? "ILS" : "EUR";

/** Display price of a plan in a currency; null when that currency has none. */
export const planPrice = (plan: PaidPlan, cadence: "monthly" | "annual", currency: BillingCurrency = "EUR"): number | null => {
  if (currency === "ILS") return ILS_PRICES[plan]?.[cadence] ?? null;
  return cadence === "monthly" ? PLAN_PRICES[plan].monthlyEur : PLAN_PRICES[plan].annualEur;
};

/** The annual price as its effective per-month figure, in the same currency. */
export const effectiveMonthly = (plan: PaidPlan, currency: BillingCurrency = "EUR"): number | null => {
  const annual = planPrice(plan, "annual", currency);
  return annual === null ? null : Math.round((annual / 12) * 100) / 100;
};

/** Deterministic "₪69.90" / "€12.99", embeds cleanly in EN and HE copy. */
export const formatPrice = (amount: number, currency: BillingCurrency = "EUR"): string =>
  currency === "ILS" ? `₪${amount.toFixed(2)}` : formatEur(amount);
