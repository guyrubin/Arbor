import React, { useState, useEffect } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { usePulses } from "../../lib/pulse";
import { requestOpenSearch } from "../search/SearchModal";

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
  const { activeTab, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const pulses = usePulses(); // E1 living pulses — shown on the More-sheet rows
  const activeSectionId = sectionForTab(activeTab).id;
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = PRIMARY_SECTION_IDS
    .map((id) => SECTIONS.find((section) => section.id === id))
    .filter((section): section is (typeof SECTIONS)[number] => Boolean(section));
  const overflow = SECTIONS.filter((section) => !PRIMARY_SECTION_IDS.includes(section.id as (typeof PRIMARY_SECTION_IDS)[number]));
  const overflowActive = overflow.some((s) => s.id === activeSectionId);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMoreOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
          // W2.7: emphasis-only weighting — primary jobs slightly larger,
          // the quieter tab dims when inactive. Colors stay on tokens.
          const emphasized = EMPHASIZED_SECTION_IDS.has(sec.id);
          return (
            <button
              key={sec.id}
              onClick={() => go(sec.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 font-bold transition ${emphasized ? "text-[10px]" : "text-[9px]"}`}
              style={{
                color: on ? "var(--arbor-clay-deep)" : "var(--arbor-muted)",
                opacity: emphasized || on ? 1 : 0.72,
              }}
            >
              <Icon name={sec.msIcon} size={emphasized ? 21 : 18} fill={on ? 1 : 0} />
              {t("nav.short." + sec.id)}
            </button>
          );
        })}
        {/* More — opens the overflow sheet exposing every remaining category.
            W2.7: renders quieter (same treatment as the non-primary tab). */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9px] font-bold transition"
          style={{
            color: overflowActive ? "var(--arbor-clay-deep)" : "var(--arbor-muted)",
            opacity: overflowActive ? 1 : 0.72,
          }}
        >
          <Icon name="more_horiz" size={18} fill={overflowActive ? 1 : 0} />
          {t("nav.short.more")}
        </button>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.popover.more")}
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: "color-mix(in srgb, var(--arbor-ink) 28%, transparent)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-3xl p-4 pb-8 bg-white"
            style={{ boxShadow: "0 -8px 32px rgba(41,51,63,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("nav.popover.more")}</span>
              <button aria-label={t("aria.close")} onClick={() => setMoreOpen(false)} className="p-2 rounded-full" style={{ color: "var(--arbor-muted)" }}>
                <Icon name="close" size={18} />
              </button>
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
      )}
    </>
  );
}
