import React from "react";
import { ArborMark } from "../ui/ArborMark";

/**
 * AP-044: Desktop topbar placeholder bar.
 *
 * Rendered above the main content area on md+ viewports. Hidden on mobile
 * (the mobile brand header inside the main scroll column covers that role).
 *
 * Wave 2 will populate the three inert placeholder slots on the right with:
 *   - Global search (Cmd/Ctrl+K)
 *   - Notification bell
 *   - Child switcher
 *
 * This component owns no interactivity — it is intentionally inert chrome.
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

      {/* Right zone: Wave-2 placeholder slots (search / notifications / kid-switcher) */}
      <div className="flex items-center gap-2.5" aria-hidden="true">
        {/* Search slot */}
        <div
          className="flex items-center rounded-xl px-3 py-2"
          style={{
            width: "200px",
            height: "40px",
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
            color: "var(--arbor-faint)",
            fontSize: "var(--t-sm)",
          }}
        />
        {/* Notification bell slot */}
        <div
          className="rounded-xl"
          style={{
            width: "40px",
            height: "40px",
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
          }}
        />
        {/* Kid-switcher slot */}
        <div
          className="rounded-xl"
          style={{
            width: "40px",
            height: "40px",
            background: "var(--arbor-paper-elevated)",
            border: "1px solid var(--arbor-rule)",
          }}
        />
      </div>
    </header>
  );
}
