import { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useObservations } from "../../hooks/useObservations";
import { bedtimeDoorOpen } from "../../lib/timeOfDay";
import { predictRhythm } from "../../rhythm/predict";
import { ageYearsOf, comparisonMonthsOf } from "../../lib/age/forChild";
import { storyFitsChild } from "../../lib/age/playGate";
import { HERO_STORIES } from "../../lib/heroJourneys";
import { PRACTICES } from "../../content/practices";
import { choosePractice, practiceDoseEntry, recentPracticeIds, restedShelves, todayDose, todaysCandidates, type PracticeAnswer } from "../../lib/practice/choosePractice";
import { buildJournalRequest } from "../../ai/journalContext";
import { selectNextMilestones } from "../../lib/milestoneData";
import { dayKey } from "../../practice/signals";
import { readTodayPin, readPracticeShown, markPracticeShown } from "../../lib/practice/todayPin";
import { shelfCoverage } from "../../lib/milestones/selectByShelf";
import { selectNoticeWithProgram, type NoticeProgram } from "../../lib/programs/notice";
import { activeProgramWeek, dayKey as programDayKey } from "../../lib/programs/enrolment";
import { programWeekDays } from "../../lib/programs/measures";
import { activeGoals, scoreGoal, type FamilyGoal } from "../../lib/goals";
import { localDay, type ObserveStatus, type ObservedWhen } from "../../lib/milestones/observe";
import { lastNightWords, shelfWordsThenNow } from "../../lib/today/shelfWords";
import { quoteKeepsakeDoc, tonightDayQuestion, tonightLineEntry, tonightOutcomeEntry } from "../../lib/loop/tonight";
import { keepsakeDoc, type KeepsakeDoc } from "../../lib/firstsKeepsake";
import type { Milestone } from "../../types";
import { shelfLabel, type ShelfId } from "../../lib/shelves/registry";
import { practiceText, type PracticeQuote, type PracticeWhyReason } from "../loop/PracticeCard";
import { adaptPractice, adaptationSessionKey, type PracticeAdaptationKey } from "../../content/practiceAdaptations";
import { planToday } from "../overview/todayModules";

/**
 * The milestone loop on Now (parity, 9 Oct 2026). The companion rewrite
 * (7e25419e) replaced the Today hub and left its loop — practice → "Did it" →
 * Tonight → notice → the week's goal marks — with no surface. This is that
 * loop's state, moved out of the retired tabs/OverviewTab.tsx unchanged in
 * substance (B-LOOP-04/07/09/10/11/13, B-PROG-03/07), so NowView renders it in
 * the companion design. Every write goes through the seam it always used:
 * recordPracticeDose, setMilestoneObservation, restoreMilestone, keepsakes,
 * addMoment, familyGoals.
 *
 * planToday (todayModules v3) still decides which loop blocks render, so the
 * route's runtime module budget (framework-check RUNTIME_BUDGETED) is real.
 *
 * CLINICAL FIREWALL: no count, %, streak, score or verdict; the dose is
 * logged, never scored; the only age sentence is the Notice card's sourced line.
 */
