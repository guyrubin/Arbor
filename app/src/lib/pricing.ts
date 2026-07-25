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
