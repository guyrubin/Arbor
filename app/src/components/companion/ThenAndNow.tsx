import React, { useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import type { Observation } from "../../lib/observations";
import { SHELF_IDS, shelfDef, shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { shelfWordsThenNow, type DatedWords } from "../../lib/today/shelfWords";
import type { BehaviorLog } from "../../types";
import { THEN_NOW_COPY } from "./nowV41Copy";
import "./nowV41.css";

/* ════════════════════════════════════════════════════════════════════════════
   v4.1 Then and now — on My child, under the portrait cards.

   For each shelf, the parent's own words (B-LOOP-07 shelfWordsThenNow): the
   newest note, and the newest one written at least seven days before it. Only
   shelves that hold both are shown, newest first, at most three. Each sentence
   carries its date ("This week" when the note is from the last seven days).
   FIREWALL: quoted and dated, nothing computed or compared, no verdict on
   which sentence is better. A shelf with one note, or none, is not shown.
   ════════════════════════════════════════════════════════════════════════════ */

const SHOWN = 3;
const WEEK_MS = 7 * 86_400_000;

export interface ThenNowPair {
  shelf: ShelfId;
  then: DatedWords;
  now: DatedWords;
}

/** The shelves whose notes have both a then and a now, newest now first. */
export function thenAndNowPairs(
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf" | "at">>,
  logs: readonly BehaviorLog[],
): ThenNowPair[] {
  const pairs: ThenNowPair[] = [];
  for (const shelf of SHELF_IDS) {
    const { then, now } = shelfWordsThenNow(observations, logs, shelf);
    if (then && now) pairs.push({ shelf, then, now });
  }
  return pairs.sort((a, b) => Date.parse(b.now.at) - Date.parse(a.now.at)).slice(0, SHOWN);
}

export default function ThenAndNow({ observations, logs, now }: {
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf" | "at">>;
  logs: readonly BehaviorLog[];
  now: Date;
}) {
  const { t, uiLang } = useLanguage();
  const copy = THEN_NOW_COPY[uiLang === "he" ? "he" : "en"];
  const pairs = useMemo(() => thenAndNowPairs(observations, logs), [observations, logs]);
  if (pairs.length === 0) return null;
  const when = (words: DatedWords) => {
    const at = Date.parse(words.at);
    return now.getTime() - at <= WEEK_MS && at <= now.getTime() ? copy.thisWeek : fmtDay(words.at, uiLang);
  };
  return <section className="then-now arbor-fade" data-module="child-then-now" aria-labelledby="then-now-title">
    <header className="then-now-head">
      <h2 id="then-now-title">{copy.title}</h2>
      <p>{copy.sub}</p>
    </header>
    <ul className="then-now-pairs" role="list">
      {pairs.map((pair) => <li key={pair.shelf} className="then-now-pair" data-testid="then-now-pair" data-shelf={pair.shelf}
        style={{ "--then-now-ink": `var(--arbor-domain-${shelfDef(pair.shelf).domain}-ink)` } as React.CSSProperties}>
        <p className="then-now-area">{shelfLabel(pair.shelf, t)}</p>
        <p className="then-now-when">{when(pair.then)}</p>
        <q className="then-now-then" dir="auto">{pair.then.text}</q>
        <p className="then-now-when then-now-when-now">{when(pair.now)}</p>
        <q className="then-now-now" dir="auto">{pair.now.text}</q>
      </li>)}
    </ul>
  </section>;
}
