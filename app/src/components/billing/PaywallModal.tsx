import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useCheckout } from "../../hooks/useCheckout";

/**
 * MON-2: the conversion moment. Opened by ArborContext when a metered/Plus-gated
 * call returns 402 (PaywallError) — so a parent who hits the daily coach limit or
 * a Plus-only feature gets an inline upgrade path, not an error message.
 */
export default function PaywallModal() {
  const { paywall, closePaywall } = useArbor();
  const { t } = useLanguage();
  const { busy, startCheckout } = useCheckout();
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");

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

        <div className="flex items-center gap-1 rounded-xl p-1 w-fit" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
          {(["monthly", "annual"] as const).map((c) => (
            <button key={c} onClick={() => setCadence(c)} className="px-3 py-1 rounded-lg text-xs font-bold transition"
              style={cadence === c ? { background: "var(--arbor-primary)", color: "#fff" } : { color: "var(--arbor-muted)" }}>
              {t(c === "monthly" ? "set.plan.monthly" : "set.plan.annual")}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => void startCheckout("plus", cadence)} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50" style={{ background: "var(--arbor-primary)", color: "#fff" }}>
            {t("set.plan.upgradePlus")}
          </button>
          <button onClick={() => void startCheckout("family", cadence)} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-bold rounded-xl px-4 py-2.5 disabled:opacity-50" style={{ background: "var(--arbor-green-ink)", color: "#fff" }}>
            {t("set.plan.upgradeFamily")}
          </button>
        </div>

        <button onClick={closePaywall} className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>
          {t("pw.maybeLater")}
        </button>
      </div>
    </Modal>
  );
}
