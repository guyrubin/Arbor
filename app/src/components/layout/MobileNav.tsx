import React, { useState, useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, primaryTabOf } from "../../lib/navigation";
import { COMPANION_PLACES, COMPANION_DOORS, homeForTab, chromeLitHome, type CompanionDoor } from "../../lib/companionPlaces";
import { requestCompanionConversation } from "../../lib/companionConversation";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { Sheet } from "../ui/Sheet";
import { requestOpenSettings } from "./settingsBus"; // IA-03: Settings moved out of the mobile strip
import { useArborPause } from "../../lib/pauseArborStore";
import { badgeText } from "./Sidebar"; // IA-16: ONE badge derivation, shared with the sidebar

/** v3 IA-03: the dock is the three places, Talk and More. The places come from
 *  these three sections (each lands on a place's tab); Talk is the conversation
 *  door, never a section; More opens the sheet. */
const PRIMARY_SECTION_IDS = ["today", "growth", "practice"] as const;
const EMPHASIZED_SECTION_IDS = new Set<string>(["today", "growth", "practice"]);
/** The dock's Talk slot is the Talk with Arbor door. Typed, so a reorder of
 *  COMPANION_DOORS fails the type check instead of moving the slot. */
const TALK_DOOR: Extract<CompanionDoor, { id: "talk" }> = COMPANION_DOORS[0];
/** Where the dock's Talk opens the conversation from. Hyphenated on purpose:
 *  the bare word is a Material Symbols name outside the shipped subset, and
 *  iconFontSubset.test.ts reads every quoted lowercase word in src/. */
const DOCK_TALK_SOURCE = "mobile-dock";

/** v10 (design system v10.1): slot five is Menu, four rows instead of the
 *  fifteen-entry More sheet. The two doors that have no slot in the bar (For
 *  you, the parent; Care, together) each name their pills under them; then
 *  Settings and Pause Arbor. Search, Safety and Kid Mode stay in the top strip,
 *  so the sheet never repeats them; the places' pills are the shell's pill row,
 *  so the sheet no longer indexes them. */
const MENU_DOOR_IDS = ["learn", "care"] as const;

