import React from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { escalationText, locText, todayHardMomentOffer } from "../../content/hardMomentSurface";
import { availableHardMomentCards } from "../../content/selectCards";
import { hardMomentPublication, type HardMomentContext } from "../../content/pilotRelease";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import { ageMonthsFromProfile } from "../../lib/childAge";

/** A contextual suggestion using the existing Today action seam and an outline CTA. */
export default function HardMomentTodayOffer() {
  const { behaviorLogs, activeTodayAction, acceptTodayAction, childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const locale = uiLang === "he" ? "he" : "en";
  const contextFor = (): HardMomentContext => {
    const now = new Date();
    return { locale, now, ageMonths: ageMonthsFromProfile(childProfile, now) };
  };
  const context = contextFor();
  const offer = todayHardMomentOffer(behaviorLogs, undefined, context.now, context.ageMonths, locale);
  if (activeTodayAction || !offer) return null;

  const doNow = locText(offer.card.doNow, locale);
  const copy = hardMomentPilotText(locale);
  const pilot = hardMomentPublication(offer.card, context) === "editorial-pilot";

  return (
    <section lang={locale} dir={locale === "he" ? "rtl" : "ltr"}
      className="mt-4 min-w-0 rounded-[20px] p-5 text-start"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}
      aria-labelledby="hard-moment-offer-title" data-testid="hard-moment-today-offer">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <Icon name="volunteer_activism" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.today.eyebrow")}{pilot ? ` · ${copy.status}` : ""}</p>
          <h2 id="hard-moment-offer-title" className="mt-1 break-words text-base font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
            {locText(offer.card.title, locale)}
          </h2>
          <p className="mt-2 break-words text-base leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{doNow}</p>
          {/* Escalation is NOT collapsible here. Today is the surface a parent
              reaches mid-moment; the immediate-danger sentence must not be one
              tap away. Matches the always-visible band in the Behaviors guide. */}
          {pilot && (
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{copy.explanation}</p>
          )}
          <div className="mt-2 min-w-0 rounded-xl p-3" role="note" data-testid="hard-moment-today-escalation"
            style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule-strong)" }}>
            <p className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.section.escalation")}</p>
            <p className="mt-1 break-words text-sm leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{escalationText(offer.card, locale)}</p>
          </div>
          <button type="button" onClick={() => {
            const current = availableHardMomentCards(contextFor()).find((card) => card.id === offer.card.id);
            if (!current) return;
            acceptTodayAction(locText(current.doNow, locale), "standard");
          }}
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-xl px-4 py-3 text-sm font-bold transition"
            style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "transparent" }}>
            {t("today.action.make")} <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:-scale-x-100" />
          </button>
        </div>
      </div>
    </section>
  );
}
