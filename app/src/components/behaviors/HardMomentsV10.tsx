import { Icon } from "../ui/Icon";
import { LivingForm } from "../../design/primitives";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { renderSayThis } from "../../content/hardMomentCards";
import { locText } from "../../content/hardMomentSurface";
import { hardMomentPublication } from "../../content/pilotRelease";
import { startConversationVoice } from "../../lib/companionConversation";
import { fmtDayV10 } from "../../lib/formatDate";
import { MOMENTS_V10_COPY } from "../moments/momentsV10Copy";
import { SendWordsButton } from "./HardMomentWords";
import { useHardMomentShelf } from "./HardMomentsSection";
import { hardMomentFace } from "./hardMomentArt";

/**
 * N-Hard (v10.3) — the page's own parts of the hard-moment shelf, read from
 * the same state as the section (useHardMomentShelf):
 *
 *  · HardMomentLastTimeCard — the stage's "Last time, this helped": the
 *    remembered words (the parent's held answer, or words a logged moment
 *    names), the guide's when / with-it line, Talk it through (the sheet's
 *    own voice hand-off) and Send these words. Nothing renders without one.
 *  · HardMomentGuides — section 3, "Closest to what you have been noting":
 *    the resting three as guide cards with their Living Forms face, and the
 *    door to every guide (a disclosure, never a filter).
 */
export function HardMomentLastTimeCard({ phone }: { phone: boolean }) {
  const { setAskHardMomentRef } = useArbor();
  const { user } = useAuth();
  const { openHardMomentNow, t, uiLang, locale, childFirst, held } = useHardMomentShelf();
  if (!held) return null;
  const hc = MOMENTS_V10_COPY[uiLang === "he" ? "he" : "en"].hard;
  const { card } = held;
  const sentence = locText(renderSayThis(card, childFirst), locale);
  const parentFirst = (user?.displayName || t("nav.parent")).split(" ")[0];
  const talk = () => {
    // The sheet's own hand-off: the card rides as a reference, Arbor says its words first.
    setAskHardMomentRef(card.id);
    startConversationVoice({ source: "hard-moment", opening: sentence });
  };
  return (
    <div data-testid="hm-last-time-row" className="hm-last" lang={locale} dir={locale === "he" ? "rtl" : "ltr"}>
      <section data-testid="hm-last-time" data-basis={held.basis} className="hm-last-h">
        <span className="gi hard" aria-hidden="true"><Icon name="favorite" size={16} /></span>
        <h3 className="h3">{held.basis === "used" ? hc.lastUsed : hc.lastTime}</h3>
        <span className="small nowrap">{fmtDayV10(held.at, locale)}</span>
      </section>
      <button type="button" data-testid="hm-last-time-open" className="hm-last-q" onClick={() => openHardMomentNow(card.id)}>
        <span data-testid="hm-last-time-words" className="q"><bdi>“{sentence}”</bdi></span>
        <span className="by">{hc.wordsKept}</span>
      </button>
      <p className="hm-last-w">
        <bdi>{t("hm.send.when", { when: locText(card.title, locale) })}</bdi>{" · "}<bdi>{t("hm.send.with", { doNow: locText(card.doNow, locale) })}</bdi>
      </p>
      <div className={phone ? "hm-last-acts m" : "hm-last-acts"}>
        <button type="button" data-testid="hm-last-time-talk" className="btn sm grow nowrap tint-btn" onClick={talk}>
          <Icon name="graphic_eq" size={16} />{t("hm.first.talk")}
        </button>
        <SendWordsButton card={card} locale={locale} parentName={parentFirst} childName={childFirst} t={t} inRow />
      </div>
    </div>
  );
}

export function HardMomentGuides({ phone }: { phone: boolean }) {
  const { openHardMomentNow, t, uiLang, locale, setCategory, expanded, setExpanded, context, cards, childFirst, copy,
    categories, activeCategory, matched, featured, visible } = useHardMomentShelf();
  if (cards.length === 0) return null;
  const hasPilot = cards.some((card) => hardMomentPublication(card, context) === "editorial-pilot");
  const hc = MOMENTS_V10_COPY[uiLang === "he" ? "he" : "en"].hard;
  const toggle = () => { setExpanded((v) => !v); if (expanded) setCategory("all"); };
  const door = cards.length > featured.length && (
    <button type="button" data-testid="hard-moments-door" aria-expanded={expanded} onClick={toggle} className="ds-link nowrap">
      {expanded ? t("elev.closeloop.hm.fewer") : t("elev.closeloop.hm.allGuides", { n: cards.length })}
      <Icon name={expanded ? "expand_less" : "chevron_right"} size={16} className={expanded ? undefined : "rtl:-scale-x-100"} />
    </button>
  );
  return (
    <section data-testid="hard-moments-section" className="hm-guides" lang={locale} dir={locale === "he" ? "rtl" : "ltr"} aria-labelledby="hard-moments-title">
      <div className="rhead">
        <h3 id="hard-moments-title" className="h3">{matched.length > 0 && !expanded ? t("elev.closeloop.hm.matched") : t("hm.title")}</h3>
        {!phone && <span className="small">{hc.guidesSub}</span>}
        {!phone && door}
      </div>
      {expanded && (
        <div className="hm-cats" role="group" aria-label={t("hm.categoriesAria")}>
          {(["all", ...categories] as const).map((value) => (
            <button key={value} type="button" className="kchip" aria-pressed={value === activeCategory} onClick={() => setCategory(value)}>
              {value === "all" ? t("hm.cat.all") : t(`hm.cat.${value}`)}
            </button>
          ))}
        </div>
      )}
      <div data-testid="hard-moment-tiles" data-layout={expanded ? "grid" : "row"} className={phone ? "hm-gcards m" : "hm-gcards"}>
        {visible.map((card) => {
          const face = hardMomentFace(card.category, 64);
          return (
            <button key={card.id} type="button" data-testid="hard-moment-tile" className="gcard" onClick={() => openHardMomentNow(card.id)}>
              <LivingForm src={face.src} width={face.width} height={face.height} crop={face.crop} />
              <span className="gct">
                <b dir="auto">{locText(card.title, locale)}</b>
                <small>{t(`hm.cat.${card.category}`)}</small>
              </span>
              <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
            </button>
          );
        })}
      </div>
      {phone && (
        <div className="hm-guides-foot">
          <span className="small">{hc.guidesSub}</span>
          {door}
        </div>
      )}
      <p data-testid="hard-moments-chosen" className="small" dir="auto">{t("hm.chosenFor", { name: childFirst })}{hasPilot ? ` · ${copy.status}` : ""}</p>
    </section>
  );
}
