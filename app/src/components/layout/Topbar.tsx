import React from "react";
import TopbarSearch from "../search/TopbarSearch";
import KidModeButton from "./KidModeButton";
import SafetyRing from "./SafetyRing"; // IA-01: canon Safety life-ring — first control in the band
import OfflineChip from "../ui/OfflineChip"; // W0.6: renders only while offline
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { sectionForTab } from "../../lib/navigation";

/**
 * Desktop topbar — the wireframe's lean control band (md+). Hidden on mobile,
 * where the in-content accessories strip + bottom MobileNav cover the same jobs.
 *
 * Left zone = page TITLE + SUBTITLE keyed off the active section (nav.title.* /
 * nav.sub.*): the topbar tells you WHERE you are, on the sapphire-tinted band.
 *
 * Right zone mirrors the wireframe: search field → Kid Mode → "how Arbor helps"
 * rail toggle → notification bell → child switcher. Ask Arbor is a first-class
 * sidebar nav row, so it is NOT duplicated here (removed the redundant topbar
 * button). The AI rail is off by default; this toggle is its single, discoverable
 * desktop entry point. All tokens are sourced from index.css; no raw hex.
 */
export default function Topbar() {
  const { activeTab, childProfile } = useArbor();
  const { t } = useLanguage();
  const section = sectionForTab(activeTab);

  // One key per hub; a hero-less child gets the Stories line that does not promise "starring {name}".
  const hubSubKey = section.id === "stories" && !childProfile.avatar ? "stories.noHero" : section.id;
  return (
    <header
      /* B-DESIGN-03 (chrome): the sticky band takes the chrome glass — paper
         80 % + blur 14 px (index.css .arbor-chrome-glass); content stays opaque. */
      className="arbor-chrome-glass hidden lg:flex items-center gap-4 px-5 xl:px-7 flex-none min-w-0"
      style={{
        height: "74px",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label={t("aria.applicationTopbar")}
    >
      {/* Left zone: page title + subtitle stack (orientation).
          UC-8: the title zone owns a hard minimum. It used to be a pure
          `flex-1 min-w-0` against a `flex-shrink-0` control band, so on wide
          desktops with the AI rail open the band (≈740px) ate the header and
          left the title 68px — "One Big Thing Today" rendered as "One …". The
          minimum is what the truncation is allowed to eat into; the control
          band below now shrinks (search first) instead of the title. */}
      <div
        className="flex flex-col justify-center flex-1"
        /* A length (not `auto`) keeps `truncate` working. 11rem is what the
           worst case can actually afford — at 2xl with the rail open the
           header is 880px and the non-shrinking controls (Kid Mode with its
           xl safety line ≈305px, rail toggle, bell, child switcher) already
           claim ~543px — and it is enough for the full section title plus a
           readable slice of the subtitle. min() keeps it proportionate if the
           header is ever narrower still. */
        style={{ minInlineSize: "min(11rem, 22%)" }}
      >
        <span
          className="text-[18px] font-extrabold leading-tight truncate"
          style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
        >
          {t("nav.title." + section.id)}
        </span>
        {/* P5 r1 pass A6: Today owns its one caption (the eyebrow line); the
            hub sentence here repeated it, in HE with a second wording. */}
        {activeTab !== "overview" && (
          <span className="text-[12px] truncate" style={{ color: "var(--arbor-muted)" }}>
            {/* W2-SHELLPLAY critic r2: "starring" only once a hero exists. */}
            {t("nav.sub." + hubSubKey, { name: childProfile.name })}
          </span>
        )}
      </div>

      {/* Right zone: lean desktop control band (search → Kid Mode → rail toggle →
          bell → child switcher). Ask Arbor lives in the sidebar, not here. */}
      <div className="flex min-w-0 shrink items-center gap-2.5">
        {/* IA-01: Safety life-ring — FIRST in the band, always reachable in one
            tap (surfaceContract `safety`: "one tap reaches a human"). Fixed
            size; never the control that gives up width. */}
        <div className="flex-shrink-0">
          <SafetyRing />
        </div>
        {/* W0.6: subtle offline chip — self-hides while online, RTL-safe. It is
            the only other flexible box here: when it appears it must not shove
            the child switcher off the header, so it clips instead. */}
        <div className="min-w-0 overflow-hidden" style={{ flex: "0 1 auto" }}>
          <OfflineChip />
        </div>
        {/* The band's shock absorber: search gives up width first, down to a
            floor that is still a 44px tap target (and still focusable/typeable;
            Ctrl/Cmd+K remains the full-modal path). Every other control keeps
            its intrinsic size, so no control can be squeezed out of reach — the
            wide-desktop title starvation is paid for here, not by dropping a
            control. TopbarSearch's own container is `max-width: 100%`, so this
            box governs its width — and no `overflow: hidden` here, or it would
            clip the search results overlay that hangs below the input. */}
        <div
          className="hidden lg:block"
          style={{ flex: "0 1 230px", minInlineSize: "2.75rem" }}
        >
          <TopbarSearch />
        </div>
        <div className="hidden lg:block flex-shrink-0">
          <KidModeButton />
        </div>
        {/* B-SHELL-38: no child chip here — on desktop the child appears ONCE,
            as the sidebar identity line that IS the switcher (ProfileSwitcher). */}
      </div>
    </header>
  );
}
