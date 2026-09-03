import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCheckout } from "../../hooks/useCheckout";
import { useNativePrices } from "../../hooks/useNativePrices";
import { isNativePlatform, nativePlatform } from "../../lib/runtime";
import type { PaidPlan } from "../../lib/pricing";
import { fmtStoreCurrency } from "./PlanPrices";
import { LegalLinks } from "./LegalLinks";
import { buildPlanRows, paywallCta, disclosureText, periodKey, type Cadence } from "./paywallModel";
import { PlanBadge } from "../ui/PlanBadge";
// Direct module import (3.6): planclarity IS registered in i18nElevation/index.ts;
// the direct read is kept so this modal renders the split even if t() overrides drift.
import * as planclarity from "../../lib/i18nElevation/planclarity";

/**
 * MON-2: the conversion moment. Opened by ArborContext when a metered/Plus-gated
 * call returns 402 (PaywallError) — so a parent who hits the daily coach limit or
 * a Plus-only feature gets an inline upgrade path, not an error message.
 *
 * MOB-02 (Apple 3.1.2 / Play subscriptions): the body is ONE selectable plan
 * list (price + period per row), ONE primary CTA that names plan + price, the
 * auto-renewal disclosure and the legal links (MOB-01). On native the store is
 * the price authority: while the offering loads the rows show skeletons and
 * the CTA is DISABLED — never a purchase button without a price. The
 * view-model is pure (paywallModel.ts) and pinned by PaywallModal.test.ts.
 */
