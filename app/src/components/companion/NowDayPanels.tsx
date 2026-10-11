import React, { useId, useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { childPicture } from "../../lib/childPicture";
import type { Observation, ObservationOrigin, ObservationSource } from "../../lib/observations";
import { dayKey } from "../../practice/signals";
import { Avatar } from "../ui/Avatar";
import Icon from "../ui/Icon";
import { NOW_COPY } from "./nowViewCopy";
import { PRACTICE_ACTIVITY_LABELS } from "./portraitEvidence";

/** Kid Mode's own records — what the child did, never the parent's notes. */
const KID_ORIGINS: ReadonlySet<ObservationOrigin> = new Set(["practiceEvents", "mimicSessions", "adventureResults", "missionRecords"]);
const PARENT_SOURCES: ReadonlySet<ObservationSource> = new Set(["parent_typed", "parent_voice", "ai_proposed_parent_confirmed"]);
const KID_ICON: Partial<Record<ObservationOrigin, string>> = { practiceEvents: "extension", mimicSessions: "mood", adventureResults: "explore", missionRecords: "flag" };
const KID_KIND: Partial<Record<ObservationOrigin, string>> = { practiceEvents: "practice", mimicSessions: "mimic", adventureResults: "adventure", missionRecords: "mission" };

const timeOf = (iso: string, he: boolean) => new Date(iso).toLocaleTimeString(he ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * v3 Now: "From {name}'s world today" — the child's own Kid Mode records from
 * today, as names and times only (no rounds scored, no levels). Hidden when
 * the child has not played today; nothing is invented to fill it.
 */
export function NowKidWorld({ observations, now, name, onAll }: {
  observations: readonly Observation[]; now: Date; name: string; onAll: () => void;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = NOW_COPY[he ? "he" : "en"];
  const id = useId();
  const today = dayKey(now);
  const tiles = useMemo(() => observations
    .filter(item => KID_ORIGINS.has(item.origin) && Number.isFinite(Date.parse(item.at)) && Date.parse(item.at) <= now.getTime() && dayKey(new Date(item.at)) === today)
    .sort((a, b) => a.at.localeCompare(b.at)), [observations, now, today]);
  if (!tiles.length) return null;
  const shown = tiles.slice(-4);
  const label = (item: Observation) => {
    const activity = item.value.type === "practice" ? item.value.activity : "";
    const named = item.origin === "practiceEvents" ? PRACTICE_ACTIVITY_LABELS[activity] : undefined;
    return named ? named[he ? 1 : 0] : t(`elev.childsignals.title.${KID_KIND[item.origin] ?? "practice"}.one`);
  };
  return <section className="now-world" aria-labelledby={`${id}-world`} data-testid="now-kid-world">
    <div className="now-world-head">
      <Avatar name={childProfile.name} photoURL={childPicture(childProfile).url} size={40} />
      <div><h2 id={`${id}-world`}>{copy.worldTitle(name)}</h2><p className="now-world-live"><span aria-hidden="true" />{copy.worldLatest(timeOf(tiles[tiles.length - 1].at, he))}</p></div>
    </div>
    <ol className="now-world-tiles">
      {shown.map((item, index) => <li key={item.id} className="now-world-tile">
        <span className={`now-world-glyph now-world-glyph-${index % 4}`} aria-hidden="true"><Icon name={item.value.type === "practice" && item.value.activity === "mood-checkin" ? "mood" : KID_ICON[item.origin] ?? "extension"} size={22} /></span>
        <span className="now-world-text"><time dateTime={item.at}>{timeOf(item.at, he)}</time><b>{label(item)}</b></span>
      </li>)}
    </ol>
    <button type="button" className="now-world-all" onClick={onAll}>{copy.worldAll}<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" /></button>
  </section>;
}

type WeekKey = "moments" | "helped" | "milestones" | "words" | "kid";
const WEEK_ORDER: readonly WeekKey[] = ["moments", "helped", "milestones", "words", "kid"];

/**
 * v3 Now: "This week so far" — counts of what was kept this report week (the
 * Weekly report's own week), day by day. Counts only: no %, no score, no
 * colour that judges; a zero category is simply not shown.
 */
export function NowWeekSoFar({ observations, now, onReport }: {
  observations: readonly Observation[]; now: Date; onReport: () => void;
}) {
  const { actionLoop = [] } = useArbor();
  const { uiLang } = useLanguage();
  const copy = NOW_COPY[uiLang === "he" ? "he" : "en"];
  const id = useId();
  const week = useMemo(() => {
    const start = recapWeekStartMs(now);
    const first = new Date(start);
    const days = Array.from({ length: 7 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i).getTime());
    const counts: Record<WeekKey, number> = { moments: 0, helped: 0, milestones: 0, words: 0, kid: 0 };
    const perDay = days.map(() => ({ moments: 0, helped: 0, milestones: 0, words: 0, kid: 0 } as Record<WeekKey, number>));
    const add = (key: WeekKey, iso?: string) => {
      const ms = Date.parse(iso ?? "");
      if (!Number.isFinite(ms) || ms < start || ms > now.getTime()) return;
      counts[key] += 1;
      let index = 0;
      while (index < 6 && ms >= days[index + 1]) index += 1;
      perDay[index][key] += 1;
    };
    for (const item of observations) {
      if (item.kind === "moment" && PARENT_SOURCES.has(item.source)) add("moments", item.at);
      else if (item.kind === "milestone") add("milestones", item.at);
      else if (item.value.type === "word") add("words", item.at);
      else if (KID_ORIGINS.has(item.origin)) add("kid", item.at);
    }
    for (const step of actionLoop) if (step.outcome === "helped") add("helped", step.outcomeAt);
    const max = Math.max(1, ...perDay.map(day => WEEK_ORDER.reduce((sum, key) => sum + day[key], 0)));
    return { counts, perDay, max };
  }, [observations, actionLoop, now]);
  const tiles = WEEK_ORDER.filter(key => week.counts[key] > 0).slice(0, 4);
  const label: Record<WeekKey, string> = { moments: copy.weekMoments, helped: copy.weekHelped, milestones: copy.weekMilestones, words: copy.weekWords, kid: copy.weekKid };
  return <section className="now-week" aria-labelledby={`${id}-week`} data-testid="now-week">
    <div className="now-week-head">
      <Icon name="bar_chart" size={19} />
      <h2 id={`${id}-week`}>{copy.weeklyTitle}</h2>
      <button type="button" className="now-week-report" data-testid="now-week-report" aria-label={copy.weekReportAria} onClick={onReport}>{copy.weekReport}<Icon name="arrow_forward" size={15} className="rtl:-scale-x-100" /></button>
    </div>
    {tiles.length ? <>
      <ul className="now-week-tiles">
        {tiles.map(key => <li key={key} className={`now-week-tile now-week-${key}`}><b>{week.counts[key]}</b><span>{label[key]}</span></li>)}
      </ul>
      <div className="now-week-bars" aria-hidden="true">
        {week.perDay.map((day, index) => <span key={index} className="now-week-day">
          {WEEK_ORDER.filter(key => day[key] > 0).map(key => <i key={key} className={`now-week-${key}`} style={{ blockSize: `${Math.max(3, Math.round((day[key] / week.max) * 30))}px` }} />)}
        </span>)}
      </div>
    </> : <p className="now-week-empty">{copy.weekEmpty}</p>}
  </section>;
}
