import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import { PLAN_PRICES, formatEur, effectiveMonthlyEur, type PaidPlan } from "../../lib/pricing";

const PLAN_NAME_KEY: Record<PaidPlan, string> = { plus: "set.plan.plus", family: "set.plan.family" };

/**
 * CARE-5 (pricing honesty): the per-plan, per-cadence price block shown on BOTH
 * upgrade surfaces (PaywallModal + Settings plan panel) BEFORE any checkout
 * redirect. Annual renders as its effective per-month figure + "billed yearly",
 * with a plain "Cancel anytime" line. Figures come from the ONE client constant
 * (lib/pricing.ts) that pricing.test.ts pins to the server entitlement config.
 */
export function PlanPrices({ cadence }: { cadence: "monthly" | "annual" }) {
  const { t } = useLanguage();
  return (
    <div className="space-y-1" data-testid="plan-prices">
      {(Object.keys(PLAN_PRICES) as PaidPlan[]).map((plan) => (
        <p key={plan} className="text-xs font-semibold" style={{ color: "var(--arbor-ink)" }}>
          {cadence === "monthly"
            ? t("set.plan.price.perMonth", { plan: t(PLAN_NAME_KEY[plan]), price: formatEur(PLAN_PRICES[plan].monthlyEur) })
            : t("set.plan.price.perMonthAnnual", {
                plan: t(PLAN_NAME_KEY[plan]),
                price: formatEur(effectiveMonthlyEur(plan)),
                total: formatEur(PLAN_PRICES[plan].annualEur),
              })}
        </p>
      ))}
      <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t("set.plan.cancelAnytime")}</p>
    </div>
  );
}

export default PlanPrices;
