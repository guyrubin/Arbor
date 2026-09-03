import { PLAN_PRICES, formatEur, effectiveMonthlyEur, type PaidPlan } from "../../lib/pricing";
import type { NativePriceMap } from "../../lib/nativeBilling";

/**
 * MOB-02 — the paywall's pure view-model (node-testable, no React).
 *
 * Apple 3.1.2 / Play subscriptions policy: price, billing period and the
 * auto-renewal statement must be visible BEFORE purchase. The modal therefore
 * renders ONE selectable plan list + ONE primary CTA that names plan and price,
 * and on native it disables the CTA until the store has answered with a price
 * (StoreKit/Play is the price authority there — never the web EUR constant).
 */
export type Cadence = "monthly" | "annual";
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

export type PlanRow = {
  plan: PaidPlan;
  /** i18n key of the plan name (set.plan.plus / set.plan.family). */
  nameKey: string;
  /** Localized price for the selected cadence, or null while the store loads. */
  price: string | null;
  /** Annual only: the effective per-month figure (null on monthly / while loading). */
  perMonth: string | null;
};

export const PLAN_NAME_KEY: Record<PaidPlan, string> = { plus: "set.plan.plus", family: "set.plan.family" };
export const PLAN_ORDER: readonly PaidPlan[] = ["plus", "family"];

export function buildPlanRows(args: {
  isNative: boolean;
  nativePrices: NativePriceMap | null;
  cadence: Cadence;
  /** Store-currency formatter for native per-month math (PlanPrices.fmtStoreCurrency). */
  fmtCurrency: (amount: number, currencyCode: string) => string;
}): PlanRow[] {
  const { isNative, nativePrices, cadence, fmtCurrency } = args;
  return PLAN_ORDER.map((plan) => {
    if (isNative) {
      const p = nativePrices?.[plan]?.[cadence];
      if (!p) return { plan, nameKey: PLAN_NAME_KEY[plan], price: null, perMonth: null };
      return {
        plan,
        nameKey: PLAN_NAME_KEY[plan],
        price: p.priceString,
        perMonth: cadence === "annual" ? fmtCurrency(Math.round((p.amount / 12) * 100) / 100, p.currencyCode) : null,
      };
    }
    return {
      plan,
      nameKey: PLAN_NAME_KEY[plan],
      price: formatEur(cadence === "monthly" ? PLAN_PRICES[plan].monthlyEur : PLAN_PRICES[plan].annualEur),
      perMonth: cadence === "annual" ? formatEur(effectiveMonthlyEur(plan)) : null,
    };
  });
}

/** Which store's name goes into the loading + disclosure copy. */
export function storeLabelKey(platform: string): string {
  if (platform === "ios") return "elev.storeshell.store.ios";
  if (platform === "android") return "elev.storeshell.store.android";
  return "elev.storeshell.store.web";
}

export const periodKey = (cadence: Cadence): string =>
  cadence === "monthly" ? "elev.storeshell.pw.period.month" : "elev.storeshell.pw.period.year";

/** "€12.99/month" — price + period suffix in the parent's language. */
export const priceWithPeriod = (t: Tr, price: string, cadence: Cadence): string => `${price}/${t(periodKey(cadence))}`;

export type PaywallCta = { label: string; disabled: boolean; loading: boolean };

/**
 * The single primary CTA. Native while no price resolved → disabled + the
 * "prices are loading" line (never a purchase button without a price).
 */
export function paywallCta(args: { rows: PlanRow[]; selected: PaidPlan; cadence: Cadence; isNative: boolean; platform: string; t: Tr }): PaywallCta {
  const { rows, selected, cadence, isNative, platform, t } = args;
  const row = rows.find((r) => r.plan === selected) ?? rows[0];
  const loading = isNative && (!row || row.price === null);
  if (loading) {
    return { label: t("elev.storeshell.pw.pricesLoading", { store: t(storeLabelKey(platform)) }), disabled: true, loading: true };
  }
  return {
    label: t("elev.storeshell.pw.cta", { plan: t(row.nameKey), price: priceWithPeriod(t, row.price as string, cadence) }),
    disabled: false,
    loading: false,
  };
}

/** The auto-renewal disclosure paragraph (Apple 3.1.2 / Play). */
export function disclosureText(t: Tr, platform: string, cadence: Cadence): string {
  return t("elev.storeshell.pw.disclosure", { period: t(periodKey(cadence)), store: t(storeLabelKey(platform)) });
}
