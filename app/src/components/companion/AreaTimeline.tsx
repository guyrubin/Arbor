import React, { useMemo } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Token } from "../../design/primitives";
import type { Composition } from "../../design/useComposition";
import type { DomainId } from "../../lib/domains/registry";
import { milestoneText } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { shelvesOfDomain } from "../../lib/shelves/registry";
import type { Milestone } from "../../types";
import { NOTICE_ANSWER_KEYS } from "../loop/NoticeCard";
import { milestonesV10Copy } from "./milestonesV10Copy";
import { fmtDayV10 } from "../../lib/formatDate";

/**
 * v10.1 (canvas V76/V77) — the open area's dated line on My child ›
 * Milestones, calendar-true: the axis is real weeks (one column per day, the
 * weeks shaded in turn), each skill the parent marked Seen it sits on the day
 * it was marked, the days between two marks are written between them, and
 * today closes the line. Under it, one card per mark (its day and its words),
 * the newest named. A row above counts what is here: how many, the first day,
 * the latest day and how long ago. Phone: the same marks as a dated list,
 * each with the days since the one before.
 *
 * Only dated Seen-it answers appear (observationUpdatedAt); a Not yet / Not
 * sure answer or an undated tick is never drawn. With nothing dated the weeks
 * are drawn empty with production's "No record yet": a missing date is
 * unknown, never a gap to fill. Counts and days only; nothing is compared.
 */
export interface AreaTimelineProps {
  domain: DomainId;
  milestones: readonly Milestone[];
  composition: Composition;
  gender?: string | null;
  /** The clock "today" reads (tests pin it). */
  nowMs?: number;
}

/** At most this many marks (the newest); every one is still in the area below. */
const MAX_LEAVES = 5;
/** The fewest weeks the axis shows, so a first mark still reads as a place in time. */
const MIN_WEEKS = 6;
const DAY_MS = 86_400_000;

/** The area's dated Seen-it skills, oldest first, the newest MAX_LEAVES. Pure. */
export function areaLeaves(milestones: readonly Milestone[], domain: DomainId, nowMs: number): Milestone[] {
  const byShelf = groupMilestonesByShelf([...milestones]);
  const seen = shelvesOfDomain(domain)
    .flatMap((shelf) => byShelf[shelf])
    .filter((m) => (m.checked === true || m.observationStatus === "yes") && typeof m.observationUpdatedAt === "string")
    .filter((m) => {
      const ms = Date.parse(m.observationUpdatedAt!);
      return Number.isFinite(ms) && ms <= nowMs;
    })
    .sort((a, b) => Date.parse(a.observationUpdatedAt!) - Date.parse(b.observationUpdatedAt!));
  return seen.slice(-MAX_LEAVES);
}

/** Local midnight of a moment. */
const dayStart = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
/** Whole local days from a to b (DST-safe: rounds the hour drift away). */
export const daysBetween = (a: number, b: number) => Math.round((dayStart(b) - dayStart(a)) / DAY_MS);

/**
 * The calendar the axis draws: the first day (a week start), the number of
 * days to today inclusive, and each mark's day index. Pure.
 * Weeks start on Monday in English and on Sunday in Hebrew.
 */
export function timelineCalendar(markMs: readonly number[], nowMs: number, weekStartsOn: 0 | 1) {
  const today = dayStart(nowMs);
  const earliest = markMs.length > 0 ? Math.min(dayStart(markMs[0]), today) : today;
  const floor = today - (MIN_WEEKS * 7 - 1) * DAY_MS;
  let start = Math.min(earliest, floor);
  const back = (new Date(start).getDay() - weekStartsOn + 7) % 7;
  start = dayStart(start - back * DAY_MS + DAY_MS / 2);
  const days = daysBetween(start, today) + 1;
  return { start, days, marks: markMs.map((ms) => daysBetween(start, ms)) };
}

