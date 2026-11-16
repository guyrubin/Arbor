import React from "react";
import TopbarSearch from "../search/TopbarSearch";
import KidModeButton from "./KidModeButton";
import SafetyRing from "./SafetyRing"; // IA-01: canon Safety life-ring — first control in the band
import OfflineChip from "../ui/OfflineChip"; // W0.6: renders only while offline
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { homeForTab, chromeLitHome } from "../../lib/companionPlaces";
import { HOME_PILLS, homeIdForTab, shellCrumbFor } from "../../lib/navigation";
import type { ActiveTab } from "../../lib/routes";
import { Icon } from "../ui/Icon";

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
 *
 * The control band: Safety life-ring → search → Kid Mode. Talk with Arbor is a
 * sidebar door and the launcher, never a header button; the language switch
 * lives in Settings only. All tokens are sourced from index.css; no raw hex.
 */
/** v10 — the crumb's labels: a pill reads as its pill; a view reads its one name. */
function crumbLabel(tab: ActiveTab, isPill: boolean, t: (k: string, v?: Record<string, string | number>) => string, name: string): string {
  if (isPill) {
    const item = HOME_PILLS[homeIdForTab(tab)].find((it) => it.tab === tab);
    if (tab === "profile" && name) return t("nav.pill.profile.named", { name });
    return t(item?.labelKey ?? "nav.tab." + tab);
  }
  const key = "nav.view." + tab;
  const view = t(key, { name: name || t("nav.crumb.child") });
  return view !== key ? view : t("nav.tab." + tab);
}

export default function Topbar() {
  const { activeTab, setActiveTab, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const childName = childProfile?.name?.trim().split(/\s+/)[0] ?? "";
  const crumb = shellCrumbFor(activeTab);
  // v3 F-SHELL-2 (critic ruling 6): ONE title on every route, the home's name.
  const home = homeForTab(activeTab);
  const lit = chromeLitHome(home);
  const named = lit.kind === "place" ? lit.place : lit.door;
  return (
    <header
      data-chrome="topbar"
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
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            data-testid="topbar-home-title"
            className="text-[20px] font-semibold leading-tight truncate flex-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}
          >
            {uiLang === "he" ? named.he : named.en}
          </span>
          {/* v10: the breadcrumb continues the title: place › pill › view. The
              pill is a link back to it; the last level is where you are. */}
          {(crumb.pill || crumb.view) && (
            <nav aria-label={t("nav.crumb.aria")} data-testid="topbar-crumb" className="min-w-0">
              <ol className="flex items-center gap-1 min-w-0 text-[14px] font-semibold" style={{ color: "var(--arbor-ink-soft)" }}>
                {crumb.pill && (
                  <li className="flex items-center gap-1 min-w-0">
                    <Icon name="chevron_right" size={16} className="rtl:-scale-x-100 flex-none" style={{ color: "var(--arbor-muted)" }} />
                    {crumb.view ? (
                      <button type="button" onClick={() => setActiveTab(crumb.pill!)} className="min-h-11 min-w-11 px-1 truncate text-center hover:underline underline-offset-2">
                        {crumbLabel(crumb.pill, true, t, childName)}
                      </button>
                    ) : (
                      <span aria-current="page" className="px-1 truncate" style={{ color: "var(--arbor-ink)" }}>{crumbLabel(crumb.pill, true, t, childName)}</span>
                    )}
                  </li>
                )}
                {crumb.view && (
                  <li className="flex items-center gap-1 min-w-0">
                    <Icon name="chevron_right" size={16} className="rtl:-scale-x-100 flex-none" style={{ color: "var(--arbor-muted)" }} />
                    <span aria-current="page" className="px-1 truncate" style={{ color: "var(--arbor-ink)" }}>{crumbLabel(crumb.view, false, t, childName)}</span>
                  </li>
                )}
              </ol>
            </nav>
          )}
        </div>
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
          style={{ flex: "0 1 300px", minInlineSize: "2.75rem" }}
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
