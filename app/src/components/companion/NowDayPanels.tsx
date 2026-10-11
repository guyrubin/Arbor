import React, { useId, useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { recapWeekStartMs } from "../../hooks/useWeeklyRecap";
import { childPicture } from "../../lib/childPicture";
import type { Observation, ObservationOrigin } from "../../lib/observations";
import { KID_ORIGINS, WEEK_ORDER, weekGlance, type WeekCountKey } from "../../lib/weekGlance";
import { dayKey } from "../../practice/signals";
import type { PracticeEvent } from "../../types";
import { Avatar } from "../ui/Avatar";
import Icon from "../ui/Icon";
import { NOW_COPY } from "./nowViewCopy";
import { PRACTICE_ACTIVITY_LABELS, kidFeelingWord } from "./portraitEvidence";

const KID_ICON: Partial<Record<ObservationOrigin, string>> = { practiceEvents: "extension", mimicSessions: "mood", adventureResults: "explore", missionRecords: "flag" };
const KID_KIND: Partial<Record<ObservationOrigin, string>> = { practiceEvents: "practice", mimicSessions: "mimic", adventureResults: "adventure", missionRecords: "mission" };
/** v3 FEAT-04: the existing name of what a tile was (mimic pack, adventure skill, mission), keyed by the record's activity suffix. */
const KID_DETAIL_KEY: Partial<Record<ObservationOrigin, (suffix: string) => string>> = {
  mimicSessions: suffix => `elev.mimic.content.pack.${suffix}.title`,
  adventureResults: suffix => `elev.practice.adventures.skill.${suffix}`,
  missionRecords: suffix => `elev.practice.journey.mission.${suffix}.title`,
};

const timeOf = (iso: string, he: boolean) => new Date(iso).toLocaleTimeString(he ? "he-IL" : "en-GB", { hour: "2-digit", minute: "2-digit" });

/**
 * v3 Now: "From {name}'s world today" — the child's own Kid Mode records from
 * today, as names and times only (no rounds scored, no levels). Hidden when
 * the child has not played today; nothing is invented to fill it.
 * FEAT-04: each tile may carry one line of names beneath its title (the
 * feeling the child chose, the pack, the skill, the mission), and a note
 * says where the items are kept. Never a score, a round count or a level.
 */
export function NowKidWorld({ observations, now, name, onAll }: {
  observations: readonly Observation[]; now: Date; name: string; onAll: () => void;
}) {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const copy = NOW_COPY[he ? "he" : "en"];
  const id = useId();
  // The same read useObservations makes (same query, so one listener): only the source row carries the feeling word.
  const practiceEvents = useChildCollection<PracticeEvent>(childProfile.id, "practiceEvents", { orderByField: "timestamp", orderDir: "desc", max: 800 });
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
  const detail = (item: Observation): string | undefined => {
    if (item.value.type !== "practice") return undefined;
    if (item.origin === "practiceEvents") {
      const sourceId = item.id.slice(item.origin.length + 1);
      const feeling = kidFeelingWord(practiceEvents.items.find(row => row.id === sourceId)?.emotion, he);
      return feeling ? copy.worldFeeling(feeling) : undefined;
    }
    const activity = item.value.activity;
    const colon = activity.indexOf(":");
    const suffix = colon >= 0 ? activity.slice(colon + 1) : "";
    const key = suffix ? KID_DETAIL_KEY[item.origin]?.(suffix) : undefined;
    const text = key ? t(key) : undefined;
    return text && text !== key ? text : undefined;
  };
  const note = shown.every(item => item.source === "kid_practice") ? copy.worldNote(name, t("companion.portrait.childPractice")) : copy.worldNoteKept(name);
  return <section className="now-world" aria-labelledby={`${id}-world`} data-testid="now-kid-world">
    <div className="now-world-head">
      <Avatar name={childProfile.name} photoURL={childPicture(childProfile).url} size={40} />
      <div><h2 id={`${id}-world`}>{copy.worldTitle(name)}</h2><p className="now-world-live"><span aria-hidden="true" />{copy.worldLatest(timeOf(tiles[tiles.length - 1].at, he))}</p></div>
    </div>
    <ol className="now-world-tiles">
      {shown.map((item, index) => {
        const sub = detail(item);
        return <li key={item.id} className="now-world-tile">
          <span className={`now-world-glyph now-world-glyph-${index % 4}`} aria-hidden="true"><Icon name={item.value.type === "practice" && item.value.activity === "mood-checkin" ? "mood" : KID_ICON[item.origin] ?? "extension"} size={22} /></span>
          <span className="now-world-text"><time dateTime={item.at}>{timeOf(item.at, he)}</time><b>{label(item)}</b>{sub && <span className="now-world-sub" dir="auto">{sub}</span>}</span>
        </li>;
      })}
    </ol>
    <button type="button" className="now-world-all" onClick={onAll}>{copy.worldAll}<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" /></button>
    <p className="now-world-note" data-testid="now-kid-world-note"><Icon name="auto_awesome" size={15} /><span>{note}</span></p>
  </section>;
}

/**
 * v3 Now: "This week so far" — counts of what was kept this report week (the
 * Weekly report's own week), day by day. Counts only: no %, no score, no
 * colour that judges; a zero category is simply not shown.
 * v3 EXTRA-WEEKLY: the counting lives in lib/weekGlance (the Weekly tab's
 * glance reads the same object); this card renders it unchanged.
 */
export function NowWeekSoFar({ observations, now, onReport }: {
  observations: readonly Observation[]; now: Date; onReport: () => void;
}) {
  const { actionLoop = [] } = useArbor();
  const { uiLang } = useLanguage();
  const copy = NOW_COPY[uiLang === "he" ? "he" : "en"];
  const id = useId();
  const week = useMemo(() => weekGlance({ observations, actionLoop, now, weekStartMs: recapWeekStartMs(now) }), [observations, actionLoop, now]);
  const tiles = WEEK_ORDER.filter(key => week.counts[key] > 0).slice(0, 4);
  const label: Record<WeekCountKey, string> = { moments: copy.weekMoments, helped: copy.weekHelped, milestones: copy.weekMilestones, words: copy.weekWords, kid: copy.weekKid };
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
