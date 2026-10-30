import React, { useState, useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, primaryTabOf } from "../../lib/navigation";
import { COMPANION_PLACES, COMPANION_DOORS, homeForTab, chromeLitHome, type CompanionDoor, type CompanionPlace } from "../../lib/companionPlaces";
import { requestCompanionConversation } from "../../lib/companionConversation";
import type { ActiveTab } from "../../lib/routes";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { requestOpenSearch } from "../search/SearchModal";
import { Sheet } from "../ui/Sheet";
import SafetyRing from "./SafetyRing"; // IA-01: Safety life-ring in the More-sheet header row
import KidModeButton from "./KidModeButton"; // IA-24: the Kid Mode door, in the sheet that never scrolls away
import { requestOpenSettings } from "./settingsBus"; // IA-03: Settings moved out of the mobile strip
import { useArborPause } from "../../lib/pauseArborStore";
import { PARENT_RECORD_COPY } from "../companion/parentRecordCopy";
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

/** v3 IA-03 (critic ruling 14): the sheet's index of the three places, under
 *  their v3 pill names. A row opens a route, or Together's home with its
 *  filter (#/practice?f=, the Together lane's contract). Now's and Together's
 *  rows reuse the label key their pill reads, so the two names cannot drift;
 *  My child's rows carry the v3 names of the route map (Milestones, Moments,
 *  About <child>) in companion.more.* until its pill row takes them. No row
 *  carries an old hub name: #/journal and #/behaviors stay on My child's pill
 *  row, the stories live in Together's Stories, and #/memory is one tap from
 *  My child's home and from Settings. */
type IndexRow = { id: string; label: string; route: ActiveTab; filter?: string; glyph: string };
function placeIndex(
  t: (key: string, vars?: Record<string, string | number>) => string,
  about: string,
): Record<CompanionPlace["id"], readonly IndexRow[]> {
  return {
    now: [
      { id: "weekly", label: t("nav.pill.weekly"), route: "weekly", glyph: "bar_chart" },
    ],
    child: [
      { id: "milestones", label: t("companion.more.milestones"), route: "development", glyph: "check_circle" },
      { id: "moments", label: t("companion.more.moments"), route: "timeline", glyph: "photo_album" },
      { id: "about", label: about, route: "profile", glyph: "person" },
    ],
    // v4: Together's three filters, in its own order — Routines · Play ·
    // Stories. Play (f=games) holds the games and the away-from-the-screen
    // ideas, so it is a row at every age: without a world that fits (under
    // three, or none in her language) it opens on the away ideas.
    together: [
      { id: "routines", label: t("companion.together-view.routines"), route: "practice", filter: "routines", glyph: "checklist" },
      { id: "play", label: t("companion.together-view.play"), route: "practice", filter: "games", glyph: "extension" },
      { id: "stories", label: t("companion.together-view.stories"), route: "practice", filter: "stories", glyph: "auto_stories" },
    ],
  };
}