export default function AreaTimeline({ domain, milestones, composition, gender = null, nowMs }: AreaTimelineProps) {
  const { t, uiLang } = useLanguage();
  const copy = milestonesV10Copy(uiLang);
  const seenIt = t(NOTICE_ANSWER_KEYS.yes);
  const now = nowMs ?? Date.now();
  const locale = uiLang === "he" ? "he-IL" : "en-GB";
  const leaves = useMemo(
    () => areaLeaves(milestones, domain, now).map((m) => ({ id: m.id, title: milestoneText(m, "title", t, { gender }), at: m.observationUpdatedAt!, ms: Date.parse(m.observationUpdatedAt!) })),
    [milestones, domain, now, t, gender],
  );
  const day = (ms: number) => fmtDayV10(ms, uiLang === "he" ? "he" : "en", new Date(now));
  const short = (ms: number) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(ms));
  const days = (n: number) => (n === 1 ? copy.dayOne : copy.daysMany.replace("{n}", String(n)));

  const stats = leaves.length > 0 ? (
    <p className="ms-tl-stats" data-testid="area-timeline-stats">
      <span><b className="arbor-num">{leaves.length}</b> {copy.seenHere}</span>
      <span>{copy.first} <b><time dateTime={leaves[0].at}>{day(leaves[0].ms)}</time></b></span>
      <span>
        {copy.latest} <b><time dateTime={leaves[leaves.length - 1].at}>{day(leaves[leaves.length - 1].ms)}</time></b>
        {" · "}{daysBetween(leaves[leaves.length - 1].ms, now) === 0 ? copy.today : copy.daysAgo.replace("{n}", days(daysBetween(leaves[leaves.length - 1].ms, now)))}
      </span>
    </p>
  ) : null;

  if (composition !== "desk") {
    if (leaves.length === 0) return <p className="ms-tl-none" data-testid="area-timeline-none">{t("companion.devMap.none")}</p>;
    return (
      <ol className="ms-tl-list" data-testid="area-timeline">
        {leaves.map((leaf, i) => (
          <li key={leaf.id} data-testid="area-timeline-leaf" className={i === leaves.length - 1 ? "new" : undefined}>
            <span aria-hidden="true"><Token kind="moment" size="md" label={seenIt} isNew={i === leaves.length - 1} /></span>
            <span>
              <b dir="auto">{leaf.title}</b>
              <span className="ms-tl-when">
                <time dateTime={leaf.at}>{day(leaf.ms)}</time>
                {" · "}
                {i === 0 ? copy.firstOne : copy.daysAfter.replace("{n}", days(daysBetween(leaves[i - 1].ms, leaf.ms)))}
              </span>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  const cal = timelineCalendar(leaves.map((l) => l.ms), now, uiLang === "he" ? 0 : 1);
  const weeks = Math.ceil(cal.days / 7);
  const col = (index: number) => ({ gridColumn: `${index + 1} / span 1` });
  return (
    <div className="ms-tl-wrap">
      {stats}
      <div className="ms-tl" data-testid="area-timeline" role="list" aria-label={copy.timelineLabel} style={{ gridTemplateColumns: `repeat(${cal.days}, minmax(0, 1fr))` }}>
        {Array.from({ length: weeks }, (_, w) => (
          <React.Fragment key={w}>
            <span className={`ms-tl-week${w % 2 ? "" : " shade"}`} aria-hidden="true" style={{ gridColumn: `${w * 7 + 1} / span ${Math.min(7, cal.days - w * 7)}` }} />
            {cal.days - w * 7 >= 3 && <span className="ms-tl-wk" aria-hidden="true" style={{ gridColumn: `${w * 7 + 1} / span ${Math.min(7, cal.days - w * 7)}` }}>{short(cal.start + w * 7 * DAY_MS + DAY_MS / 2)}</span>}
          </React.Fragment>
        ))}
        <span className="ms-tl-axis" aria-hidden="true" />
        <span className="ms-tl-today" data-testid="area-timeline-today" style={{ gridColumn: `${Math.max(1, cal.days - 6)} / ${cal.days + 1}` }}><i aria-hidden="true" /><span>{copy.today}</span></span>
        {leaves.length === 0 && <span className="ms-tl-empty" data-testid="area-timeline-none">{t("companion.devMap.none")}</span>}
        {leaves.map((leaf, i) => (
          <span key={leaf.id} className="ms-tl-leaf" style={col(cal.marks[i])} role="listitem" aria-label={`${seenIt}: ${leaf.title}, ${day(leaf.ms)}`} data-testid="area-timeline-leaf">
            <span aria-hidden="true"><Token kind="moment" size="md" label={seenIt} isNew={i === leaves.length - 1} /></span>
          </span>
        ))}
        {[...leaves.slice(1).map((leaf, i) => ({ key: leaf.id, from: cal.marks[i], to: cal.marks[i + 1] })), ...(leaves.length > 0 ? [{ key: "today", from: cal.marks[leaves.length - 1], to: cal.days - 1 }] : [])].map(({ key, from, to }) => {
          return to - from > 1 ? (
            <span key={`gap-${key}`} className="ms-tl-gap" aria-hidden="true" style={{ gridColumn: `${from + 2} / ${to + 1}` }}>{days(to - from)}</span>
          ) : null;
        })}
      </div>
      {leaves.length > 0 && (
        <ol className="ms-tl-cards" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${leaves.length}, minmax(0, 1fr))` }}>
          {leaves.map((leaf, i) => (
            <li key={leaf.id} className={i === leaves.length - 1 ? "new" : undefined}>
              <span className="ms-tl-cd"><time dateTime={leaf.at}>{day(leaf.ms)}</time>{i === leaves.length - 1 && <b>{copy.newest}</b>}</span>
              <span className="ms-tl-ct" dir="auto">{leaf.title}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
