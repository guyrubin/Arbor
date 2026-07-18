import React, { useState, useEffect } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { SECTIONS, sectionForTab, primaryTabOf } from "../../lib/navigation";
import { Icon } from "../ui/Icon";
import { selectionHaptic } from "../../lib/native";
import { usePulses, type HubId } from "../../lib/pulse";

/**
 * Bottom tab bar shown on mobile (< md). The UC-1 IA has EIGHT categories, which
 * don't fit a mobile bar — so the first four show as tabs and a fifth "More"
 * entry opens a sheet exposing EVERY remaining category (no route is lost).
 */
const PRIMARY_COUNT = 4;

export default function MobileNav() {
  const { activeTab, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const pulses = usePulses(); // E1 living pulses — shown on the More-sheet rows
  const activeSectionId = sectionForTab(activeTab).id;
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = SECTIONS.slice(0, PRIMARY_COUNT);
  const overflow = SECTIONS.slice(PRIMARY_COUNT);
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
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex bg-white"
        style={{ borderTop: "1px solid var(--arbor-rule)", boxShadow: "0 -4px 16px rgba(41,51,63,0.04)" }}
      >
        {primary.map((sec) => {
          const on = sec.id === activeSectionId;
          return (
            <button
              key={sec.id}
              onClick={() => go(sec.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9.5px] font-bold transition"
              style={{ color: on ? "var(--arbor-primary-deep)" : "var(--arbor-muted)" }}
            >
              <Icon name={sec.msIcon} size={20} fill={on ? 1 : 0} />
              {t("nav.short." + sec.id)}
            </button>
          );
        })}
        {/* More — opens the overflow sheet exposing every remaining category */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[9.5px] font-bold transition"
          style={{ color: overflowActive ? "var(--arbor-primary-deep)" : "var(--arbor-muted)" }}
        >
          <Icon name="more_horiz" size={20} fill={overflowActive ? 1 : 0} />
          {t("nav.short.more")}
        </button>
      </nav>

      {moreOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("nav.popover.more")}
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
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
            <div className="grid grid-cols-2 gap-2">
              {overflow.map((sec) => {
                const on = sec.id === activeSectionId;
                // E1 living pulse — informational line under the label (counts/
                // activity only; firewall lives in usePulses). Hidden when empty.
                const pulse = pulses[sec.id as HubId];
                const pulseText = pulse ? t(pulse.key, pulse.params) : "";
                return (
                  <button
                    key={sec.id}
                    onClick={() => go(sec.id)}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-2xl text-start text-sm font-bold transition min-w-0"
                    style={on
                      ? { background: "var(--arbor-primary-dim)", color: "var(--arbor-primary-deep)" }
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
