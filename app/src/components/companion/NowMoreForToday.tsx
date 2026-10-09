import React, { useMemo } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useWeeklyRecap } from "../../hooks/useWeeklyRecap";
import { firstsStorageKey, type FirstsState } from "../../lib/firsts";
import WhatChanged from "../overview/WhatChanged";
import { composeWhatChanged, type WhatChangedLine } from "../overview/whatChangedEvents";
import CompanionOfferSlot from "../overview/CompanionOfferSlot";
import type { useCompanionOffer } from "../overview/useCompanionOffer";
import TodaySayBackLine from "../overview/TodaySayBackLine";
import FamilyOfferLines from "../overview/FamilyOfferLines";
import ArborNoticedCard from "../sections/ArborNoticedCard";
import Icon from "../ui/Icon";

/**
 * "More for today" on Now (parity, 9 Oct 2026) — ONE collapsed door, chrome,
 * never a module (#/overview demotes into its disclosure). It re-homes what the
 * retired Today door carried and no companion place showed:
 *  · what changed since you left, for returning parents (B-TODAY-21);
 *  · the ONE proactive offer — appointment prep, a re-check due, a routine
 *    cue, carry-over (B-AI-06, CompanionOfferSlot surface "today");
 *  · the say-back question (B-GROWTH-36), the watch signal (C1 — clinical,
 *    "worth mentioning to your pediatrician", no other push home) and the
 *    sibling lines (B-TODAY-18);
 *  · lines to bedtime (evening, age-fit) and Daily Play. Day Windows keeps
 *    its B-TODAY-13 door (the rhythm cue's "See the hours", via the offer
 *    slot) and Settings; Gentle Reminders lives in Settings.
 * Lines only; nothing here competes with the lead's one move.
 */
export default function NowMoreForToday({ now, evening, storyFits, rhythmDaysNeeded, keepsakeDocs, previousVisitAt, isReturning, todayOffer }: {
  now: Date;
  evening: boolean;
  storyFits: boolean;
  rhythmDaysNeeded?: number;
  keepsakeDocs: readonly unknown[];
  previousVisitAt: string | null;
  isReturning: boolean;
  todayOffer: ReturnType<typeof useCompanionOffer>;
}) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, approvedMemoryItems, checkedMilestones, setActiveTab, requestJournalFocus } = useArbor();
  const { t } = useLanguage();
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
    // the watch signal renders as its own card below (never twice)
    includeNoticed: false,
  }), [isReturning, dayZero, previousVisitAt, behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState, checkedMilestones]);
  const changedWould = !dayZero && isReturning && changed.lines.length > 0;
  const weeklyRecap = useWeeklyRecap();
  const onChangedLineTap = (line: WhatChangedLine) => {
    if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") { setActiveTab("development"); return; }
    if (line.kind === "facts" || line.kind === "ideas") { setActiveTab("memory"); return; }
    requestJournalFocus(line.focusId);
    setActiveTab("journal");
  };
  const line = (testId: string, icon: string, label: string, onClick: () => void) => (
    <button key={testId} type="button" className="now-more-line" data-testid={testId} onClick={onClick}>
      <Icon name={icon} size={18} /><span>{label}</span><Icon name="chevron_right" size={18} className="rtl:-scale-x-100" />
    </button>
  );

  return <details className="now-more" data-module-disclosure="today-more" data-testid="today-door">
    <summary>
      <span><b>{t("elev.loop.today.door")}</b><small>{t("elev.loop.today.doorSub")}</small></span>
      <Icon name="expand_more" size={20} />
    </summary>
    <div className="now-more-body">
      {changedWould && <WhatChanged lines={changed.lines.slice(0, 3)} hiddenCount={0} recap={weeklyRecap} rhythmDaysNeeded={rhythmDaysNeeded} onLineTap={onChangedLineTap} onMore={() => setActiveTab("journal")} />}
      <CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} placement="under-step" />
      <TodaySayBackLine keepsakeDocs={keepsakeDocs} now={now} />
      {!dayZero && <ArborNoticedCard />}
      <FamilyOfferLines activeChildId={childProfile.id} />
      {evening && storyFits && line("today-door-story", "auto_stories", t("elev.loop.tonight.story"), () => setActiveTab("bedtime-stories"))}
      {line("today-door-play", "sports_esports", t("elev.loop.door.play"), () => setActiveTab("daily-play"))}
    </div>
  </details>;
}
