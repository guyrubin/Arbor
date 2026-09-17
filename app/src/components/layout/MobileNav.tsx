import React, { useState, useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { usePulses } from "../../lib/pulse";
import { requestOpenSearch } from "../search/SearchModal";
import { Sheet } from "../ui/Sheet";
import SafetyRing from "./SafetyRing"; // IA-01: Safety life-ring in the More-sheet header row
import KidModeButton from "./KidModeButton"; // IA-24: the Kid Mode door, in the sheet that never scrolls away
import { requestOpenSettings } from "./settingsBus"; // IA-03: Settings moved out of the mobile strip
import { badgeText } from "./Sidebar"; // IA-16: ONE badge derivation, shared with the sidebar

/**
 * Bottom tab bar shown on mobile and tablet (< lg). The Heartwood IA has TEN
 * categories, which don't fit a mobile bar — so the first four show as tabs and
 * a fifth "More" entry opens a sheet exposing EVERY remaining category as
 * NAVIGATION rows (no route is lost; never a tools grid).
 */
// Mobile is job-prioritized rather than a slice of the desktop IA. Ask Arbor is
// a frequent in-the-moment parent action; Behaviors remains one tap away in
// More. Heartwood D5 slot order: the three primary jobs lead (Today · Journal ·
// Ask), Growth fourth, More last.
const PRIMARY_SECTION_IDS = ["today", "journal", "ask", "growth"] as const;

// W2.7 nav de-overload (anti-overload, EMPHASIS ONLY): the three primary jobs
// (Today / Journal / Ask) carry more visual weight; the remaining tab (Growth)
// and More render quieter via size/opacity tokens. NO tab is removed — the
// Heartwood D5 pass reordered the slots to match the emphasis set (the W2.7
// canon follow-up from the 2026-08-11 masterplan §2.7, now ratified).
const EMPHASIZED_SECTION_IDS = new Set<string>(["today", "ask", "journal"]);

export default function MobileNav() {
  const { activeTab, setActiveTab, milestones, actionPlans, unreadCoachCount } = useArbor();
  const { t } = useLanguage();
  const pulses = usePulses(); // E1 living pulses — shown on the More-sheet rows
  const activeSectionId = sectionForTab(activeTab).id;
  const milestonesNoticed = milestones.filter((m) => m.checked).length;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);

  const primary = PRIMARY_SECTION_IDS
    .map((id) => SECTIONS.find((section) => section.id === id))
    .filter((section): section is (typeof SECTIONS)[number] => Boolean(section));
  const overflow = SECTIONS.filter((section) => !PRIMARY_SECTION_IDS.includes(section.id as (typeof PRIMARY_SECTION_IDS)[number]));
  const overflowActive = overflow.some((s) => s.id === activeSectionId);

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
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex bg-white"
        style={{ borderTop: "1px solid var(--arbor-rule)", boxShadow: "0 -4px 16px rgba(41,51,63,0.04)" }}
      >
        {primary.map((sec) => {
          const on = sec.id === activeSectionId;
          // W2.7: emphasis-only weighting — primary jobs render a larger glyph.
          // IA-16: the SIZE difference stays; the dimming does not. Labels ran
          // 9-10 px at 0.72 opacity — smaller than any other text in the app,
          // on the one control surface that is always on screen. 11-12 px at
          // full opacity keeps the same hierarchy without paying for it in
          // legibility: emphasis is weight and glyph size, never opacity.
          const emphasized = EMPHASIZED_SECTION_IDS.has(sec.id);
          // IA-16: the sidebar's unread-coach badge, on the tab a phone
          // actually uses to reach the coach. Same derivation, same app state —
          // badgeText is the sidebar's own function, imported, not re-written.
          // CLINICAL FIREWALL: a count of unread messages TO THE PARENT; it
          // says nothing about the child.
          const badge = badgeText(sec.badge, { milestonesNoticed, plansCount: actionPlans.length, unreadCoachCount });
          const showBadge = typeof sec.badge === "object" && sec.badge.kind === "count" && badge !== "";
          return (
            <button
              key={sec.id}
              onClick={() => go(sec.id)}
              aria-current={on ? "page" : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold transition ${emphasized ? "text-[12px]" : "text-[11px]"}`}
              style={{ color: on ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}
            >
              <span className="relative inline-flex">
                <Icon name={sec.msIcon} size={emphasized ? 21 : 18} fill={on ? 1 : 0} />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 text-[10px] font-extrabold rounded-full px-1.5 leading-4 text-center"
                    style={{ insetInlineStart: "100%", marginInlineStart: "-7px", background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}
                  >
                    {badge}
                  </span>
                )}
              </span>
              {t("nav.short." + sec.id)}
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
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold transition"
          style={{ color: overflowActive ? "var(--arbor-clay-deep)" : "var(--arbor-muted)" }}
        >
          <Icon name="more_horiz" size={18} fill={overflowActive ? 1 : 0} />
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
