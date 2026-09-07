import React from "react";
import { BookOpenCheck } from "lucide-react";
import { PASTEL } from "../../lib/tokens";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";

/* ════════════════════════════════════════════════════════════════════════════
   EvidenceChip — the E8 "research-anchored" trust chip.

   One small tappable chip ("Research-based · CDC/AAP" / "מבוסס מחקר · CDC/AAP")
   that deep-links to The Science page (#/science) via the app's canonical
   setActiveTab pattern (which also writes the URL hash).

   TRUTHFUL-CLAIMS RULE: this chip states research anchoring ONLY (CDC/AAP,
   named public frameworks). It must NEVER be changed to claim professional or
   human review ("built with psychologists", "clinically validated", …).

   a11y: the visual chip is compact, but an invisible ::before overlay extends
   the hit area to ≥44px height. Decorative icon; accessible name via aria-label.
   ════════════════════════════════════════════════════════════════════════════ */

export function EvidenceChip({ className = "" }: { className?: string }) {
  const { t } = useLanguage();
  const { setActiveTab } = useArbor();
  const p = PASTEL.sky;

  return (
    <button
      type="button"
      onClick={() => setActiveTab("science")}
      aria-label={t("elev.evidence.aria")}
      data-testid="evidence-chip"
      // before:-inset-y-2 grows the touch target to ~44px without inflating the chip.
      className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--t-xs)] font-bold transition active:scale-[0.97] before:absolute before:content-[''] before:-inset-y-2 before:inset-x-0 ${className}`.trim()}
      // OBJ-TODAY-01: outline, not a wash — `--arbor-sky-soft` is itself a
      // linear-gradient token, so a filled chip competed with the one primary
      // CTA. Sibling recipe: TrustLink. The sky register survives in the ink.
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: p.ink }}
    >
      <BookOpenCheck aria-hidden="true" size={13} strokeWidth={2.4} />
      {t("elev.evidence.label")}
    </button>
  );
}

export default EvidenceChip;