export default function PaywallModal() {
  const { paywall, closePaywall } = useArbor();
  const { t, uiLang } = useLanguage();
  // 3.6 free-vs-Plus clarity strings (see import note above).
  const pc = (k: string) => (uiLang === "he" ? planclarity.he : planclarity.en)[`elev.plan.${k}`] ?? "";
  const { busy, startCheckout, restorePurchases, isNative } = useCheckout();
  const nativePrices = useNativePrices();
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const [selected, setSelected] = useState<PaidPlan>(paywall.suggestedPlan ?? "plus");

  // The 402 names the plan that unlocks the feature; re-select it each open.
  useEffect(() => {
    if (paywall.open) setSelected(paywall.suggestedPlan ?? "plus");
  }, [paywall.open, paywall.suggestedPlan]);

  const rows = buildPlanRows({ isNative: isNativePlatform, nativePrices, cadence, fmtCurrency: fmtStoreCurrency });
  const cta = paywallCta({ rows, selected, cadence, isNative: isNativePlatform, platform: nativePlatform, t });
  const disclosure = disclosureText(t, nativePlatform, cadence);

  // Feature-specific body copy keeps the pitch relevant to what they just hit.
  const body =
    paywall.feature === "professionalReports" ? t("pw.bodyReports")
      : paywall.feature === "advancedPlans" ? t("pw.bodyPlans")
        : paywall.feature === "coach_unlimited" ? t("pw.bodyCoach")
          : t("pw.body");

  return (
    <Modal open={paywall.open} onClose={closePaywall} title={t("pw.title")}>
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
            <Sparkles className="w-4.5 h-4.5" />
          </span>
          <p className="leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{body}</p>
        </div>

        {/* 3.6 — the mom-test answer to "what's free vs paid?": the split, stated
            plainly BEFORE the price. Free column first — the parent keeps it all
            either way; the upgrade only ADDS. */}
        <div dir="auto" className="rounded-xl p-3 grid gap-3 sm:grid-cols-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          <div>
            <p className="font-bold mb-1" style={{ color: "var(--arbor-ink)" }}>{pc("freeTitle")}</p>
            <ul className="space-y-0.5 list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              {(["free.1", "free.2", "free.3"] as const).map((k) => <li key={k}>{pc(k)}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-bold mb-1 flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              <PlanBadge plan="plus" />{pc("plusTitle")}
            </p>
            <ul className="space-y-0.5 list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              {(["plus.1", "plus.2", "plus.3", "plus.4"] as const).map((k) => <li key={k}>{pc(k)}</li>)}
            </ul>
            <p className="font-bold mt-2 mb-1 flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
              <PlanBadge plan="family" />{pc("familyTitle")}
            </p>
            <ul className="space-y-0.5 list-disc ps-4" style={{ color: "var(--arbor-muted)" }}>
              <li>{pc("family.1")}</li>
            </ul>
          </div>
        </div>

        {/* Cadence toggle (monthly / annual) */}
        <div className="flex items-center gap-1 rounded-xl p-1 w-fit" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          {(["monthly", "annual"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCadence(c)} aria-pressed={cadence === c} className="px-3 min-h-[44px] rounded-lg text-xs font-bold transition"
              style={cadence === c ? { background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" } : { color: "var(--arbor-muted)" }}>
              {t(c === "monthly" ? "set.plan.monthly" : "set.plan.annual")}
            </button>
          ))}
        </div>

        {/* MOB-02: ONE selectable plan list — price + period per row, BEFORE any
            purchase. Native: store-localized price or a skeleton while loading. */}
        <div role="radiogroup" aria-label={t("elev.storeshell.pw.choose")} className="space-y-2" data-testid="plan-prices">
          {rows.map((row) => {
            const on = row.plan === selected;
            return (
              <button
                key={row.plan}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(row.plan)}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 min-h-[44px] text-start transition"
                style={on
                  ? { background: "var(--arbor-clay-dim)", border: "1px solid var(--arbor-clay-border)", color: "var(--arbor-ink)" }
                  : { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
              >
                <span className="inline-flex items-center gap-2 font-bold">
                  <span
                    aria-hidden="true"
                    className="inline-block w-4 h-4 rounded-full flex-shrink-0"
                    style={{ border: on ? "5px solid var(--arbor-clay)" : "2px solid var(--arbor-rule-strong)", background: "var(--arbor-paper-elevated)" }}
                  />
                  {t(row.nameKey)}
                  <PlanBadge plan={row.plan} />
                </span>
                <span className="text-end text-xs font-semibold" style={{ color: "var(--arbor-ink)" }}>
                  {row.price === null ? (
                    <Skeleton className="h-4 w-20" />
                  ) : (
                    <>
                      <span className="block">{row.price}/{t(periodKey(cadence))}</span>
                      {row.perMonth && (
                        <span className="block text-[11px] font-medium" style={{ color: "var(--arbor-muted)" }}>
                          {t("elev.storeshell.pw.perMonthApprox", { price: row.perMonth })}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* MOB-02: ONE primary CTA naming plan + price; disabled on native until
            the store answered with a price (loading line shown in its place). */}
        <button
          type="button"
          onClick={() => void startCheckout(selected, cadence)}
          disabled={busy || cta.disabled}
          aria-busy={cta.loading || busy}
          data-testid="paywall-cta"
          className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-bold rounded-xl px-4 py-3 min-h-[44px] disabled:opacity-50"
          style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
        >
          {cta.label}
        </button>

        {/* Apple 3.1.2 / Play: the auto-renewal + cancellation statement, visible
            before purchase, plus the Privacy · Terms · Support links (MOB-01). */}
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{disclosure}</p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button type="button" onClick={closePaywall} className="text-xs font-semibold min-h-[44px]" style={{ color: "var(--arbor-muted)" }}>
              {t("pw.maybeLater")}
            </button>
            {/* STORE-2: Apple-required Restore Purchases — native builds ONLY. */}
            {isNative && (
              <button type="button" onClick={() => void restorePurchases()} disabled={busy} className="text-xs font-semibold min-h-[44px] disabled:opacity-50" style={{ color: "var(--arbor-muted)" }}>
                {t("set.plan.restore")}
              </button>
            )}
          </div>
          <LegalLinks />
        </div>
      </div>
    </Modal>
  );
}
