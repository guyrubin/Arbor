import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { AiBlock } from "../ui/AiBlock";
import { Modal } from "../ui/Modal";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { cardCls } from "../ui/kit";
import { renderSayThis, type HardMomentCard, type HardMomentCategory } from "../../content/hardMomentCards";
import { HARD_MOMENT_CATEGORIES, buildHardMomentSeedPrompt, escalationText, locText } from "../../content/hardMomentSurface";
import { availableHardMomentCards } from "../../content/selectCards";
import { hardMomentPublication, type HardMomentContext } from "../../content/pilotRelease";
import { hardMomentAgeFit, explainsEmptyHardMoments } from "../../content/hardMomentAgeFit";
import HardMomentAgeNotice from "./HardMomentAgeNotice";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import { matchLearnCards } from "../../learn/learnLibrary";
import { LEARN_CARDS } from "../../learn/learnCards";
import { ageMonthsFromProfile, ageYearsFromProfile } from "../../lib/childAge";

/** Renderable without a provider; also independently enforces the release policy. */
export function HardMomentGuideContent({ card, context, childName, t }: {
  card: HardMomentCard;
  context: HardMomentContext;
  childName?: string;
  t: (key: string) => string;
}) {
  const publication = hardMomentPublication(card, context);
  if (!publication) return null;
  const { locale } = context;
  const copy = hardMomentPilotText(locale);
  const sections = [
    ["hm.section.doNow", locText(card.doNow, locale)],
    ["hm.section.sayThis", locText(renderSayThis(card, childName), locale)],
    ["hm.section.avoid", locText(card.avoid, locale)],
    ["hm.section.observe", locText(card.observe, locale)],
  ];
  return (
    <div lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className="min-w-0 space-y-3 text-start">
      {publication === "editorial-pilot" && (
        <div className="text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }} role="note">
          <p className="font-bold">{copy.status}</p>
          <p>{copy.explanation}</p>
        </div>
      )}
      <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>
        {copy.ageLabel} <bdi>{card.ageBands.join(", ")}</bdi> {copy.years}
      </p>
      {/* AI-17: the per-axis section is the shared AiBlock guide tone. This
          file used to hand-roll a third copy of the coach answer's frame. */}
      {sections.map(([key, text]) => (
        <AiBlock key={key} tone="guide" title={t(key)} tint="var(--arbor-green-ink)">
          <p className="mt-1 break-words text-base leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{text}</p>
          {key === "hm.section.sayThis" && <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{copy.sayThisNote}</p>}
        </AiBlock>
      ))}
      <div className="min-w-0 rounded-xl p-4" role="note" data-testid="hard-moment-escalation"
        style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule-strong)",
          borderInlineStart: "3px solid var(--arbor-green-ink)" }}>
        <h4 className="text-xs font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.section.escalation")}</h4>
        <p className="mt-1 break-words text-base leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{escalationText(card, locale)}</p>
      </div>
      <details className="min-w-0 text-sm" style={{ color: "var(--arbor-ink-soft)" }}>
        <summary className="min-h-11 cursor-pointer py-3 font-semibold">{copy.sources}</summary>
        <ul className="space-y-1">
          {card.evidenceRefs.filter((ref) => ref.startsWith("https://")).map((ref) => (
            <li key={ref}><a href={ref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 max-w-full items-center break-all py-2 underline">{new URL(ref).hostname}</a></li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/** Contextual catalog: select by ID again when a sheet or action is used. */
export default function HardMomentsSection() {
  const { childProfile, seedCoach, requestLearnRead } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const [category, setCategory] = useState<HardMomentCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const locale = uiLang === "he" ? "he" : "en";
  const contextFor = (lang: "en" | "he" = locale): HardMomentContext => {
    const now = new Date();
    return { locale: lang, now, ageMonths: ageMonthsFromProfile(childProfile, now) };
  };
  const context = contextFor();
  const cards = availableHardMomentCards(context);
  const openCard = cards.find((card) => card.id === selectedId);
  const childFirst = (childProfile.name || "").split(" ")[0];
  const copy = hardMomentPilotText(locale);
  const categories = HARD_MOMENT_CATEGORIES.filter((value) => cards.some((card) => card.category === value));
  const activeCategory = category === "all" || categories.includes(category) ? category : "all";
  const visible = activeCategory === "all" ? cards : cards.filter((card) => card.category === activeCategory);

  // WAVE-G · THE AGE GAP — an empty list caused by the child's AGE explains
  // itself; the guides are written for a bounded range and the gate is
  // fail-closed, so a younger/older child matched nothing and got a blank
  // feature. The notice renders only when guides exist for SOME age (see
  // hardMomentAgeFit): a withdrawn or expired pack still renders nothing.
  const ageVerdict = hardMomentAgeFit(context);
  if (cards.length === 0 && explainsEmptyHardMoments(ageVerdict.fit)) {
    return <HardMomentAgeNotice verdict={ageVerdict} uiLang={uiLang} childName={childFirst} />;
  }
  if (cards.length === 0) return null;
  const hasPilot = cards.some((card) => hardMomentPublication(card, context) === "editorial-pilot");

  return (
    <section lang={locale} dir={locale === "he" ? "rtl" : "ltr"} className={`${cardCls} min-w-0 p-5 space-y-4 text-start`} aria-labelledby="hard-moments-title" data-testid="hard-moments-section">
      <div className="min-w-0">
        <h3 id="hard-moments-title" className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--arbor-ink)" }}>{t("hm.title")}</h3>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--arbor-ink-soft)" }}>{t("hm.sub")}</p>
        {hasPilot && <p className="mt-2 text-xs font-semibold" style={{ color: "var(--arbor-green-ink)" }}>{copy.status}</p>}
      </div>
      {/* Persistent live region: mounting a role="status" together with its
          text is routinely dropped by NVDA/JAWS/VoiceOver. Only the text swaps. */}
      <p role="status" aria-live="polite" className="text-sm" style={{ color: "var(--arbor-ink)" }}>
        {selectedId && !openCard ? copy.unavailable : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("hm.categoriesAria")}>
        {(["all", ...categories] as (HardMomentCategory | "all")[]).map((value) => (
          <button key={value} type="button" onClick={() => setCategory(value)} aria-pressed={value === activeCategory}
            className="min-h-11 min-w-11 rounded-full px-3.5 text-sm font-semibold transition"
            style={value === activeCategory
              // Selected state must not rest on hue alone (1.4.1) or on a
              // 1.01:1 border (1.4.11): green-ink reads 7.19:1 on both fills.
              ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", fontWeight: 700 }
              : { background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink-soft)", border: "1px solid var(--arbor-rule)" }}>
            {value === "all" ? t("hm.cat.all") : t(`hm.cat.${value}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visible.map((card) => (
          <button key={card.id} type="button" onClick={() => setSelectedId(card.id)}
            className="flex min-h-[52px] min-w-0 items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-start transition"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
            <span className="min-w-0">
              <span className="block break-words text-base font-bold" style={{ color: "var(--arbor-ink)" }}>{locText(card.title, locale)}</span>
              <span className="mt-1 block text-xs" style={{ color: "var(--arbor-green-ink)" }}>{t(`hm.cat.${card.category}`)}</span>
            </span>
            <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:-scale-x-100" style={{ color: "var(--arbor-green-ink)" }} />
          </button>
        ))}
      </div>
      <Modal open={!!openCard} onClose={() => setSelectedId(null)} title={openCard ? locText(openCard.title, locale) : undefined}>
        {openCard && (
          <div className="min-w-0 space-y-3" lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
            <HardMomentGuideContent card={openCard} context={context} childName={childFirst} t={t} />
            <button type="button" onClick={() => {
              const aiContext = contextFor(aiLang === "he" ? "he" : "en");
              const current = availableHardMomentCards(aiContext).find((card) => card.id === selectedId);
              if (!current) { setSelectedId(null); return; }
              const prompt = buildHardMomentSeedPrompt(current, aiContext.locale, childFirst, aiContext);
              if (prompt) seedCoach({ prompt, source: "hard-moment-card" });
              setSelectedId(null);
            }}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
              // rule-strong is a divider token (1.17:1 on white) and cannot
              // carry a control boundary; green-ink is 7.19:1.
              style={{ color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}>
              <Icon name="forum" size={16} /> {t("hm.talkThrough")}
            </button>
            {(() => {
              const read = matchLearnCards(LEARN_CARDS, { concerns: openCard.concerns, ageYears: ageYearsFromProfile(childProfile) }, 1)[0];
              if (!read) return null;
              return <button type="button" onClick={() => {
                if (!availableHardMomentCards(contextFor()).some((card) => card.id === selectedId)) { setSelectedId(null); return; }
                requestLearnRead({ cardId: read.id, source: "hard-moment-card" });
                setSelectedId(null);
              }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition"
                style={{ color: "var(--arbor-lav-ink)", border: "1px solid var(--arbor-lav-ink)", background: "var(--arbor-lav-soft)" }}>
                <Icon name="local_library" size={16} /> {t("learn.understandWhy")}
              </button>;
            })()}
          </div>
        )}
      </Modal>
    </section>
  );
}
