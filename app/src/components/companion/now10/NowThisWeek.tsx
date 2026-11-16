import React, { useMemo } from "react";
import type { Composition } from "../../../design/useComposition";
import { Fig, LivingForm, Tile } from "../../../design/primitives";
import Icon from "../../ui/Icon";
import { WEEK_ORDER, weekGlance, type WeekCountKey } from "../../../lib/weekGlance";
import { recapWeekStartMs } from "../../../hooks/useWeeklyRecap";
import type { Observation } from "../../../lib/observations";
import type { ActionLoopEntry } from "../../../actionLoop/model";
import type { NowV10Copy } from "./nowV10Copy";

/** A token's kind on the strip: the parent's records leaf-shaped, steps square, Kid Mode its own. */
const TOKEN_CLASS: Record<WeekCountKey, string> = { moments: "tok moment", helped: "tok stp", milestones: "tok moment", words: "tok moment", kid: "tok kid" };
const DAY_CAP = 5;
const WEEK_MS = 7 * 86_400_000;

/**
 * Now v10.1 › stop 3 "This week" (O-WeekObjects, the compact strip only):
 * the report week's counts as figures, then one column per day where each mark
 * is one thing the parent recorded, piled up from the band. The full ribbon
 * and its legend live on Weekly report (one home per object); this is one
 * line and a link. Counts only (lib/weekGlance): no share, no score, a zero
 * count is not drawn, a quiet day is simply an empty column.
 */
export default function NowThisWeek({ composition, observations, actionLoop, now, lang, copy, title, labels, emptyLine, reportLabel, onReport, titleId, children }: {
  composition: Composition;
  observations: readonly Observation[];
  actionLoop: readonly Pick<ActionLoopEntry, "outcome" | "outcomeAt">[];
  now: Date;
  lang: "en" | "he";
  copy: NowV10Copy;
  /** The tile's heading: production's "This week so far". */
  title: string;
  /** Production's names of the five counts (nowViewCopy). */
  labels: Record<WeekCountKey, string>;
  emptyLine: string;
  reportLabel: string;
  onReport: () => void;
  titleId: string;
  /** What changed since the last visit: lines under the strip. */
  children?: React.ReactNode;
}) {
  const desk = composition === "desk";
  const weekStartMs = recapWeekStartMs(now);
  const week = useMemo(() => weekGlance({ observations, actionLoop, now, weekStartMs }), [observations, actionLoop, now, weekStartMs]);
  const locale = lang === "he" ? "he-IL" : "en-GB";
  const first = new Date(week.perDay[0].startMs);
  const last = new Date(week.perDay[6].startMs);
  const range = copy.weekRange(
    first.toLocaleDateString(locale, { weekday: "short", day: "numeric" }),
    last.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" }),
  );
  const tiles = WEEK_ORDER.filter((key) => week.counts[key] > 0).slice(0, desk ? 4 : 2);
  const rest = desk ? [] : WEEK_ORDER.filter((key) => week.counts[key] > 0).slice(2, 4);
  const done = Math.min(100, Math.max(0, ((now.getTime() - weekStartMs) / WEEK_MS) * 100));
  const link = <button type="button" className="ds-link" data-testid="now-week-report" onClick={onReport}>{reportLabel}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" /></button>;
  const figs = (keys: WeekCountKey[]) => keys.map((key) => <Fig key={key} size="md" n={week.counts[key]} unit={labels[key]} className={`now-week-${key}`} />);
  const body = tiles.length ? <>
    <div className="nw-week-figs">
      {figs(tiles)}
      {desk && <span className="grow" />}
      {desk && <LivingForm src="/visuals/parent/v2/empty-weekly-480.webp" width={132} height={60} crop={{ w: 168.5, h: 112.3, x: -18.3, y: -28.4 }} style={{ marginBottom: -4 }} />}
    </div>
    {rest.length > 0 && <div className="nw-week-figs">{figs(rest)}</div>}
  </> : <p className="nw-week-empty" data-testid="now-week-empty">{emptyLine}</p>;
  const strip = <div className="wk7" style={{ ["--done" as string]: `${done.toFixed(0)}%`, gap: desk ? 6 : 4 }} role="img" aria-label={copy.weekStripAria}>
    {week.perDay.map((day, index) => {
      const date = new Date(day.startMs);
      const marks: Array<{ cls: string; label: string }> = [];
      for (const key of WEEK_ORDER) for (let i = 0; i < day[key]; i += 1) marks.push({ cls: TOKEN_CLASS[key], label: copy.tok[key] });
      if (day.outcome === "not-this-time") marks.push({ cls: "tok stp open", label: copy.tok.notThisTime });
      const shown = marks.slice(0, DAY_CAP);
      const state = index === week.today ? "wd today" : index > week.today ? "wd future" : "wd";
      return <div key={day.startMs} className={state}>
        <span className="dh">{date.toLocaleDateString(locale, { weekday: desk ? "short" : "narrow" })}<b>{date.getDate()}</b></span>
        <div className="col nw-col">
          <span className="pile">{shown.map((m, i) => <i key={i} className={desk ? `${m.cls} md` : m.cls} />)}</span>
          {marks.length > DAY_CAP && <span className="nw-more">+{marks.length - DAY_CAP}</span>}
        </div>
      </div>;
    })}
  </div>;
  return desk ? <Tile icon="calendar_month" title={title} sub={range} link={link} className="x8 nw-week" titleId={titleId} >
    {body}
    {strip}
    {children}
  </Tile> : <div className="nw-week-phone">
    <div className="rhead"><h2 className="h3" id={titleId}>{title}</h2><span className="small">{range}</span>{link}</div>
    <section className="vt nw-week" aria-labelledby={titleId}>
      {body}
      {strip}
      {children}
    </section>
  </div>;
}
