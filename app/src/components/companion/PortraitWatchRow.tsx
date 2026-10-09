import React, { useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { ageMonthsOf } from "../../lib/age/forChild";
import { comparisonAgeMonths, milestoneText, selectWeeklyFocus } from "../../lib/milestoneData";
import { clearWatchFocus, resolveWatchFocus } from "../../lib/screeningWatch";
import { latestRecheckDueAt } from "../../lib/screeningRecheck";
import { closeDay, deriveReturnSignals } from "../../lib/tomorrowReason";
import { readRitualRecord } from "../../lib/familyRitualsCadence";
import { ADVENTURES, type SavedComicMeta } from "../../lib/heroComics";
import { celebrate } from "../../lib/celebrate";
import { fmtDay, fmtDayShort } from "../../lib/formatDate";
import { tGCare } from "../../lib/growthCareText";
import { ContentWhyLine } from "../ui/ContentActionBar";
import Icon from "../ui/Icon";

type ObserveStatus = "yes" | "not_sure" | "not_yet";

/**
 * "Watching for" on My child (parity, 9 Oct 2026). The companion rewrite
 * unmounted the Growth hub, and with it the only reader of the parent's
 * watch choice: the Development Check still says "It becomes this week's
 * focus on Development" (elev.gcare.screen.watch.body) and writes it — this
 * row is where it shows again.
 *  · GP-34: the parent's own pick wins; else UND-6's age-aware weekly focus
 *    (corrected months; never an infant item for an older child).
 *  · GP-06: Seen it / Not sure / Not yet through setMilestoneObservation, the
 *    same seam and capped celebration as the Milestones map.
 *  · B-GROWTH-04: the saved re-check date, plain text in neutral ink.
 *  · GP-22: the why-line names its inputs and opens the Trust Center.
 *  · TJB-28: tonight's return reason is written once a day, as before.
 * CLINICAL FIREWALL: observational wording only; no count, %, colour verdict.
 * No primary-move stamp: the portrait's one move stays explore-child-record.
 */
export default function PortraitWatchRow() {
  const { childProfile, milestones, behaviorLogs, playLogs, setMilestoneObservation, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const firstName = (childProfile.name || "").split(" ")[0];
  const heGender = useMemo(() => ({ gender: childProfile.gender ?? null }), [childProfile.gender]);
  const [watchTick, setWatchTick] = useState(0);
  const chosenWatch = useMemo(
    () => resolveWatchFocus(childProfile.id, milestones),
    // watchTick is the storage-read trigger; it has no value of its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childProfile.id, milestones, watchTick],
  );
  const comparisonMonths = useMemo(
    () => comparisonAgeMonths(ageMonthsOf(childProfile), childProfile.preterm?.gestationalWeeks),
    [childProfile],
  );
  const focus = useMemo(() => {
    if (chosenWatch) {
      return {
        title: milestoneText(chosenWatch, "title", t, heGender),
        body: milestoneText(chosenWatch, chosenWatch.skillLooksLike ? "looks" : "desc", t, heGender),
        hint: t("growth.focus.watchHint"), chosen: true, id: chosenWatch.id,
        status: chosenWatch.observationStatus ?? (chosenWatch.checked ? "yes" : undefined), updatedAt: chosenWatch.observationUpdatedAt,
      };
    }
    const selected = selectWeeklyFocus(milestones, comparisonMonths);
    if (!selected) return null;
    return {
      title: milestoneText(selected.milestone, "title", t, heGender),
      body: milestoneText(selected.milestone, selected.milestone.skillLooksLike ? "looks" : "desc", t, heGender),
      hint: selected.mode === "watch" ? t("growth.focus.watchHint") : t("growth.focus.tryHint"), chosen: false, id: selected.milestone.id,
      status: selected.milestone.observationStatus, updatedAt: selected.milestone.observationUpdatedAt,
    };
  }, [chosenWatch, milestones, comparisonMonths, t, heGender]);

  const screenings = useChildCollection<{ id: string; answeredAt: string; recheckDueAt?: string }>(childProfile.id, "screenings");
  const recheckDueAt = useMemo(() => latestRecheckDueAt(screenings.items), [screenings.items]);
  const savedComics = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const returnSignals = useMemo(() => deriveReturnSignals({
    behaviorLogs, playLogs, watchFocus: chosenWatch != null, ritualRecord: readRitualRecord(),
    savedComicCount: savedComics.items.length, storyTotal: ADVENTURES.length, now: Date.now(),
  }), [chosenWatch, savedComics.items.length, behaviorLogs, playLogs]);
  useEffect(() => {
    closeDay(childProfile.id, Date.now(), returnSignals);
    // Once per child per visit, exactly as the comic shelf does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile.id]);

  const [justNoticedId, setJustNoticedId] = useState<string | null>(null);
  const observe = (id: string, status: ObserveStatus, wasSeen: boolean) => {
    setMilestoneObservation(id, status);
    if (status !== "yes" || wasSeen) return;
    celebrate({ kind: "milestone" });
    setJustNoticedId(id);
  };
  const today = new Date().toISOString();

  return <section className="portrait-watch" data-testid="portrait-watch" aria-labelledby="portrait-watch-title">
    <p className="portrait-kicker">{t("growth.focus.eyebrow")}</p>
    {focus ? <>
      <h2 id="portrait-watch-title" dir="auto">{focus.title}</h2>
      {focus.body && <p className="portrait-watch-body" dir="auto">{focus.body}</p>}
      {focus.hint && <p className="portrait-meta">{focus.hint}</p>}
      <p className="portrait-watch-prompt">{t("elev.waveR.growth.observe.prompt")}</p>
      <div className="portrait-watch-answers" role="group" aria-label={t("elev.waveR.growth.observe.aria")}>
        {([
          ["yes", tGCare(uiLang, "elev.gcare.ms.observe.yes")],
          ["not_sure", t("ms.observe.notSure")],
          ["not_yet", t("ms.observe.notYet")],
        ] as const).map(([status, label]) => (
          <button key={status} type="button" data-testid={`portrait-observe-${status}`} aria-pressed={focus.status === status}
            onClick={() => observe(focus.id, status, focus.status === "yes")}>{label}</button>
        ))}
      </div>
      {justNoticedId === focus.id ? (
        <p className="portrait-watch-note" aria-live="polite" data-testid="portrait-observe-kept">
          {firstName ? t("elev.growth.observe.kept", { name: firstName, date: fmtDayShort(today, uiLang) }) : t("elev.growth.observe.keptGeneric", { date: fmtDayShort(today, uiLang) })}
        </p>
      ) : focus.status === "not_sure" && focus.updatedAt ? (
        <p className="portrait-meta">{t("elev.growth.observe.notSureAgain", { date: fmtDay(focus.updatedAt, uiLang) })}</p>
      ) : (
        <p className="portrait-meta">{t("elev.waveR.growth.observe.hint")}</p>
      )}
      <div className="portrait-watch-links">
        <button type="button" className="portrait-text-button" onClick={() => setActiveTab("daily-play")}><Icon name="play_arrow" size={18} />{t("growth.focus.try")}</button>
        <button type="button" className="portrait-text-button" onClick={() => setActiveTab("milestones")}><Icon name="edit_note" size={18} />{t("growth.focus.review")}</button>
        {/* A choice the parent made has to be a choice they can unmake. */}
        {focus.chosen && <button type="button" className="portrait-text-button" data-testid="portrait-unwatch" onClick={() => { clearWatchFocus(childProfile.id); setWatchTick((n) => n + 1); }}>{tGCare(uiLang, "elev.gcare.growth.watch.clear")}</button>}
      </div>
    </> : <>
      <h2 id="portrait-watch-title">{t("growth.focus.empty.title")}</h2>
      <p className="portrait-watch-body">{t("growth.focus.empty.body")}</p>
      <div className="portrait-watch-links"><button type="button" className="portrait-text-button" onClick={() => setActiveTab("screening")}><Icon name="assignment_turned_in" size={18} />{t("growth.focus.check")}</button></div>
    </>}
    {recheckDueAt && <p className="portrait-meta" data-testid="portrait-recheck-date">{t("elev.growth.recheck.date", { date: fmtDay(recheckDueAt, uiLang) })}</p>}
    <ContentWhyLine why={t("elev.waveR.why.focus")} trustLink surface="growth-focus" />
  </section>;
}