export default function MobileNav() {
  const { activeTab, setActiveTab, milestones, actionPlans, pendingReviewCount, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const milestonesNoticed = milestones.filter((m) => m.checked).length;
  const [moreOpen, setMoreOpen] = useState(false);
  const arborPause = useArborPause();
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  const primary = PRIMARY_SECTION_IDS
    .map((id) => SECTIONS.find((section) => section.id === id))
    .filter((section): section is (typeof SECTIONS)[number] => Boolean(section));
  // v3 IA-03: the dock lights the route's ONE home, through the resolver the
  // desktop Sidebar reads (chromeLitHome(homeForTab)). A place lights its place;
  // Talk is a panel over a page, so on #/coach the page under it (Now) is lit
  // and Talk never is; the two doors that live in the sheet (For you, the
  // parent; Care, together) light More.
  const lit = chromeLitHome(homeForTab(activeTab));
  const overflowActive = moreOpen || lit.kind === "door";

  // The sheet is hidden at lg; it must not retain focus/scroll ownership there.
  useEffect(() => {
    if (!moreOpen || !window.matchMedia) return;
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeWhenWide = () => { if (wide.matches) setMoreOpen(false); };
    closeWhenWide();
    wide.addEventListener("change", closeWhenWide);
    return () => wide.removeEventListener("change", closeWhenWide);
  }, [moreOpen]);

  const go = (sectionId: string) => {
    const sec = SECTIONS.find((s) => s.id === sectionId);
    if (!sec) return;
    void selectionHaptic();
    setActiveTab(primaryTabOf(sec));
    setMoreOpen(false);
  };
  // Talk opens the conversation over the current place through its one door
  // (shared contract 2). The route never changes, so the page and its scroll
  // position wait beneath the full-screen panel.
  const openTalk = (source: string) => {
    void selectionHaptic();
    setMoreOpen(false);
    requestCompanionConversation({ source });
  };
  const openDoor = (door: CompanionDoor) => {
    if (door.id === TALK_DOOR.id) { openTalk("more"); return; }
    void selectionHaptic();
    setActiveTab(door.tab);
    setMoreOpen(false);
  };

  return (
    <>
      <nav aria-label={t("elev.sidebar.nav.aria")} data-chrome="phone-dock"
        /* B-DESIGN-03 (chrome): the dock is chrome glass (paper 80 % + blur 14 px);
           the content scrolling under it stays opaque. */
        className="arbor-chrome-glass lg:hidden fixed bottom-0 inset-x-0 z-40 flex"
        style={{ borderTop: "1px solid var(--arbor-rule)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {primary.map((sec) => {
          // One glyph per place: the dock takes Now / My child / Together's
          // glyph from lib/companionPlaces.ts, the same source the desktop
          // sidebar reads (iconFamily.guard.test.ts holds both). The section
          // glyph is only a fallback for a dock section that is not a place.
          const place = COMPANION_PLACES.find(p => p.tab === primaryTabOf(sec));
          const on = lit.kind === "place" && lit.place.id === place?.id;
          const label = place ? (he ? place.he : place.en) : t("nav.cat." + sec.id);
          // W2.7: emphasis-only weighting — primary jobs render a larger glyph.
          // IA-16: the SIZE difference stays; the dimming does not. Labels ran
          // 9-10 px at 0.72 opacity — smaller than any other text in the app,
          // on the one control surface that is always on screen. 11-12 px at
          // full opacity keeps the same hierarchy without paying for it in
          // legibility: emphasis is weight and glyph size, never opacity.
          const emphasized = EMPHASIZED_SECTION_IDS.has(sec.id);
          // IA-16: the sidebar's Ask badge, on the tab a phone actually uses
          // to reach the coach. Same derivation, same app state — badgeText is
          // the sidebar's own function, imported, not re-written.
          // B-SHELL-03: the number counts notes awaiting the PARENT's review
          // (the coach's memory review queue), and the tab's accessible name
          // says so. CLINICAL FIREWALL: it says nothing about the child.
          const badge = badgeText(sec.badge, { milestonesNoticed, plansCount: actionPlans.length, pendingReviewCount });
          const showBadge = typeof sec.badge === "object" && sec.badge.kind === "count" && badge !== "";
          const reviewAria = showBadge
            ? t("elev.sidebar.badge.review", { label, count: pendingReviewCount })
            : undefined;
          return (
            <button
              key={sec.id}
              onClick={() => go(sec.id)}
              aria-current={on ? "page" : undefined}
              aria-label={reviewAria}
              className={`min-h-[64px] min-w-0 flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold transition text-[12px]`}
              style={{ color: on ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}
            >
              <span className="relative inline-flex">
                <Icon name={place?.icon ?? sec.msIcon} size={emphasized ? 21 : 18} chrome active={on} />
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 text-xs font-bold rounded-full px-1.5 leading-4 text-center"
                    style={{ insetInlineStart: "100%", marginInlineStart: "-7px", background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
                  >
                    {badge}
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
        {/* v3 IA-03: Talk, the fourth slot, is the Talk with Arbor door
            (COMPANION_DOORS). It opens the conversation full-screen over the
            current place and never changes the route, so it says
            aria-haspopup, never aria-current, and it never carries a count
            (B-SHELL-26). Its accessible name is the door's full name. */}
        <button
          type="button"
          data-testid="dock-talk"
          onClick={() => openTalk(DOCK_TALK_SOURCE)}
          aria-haspopup="dialog"
          aria-label={he ? TALK_DOOR.he : TALK_DOOR.en}
          className="min-h-[64px] min-w-0 flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[12px] font-bold transition"
          style={{ color: "var(--arbor-muted)" }}
        >
          <Icon name={TALK_DOOR.icon} size={21} chrome />
          {t("companion.mobile-nav.talk")}
        </button>
        {/* More — opens the sheet: the three doors, Search, then every place's
            pages. Lit while open and on a door the sheet holds.
            W2.7: renders quieter (same treatment as the non-primary tab). */}
        <button
          ref={moreTriggerRef}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={overflowActive ? "page" : undefined}
          className="min-h-[64px] min-w-0 flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[12px] font-bold transition"
          style={{ color: overflowActive ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}
        >
          <Icon name="menu" size={21} chrome active={overflowActive} />
          {t("nav.short.menu")}
        </button>
      </nav>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        returnFocusRef={moreTriggerRef}
        title={t("nav.popover.menu")}
      >
        {/* v10: four rows. Each door names its pills; Settings and Pause Arbor
            follow. Rows are 64 px with a glyph chip, a title, the line under it
            and a chevron that points to the inline end (flips in Hebrew). */}
        <div className="ds" data-testid="menu-rows">
          <div className="ds-menu" role="list">
            {MENU_DOOR_IDS.map((id) => {
              const door = COMPANION_DOORS.find((d) => d.id === id)!;
              const on = lit.kind === "door" && lit.door.id === door.id;
              return (
                <div role="listitem" key={door.id}>
                  <button
                    type="button"
                    data-more-door={door.id}
                    aria-current={on ? "page" : undefined}
                    onClick={() => openDoor(door)}
                    className={on ? "ds-menurow on" : "ds-menurow"}
                  >
                    <span className="gi" aria-hidden="true"><Icon name={door.icon} size={18} fill={on ? 1 : 0} /></span>
                    <span className="ds-menurow-text"><b>{he ? door.he : door.en}</b><span className="small">{t(`nav.menu.${door.id}.sub`)}</span></span>
                    <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
                  </button>
                </div>
              );
            })}
            <div role="listitem">
              <button
                type="button"
                data-testid="menu-settings"
                onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSettings(); }}
                className="ds-menurow"
              >
                <span className="gi" aria-hidden="true"><Icon name="settings" size={18} /></span>
                <span className="ds-menurow-text"><b>{t("aria.settings")}</b><span className="small">{t("nav.menu.settings.sub")}</span></span>
                <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
              </button>
            </div>
            <div role="listitem">
              <button
                type="button"
                data-testid="more-pause"
                onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSettings({ focus: "pause-arbor" }); }}
                className="ds-menurow"
              >
                <span className="gi" aria-hidden="true"><Icon name="pause" size={18} /></span>
                <span className="ds-menurow-text"><b>{t(arborPause.paused ? "companion.pause.moreOn" : "companion.pause.more")}</b><span className="small">{t("nav.menu.pause.sub")}</span></span>
                <span aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}
