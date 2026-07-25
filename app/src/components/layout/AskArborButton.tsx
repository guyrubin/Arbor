import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";

/**
 * The persistent entry to Ask Arbor (the `coach` tab) — a compact icon button
 * mounted in the in-content accessories row (Shell.tsx), matching the
 * Settings / Search / KidMode accessory buttons.
 *
 * PLAT-6 hygiene: the old labelled "desktop pill" default variant was dead
 * code — Shell mounted only `compact` and the Topbar pill was removed — and it
 * carried a hardcoded sapphire shadow. Deleted; this component now renders the
 * one variant that actually ships. Localized via `nav.ask`
 * (EN "Ask Arbor" / HE "שאל את ארבור").
 */
export default function AskArborButton() {
  const { setActiveTab } = useArbor();
  const { t } = useLanguage();
  const go = () => setActiveTab("coach");

  return (
    <button
      onClick={go}
      aria-label={t("nav.ask")}
      title={t("nav.ask")}
      className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl transition bg-white"
      style={{ color: "var(--arbor-clay-deep)", border: "1px solid var(--arbor-rule)" }}
    >
      <Icon name="forum" size={18} />
    </button>
  );
}
