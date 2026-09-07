import React, { useState, useEffect, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { usePulses } from "../../lib/pulse";
import { requestOpenSearch } from "../search/SearchModal";
import { createPortal } from "react-dom";
import { useDialog } from "../../hooks/useDialog";
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
  const { ref: dialogRef, requestClose, onBackdropClick } = useDialog({ open: moreOpen, onClose: () => setMoreOpen(false), returnFocusRef: moreTriggerRef });

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

      {moreOpen && createPortal(
        <div className="arbor-app" style={{ display: "contents" }}>
        <div
          ref={dialogRef}
          tabIndex={-1}
          data-arbor-dialog-layer
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.popover.more")}
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "color-mix(in srgb, var(--arbor-ink) 28%, transparent)" }}
          onClick={onBackdropClick}
        >
          <div
            className="rounded-t-3xl p-4 pb-8 bg-white"
            style={{ boxShadow: "0 -8px 32px rgba(41,51,63,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("nav.popover.more")}</span>
              <div className="flex items-center gap-1">
                {/* IA-01: Safety is one tap from the sheet too — closes it on navigate. */}
                <SafetyRing onNavigate={() => setMoreOpen(false)} />
                {/* IA-24: the Kid Mode door lived ONLY in the in-content strip,
                    which is position:static — scroll a hub and the one way to
                    hand the device to the child scrolls off with it. The sheet
                    is fixed and one tap from every scroll position. Same
                    component, same openKidMode, same parent-lock aria line. */}
                <KidModeButton compact />
                {/* IA-03: Settings moved out of the strip and lands beside the
                    two accessories this header already hosted. Shell owns the
                    open state and re-checks the kid gate (settingsBus). */}
                <button
                  aria-label={t("aria.settings")}
                  onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSettings(); }}
                  className="w-11 h-11 flex flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ color: "var(--arbor-muted)" }}
                >
                  <Icon name="settings" size={18} />
                </button>
                <button aria-label={t("aria.close")} onClick={requestClose} className="w-11 h-11 flex flex-shrink-0 items-center justify-center rounded-full" style={{ color: "var(--arbor-muted)" }}>
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>
            {/* W1.9 mobile search entry: full-width row above the category
                grid — opens the same SearchModal as the accessories strip
                and desktop Ctrl/Cmd+K (Shell owns the open state + kid gate). */}
            <button
              onClick={() => { void selectionHaptic(); setMoreOpen(false); requestOpenSearch("more"); }}
              className="w-full flex items-center gap-2.5 px-3 py-3 mb-2 min-h-[44px] rounded-2xl text-start text-sm font-bold transition"
              style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
            >
              <Icon name="search" size={20} />
              <span className="truncate">{t("top.search")}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              {overflow.map((sec) => {
                const on = sec.id === activeSectionId;
                // E1 living pulse — informational line under the label (counts/
                // activity only; firewall lives in usePulses). Hidden when empty.
                // No cast: NavSection.id IS HubId, so a hub without a pulse
                // entry is a compile error, not a silently empty row.
                const pulse = pulses[sec.id];
                const pulseText = pulse ? t(pulse.key, pulse.params) : "";
                return (
                  <button
                    key={sec.id}
                    onClick={() => go(sec.id)}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-2xl text-start text-sm font-bold transition min-w-0"
                    style={on
                      ? { background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }
                      : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                  >
                    <Icon name={sec.msIcon} size={20} fill={on ? 1 : 0} />
                    <span className="min-w-0 flex flex-col">
                      <span className="truncate">{t("nav.cat." + sec.id)}</span>
                      {pulseText ? (
                        <span
                          className="truncate text-[11px] leading-snug"
                          style={{ color: "var(--arbor-muted)", fontWeight: 500 }}
                        >
                          {pulseText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        </div>, document.body
      )}
    </>
  );
}
