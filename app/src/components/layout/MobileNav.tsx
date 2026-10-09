import React, { useState, useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";
import { COMPANION_PLACES, placeForTab } from "../../lib/companionPlaces";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { usePulses } from "../../lib/pulse";
import { requestOpenSearch } from "../search/SearchModal";
import { Sheet } from "../ui/Sheet";
import SafetyRing from "./SafetyRing"; // IA-01: Safety life-ring in the More-sheet header row
import KidModeButton from "./KidModeButton"; // IA-24: the Kid Mode door, in the sheet that never scrolls away
import { requestOpenSettings } from "./settingsBus"; // IA-03: Settings moved out of the mobile strip
import { badgeText } from "./Sidebar"; // IA-16: ONE badge derivation, shared with the sidebar

/** Three primary places, a conversation door, and utilities available at any scroll position. */
const PRIMARY_SECTION_IDS = ["today", "growth", "practice"] as const;
const EMPHASIZED_SECTION_IDS = new Set<string>(["today", "growth", "practice"]);

export default function MobileNav() {
  const { activeTab, setActiveTab, milestones, actionPlans, pendingReviewCount } = useArbor();
  const { t, uiLang } = useLanguage();
  const pulses = usePulses(); // E1 living pulses — shown on the More-sheet rows
  const activeSectionId = sectionForTab(activeTab).id;
  const milestonesNoticed = milestones.filter((m) => m.checked).length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  const primary = PRIMARY_SECTION_IDS
    .map((id) => SECTIONS.find((section) => section.id === id))
    .filter((section): section is (typeof SECTIONS)[number] => Boolean(section));
  const overflow = SECTIONS.filter((section) => section.id !== "ask" && !PRIMARY_SECTION_IDS.includes(section.id as (typeof PRIMARY_SECTION_IDS)[number]));
  const overflowActive = moreOpen;

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

  return (
    <>
      <nav aria-label={t("elev.sidebar.nav.aria")}
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
          const on = sec.id === "ask" ? activeTab === "coach" : activeTab !== "coach" && place?.id === placeForTab(activeTab).id;
          const label = place ? (uiLang === "he" ? place.he : place.en) : t("companion.mobile-nav.talk");
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
              className={`min-h-[64px] min-w-0 flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold transition ${emphasized ? "text-[12px]" : "text-[11px]"}`}
              style={{ color: on ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}
            >
              <span className="relative inline-flex">
                <Icon name={place?.icon ?? sec.msIcon} size={emphasized ? 21 : 18} chrome active={on} />
                {showBadge && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 text-[10px] font-extrabold rounded-full px-1.5 leading-4 text-center"
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
        {/* More — opens the overflow sheet exposing every remaining category.
            W2.7: renders quieter (same treatment as the non-primary tab). */}
        <button
          ref={moreTriggerRef}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={overflowActive ? "page" : undefined}
          className="min-h-[64px] min-w-0 flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition"
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
        <button
          onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSearch("more"); }}
          className="w-full flex items-center gap-2.5 px-3 py-3 mb-2 min-h-[44px] rounded-2xl text-start text-sm font-bold transition"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
        >
          <Icon name="search" size={20} />
          <span>{t("top.search")}</span>
        </button>
        <div className="space-y-1">
          {overflow.map((sec) => {
            const on = sec.id === activeSectionId;
            const pulse = pulses[sec.id];
            const pulseText = pulse ? t(pulse.key, pulse.params) : "";
            return (
              <button
                key={sec.id}
                onClick={() => go(sec.id)}
                aria-current={on ? "page" : undefined}
                className="flex min-h-11 w-full items-start gap-2.5 rounded-2xl px-3 py-2.5 text-start text-sm font-bold transition"
                style={on
                  ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
                  : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
              >
                <Icon name={sec.msIcon} size={20} fill={on ? 1 : 0} />
                <span className="min-w-0 flex-1">
                  <span className="block break-words leading-snug">{t("nav.cat." + sec.id)}</span>
                  {pulseText ? (
                    <span className="mt-0.5 block break-words text-[11px] leading-snug" style={{ color: "var(--arbor-muted)", fontWeight: 500 }}>
                      {pulseText}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}
