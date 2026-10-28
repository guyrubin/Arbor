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
import { BrandChip } from "../ui/BrandChip";
import Icon from "../ui/Icon";
import { useChildCollection } from "../../hooks/useChildCollection";
import type { LangObservation } from "../../growth/vocabAgg";

/**
 * v4 (blueprint decision 5: "More for today" dissolves) — the lines the old
 * collapsed door carried, each in the object it belongs to on Now:
 *  · what changed since you left (B-TODAY-21) → inside "This week so far"
 *    (NowWhatChangedLines), so a returning parent still sees it first-screen;
 *  · the say-back question (B-GROWTH-36) and the watch signal ("Arbor
 *    noticed", C1 — clinical, worth mentioning to your pediatrician) → Notice
 *    today (NowNoticeExtras), its last rows;
 *  · the ONE proactive offer (B-AI-06, CompanionOfferSlot surface "today"),
 *    the sibling lines (B-TODAY-18) and the evening story → the agenda rows of
 *    "Today at a glance" (NowAgendaExtras);
 *  · Daily Play lives in Together (Play › Away from the screen › More ideas).
 * Lines only, never a module: nothing here competes with the lead's one move.
 */

/** The day-zero rule the door used: a first visit with nothing kept yet. */
function useDayZero(isReturning: boolean): boolean {
  const { behaviorLogs, playLogs, checkedMilestones } = useArbor();
  return !isReturning && behaviorLogs.length === 0 && playLogs.length === 0 && checkedMilestones === 0;
}

/** What changed since the last visit, as lines inside the week card. */
export function NowWhatChangedLines({ previousVisitAt, isReturning, rhythmDaysNeeded }: {
  previousVisitAt: string | null;
  isReturning: boolean;
  rhythmDaysNeeded?: number;
}) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, approvedMemoryItems, checkedMilestones, setActiveTab, requestJournalFocus } = useArbor();
  const dayZero = useDayZero(isReturning);
  // B-GROWTH-15: the words the parent wrote down — the words line counts them by language.
  const langObs = useChildCollection<LangObservation>(childProfile.id, "langObs");
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
    // the watch signal is Notice today's own row (never twice)
    includeNoticed: false,
    langObs: langObs.items,
  }), [isReturning, dayZero, previousVisitAt, behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState, checkedMilestones, langObs.items]);
  const weeklyRecap = useWeeklyRecap();
  // The door's own gate, unchanged: a returning parent, past day zero, with something new.
  if (dayZero || !isReturning || changed.lines.length === 0) return null;
  const onLineTap = (line: WhatChangedLine) => {
    if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") { setActiveTab("development"); return; }
    if (line.kind === "facts" || line.kind === "ideas") { setActiveTab("memory"); return; }
    requestJournalFocus(line.focusId);
    setActiveTab("journal");
  };
  return <WhatChanged variant="lines" lines={changed.lines.slice(0, 3)} hiddenCount={0} recap={weeklyRecap} rhythmDaysNeeded={rhythmDaysNeeded} onLineTap={onLineTap} onMore={() => setActiveTab("journal")} />;
}

/** The say-back question and the watch signal: Notice today's last rows. */
export function NowNoticeExtras({ keepsakeDocs, now, isReturning, suppressSayBack = false }: {
  keepsakeDocs: readonly unknown[];
  now: Date;
  isReturning: boolean;
  suppressSayBack?: boolean;
}) {
  const dayZero = useDayZero(isReturning);
  return <div className="now-notice-extras" data-testid="now-notice-extras">
    {!suppressSayBack && <TodaySayBackLine keepsakeDocs={keepsakeDocs} now={now} />}
    {!dayZero && <ArborNoticedCard />}
  </div>;
}

/** The offer, the sibling lines and the evening story: agenda rows. */
export function NowAgendaExtras({ evening, storyFits, todayOffer, suppressVisit = false, storyRow = true }: {
  evening: boolean;
  storyFits: boolean;
  todayOffer: ReturnType<typeof useCompanionOffer>;
  suppressVisit?: boolean;
  /** False while the Tonight pointer already stands in the agenda. */
  storyRow?: boolean;
}) {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  return <div className="now-glance-extras" data-testid="now-agenda-extras">
    {!(suppressVisit && todayOffer.offer?.kind === "appointment") && <CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} placement="under-step" />}
    <FamilyOfferLines activeChildId={childProfile.id} />
    {storyRow && evening && storyFits && <button type="button" className="now-weekly-door now-agenda-row" data-testid="today-agenda-story" onClick={() => setActiveTab("bedtime-stories")}>
      <BrandChip icon="auto_stories" tone="lav" shape="arch" />
      <span><b>{t("elev.loop.tonight.story")}</b></span>
      <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
    </button>}
  </div>;
}
