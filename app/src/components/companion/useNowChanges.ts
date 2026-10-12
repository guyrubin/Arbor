import { useEffect, useMemo, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useWeeklyRecap } from "../../hooks/useWeeklyRecap";
import { goToRoute } from "../../hooks/useHashQuery";
import { track } from "../../lib/analytics";
import { firstsStorageKey, type FirstsState } from "../../lib/firsts";
import { milestoneText } from "../../lib/milestoneData";
import { primaryDomain } from "../../lib/domains/registry";
import type { Milestone } from "../../types";
import { coldStartLineKey, composeWhatChanged, type WhatChangedLine } from "../overview/whatChangedEvents";
import { LINE_ICON, countFor, whatChangedLineText } from "../overview/WhatChanged";

/** One "Since you were last here" line in Now's week card (v3 F-NOW-2). */
export interface NowChangedLine {
  id: string;
  icon: string;
  text: string;
  /** A line with no destination (the lifecycle note) is a plain line, never a button. */
  onOpen?: () => void;
}

/** The week card shows at most three lines; the notice keeps its place. */
export const NOW_CHANGED_MAX = 3;

/**
 * v3 F-NOW-2 — the week card's "Since you were last here" lines. This is what
 * the retired "More for today" door carried, as event lines under the week
 * tiles (mock: the week card's changed lines):
 *  · the lifecycle note (birthday, first week/month/moment), first, once, as
 *    the coordinator already rules (useLifecycleMoment + the what-changed offer);
 *  · the weekly report's ready line, while the parent keeps its reminder on;
 *  · B-TODAY-21's event lines (whatChangedEvents: events and counts, never a
 *    score, a ratio or "n of m" about the child), for returning parents;
 *  · the loop's first notice ("Worth noticing"), opening Milestones on the
 *    milestone's own area (#/development?area=…), as the retired notice block
 *    showed it: whenever the loop has one, day zero included.
 * C1's watch signal (ArborNoticedCard) is NOT here: its ruled home is the
 * guide card's "Why this suggestion?" (F-NOW-1 follow-up); until then it stays
 * where the Development check derives it. Day zero shows no event line.
 * Counts in Hebrew are bidi-isolated (countFor).
 */
export function useNowChanges({ previousVisitAt, isReturning, lifecycleNote, notice, rhythmDaysNeeded, name, recapOn }: {
  previousVisitAt: string | null;
  isReturning: boolean;
  lifecycleNote: string | null;
  notice: { milestone: Milestone } | null;
  rhythmDaysNeeded?: number;
  name: string;
  /** The "Weekly report is ready" reminder chip (JitaiPrefs types.recap). */
  recapOn: boolean;
}): { lines: NowChangedLine[]; coldStart: string | null } {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, approvedMemoryItems, checkedMilestones, setActiveTab, requestJournalFocus } = useArbor();
  const { t, uiLang } = useLanguage();
  const weeklyRecap = useWeeklyRecap();
  const dayZero = !isReturning && behaviorLogs.length === 0 && playLogs.length === 0 && checkedMilestones === 0;
  const firstsState = useMemo<FirstsState>(() => {
    try {
      const raw = window.localStorage.getItem(firstsStorageKey(childProfile.id));
      const parsed = raw ? (JSON.parse(raw) as FirstsState) : null;
      return parsed && Array.isArray(parsed.seen) ? parsed : { seen: [] };
    } catch {
      return { seen: [] };
    }
  }, [childProfile.id]);
  const approvedFactsSince = useMemo(() => {
    const since = previousVisitAt ? Date.parse(previousVisitAt) : NaN;
    if (!Number.isFinite(since)) return 0;
    return approvedMemoryItems.filter((m) => Date.parse(m.createdAt) > since).length;
  }, [approvedMemoryItems, previousVisitAt]);
  const changed = useMemo(() => composeWhatChanged({
    previousVisitAt: isReturning && !dayZero ? previousVisitAt : null,
    behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState,
    firstsCounts: { milestoneCount: checkedMilestones },
    // C1's watch signal is not a Now line (v3 F-NOW-2; see above)
    includeNoticed: false,
  }), [isReturning, dayZero, previousVisitAt, behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState, checkedMilestones]);
  const changedWould = !dayZero && isReturning && changed.lines.length > 0;
  const recapLine = !dayZero && recapOn && !!weeklyRecap.currentReport && weeklyRecap.recapUnopened;

  const onChangedLineTap = (line: WhatChangedLine) => {
    track("sincevisit_row_tap", { kind: line.kind });
    if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") { setActiveTab("development"); return; }
    if (line.kind === "facts" || line.kind === "ideas") { setActiveTab("memory"); return; }
    requestJournalFocus(line.focusId);
    setActiveTab("journal");
  };

  const head: NowChangedLine[] = [];
  if (lifecycleNote) head.push({ id: "lifecycle", icon: "auto_awesome", text: lifecycleNote });
  if (recapLine) head.push({ id: "recap", icon: "auto_stories", text: t("elev.recap.ready", { name }), onOpen: () => { track("recap_ready_tap", { week: weeklyRecap.currentId }); setActiveTab("weekly"); } });
  if (changedWould) changed.lines.forEach((line, i) => {
    const words = whatChangedLineText(line, t, uiLang, name);
    head.push({ id: `${line.kind}.${i}`, icon: LINE_ICON[line.kind], text: words.title, onOpen: () => onChangedLineTap(line) });
  });
  const tail: NowChangedLine[] = [];
  if (notice) tail.push({ id: "notice", icon: "visibility", text: `${t("elev.loop.today.notice.title")} · ${milestoneText(notice.milestone, "title", t, { gender: childProfile.gender })}`,
    onOpen: () => goToRoute("development", { area: primaryDomain("developmental", notice.milestone.domain) }) });
  const lines = [...head.slice(0, NOW_CHANGED_MAX - tail.length), ...tail];

  // ENG-18: the cold-start line rides with the event lines, as it did in the card.
  const coldKey = changedWould ? coldStartLineKey(rhythmDaysNeeded) : null;
  const coldStart = coldKey ? t(coldKey, { n: countFor(rhythmDaysNeeded ?? 0, uiLang), name }) : null;

  // KPI 0.8 names are pinned (lib/loopEvents): the since-visit series keeps its
  // event names, sent once per visit when the first lines are drawn.
  const shownSent = useRef(false);
  const eventRows = changedWould ? Math.min(changed.lines.length, NOW_CHANGED_MAX) : 0;
  useEffect(() => {
    if (shownSent.current || (eventRows === 0 && !recapLine)) return;
    shownSent.current = true;
    track("sincevisit_shown", { rows: eventRows, recap: recapLine ? 1 : 0 });
  }, [eventRows, recapLine]);

  return { lines, coldStart };
}
