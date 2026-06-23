import React from "react";
import { Gamepad2 } from "lucide-react";
import { ArborMark } from "../ui/ArborMark";
import TopbarKidSwitcher from "./TopbarKidSwitcher";
import TopbarSearch from "../search/TopbarSearch";
import TopbarBell from "./TopbarBell";
import { useKidMode } from "../kidmode/KidModeContext";

/**
 * AP-044: Desktop topbar placeholder bar.
 *
 * Rendered above the main content area on md+ viewports. Hidden on mobile
 * (the mobile brand header inside the main scroll column covers that role).
 *
 * AP-048: Kid Mode toggle added to the right zone. Desktop-only (hidden md:flex
 * already gates the parent header). Fires openKidMode() from KidModeContext —
 * no Firestore write, no child-data mutation.
 *
 * All tokens are sourced from index.css :root; no raw hex values.
 */
export default function Topbar() {
  const { openKidMode } = useKidMode();

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
        {/* AP-048: Kid Mode toggle — desktop only (this topbar is hidden md:flex) */}
        <button
          onClick={openKidMode}
          aria-label="Launch Kid Mode"
          title="Kid Mode — hand the device to your child"
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
            background: "var(--arbor-green-soft)",
            color: "var(--arbor-green-ink)",
            border: "1px solid var(--arbor-clay-dim)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "background 120ms",
          }}
        >
          <Gamepad2 aria-hidden="true" style={{ width: "16px", height: "16px", flexShrink: 0 }} />
          <span>Kid Mode</span>
        </button>
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
