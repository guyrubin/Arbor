import React from "react";
import { ArborMark } from "../ui/ArborMark";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import KidModeButton from "./KidModeButton";

/**
 * AP-044: Desktop topbar placeholder bar.
 *
 * Rendered above the main content area on md+ viewports. Hidden on mobile
 * (the mobile brand header inside the main scroll column covers that role,
 * and a compact KidModeButton lives in the in-content accessories row so
 * mobile users can still hand the device to their child).
 *
 * AP-048: Kid Mode toggle in the right zone (desktop). Delegates to the shared
 * <KidModeButton> so desktop + mobile share one sapphire affordance.
 *
 * All tokens are sourced from index.css :root; no raw hex values.
 */
export default function Topbar() {
  return (
    <header
      className="hidden md:flex items-center gap-4 px-7 flex-none"
      style={{
        height: "64px",
        background: "var(--arbor-paper-deep)",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label="Application topbar"
    >
      {/* Left zone: Arbor wordmark (mirrors sidebar brand lockup for orientation) */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <ArborMark size={28} />
        <span
          className="text-base font-extrabold leading-none"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          Arbor
        </span>
      </div>

      {/* Right zone: Kid Mode toggle + search / notifications / kid-switcher */}
      <div className="flex items-center gap-2.5">
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