export default function MobileNav() {
  const { activeTab, setActiveTab, milestones, actionPlans, pendingReviewCount, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = PARENT_RECORD_COPY[he ? "he" : "en"];
  const query = useHashQuery();
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
  const firstName = childProfile?.name?.trim().split(" ")[0] ?? "";
  const index = placeIndex(
    t,
    firstName ? t("companion.more.about", { name: firstName }) : t("companion.more.about-child"),
  );

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
  const openRow = (row: IndexRow) => {
    void selectionHaptic();
    setMoreOpen(false);
    if (row.filter) goToRoute(row.route, { f: row.filter });
    else setActiveTab(row.route);
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
          <Icon name="more_horiz" size={18} chrome active={overflowActive} />
          {t("nav.short.more")}
        </button>
      </nav>

      <Sheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        returnFocusRef={moreTriggerRef}
        title={t("nav.popover.more")}
        headerActions={
          <>
            <SafetyRing onNavigate={() => setMoreOpen(false)} />
            <KidModeButton compact onBeforeOpen={() => setMoreOpen(false)} />
            <button
              aria-label={t("aria.settings")}
              onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSettings(); }}
              className="w-11 h-11 flex flex-shrink-0 items-center justify-center rounded-xl"
              style={{ color: "var(--arbor-muted)" }}
            >
              <Icon name="settings" size={18} />
            </button>
          </>
        }
      >
        {/* v3 IA-03: the three doors lead the sheet. Talk opens the conversation
            over the current place; For you, the parent and Care, together open
            their landings. They carry data-more-door, not data-more-destination:
            the place index below is the one list of pages. Chevrons point to
            the inline end and flip once in Hebrew. */}
        <section data-testid="more-doors-group" aria-labelledby="more-doors-heading" className="mb-3">
          <h3 id="more-doors-heading" className="px-3 mb-2 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{t("companion.more.doors")}</h3>
          <div className="space-y-1">
            {COMPANION_DOORS.map((door) => {
              const on = lit.kind === "door" && lit.door.id === door.id;
              return (
                <button
                  key={door.id}
                  type="button"
                  data-more-door={door.id}
                  aria-haspopup={door.id === TALK_DOOR.id ? "dialog" : undefined}
                  aria-current={on ? "page" : undefined}
                  onClick={() => openDoor(door)}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-start text-sm font-semibold transition"
                  style={on
                    ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
                    : { background: "var(--arbor-paper-deep)", color: "var(--arbor-ink-soft)" }}
                >
                  <Icon name={door.icon} size={20} fill={on ? 1 : 0} />
                  <span className="min-w-0 flex-1 block break-words leading-snug">{he ? door.he : door.en}</span>
                  <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
                </button>
              );
            })}
          </div>
        </section>
        <button
          data-testid="more-search"
          onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSearch("more"); }}
          className="w-full flex items-center gap-2.5 px-3 py-3 mb-2 min-h-[44px] rounded-2xl text-start text-sm font-bold transition"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
        >
          <Icon name="search" size={20} />
          <span>{t("top.search")}</span>
        </button>
        <button
          type="button"
          data-testid="more-pause"
          onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSettings({ focus: "pause-arbor" }); }}
          className="w-full flex items-center gap-2.5 px-3 py-3 mb-2 min-h-[44px] rounded-2xl text-start text-sm font-bold transition"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
        >
          <Icon name="schedule" size={20} />
          <span>{t(arborPause.paused ? "companion.pause.moreOn" : "companion.pause.more")}</span>
        </button>
        {/* v3 IA-03 (ruling 14): the old records and support groups are gone,
            and so are their pulse sub-lines. One index follows the three places
            in COMPANION_PLACES order, each row under its v3 pill name. The
            heading above it is the pinned Records heading; renaming it is a
            decision for Guy. */}
        <section aria-labelledby="more-records-heading" data-testid="more-records-group" className="mt-4 space-y-4">
          <h3 id="more-records-heading" className="px-3 text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{copy.records}</h3>
          {COMPANION_PLACES.map((place) => (
            <div key={place.id} role="group" aria-labelledby={`more-place-${place.id}-heading`} data-testid={`more-place-${place.id}-group`}>
              <h4 id={`more-place-${place.id}-heading`} className="px-3 mb-1 text-[13px] font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{he ? place.he : place.en}</h4>
              <div className="space-y-1">
                {index[place.id].map((row) => {
                  const on = activeTab === row.route && (row.filter ? query.get("f") === row.filter : true);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      data-more-destination={row.filter ? `${row.route}?f=${row.filter}` : row.route}
                      aria-current={on ? "page" : undefined}
                      onClick={() => openRow(row)}
                      className="flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-start text-sm font-semibold transition"
                      style={on
                        ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
                        : { background: "transparent", color: "var(--arbor-ink-soft)" }}
                    >
                      <Icon name={row.glyph} size={20} fill={on ? 1 : 0} />
                      <span className="min-w-0 flex-1 block break-words leading-snug">{row.label}</span>
                      <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </Sheet>
    </>
  );
}
