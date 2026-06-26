import React from "react";
import { ArborMark } from "../ui/ArborMark";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import KidModeButton from "./KidModeButton";
import AskArborButton from "./AskArborButton";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";

/**
 * AP-044: Desktop topbar placeholder bar.
 *
 * Rendered above the main content area on md+ viewports. Hidden on mobile
 * (the mobile brand header inside the main scroll column covers that role,
 * and compact KidModeButton / AskArborButton entries live in the in-content
 * accessories row so mobile users can still reach both).
 *
 * Left zone = ORIENTATION, not a duplicate brand. The sidebar already carries
 * the full Arbor lockup (mark + wordmark + tagline), so the topbar shows the
 * mark + the ACTIVE SECTION label ("Today" / "My Child" / "Grow" / "Care
 * Network" / "Arbor Academy") — prime real estate now tells you WHERE you are
 * instead of re-branding. (Fixes the P1.1 brand-dedupe finding.)
 *
 * Right zone: Ask Arbor (the flagship primary action — solid sapphire pill) +
 * Kid Mode toggle + search / notifications / kid-switcher. Ask Arbor is the
 * persistent coach entry the navigation.ts contract calls a "top-bar action";
 * <AskArborButton> makes that contract true instead of aspirational.
 * AP-048: Kid Mode delegates to the shared <KidModeButton>.
 *
 * All tokens are sourced from index.css :root; no raw hex values.
 */
export default function Topbar() {
  const { activeTab } = useArbor();
  const { t } = useLanguage();
  const section = sectionForTab(activeTab);

  return (
    <header
      className="hidden md:flex items-center gap-4 px-7 flex-none"
      style={{
        height: "64px",
        background: "var(--arbor-paper-deep)",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label={t("aria.applicationTopbar")}
    >
      {/* Left zone: Arbor mark + active section (orientation, not a duplicate wordmark) */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <ArborMark size={26} />
        <span
          className="text-base font-extrabold leading-none truncate"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {t("nav." + section.id)}
        </span>
      </div>

      {/* Right zone: Ask Arbor (primary) + Kid Mode + search / notifications / kid-switcher */}
      <div className="flex items-center gap-2.5">
        <AskArborButton />
        <KidModeButton />
        {/* Search slot — AP-045 */}
        <TopbarSearch />
        {/* Notification bell slot — AP-046 */}
        <TopbarBell />
        {/* Kid-switcher slot — AP-047 */}
        <TopbarKidSwitcher />
      </div>
    </header>
  );
}
