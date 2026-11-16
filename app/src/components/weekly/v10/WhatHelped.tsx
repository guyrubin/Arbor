import React, { type ReactNode } from "react";
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
    if (line.notThisTime > 0) parts.push(t("elev.wk.helped.not", { n: line.notThisTime }));
    return parts.join(" · ");
  };
  const art = guideArtFor("big-feelings", uiLang);

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
        <article className="wk-node words wk10-words" data-testid="weekly-thread-words">
          <span className="k">{copy.wordsYouUsed}</span>
          {heldWords}
        </article>
      )}
      {hardCount > 0 && (
        <button type="button" className="nx-co wk10-linkcard" data-testid="weekly-hard-card" onClick={onHardMoments}>
          {art && <LivingForm src={art.src} srcSet={art.srcSet} width={52} height={35} crop={{ w: 123.6, h: 69.5, x: -66.7, y: -18.3 }} />}
          <span className="ct">
            <b>{copy.hardCard(hardCount)}</b>
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
          {stepsList}
          {side}
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
