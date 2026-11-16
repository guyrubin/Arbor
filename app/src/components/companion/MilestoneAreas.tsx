import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useKeepsakeMigration } from "../../hooks/useKeepsakeMigration";
import { useNoticeActions } from "../../hooks/useNoticeActions";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { ageMonthsOf } from "../../lib/age/forChild";
import { DOMAIN_IDS, type DomainId } from "../../lib/domains/registry";
import { readRitualRecord } from "../../lib/familyRitualsCadence";
import { keepsakeMapFromDocs } from "../../lib/firstsKeepsake";
import { ADVENTURES, type SavedComicMeta } from "../../lib/heroComics";
import { bandForAgeMonths, comparisonAgeMonths } from "../../lib/milestoneData";
import { lastMomentByDomain, noticedByDomain } from "../../lib/milestones/domainMap";
import type { ObserveStatus } from "../../lib/milestones/observe";
import type { Observation } from "../../lib/observations";
import { latestRecheckDueAt } from "../../lib/screeningRecheck";
import { clearWatchFocus, readWatchFocus, resolveWatchFocus, writeWatchFocus, type WatchFocus } from "../../lib/screeningWatch";
import { closeDay, deriveReturnSignals } from "../../lib/tomorrowReason";
import { closeNoticeDetail, openNoticeDetail, readNoticeTarget } from "../../lib/noticeNavigation";
import { celebrateFirstOnce } from "../milestones/celebrateFirst";
import type { Composition } from "../../design/useComposition";
import AreaRowDetail from "./AreaRowDetail";
import DevelopmentCheckCard from "./DevelopmentCheckCard";
import DevelopmentMap from "./DevelopmentMap";
import NoticeNext from "./NoticeNext";
import NoticeObjectDetail from "./NoticeObjectDetail";
import { CUSTOM_MILESTONE_DOMAIN, areaFromQuery, watchDomain } from "./milestonesModel";

/**
 * v10.1 — the state behind the milestone map, handed to the page as parts.
 *
 * This owns which area is open and what an answer does; the page (ChildPortrait)
 * places the parts in its numbered sections: `map` (DevelopmentMap, the eight
 * territories), `check` (the 5-minute check object), `area` (the open area's
 * body, AreaRowDetail, under its tinted head) and `next` (What to notice
 * next). ?area=<domain> (and the old #/milestones ?shelf=) opens its area; a
 * tap on a territory opens that area in its section (desk and phone alike,
 * one tree). With no link and no tap, the chosen watch's area leads, else the
 * first area with something recorded, else the first area.
 *
 * Absorbed from the old surfaces, so nothing they did is lost:
 *  · MilestonesTab: the answers write through setMilestoneObservation (the one
 *    seam), a fresh Seen it fires the capped celebration once per skill ever
 *    (celebrateFirstOnce) and then offers the note-and-date keepsake, whose
 *    "Kept" waits for the write; "Add your own" writes a custom row on the
 *    area; the one-time move of a device's legacy keepsake map into the
 *    subcollection runs here too (useKeepsakeMigration).
 *  · PortraitWatchRow: the skill the parent chose to watch for leads its area,
 *    with the saved re-check date and Stop watching (with Undo). Tonight's
 *    return reason is still written once per child per visit (TJB-28).
 * CLINICAL FIREWALL: Seen-it counts and the parent's own words only.
 */
export interface MilestoneAreaParts {
  map: React.ReactNode;
  check: React.ReactNode;
  area: React.ReactNode;
  next: React.ReactNode;
  openDomain: DomainId;
}

export interface MilestoneAreasProps {
  /** The child's loaded record, already this child's. */
  observations: readonly Observation[];
  momentText: (observation: Observation) => string;
  /** The page's primary-move stamp, carried to the check button. */
  primaryMoveProps?: Record<string, string>;
  /** Explore this with Arbor: the page opens Talk with the area. */
  onExplore: (domain: DomainId) => void;
  composition: Composition;
  /** Called after a territory opens its area (the phone scrolls to it). */
  onOpened?: (domain: DomainId) => void;
  children: (parts: MilestoneAreaParts) => React.ReactNode;
}

