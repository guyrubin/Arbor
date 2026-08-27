import React from "react";
import Icon from "../ui/Icon";
import { PASTEL } from "../../lib/tokens";
import { useLanguage } from "../../context/LanguageContext";
import { useArborOptional } from "../../context/ArborContext";
import { track } from "../../lib/analytics";
import { trustText } from "../../lib/i18nElevation/trustcenter";

/* ════════════════════════════════════════════════════════════════════════════
   TrustLink — masterplan 3.1/3.3: the one-liner "How Arbor decides →" chip.

   Mounts next to any inline why-line and deep-links to the Trust Center
   (#/science) via the canonical setActiveTab pattern (which also writes the
   URL hash). Ships READY but is mounted NOWHERE by this workstream — W4's
   shared ContentActionBar owns the mounting slot (render it beside the
   required why-line slot, after the why text, same row).

   Sibling of EvidenceChip (same chip anatomy + ≥44px ::before hit-area
   recipe), lav register to match the Trust Center itself. Strings resolve
   from i18nElevation/trustcenter directly (module-local, en+he) so this
   component works before the module is registered in i18nElevation/index.ts.

   CLINICAL FIREWALL: the label is a fixed navigation phrase — callers never
   inject copy, so no verdict/graded language can ride on this surface.
   ════════════════════════════════════════════════════════════════════════════ */

/** Resolve uiLang without requiring a LanguageProvider (the ContentActionBar
 *  useHeMode recipe) — provider-less render harnesses default to en. */
function useUiLang(): string {
  try {
    return useLanguage().uiLang;
  } catch {
    return "en";
  }
}

export function TrustLink({
  surface,
  className = "",
}: {
  /** Optional analytics tag naming the mounting surface (e.g. "learn-card"). */
  surface?: string;
  className?: string;
}) {
  const uiLang = useUiLang();
  // Tolerant context read: coach answer cards render in provider-less static
  // harnesses; in-app the provider is always present.
  const arbor = useArborOptional();
  const p = PASTEL.lav;

  return (
    <button
      type="button"
      onClick={() => {
        track("trustlink_tap", surface ? { surface } : {});
        if (arbor) arbor.setActiveTab("science");
        else window.location.hash = "/science"; // canonical hash the provider would write
      }}
      aria-label={trustText(uiLang, "elev.trust.link.aria")}
      data-testid="trust-link"
      // before:-inset-y-2 grows the touch target to ~44px without inflating the chip.
      className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[var(--t-xs)] font-bold transition active:scale-[0.97] motion-reduce:transition-none motion-reduce:transform-none before:absolute before:content-[''] before:-inset-y-2 before:inset-x-0 ${className}`.trim()}
      style={{ background: p.soft, color: p.ink }}
    >
      {trustText(uiLang, "elev.trust.link")}
      <Icon name="arrow_forward" size={13} className="flex-shrink-0 rtl:rotate-180" />
    </button>
  );
}

export default TrustLink;
