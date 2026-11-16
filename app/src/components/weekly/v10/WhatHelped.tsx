import React, { type ReactNode } from "react";
import { Token, MoreLink, RouteHead } from "../../../design/primitives";
import Icon from "../../ui/Icon";
import type { Composition } from "../../../design/useComposition";
import type { WeekStepLine } from "../../../lib/weekReport";
import type { WeeklyCopy } from "./weeklyCopy";

/** The week's newest hard moment, as the parent logged it. */
export type WeekHardMoment = {
  id: string;
  ms: number;
  /** The parent's own words, or the kind they picked when they wrote none. */
  words: string;
  /** What the parent wrote they tried, when they wrote it. */
  tried: string;
  settled: boolean;
};

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Stop 2 — What helped (board object "thread"): the week's newest hard moment,
 * what the parent tried, and the words they used, joined by one line; then the
 * other steps the parent rated this week, and the child's own words. Only what
 * the parent recorded; nothing is inferred, and a step "not this time" is a
 * plain fact, never a mark against anyone.
 */
export default function WhatHelped({
  composition,
  copy,
  t,
  locale,
  childFirst,
  hard,
  steps,
  heldWords,
  hasHeldWords,
  words,
  onPlans,
}: {
  composition: Composition;
  copy: WeeklyCopy;
  t: T;
  locale: string;
  childFirst: string;
  hard: WeekHardMoment | null;
  steps: readonly WeekStepLine[];
  /** WhatWorkedSend: the held sentences with "Send these words". */
  heldWords: ReactNode;
  hasHeldWords: boolean;
  /** The child's words kept this week. */
  words: readonly string[];
  onPlans: () => void;
}) {
  const day = (ms: number) => new Date(ms).toLocaleDateString(locale, { weekday: "short", day: "numeric" });
  const clock = (ms: number) => new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false });
  const helpedTimes = (n: number) => (n === 1 ? t("elev.wk.helped.once") : t("elev.wk.helped.times", { n }));
  const stepLine = (line: WeekStepLine) => {
    const parts: string[] = [];
    if (line.helped > 0) parts.push(`${helpedTimes(line.helped)} · ${line.helpedDays.map((ms) => new Date(ms).toLocaleDateString(locale, { weekday: "short" })).join(", ")}`);
    if (line.notThisTime > 0) parts.push(t("elev.wk.helped.not", { n: line.notThisTime }));
    return parts.join(" · ");
  };
  const phone = composition === "phone";
  const hasThread = !!hard || hasHeldWords;

  const thread = hasThread && (
    <div className={phone ? "wk10-vt" : "wk10-thread"} data-testid="weekly-thread">
      {hard && (
        <article className={phone ? "wk-tr hard" : "wk-node hard"} data-testid="weekly-thread-hard">
          {phone && <Token kind="hard" size="md" label={copy.tokenHard} />}
          <div className="wk10-node-body">
            <div className="line wk10-node-kick">
              {!phone && <Token kind="hard" size="md" label={copy.tokenHard} />}
              <span className="k">{copy.hardKicker(day(hard.ms))}</span>
            </div>
            <p className="nx-q ds-said" dir="auto"><bdi>“{hard.words}”</bdi></p>
            <span className="wk-out wk10-out-hard">
              {clock(hard.ms)}
              {hard.settled && ` · ${copy.settled}`}
            </span>
          </div>
        </article>
      )}
      {hard?.tried && (
        <>
          {!phone && <span className="wk-link" aria-hidden="true"><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></span>}
          <article className={phone ? "wk-tr stp" : "wk-node stp"} data-testid="weekly-thread-tried">
            {phone && <Token kind="stp" size="md" label={copy.youTried} />}
            <div className="wk10-node-body">
              <div className="line wk10-node-kick">
                {!phone && <Token kind="stp" size="md" label={copy.youTried} />}
                <span className="k">{copy.youTried}</span>
              </div>
              <p className="nx-q ds-said" dir="auto"><bdi>“{hard.tried}”</bdi></p>
            </div>
          </article>
        </>
      )}
      {hasHeldWords && (
        <>
          {!phone && hard && <span className="wk-link" aria-hidden="true"><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></span>}
          <article className={phone ? "wk-tr words wk10-words" : "wk-node words"} data-testid="weekly-thread-words">
            <div className="wk10-node-body">
              <span className="k">{copy.wordsYouUsed}</span>
              {heldWords}
            </div>
          </article>
        </>
      )}
    </div>
  );

  const others = (
    <div className="stack wk10-others">
      {steps.length > 0 ? (
        <>
          <span className="kicker">{hasThread ? copy.otherSteps : t("elev.wk.helped.title")}</span>
          <ul className={phone ? "wk10-srs ds-snap-scroll" : "wk10-srs"}>
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
        </>
      ) : (
        !hasThread && <p className="wk10-note">{t("elev.wk.helped.none")}</p>
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
      <RouteHead
        id="wk-helped-title"
        title={copy.stopHelped}
        sub={copy.helpedSub}
        link={<MoreLink onClick={onPlans}>{t("nav.pill.plans")}</MoreLink>}
      />
      {phone ? (
        <>
          {thread}
          {others}
        </>
      ) : (
        <div className="g12">
          {hasThread ? <div className="x8">{thread}</div> : null}
          <div className={hasThread ? "x4" : "x12"}>{others}</div>
        </div>
      )}
    </div>
  );
}
