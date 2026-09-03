import React, { useSyncExternalStore } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { selectionHaptic } from "../../lib/native";
import { isKidModeActive, subscribeKidMode } from "../../lib/kidModeGate";

/**
 * IA-01 — the Safety life-ring: canon chrome (Heartwood §3 "topbar Safety
 * life-ring (persistent, canon)"; surfaceContract `safety`: "one tap reaches
 * a human"). ONE icon button, mounted in the three chrome homes — the desktop
 * Topbar control band (first), the mobile accessories strip and the More-sheet
 * header row (chromeLayout.test.ts pins all three) — so Safety is ≤1 tap from
 * every hub instead of More → Care Network → scroll → pill.
 *
 * Kid register never sees it: like Shell's modals it renders null while the
 * Kid Mode gate is engaged (module gate singleton, the same pattern as
 * Shell.tsx's `!kidLocked` guards). 44px target, tokens only, RTL-neutral.
 */
export default function SafetyRing({ onNavigate }: { onNavigate?: () => void }) {
  const { setActiveTab, activeTab } = useArbor();
  const { t } = useLanguage();
  const kidLocked = useSyncExternalStore(subscribeKidMode, isKidModeActive);
  if (kidLocked) return null;

  const label = t("nav.tab.safety");
  const on = activeTab === "safety";
  const go = () => {
    void selectionHaptic();
    setActiveTab("safety");
    onNavigate?.();
  };

  return (
    <button
      type="button"
      onClick={go}
      aria-label={label}
      aria-current={on ? "page" : undefined}
      title={label}
      data-testid="safety-ring"
      className="flex flex-shrink-0 items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl transition"
      style={on
        ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-clay-border)" }
        : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
    >
      <Icon name="support" size={20} fill={on ? 1 : 0} />
    </button>
  );
}