export function useNowLoop({ aiPracticeId, openPhotoCapture }: { aiPracticeId?: string; openPhotoCapture: () => void }) {
  const {
    milestones, behaviorLogs, childProfile, playLogs, actionLoop, activeTodayAction,
    setMilestoneObservation, restoreMilestone, recordPracticeDose, removeTodayAction, addMoment,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";

  // ── The evening door: bedtimeDoorOpen is the ONE evening rule (18:00 on, or
  //    the family's own wind-down hour); the parent may open Tonight early. ──
  const ageYears = ageYearsOf(childProfile);
  const rhythm = useMemo(
    () => predictRhythm(behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })), Date.now(), { ageYears }),
    [behaviorLogs, ageYears],
  );
  const now = useMemo(() => new Date(), [behaviorLogs, actionLoop, milestones]);
  const [tonightEarly, setTonightEarly] = useState(false);
  const evening = bedtimeDoorOpen(now.getHours(), rhythm.windDownHour) || tonightEarly;

  // ── B-LOOP-09: today's practice (the pure chooser; the AI focus may name a
  //    practiceId from the same candidates — B-LOOP-13 — and wins only then). ──
  const observations = useObservations();
  const coverage = useMemo(() => shelfCoverage(observations, now), [observations, now]);
  const comparisonMonths = comparisonMonthsOf(childProfile, now);
  const dose = useMemo(() => todayDose(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const recentIds = useMemo(() => recentPracticeIds(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  // B-LOOP-13: the journal the focus route chooses from (ids and counts only).
  const journal = useMemo(() => {
    if (comparisonMonths === null) return undefined;
    const base = { childId: childProfile.id, milestones, comparisonMonths, practices: PRACTICES, coverage, today: now, recentPracticeIds: recentIds };
    return buildJournalRequest({
      childId: childProfile.id,
      dateKey: dayKey(now),
      shelfCoverage: coverage,
      nextMilestoneIds: selectNextMilestones(milestones, comparisonMonths, 6).map((m) => m.id),
      candidatePracticeIds: todaysCandidates(base).map((c) => c.practice.id),
      restedShelves: Array.from(restedShelves(milestones, now)),
      pinnedPracticeId: readTodayPin(childProfile.id, now),
      actionLoop,
    });
  }, [childProfile.id, milestones, comparisonMonths, coverage, now, recentIds, actionLoop]);
  const basePick = useMemo(
    () => choosePractice({
      childId: childProfile.id,
      milestones,
      comparisonMonths,
      practices: PRACTICES,
      coverage,
      today: now,
      recentPracticeIds: recentIds,
      // B-LOOP-11: "Try it today" on a journal shelf pins the practice for the
      // day (lib/practice/todayPin); a dose row always wins.
      todayPracticeId: dose?.practiceId ?? readTodayPin(childProfile.id, now),
      todayAdaptation: dose?.practiceAdaptation,
      aiPracticeId,
    }),
    [childProfile.id, milestones, comparisonMonths, coverage, now, recentIds, dose?.practiceId, dose?.practiceAdaptation, aiPracticeId],
  );
  const adaptationKey = adaptationSessionKey(childProfile.id, basePick?.practice.id ?? "", dayKey(now));
  const [adaptationPreview, setAdaptationPreview] = useState<{ session: string; key: PracticeAdaptationKey | null } | null>(null);
  useEffect(() => { setAdaptationPreview(null); }, [adaptationKey]);
  const selectedAdaptation = adaptationPreview?.session === adaptationKey ? adaptationPreview.key : null;
  const pick = useMemo(() => {
    if (!basePick || dose) return basePick;
    return { ...basePick, ...adaptPractice(basePick.practice, selectedAdaptation) };
  }, [basePick, dose, selectedAdaptation]);
  const doseAnswer: PracticeAnswer | null = dose ? (dose.outcome === "not_today" ? "not_today" : "did") : null;
  const sayText = pick ? practiceText(pick.practice, "say", lang, childProfile.gender) : "";
  const answerPractice = (answer: PracticeAnswer) => {
    if (!pick) return;
    recordPracticeDose(practiceDoseEntry(pick, answer, childProfile.id, sayText));
  };
  const words = useMemo(
    () => (pick ? shelfWordsThenNow(observations, behaviorLogs, pick.shelf) : { then: null, now: null }),
    [pick, observations, behaviorLogs],
  );
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
  // The words slot: last night's "What happened?" line on yesterday's
  // practice, else the practice shelf's own notes (THEN and NOW), else nothing.
  const lastNight = useMemo(() => lastNightWords(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const quotes: PracticeQuote[] = lastNight
    ? [{ text: lastNight.text, lead: t("elev.loop.practice.lastNight"), shelf: `${shelfLabel(lastNight.shelf, t)} · ${dateOf(lastNight.at)}`, onShelf: !!pick && lastNight.shelf === pick.shelf }]
    : [words.then, words.now].filter((w): w is NonNullable<typeof w> => !!w).map((w) => ({ text: w.text, date: dateOf(w.at) }));
  const shelfNewestAt = useMemo(() => {
    const ats = [words.now?.at, lastNight && pick && lastNight.shelf === pick.shelf ? lastNight.at : undefined].filter((x): x is string => !!x);
    return ats.sort().pop() ?? null;
  }, [words.now, lastNight, pick]);
  // The why-line states the chooser's reason from the SAME coverage it ranked
  // by (never rendered as a number); frozen for the session once answered.
  const liveWhy = useMemo<PracticeWhyReason | null>(() => {
    if (!pick) return null;
    const n = coverage[pick.shelf] ?? 0;
    if (shelfNewestAt && dayKey(new Date(shelfNewestAt)) !== dayKey(now)) return "since";
    if (n === 0) return shelfNewestAt ? "empty" : "startsPage";
    return n <= Math.min(...Object.values(coverage)) ? "fewest" : null;
  }, [pick, coverage, shelfNewestAt, now]);
  const frozenWhy = useRef<{ id: string; reason: PracticeWhyReason | null } | null>(null);
  if (pick && !dose) frozenWhy.current = { id: pick.practice.id, reason: liveWhy };
  const whyReason = pick && dose && frozenWhy.current?.id === pick.practice.id ? frozenWhy.current.reason : liveWhy;
  const whyDate = whyReason === "since" && shelfNewestAt ? dateOf(shelfNewestAt) : null;

  // ── B-LOOP-04 + B-PROG-03: Notice today; with an active program the week's
  //    watchFor rows are served first (lib/programs/notice). ──
  const programRows = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const noticeProgram = useMemo<NoticeProgram | null>(() => {
    const active = activeProgramWeek(programRows.items, now);
    return active ? { shelf: active.program.shelf, watchFor: active.content.watchFor } : null;
  }, [programRows.items, now]);
  // B-PROG-07: on the LAST day of the program week, Tonight asks how each of
  // the family's goals went — never while a coach step is open.
  const familyGoals = useChildCollection<FamilyGoal>(childProfile.id, "familyGoals");
  const weeklyGoals = useMemo<FamilyGoal[] | undefined>(() => {
    if (activeTodayAction?.status === "accepted") return undefined;
    const active = activeProgramWeek(programRows.items, now);
    if (!active || programDayKey(now) !== programWeekDays(active.enrolment, active.week).to) return undefined;
    const goals = activeGoals(familyGoals.items);
    return goals.length ? goals : undefined;
  }, [activeTodayAction?.status, programRows.items, familyGoals.items, now]);
  const noticePicks = useMemo(
    () => (comparisonMonths === null ? [] : selectNoticeWithProgram(milestones, comparisonMonths, {
      perShelf: 1, total: 3, coverage, now, excludeShelves: pick ? [pick.shelf] : [],
    }, noticeProgram)),
    [milestones, comparisonMonths, coverage, now, pick, noticeProgram],
  );
  const [heldNotice, setHeldNotice] = useState<{ id: string; shelf: ShelfId }[]>([]);
  const [beforeNotice, setBeforeNotice] = useState<Record<string, Milestone>>({});
  const noticeCards = useMemo(() => {
    const held = heldNotice
      .map((h) => ({ shelf: h.shelf, milestone: milestones.find((m) => m.id === h.id) }))
      .filter((h): h is { shelf: ShelfId; milestone: Milestone } => !!h.milestone);
    const fresh = noticePicks.filter((p) => !held.some((h) => h.milestone.id === p.milestone.id || h.shelf === p.shelf));
    return [...held, ...fresh];
  }, [heldNotice, noticePicks, milestones]);
  // No practice for the window → the lead is the thinnest shelf's Notice card.
  const slotNotice = pick ? null : noticeCards[0] ?? null;
  const blockNotices = (pick ? noticeCards : noticeCards.slice(1)).slice(0, 2);
  const keepsakes = useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes");
  const noticeHandlers = (m: Milestone, shelf: ShelfId) => ({
    onAnswer: (status: ObserveStatus) => {
      setHeldNotice((p) => (p.some((h) => h.id === m.id) ? p : [...p, { id: m.id, shelf }]));
      setBeforeNotice((p) => ({ ...p, [m.id]: m }));
      setMilestoneObservation(m.id, status);
    },
    onWhen: (when: ObservedWhen) => setMilestoneObservation(m.id, "yes", { when }),
    onKeepQuote: (note: string) => {
      const at = new Date().toISOString();
      void keepsakes.upsert(keepsakeDoc({ milestoneId: m.id, note: note.slice(0, 280), noticedOn: localDay(new Date()), createdAt: at, updatedAt: at }));
    },
    onKeepPhoto: openPhotoCapture,
    onUndo: () => {
      const previous = beforeNotice[m.id];
      if (previous) restoreMilestone(previous);
    },
  });

  // ── B-LOOP-10: Tonight, each step through its named seam. ──
  const dayQuestion = useMemo(() => tonightDayQuestion(behaviorLogs, now), [behaviorLogs, now]);
  const tonightNotice = noticeCards.find((c) => !pick || c.shelf !== pick.shelf) ?? null;
  const storyFits = HERO_STORIES.some((s) => storyFitsChild(s, childProfile));
  const tonightHasQuestions = !!pick || behaviorLogs.length + playLogs.length > 0 || !!tonightNotice;
  // Tonight asks "Did you try it today?" only about a practice the parent SAW.
  const practiceShown = !!dose || tonightEarly || !!readTodayPin(childProfile.id, now) || (!!pick && readPracticeShown(childProfile.id, now) === pick.practice.id);
  const plan = planToday({
    evening,
    practice: !!pick || !!slotNotice,
    notice: blockNotices.length > 0,
    tonight: tonightHasQuestions,
    practiceAnswered: !!dose,
    practiceShown: pick ? practiceShown : true,
  });
  // The impression is written by the DAY card only.
  const shownPracticeId = plan.practiceMode === "card" && pick ? pick.practice.id : null;
  useEffect(() => {
    if (shownPracticeId) markPracticeShown(childProfile.id, shownPracticeId, now);
  }, [childProfile.id, shownPracticeId, now]);

  const tonight = {
    childName: (childProfile.name || "").split(" ")[0],
    gender: childProfile.gender,
    practice: pick,
    doseAnswer,
    doseAt: dose?.acceptedAt ?? null,
    onPracticeAnswer: answerPractice,
    onOutcome: (outcome: Parameters<typeof tonightOutcomeEntry>[1]) => {
      if (!pick) return;
      const row = dose ?? practiceDoseEntry(pick, "did", childProfile.id, sayText);
      recordPracticeDose(tonightOutcomeEntry(row, outcome));
    },
    onWhatHappened: async (text: string) => {
      if (!pick) return;
      // The seam's own toast is this write's one failure message (Tonight has no inline error).
      if (!await addMoment(text, { shelf: pick.shelf, ...(pick.milestone ? { milestoneId: pick.milestone.id } : {}) })) return;
      // B-LOOP-13: the line also lands on the day's dose row (tomorrow's choice).
      const row = tonightLineEntry(dose ?? practiceDoseEntry(pick, "did", childProfile.id, sayText), text);
      if (row) recordPracticeDose(row);
    },
    dayQuestion,
    onQuote: (text: string) => {
      const doc = quoteKeepsakeDoc(text);
      if (doc) void keepsakes.upsert(doc);
    },
    notice: tonightNotice,
    onNotice: (status: ObserveStatus) => { if (tonightNotice) noticeHandlers(tonightNotice.milestone, tonightNotice.shelf).onAnswer(status); },
    onNoticeWhen: (when: ObservedWhen) => { if (tonightNotice) setMilestoneObservation(tonightNotice.milestone.id, "yes", { when }); },
    onNoticeUndo: () => { if (tonightNotice) noticeHandlers(tonightNotice.milestone, tonightNotice.shelf).onUndo(); },
    weeklyGoals,
    onGoalScore: (goalId: string, value: Parameters<typeof scoreGoal>[1]) => {
      const goal = familyGoals.items.find((g) => g.id === goalId);
      if (goal) void familyGoals.upsert(scoreGoal(goal, value, new Date()));
    },
  };

  return {
    now, evening, rhythm, setTonightEarly, plan, journal, pick, dose, doseAnswer, adaptationKey,
    setAdaptation: (key: PracticeAdaptationKey | null) => setAdaptationPreview({ session: adaptationKey, key }),
    answerPractice, undoPractice: dose ? () => removeTodayAction(dose.id) : undefined,
    quotes, whyReason, whyDate, slotNotice, blockNotices, noticeHandlers, tonight, tonightHasQuestions,
    storyFits, keepsakeDocs: keepsakes.items,
  };
}