export default function MilestoneAreas({ observations, momentText, primaryMoveProps, onExplore, composition, onOpened, children }: MilestoneAreasProps) {
  const { childProfile, milestones, behaviorLogs, playLogs, addCustomMilestone, setActiveTab } = useArbor();
  const notices = useNoticeActions();
  const query = useHashQuery();
  const queryArea = areaFromQuery(query);
  const noticeTarget = readNoticeTarget(query, childProfile.id);

  const comparisonMonths = comparisonAgeMonths(ageMonthsOf(childProfile), childProfile.preterm?.gestationalWeeks);
  const currentBandMonths = bandForAgeMonths(comparisonMonths).months;
  const gender = childProfile.gender ?? null;

  // The watch the parent chose in the Development Check (PortraitWatchRow's reader).
  const [clearedWatch, setClearedWatch] = useState<{ childId: string; focus: WatchFocus } | null>(null);
  const [watchTick, setWatchTick] = useState(0);
  const chosenWatch = useMemo(
    () => resolveWatchFocus(childProfile.id, milestones),
    // watchTick is the storage-read trigger; it has no value of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childProfile.id, milestones, watchTick],
  );
  const chosenDomain = chosenWatch ? watchDomain(milestones, chosenWatch.id) : null;
  const clearedDomain = clearedWatch?.childId === childProfile.id && !chosenWatch ? watchDomain(milestones, clearedWatch.focus.milestoneId) : null;
  const stopWatching = () => {
    const previous = readWatchFocus(childProfile.id);
    clearWatchFocus(childProfile.id);
    setClearedWatch(previous ? { childId: childProfile.id, focus: previous } : null);
    setWatchTick((n) => n + 1);
  };
  const undoStop = () => {
    if (!clearedWatch) return;
    writeWatchFocus(childProfile.id, clearedWatch.focus);
    setClearedWatch(null);
    setWatchTick((n) => n + 1);
  };

  // The open area: a tap wins until the link's area changes; a new ?area= wins over the tap.
  const last = useMemo(() => lastMomentByDomain(observations, milestones), [observations, milestones]);
  const leading = useMemo(() => {
    const seen = noticedByDomain(milestones);
    return DOMAIN_IDS.find((domain) => seen[domain] > 0 || !!last[domain]) ?? DOMAIN_IDS[0];
  }, [milestones, last]);
  const [tapped, setTapped] = useState<{ from: DomainId | null; domain: DomainId } | null>(null);
  const openDomain: DomainId = (tapped && tapped.from === queryArea ? tapped.domain : null) ?? queryArea ?? chosenDomain ?? clearedDomain ?? leading;
  const open = (domain: DomainId) => {
    setTapped({ from: queryArea, domain });
    onOpened?.(domain);
  };

  const screenings = useChildCollection<{ id: string; answeredAt: string; recheckDueAt?: string }>(childProfile.id, "screenings");
  const recheckDueAt = useMemo(() => latestRecheckDueAt(screenings.items), [screenings.items]);
  // v4: the check names the latest saved check (the screener's own newest-first rule).
  const lastCheckAt = useMemo(() => screenings.items.reduce<string | null>((latest, s) => (s.answeredAt && (!latest || s.answeredAt > latest) ? s.answeredAt : latest), null), [screenings.items]);
  const savedComics = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const returnSignals = useMemo(() => deriveReturnSignals({
    behaviorLogs: behaviorLogs ?? [], playLogs: playLogs ?? [], watchFocus: chosenWatch != null, ritualRecord: readRitualRecord(),
    savedComicCount: savedComics.items.length, storyTotal: ADVENTURES.length, now: Date.now(),
  }), [chosenWatch, savedComics.items.length, behaviorLogs, playLogs]);
  useEffect(() => {
    closeDay(childProfile.id, Date.now(), returnSignals);
    // Once per child per visit, exactly as the watch row did.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  // The first's keepsake: the registered `keepsakes` subcollection (doc id = milestone id).
  const keepsakeCol = notices.keepsakes;
  const keepsakes = useMemo(() => keepsakeMapFromDocs(keepsakeCol.items), [keepsakeCol.items]);
  useKeepsakeMigration(childProfile.id, keepsakeCol, keepsakes);

  const answer = (id: string, status: ObserveStatus) => {
    const before = milestones.find((m) => m.id === id);
    const fresh = status === "yes" && !!before && before.checked !== true;
    if (!before) return undefined;
    const write = notices.forMilestone(before).onAnswer(status);
    write.then(() => {
      // One capped burst per skill ever, after the answer is stored (MilestonesTab's rule).
      if (fresh && notices.isCurrent()) celebrateFirstOnce(childProfile.id, id);
    }, () => undefined);
    return write;
  };
  const toCheck = () => setActiveTab("screening");

  const map = (
    <DevelopmentMap
      milestones={milestones}
      observations={observations}
      momentText={momentText}
      openDomain={openDomain}
      onToggle={open}
      composition={composition}
    />
  );
  const check = (
    <DevelopmentCheckCard
      onCheck={toCheck}
      primaryMoveProps={primaryMoveProps}
      recheckDueAt={chosenWatch ? null : recheckDueAt}
      lastCheckAt={lastCheckAt}
    />
  );
  const moment = last[openDomain];
  const area = (
    <>
      <AreaRowDetail
        key={`${notices.scopeKey}:${openDomain}`}
        lastMoment={moment ? { at: moment.at, text: momentText(moment) } : null}
        domain={openDomain}
        milestones={milestones}
        currentBandMonths={currentBandMonths}
        confirmed={notices.confirmed}
        gender={gender}
        onAnswer={answer}
        onKeep={(milestoneId) => openNoticeDetail(childProfile.id, milestoneId, { editEvidence: true })}
        onOpenObservation={(milestoneId) => openNoticeDetail(childProfile.id, milestoneId)}
        onAddOwn={(words) => addCustomMilestone(words, CUSTOM_MILESTONE_DOMAIN[openDomain])}
        watch={chosenWatch && chosenDomain === openDomain ? { milestoneId: chosenWatch.id, recheckDueAt, onStop: stopWatching } : null}
        onUndoWatch={clearedDomain === openDomain ? undoStop : null}
        onCheck={toCheck}
        onExplore={() => onExplore(openDomain)}
        onOpenMoments={() => goToRoute("timeline", { view: "areas", area: openDomain })}
      />
      {noticeTarget && <NoticeObjectDetail
        key={`${notices.scopeKey}:${noticeTarget.milestoneId}`}
        target={noticeTarget} editEvidence={query.get("evidence") === "edit"} observations={observations}
        onClose={() => closeNoticeDetail(query)}
      />}
    </>
  );
  const next = (
    <NoticeNext
      childId={childProfile.id}
      milestones={milestones}
      comparisonMonths={comparisonMonths}
      gender={gender}
      onAnswer={answer}
    />
  );
  return <>{children({ map, check, area, next, openDomain })}</>;
}
