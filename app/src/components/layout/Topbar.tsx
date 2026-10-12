import React from "react";
import TopbarSearch from "../search/TopbarSearch";
import KidModeButton from "./KidModeButton";
import SafetyRing from "./SafetyRing"; // IA-01: canon Safety life-ring — first control in the band
import OfflineChip from "../ui/OfflineChip"; // W0.6: renders only while offline
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab, chromeLitHome } from "../../lib/companionPlaces";
import { useSheetCrumbShown } from "../../hooks/useSheetCrumbShown"; // v3 IA-06r: an open L2 sheet's crumb
import { Breadcrumb, useLeafCrumb } from "./Breadcrumb"; // v3 IA-06r: a deep leaf's crumb

/**
 * Desktop topbar — the wireframe's lean control band (md+). Hidden on mobile,
 * where the in-content accessories strip + bottom MobileNav cover the same jobs.
 *
 * v3 F-SHELL-2: the title is the route's HOME, its place or its door, and
 * nothing else: #/weekly reads Now, #/milestones My child, #/consult Care,
 * together, #/learn For you, the parent. The old hub title and its one-line
 * hub sentence (nav.title.* / nav.sub.*) are gone from the header; the keys
 * stay in the dictionaries. Talk is a panel over a page, never a place, so
 * #/coach and #/scholar read Now, the page under the panel, exactly as the
 * Sidebar lights it (chromeLitHome): the chrome gives one answer.
 * v3 IA-06r: a deep leaf (an L2 page of the v3 route map) has no pill to say
 * where it is, so there the title is the crumb home › page instead
 * (layout/Breadcrumb): #/memory reads "My child › What Arbor remembers".
 *
 * The control band: Safety life-ring → search → Kid Mode. Talk with Arbor is a
 * sidebar door and the launcher, never a header button; the language switch
 * lives in Settings only. All tokens are sourced from index.css; no raw hex.
 */
export default function Topbar() {
  const { activeTab, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  // v3 F-SHELL-2 (critic ruling 6): ONE title on every route, the home's name.
  const home = homeForTab(activeTab);
  const lit = chromeLitHome(home);
  const named = lit.kind === "place" ? lit.place : lit.door;
  // v3 IA-06r: while an L2 sheet is open its crumb (layout/Breadcrumb) is
  // drawn over this title zone, above the sheet's backdrop: the title becomes
  // the crumb. The title steps aside (keeping its box) so nothing ghosts
  // through the dimmed band around it.
  const crumbShown = useSheetCrumbShown();
  // v3 IA-06r: on a deep leaf (an L2 page: #/memory, #/safety, #/day-windows
  // …) the title IS the crumb, home › page ("My child › What Arbor
  // remembers"); the home names every other route. A sheet opened over the
  // leaf carries both levels in its own crumb, so the leaf's steps aside then.
  const leafCrumb = useLeafCrumb("bar");
  return (
    <header
      /* B-DESIGN-03 (chrome): the sticky band takes the chrome glass — paper
         80 % + blur 14 px (index.css .arbor-chrome-glass); content stays opaque. */
      /* The glass establishes a stacking context. Lift that context above the
         later scrolling main, so search results remain visible and clickable;
         keep it below modal sheets (50) and the skip link (80). */
      className="arbor-chrome-glass relative z-30 hidden lg:flex items-center gap-4 px-5 xl:px-7 flex-none min-w-0"
      style={{
        // v3 F-SHELL-2: the 64 px band (index.css --shell-topbar-h mirrors it).
        height: "64px",
        borderBottom: "1px solid var(--arbor-rule)",
      }}
      aria-label={t("aria.applicationTopbar")}
    >
      {/* Left zone: the home's name, one line (orientation).
          UC-8: the title zone owns a hard minimum. It used to be a pure
          `flex-1 min-w-0` against a `flex-shrink-0` control band, so on wide
          desktops with the AI rail open the band (≈740px) ate the header and
          left the title 68px — "One Big Thing Today" rendered as "One …". The
          minimum is what the truncation is allowed to eat into; the control
          band below now shrinks (search first) instead of the title. */}
      <div
        data-crumb-anchor="bar"
        className="flex flex-col justify-center flex-1"
        /* A length (not `auto`) keeps `truncate` working. 11rem is what the
           narrowest band can afford: at 1024 the header is the viewport less
           the sidebar, and the band holds only Safety (44px), search (which
           shrinks first, down to a 44px floor) and Kid Mode with its short
           two-line safety label; the offline chip appears only offline and
           clips. It is enough for the longest home name ("For you, the
           parent"). min() keeps it proportionate if the header is ever
           narrower still. */
        style={{ minInlineSize: "min(11rem, 22%)" }}
      >
        {/* v3 F-SHELL-2: display face 20/600, and no second line: the page
            under it owns its own introduction. */}
        {leafCrumb && !leafCrumb.held ? (
          <Breadcrumb kind="route" place="bar" levels={leafCrumb.levels} onSelect={setActiveTab} />
        ) : (
          <span
            data-testid="topbar-home-title"
            className={`text-[20px] font-semibold leading-tight truncate${crumbShown ? " invisible" : ""}`}
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {uiLang === "he" ? named.he : named.en}
          </span>
        )}
      </div>

      {/* Right zone: lean desktop control band (Safety → search → Kid Mode).
          Talk with Arbor lives in the sidebar and the launcher, not here. */}
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
          style={{ flex: "0 1 220px", minInlineSize: "2.75rem" }}
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
