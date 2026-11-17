import React, { useRef, useState, type ReactNode } from "react";
import { Token, MoreLink, RouteHead, LivingForm } from "../../../design/primitives";
import Icon from "../../ui/Icon";
import type { Composition } from "../../../design/useComposition";
import { guideArtFor } from "../../../lib/guideArt";
import type { UiLang } from "../../../lib/i18n";
import type { WeekStepLine } from "../../../lib/weekReport";
import type { WeeklyCopy } from "./weeklyCopy";

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Stop 2 — What helped (canvas V77): the steps the parent rated this week, as
 * they reported them; beside them the words they used ("Send these words")
 * and one card to the week's hard moments in Hard moments, where each one sits
 * with what was tried. Then the child's own words. Only what the parent
 * recorded; a step "not this time" is a plain fact, never a mark against anyone.
 */
export default function WhatHelped({
  composition,
  copy,
  t,
  uiLang,
  locale,
  childFirst,
  hardCount,
  steps,
  heldWords,
  hasHeldWords,
  wordsDay,
  words,
  onPlans,
  onHardMoments,
}: {
  composition: Composition;
  copy: WeeklyCopy;
  t: T;
  uiLang: UiLang;
  locale: string;
  childFirst: string;
  /** Hard moments the parent logged this week (lib/weekInstrument). */
  hardCount: number;
  steps: readonly WeekStepLine[];
  /** WhatWorkedSend: the held sentences with "Send these words". */
  heldWords: ReactNode;
  hasHeldWords: boolean;
  /** The weekday the held words were used, when they all share one. */
  wordsDay?: string;
  /** The child's words kept this week. */
  words: readonly string[];
  onPlans: () => void;
  onHardMoments: () => void;
}) {
  const phone = composition === "phone";
  const helpedTimes = (n: number) => (n === 1 ? t("elev.wk.helped.once") : t("elev.wk.helped.times", { n }));
  const stepLine = (line: WeekStepLine) => {
    const parts: string[] = [];
    if (line.helped > 0) parts.push(`${helpedTimes(line.helped)} · ${line.helpedDays.map((ms) => new Date(ms).toLocaleDateString(locale, { weekday: "short", day: "numeric" })).join(", ")}`);
    // One "not this time" names its day (N-Week-D: "Not this time · Sun 15"); more keep the count.
    if (line.notThisTime === 1 && line.helped === 0) parts.push(copy.notThisTimeOn(new Date(line.latest).toLocaleDateString(locale, { weekday: "short", day: "numeric" })));
    else if (line.notThisTime > 0) parts.push(t("elev.wk.helped.not", { n: line.notThisTime }));
    return parts.join(" · ");
  };
  const art = guideArtFor("big-feelings", uiLang);

  /* Phone (N-Week-M): the newest step as the violet "Step you tried" card,
     the others in a sideways row under "Other steps you tried". */
  const [lead, ...rest] = steps;
  const [at, setAt] = useState(0);
  const othersRow = useRef<HTMLUListElement>(null);
  const onOthersScroll = () => {
    const el = othersRow.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    setAt(Math.min(rest.length - 1, Math.max(0, Math.round(Math.abs(el.scrollLeft) / (card.offsetWidth + 8)))));
  };
  const phoneSteps = lead ? (
    <>
      <article className={`wk-tr stp${lead.helped > 0 ? "" : " not"}`} data-testid="weekly-step" data-helped={lead.helped > 0 ? "" : undefined}>
        <Token kind="stp" state={lead.helped > 0 ? "solid" : "open"} size="md" label={lead.helped > 0 ? copy.tokenHelped : copy.tokenNot} />
        <div className="wk10-node-body">
          <span className="k">{copy.stepYouTried}</span>
          <bdi className="nx-q ds-said wk10-steptext" dir="auto">“{lead.step}”</bdi>
          <span className={`wk-out ${lead.helped > 0 ? "wk10-out-step" : "wk10-out-not"}`}>{stepLine(lead)}</span>
        </div>
      </article>
    </>
  ) : null;
  const phoneOthers = rest.length > 0 ? (
        <>
          <div className="line wk10-others-head">
            <span className="kicker wk10-others-k">{copy.otherSteps}</span>
            {rest.length > 1 && (
              <>
                <span className="sdots" aria-hidden="true">
                  {rest.map((_, i) => (
                    <i key={i} className={i === at ? "on" : undefined} />
                  ))}
                </span>
                <span className="small" aria-live="polite">{copy.readOf(at + 1, rest.length)}</span>
              </>
            )}
          </div>
          <ul className="wk10-srs ds-snap-scroll" data-testid="weekly-steps" ref={othersRow} onScroll={onOthersScroll}>
            {rest.map((line) => (
              <li key={line.step} className={`wk-sr${line.helped > 0 ? "" : " not"}`} data-testid="weekly-step" data-helped={line.helped > 0 ? "" : undefined}>
                <Token kind="stp" state={line.helped > 0 ? "solid" : "open"} size="md" label={line.helped > 0 ? copy.tokenHelped : copy.tokenNot} />
                <span>
                  <bdi className="nx-q ds-said wk10-steptext" dir="auto">“{line.step}”</bdi>
                  <span className={`wk-out ${line.helped > 0 ? "wk10-out-step" : "wk10-out-not"}`}>{stepLine(line)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
  ) : null;

  const stepsList = steps.length > 0 ? (
    <ul className={phone ? "wk10-srs ds-snap-scroll" : "wk10-srs"} data-testid="weekly-steps">
      {steps.map((line) => (
        <li key={line.step} className={`wk-sr${line.helped > 0 ? "" : " not"}`} data-testid="weekly-step" data-helped={line.helped > 0 ? "" : undefined}>
          <Token kind="stp" state={line.helped > 0 ? "solid" : "open"} size="md" label={line.helped > 0 ? copy.tokenHelped : copy.tokenNot} />
          <span>
            <bdi className="nx-q ds-said wk10-steptext" dir="auto">“{line.step}”</bdi>
            <span className={`wk-out ${line.helped > 0 ? "wk10-out-step" : "wk10-out-not"}`}>{stepLine(line)}</span>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    !hasHeldWords && hardCount === 0 && <p className="wk10-note">{t("elev.wk.helped.none")}</p>
  );

  const side = (
    <div className="stack wk10-helped-side">
      {hasHeldWords && (
        phone ? (
          /* N-Week-M: the words card leads with a music-note glyph tile (decor). */
          <article className={`wk-tr words wk10-words${wordsDay ? " dayed" : ""}`} data-testid="weekly-thread-words">
            <span className="wk-tw" aria-hidden="true" data-testid="weekly-words-glyph">
              <Icon name="music_note" size={15} />
            </span>
            <div className="wk10-node-body">
              <span className="k">{wordsDay ? copy.wordsYouUsedOn(wordsDay) : copy.wordsYouUsed}</span>
              {heldWords}
            </div>
          </article>
        ) : (
          <article className={`wk-node words wk10-words${wordsDay ? " dayed" : ""}`} data-testid="weekly-thread-words">
            <span className="k">{wordsDay ? copy.wordsYouUsedOn(wordsDay) : copy.wordsYouUsed}</span>
            {heldWords}
          </article>
        )
      )}
      {hardCount > 0 && (
        <button type="button" className="nx-co wk10-linkcard" data-testid="weekly-hard-card" onClick={onHardMoments}>
          {art && <LivingForm src={art.src} srcSet={art.srcSet} width={52} height={35} crop={{ w: 123.6, h: 69.5, x: -66.7, y: -18.3 }} />}
          <span className="ct">
            <b>{t("nav.view.behaviors")}</b>
            {copy.hardCardSub}
          </span>
          <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
        </button>
      )}
      {words.length > 0 && (
        <section className="wk10-words-kept" data-testid="weekly-words" aria-label={copy.childWords(childFirst)}>
          <span className="kicker">{copy.childWords(childFirst)}</span>
          <ul className="wk10-chips">
            {words.map((w) => (
              <li key={w} dir="auto"><bdi>{t("elev.wk.words.quote", { phrase: w })}</bdi></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  return (
    <div data-testid="weekly-what-helped" className="wk10-helped">
      <RouteHead id="wk-helped-title" title={copy.stopHelped} sub={copy.helpedSub} link={<MoreLink onClick={onPlans}>{t("nav.pill.plans")}</MoreLink>} />
      {phone ? (
        <div className="stack wk10-next-stack">
          {/* N-Week-M order: the step you tried, the words you used, Hard moments, then the other steps. */}
          {lead ? phoneSteps : stepsList}
          {side}
          {lead && phoneOthers}
        </div>
      ) : (
        <div className="g12">
          <div className="x8">{stepsList}</div>
          <div className="x4">{side}</div>
        </div>
      )}
    </div>
  );
}
