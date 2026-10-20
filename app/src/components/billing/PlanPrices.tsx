import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { planPrice, effectiveMonthly, formatPrice, checkoutCurrency, type PaidPlan } from "../../lib/pricing";
import { useEntitlement } from "../../hooks/useEntitlement";
import { isNativePlatform } from "../../lib/runtime";
import { useNativePrices } from "../../hooks/useNativePrices";

const PLAN_NAME_KEY: Record<PaidPlan, string> = { plus: "set.plan.plus", family: "set.plan.family" };

/** Store-localized currency formatting for native price math (annual → its
 *  effective per-month figure). Falls back to the raw number on a bad code. */
export const fmtStoreCurrency = (amount: number, currencyCode: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
};

/**
 * CARE-5 (pricing honesty): the per-plan, per-cadence price block shown on BOTH
 * upgrade surfaces (PaywallModal + Settings plan panel) BEFORE any checkout
 * redirect. Annual renders as its effective per-month figure + "billed yearly",
 * with a plain "Cancel anytime" line.
 *
 * Web: figures come from the ONE client constant (lib/pricing.ts) that
 * pricing.test.ts pins to the server entitlement config, in the currency the
 * checkout link will charge (lib/pricing checkoutCurrency).
 *
 * Native (STORE-2 §2.4): figures come EXCLUSIVELY from the store product via
 * the RevenueCat offering (StoreKit/Play is the billing authority there); while
 * offerings load — or when billing isn't configured — no price renders, never
 * a stale EUR constant.
 */
export function PlanPrices({ cadence, plans = ["plus"] }: { cadence: "monthly" | "annual"; plans?: PaidPlan[] }) {
  const { t, uiLang } = useLanguage();
  const nativePrices = useNativePrices();
  // BD-53/P2: the same rule names the currency to the checkout link.
  const { entitlement } = useEntitlement();
  const currency = checkoutCurrency(uiLang, entitlement.currencies);

  if (isNativePlatform) {
    return (
      <div className="space-y-1" data-testid="plan-prices">
        {nativePrices && plans.map((plan) => {
          const price = nativePrices[plan]?.[cadence];
          if (!price) return null;
          return (
            <p key={plan} className="text-xs font-semibold" style={{ color: "var(--arbor-ink)" }}>
              {cadence === "monthly"
                ? t("set.plan.price.perMonth", { plan: t(PLAN_NAME_KEY[plan]), price: price.priceString })
                : t("set.plan.price.perMonthAnnual", {
                    plan: t(PLAN_NAME_KEY[plan]),
                    price: fmtStoreCurrency(Math.round((price.amount / 12) * 100) / 100, price.currencyCode),
                    total: price.priceString,
                  })}
            </p>
          );
        })}
        <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("set.plan.cancelAnytime")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="plan-prices">
      {plans.map((plan) => {
        const monthly = planPrice(plan, "monthly", currency);
        const annual = planPrice(plan, "annual", currency);
        const perMonth = effectiveMonthly(plan, currency);
        if (monthly === null || annual === null || perMonth === null) return null;
        return (
          <p key={plan} className="text-xs font-semibold" style={{ color: "var(--arbor-ink)" }}>
            {cadence === "monthly"
              ? t("set.plan.price.perMonth", { plan: t(PLAN_NAME_KEY[plan]), price: formatPrice(monthly, currency) })
              : t("set.plan.price.perMonthAnnual", {
                  plan: t(PLAN_NAME_KEY[plan]),
                  price: formatPrice(perMonth, currency),
                  total: formatPrice(annual, currency),
                })}
          </p>
        );
      })}
      <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("set.plan.cancelAnytime")}</p>
    </div>
  );
}

export default PlanPrices;
