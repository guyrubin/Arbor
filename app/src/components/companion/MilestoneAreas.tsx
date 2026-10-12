import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useKeepsakeMigration } from "../../hooks/useKeepsakeMigration";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { ageMonthsOf } from "../../lib/age/forChild";
import { domainName, type DomainId } from "../../lib/domains/registry";
import { readRitualRecord } from "../../lib/familyRitualsCadence";
import { keepsakeDoc, keepsakeMapFromDocs, upsertKeepsake, type KeepsakeDoc, type KeepsakeDraft } from "../../lib/firstsKeepsake";
import { ADVENTURES, type SavedComicMeta } from "../../lib/heroComics";
import { bandForAgeMonths, comparisonAgeMonths, milestoneText } from "../../lib/milestoneData";
import type { ObserveStatus } from "../../lib/milestones/observe";
import type { Observation } from "../../lib/observations";
import { latestRecheckDueAt } from "../../lib/screeningRecheck";
import { clearWatchFocus, readWatchFocus, resolveWatchFocus, writeWatchFocus, type WatchFocus } from "../../lib/screeningWatch";
import { closeDay, deriveReturnSignals } from "../../lib/tomorrowReason";
import FirstKeepsakeSheet from "../milestones/FirstKeepsakeSheet";
import { celebrateFirstOnce } from "../milestones/celebrateFirst";
import { Sheet, useCompactSurface } from "../ui/Sheet";
import AreaRowDetail from "./AreaRowDetail";
import DevelopmentMap from "./DevelopmentMap";
import { CUSTOM_MILESTONE_DOMAIN, areaFromQuery, watchDomain } from "./milestonesModel";

/**
 * v3 F-CHILD-1 — the areas card of the Milestones pill, with its one open row.
 *
 * DevelopmentMap draws the eight rows; this owns which one is open and what
 * it does. ?area=<domain> (and the old #/milestones ?shelf=) opens its row; a
 * tap toggles a row; at most one is open. A wide screen opens the row's body
 * inline under it (no dialog); below lg the same AreaRowDetail rides a bottom
 * Sheet (critic ruling 25).
 *
 * Absorbed from the old surfaces, so nothing they did is lost:
 *  · MilestonesTab: the answers write through setMilestoneObservation (the one
 *    seam), a fresh Seen it fires the capped celebration once per skill ever
 *    (celebrateFirstOnce) and then offers the note-and-date keepsake
 *    (FirstKeepsakeSheet), whose "Kept" waits for the write; "Add your own"
 *    writes a custom row on the area; the one-time move of a device's legacy
 *    keepsake map into the subcollection runs here too (useKeepsakeMigration).
 *  · PortraitWatchRow: the skill the parent chose to watch for leads its area,
 *    with the saved re-check date and Stop watching (with Undo); on a wide
 *    screen a newly chosen watch opens its row once. Tonight's return reason
 *    is still written once per child per visit (TJB-28).
 * CLINICAL FIREWALL: Seen-it counts and the parent's own words only.
 */
export interface MilestoneAreasProps {
  /** The child's loaded record, already this child's. */
  observations: readonly Observation[];
  momentText: (observation: Observation) => string;
  /** The page's primary-move stamp, carried to the check button. */
  primaryMoveProps?: Record<string, string>;
  /** Explore this with Arbor: the page opens Talk with the area. */
  onExplore: (domain: DomainId) => void;
}

const watchOpenedKey = (childId: string) => `arbor.milestones.watchOpened.${childId}`;

