import { MessageSquare } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/**
 * The persistent entry to Ask Arbor (the `coach` tab) — the one surface the
 * navigation.ts contract calls "a top-bar action + the Today coach card, not a
 * sidebar row." Until now that "top-bar action" was only an assertion in code:
 * the coach was reachable SOLELY from in-context CTAs inside other tabs
 * (Overview, Strengths, ChildProfile, Scholar, Daily Play…). There was no
 * persistent, always-available way to just ask Arbor. This makes the contract
 * true on BOTH surfaces:
 *   - desktop: the labelled sapphire primary pill in the Topbar;
 *   - mobile: the compact icon in the in-content accessories row.
 *
 * `compact` renders the mobile icon-button (`md:hidden`, matches the Settings /
 * Search / KidMode accessory buttons). The default is the labelled desktop pill.
 *
 * Sapphire fill + white = the primary action; it sits one step above the soft
 * KidMode pill, so the flagship AI surface reads as the most prominent thing in
 * the header. Localized via `nav.ask` (EN "Ask Arbor" / HE "שאל את ארבור").
 */
export default function AskArborButton({ compact = false }: { compact?: boolean }) {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  const go = () => setActiveTab("coach");

  if (compact) {
    return (
      <button
        onClick={go}
        aria-label={t("nav.ask")}
        title={t("nav.ask")}
        className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl transition bg-white"
        style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
      >
        <MessageSquare className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={go}
      aria-label={t("nav.ask")}
      title={t("nav.ask")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        paddingInline: "14px",
        paddingBlock: "0",
        height: "40px",
        minHeight: "44px",
        minWidth: "44px",
        borderRadius: "var(--r)",
        fontWeight: 800,
        fontSize: "var(--t-sm)",
        background: "var(--arbor-clay)",
        color: "#fff",
        border: "1px solid transparent",
        boxShadow: "0 6px 14px -6px rgba(43,127,255,0.55)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "background 120ms, transform 120ms",
      }}
    >
      <MessageSquare aria-hidden="true" style={{ width: "16px", height: "16px", flexShrink: 0 }} />
      <span>{t("nav.ask")}</span>
    </button>
  );
}