export default function MilestoneAreas({ observations, momentText, primaryMoveProps, onExplore }: MilestoneAreasProps) {
  const { childProfile, milestones, behaviorLogs, playLogs, setMilestoneObservation, addCustomMilestone, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const compact = useCompactSurface();
  const queryArea = areaFromQuery(useHashQuery());
  // A tap wins until the link's area changes; a new ?area= wins over the tap.
  const [toggled, setToggled] = useState<{ from: DomainId | null; domain: DomainId | null } | null>(null);
  const openDomain = toggled && toggled.from === queryArea ? toggled.domain : queryArea;
  const toggle = (domain: DomainId) => setToggled({ from: queryArea, domain: openDomain === domain ? null : domain });
  const close = () => setToggled({ from: queryArea, domain: null });

  const currentBandMonths = bandForAgeMonths(comparisonAgeMonths(ageMonthsOf(childProfile), childProfile.preterm?.gestationalWeeks)).months;
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

  const screenings = useChildCollection<{ id: string; answeredAt: string; recheckDueAt?: string }>(childProfile.id, "screenings");
  const recheckDueAt = useMemo(() => latestRecheckDueAt(screenings.items), [screenings.items]);
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

  // A newly chosen watch opens its row once, on a wide screen, unless a link already opened one.
  useEffect(() => {
    if (compact || queryArea || !chosenWatch) return;
    const focus = readWatchFocus(childProfile.id);
    if (!focus || focus.milestoneId !== chosenWatch.id) return;
    const domain = watchDomain(milestones, focus.milestoneId);
    if (!domain) return;
    try {
      const key = watchOpenedKey(childProfile.id);
      if (window.localStorage.getItem(key) === focus.chosenAt) return;
      window.localStorage.setItem(key, focus.chosenAt);
    } catch {
      return;
    }
    setToggled((current) => current ?? { from: null, domain });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenWatch?.id, compact]);

  // The first's keepsake: the registered `keepsakes` subcollection (doc id = milestone id).
  const keepsakeCol = useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes");
  const keepsakes = useMemo(() => keepsakeMapFromDocs(keepsakeCol.items), [keepsakeCol.items]);
  const [keepFor, setKeepFor] = useState<string | null>(null);
  useKeepsakeMigration(childProfile.id, keepsakeCol, keepsakes);
  const keeping = keepFor ? milestones.find((m) => m.id === keepFor) ?? null : null;

  const answer = (id: string, status: ObserveStatus) => {
    const before = milestones.find((m) => m.id === id);
    const fresh = status === "yes" && !!before && before.checked !== true;
    const write = setMilestoneObservation(id, status);
    if (!write) return write;
    write.then(() => {
      // One capped burst per skill ever, after the answer is stored (MilestonesTab's rule).
      if (fresh) celebrateFirstOnce(childProfile.id, id);
    }, () => undefined);
    return write;
  };

  const detail = (domain: DomainId, detailId?: string) => (
    <AreaRowDetail
      key={domain}
      id={detailId}
      domain={domain}
      milestones={milestones}
      currentBandMonths={currentBandMonths}
      gender={gender}
      onAnswer={answer}
      onKeep={setKeepFor}
      onAddOwn={(words) => addCustomMilestone(words, CUSTOM_MILESTONE_DOMAIN[domain])}
      watch={chosenWatch && chosenDomain === domain ? { milestoneId: chosenWatch.id, recheckDueAt, onStop: stopWatching } : null}
      onUndoWatch={clearedDomain === domain ? undoStop : null}
      onCheck={() => setActiveTab("screening")}
      onExplore={() => onExplore(domain)}
      onOpenMoments={() => goToRoute("timeline", { view: "areas", area: domain })}
    />
  );

  return (
    <>
      <DevelopmentMap
        milestones={milestones}
        observations={observations}
        momentText={momentText}
        openDomain={openDomain}
        onToggle={toggle}
        renderDetail={compact ? undefined : detail}
        onCheck={() => setActiveTab("screening")}
        primaryMoveProps={primaryMoveProps}
        recheckDueAt={chosenWatch ? null : recheckDueAt}
      />
      {compact && openDomain && (
        <Sheet open onClose={close} title={domainName(openDomain, t)}>
          {detail(openDomain)}
        </Sheet>
      )}
      {keeping && (
        <FirstKeepsakeSheet
          key={`${childProfile.id}:${keeping.id}`}
          open
          milestoneId={keeping.id}
          milestoneTitle={milestoneText(keeping, "title", t, { gender })}
          childId={childProfile.id}
          childName={(childProfile.name || "").split(" ")[0]}
          keepsake={keepsakes[keeping.id] ?? null}
          canShare={false}
          beforeShare={() => false}
          // Both return the write: the sheet says "Kept" (or closes) only after it resolved.
          onSave={(draft: KeepsakeDraft) => {
            const next = upsertKeepsake(keepsakes, draft, new Date().toISOString());
            return keepsakeCol.upsert(keepsakeDoc(next[draft.milestoneId]));
          }}
          onRemove={() => keepsakeCol.remove(keeping.id)}
          onClose={() => setKeepFor(null)}
        />
      )}
    </>
  );
}
