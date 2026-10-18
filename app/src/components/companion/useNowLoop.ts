import { useEffect, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useObservations } from "../../hooks/useObservations";
import { useNoticeActions } from "../../hooks/useNoticeActions";
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
import { readTodayPin, readPracticeShown } from "../../lib/practice/todayPin";
import { shelfCoverage } from "../../lib/milestones/selectByShelf";
import { selectNoticeWithProgram, type NoticeProgram } from "../../lib/programs/notice";
import { activeProgramWeek, dayKey as programDayKey } from "../../lib/programs/enrolment";
import { programWeekDays } from "../../lib/programs/measures";
import { activeGoals, scoreGoal, type FamilyGoal } from "../../lib/goals";
import type { ObserveStatus, ObservedWhen } from "../../lib/milestones/observe";
import { lastNightWords, shelfWordsThenNow } from "../../lib/today/shelfWords";
import { quoteKeepsakeDoc, tonightDayQuestion, tonightLineEntry, tonightOutcomeEntry } from "../../lib/loop/tonight";
import type { KeepsakeDoc } from "../../lib/firstsKeepsake";
import { openNoticeDetail } from "../../lib/noticeNavigation";
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
export function useNowLoop({ aiPracticeId, now, questionShelves }: {
  aiPracticeId?: string;
  openPhotoCapture: () => void;
  now: Date;
  /** v3 question continuity (audit #3): the active question's shelves
   *  (companionChoices shelvesForQuestion). Set and non-empty, the practice
   *  and Notice picks are drawn from them only, so the card never says sleep
   *  while the art says mornings; empty, the loop keeps its own order. */
  questionShelves?: readonly ShelfId[];
}) {
  const {
    milestones, behaviorLogs, childProfile, playLogs, actionLoop, activeTodayAction,
    recordPracticeDose, removeTodayAction, addMoment,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const notices = useNoticeActions();
  const keepsakes = notices.keepsakes;

  // ── The evening door: bedtimeDoorOpen is the ONE evening rule (18:00 on, or
  //    the family's own wind-down hour); the parent may open Tonight early. ──
  const ageYears = ageYearsOf(childProfile, now);
  const rhythm = useMemo(
    () => predictRhythm(behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })), now.getTime(), { ageYears }),
    [behaviorLogs, ageYears, now],
  );
  const [tonightEarly, setTonightEarly] = useState(false);
  const evening = bedtimeDoorOpen(now.getHours(), rhythm.windDownHour) || tonightEarly;

  // ── B-LOOP-09: today's practice (the pure chooser; the AI focus may name a
  //    practiceId from the same candidates — B-LOOP-13 — and wins only then). ──
  const observations = useObservations();
  const coverage = useMemo(() => shelfCoverage(observations, now), [observations, now]);
  const comparisonMonths = comparisonMonthsOf(childProfile, now);
  const dose = useMemo(() => todayDose(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const recentIds = useMemo(() => recentPracticeIds(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const shelvesKey = (questionShelves ?? []).join("|");
  const questionFilter = useMemo<((p: { shelf: ShelfId }) => boolean) | undefined>(() => {
    const shelves = new Set(shelvesKey ? shelvesKey.split("|") as ShelfId[] : []);
    return shelves.size ? (p) => shelves.has(p.shelf) : undefined;
  }, [shelvesKey]);
  // B-LOOP-13: the journal the focus route chooses from (ids and counts only).
  const journal = useMemo(() => {
    if (comparisonMonths === null) return undefined;
    const base = { childId: childProfile.id, milestones, comparisonMonths, practices: PRACTICES, coverage, today: now, recentPracticeIds: recentIds, candidateFilter: questionFilter };
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
  }, [childProfile.id, milestones, comparisonMonths, coverage, now, recentIds, actionLoop, questionFilter]);
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
      candidateFilter: questionFilter,
    }),
    [childProfile.id, milestones, comparisonMonths, coverage, now, recentIds, dose?.practiceId, dose?.practiceAdaptation, aiPracticeId, questionFilter],
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
    }, noticeProgram)).filter((p) => !questionFilter || questionFilter(p)),
    [milestones, comparisonMonths, coverage, now, pick, noticeProgram, questionFilter],
  );
  const [heldNotice, setHeldNotice] = useState<{ scope: string; rows: { id: string; shelf: ShelfId }[] }>({ scope: notices.scopeKey, rows: [] });
  const noticeCards = useMemo(() => {
    const held = (heldNotice.scope === notices.scopeKey ? heldNotice.rows : [])
      .map((h) => ({ shelf: h.shelf, milestone: milestones.find((m) => m.id === h.id) }))
      .filter((h): h is { shelf: ShelfId; milestone: Milestone } => !!h.milestone);
    const fresh = noticePicks.filter((p) => !held.some((h) => h.milestone.id === p.milestone.id || h.shelf === p.shelf));
    return [...held, ...fresh].slice(0, 3);
  }, [heldNotice, notices.scopeKey, noticePicks, milestones]);
  // No practice for the window → the lead is the thinnest shelf's Notice card.
  const slotNotice = pick ? null : noticeCards[0] ?? null;
  const blockNotices = (pick ? noticeCards : noticeCards.slice(1)).slice(0, 2);
  const noticeHandlers = (m: Milestone, _shelf: ShelfId) => {
    const actions = notices.forMilestone(m);
    return {
      ...actions,
      onAnswer: (status: ObserveStatus) => {
        // Hold the offered order, including its siblings. Answering the second
        // object must not move it ahead of the one the parent just read.
        setHeldNotice({
          scope: notices.scopeKey,
          rows: noticeCards.map(card => ({ id: card.milestone.id, shelf: card.shelf })),
        });
        return actions.onAnswer(status);
      },
      onOpen: () => openNoticeDetail(childProfile.id, m.id),
      onDetails: () => openNoticeDetail(childProfile.id, m.id),
      onKeepPhoto: () => openNoticeDetail(childProfile.id, m.id, { editEvidence: true }),
    };
  };

  // ── B-LOOP-10: Tonight, each step through its named seam. ──
  const dayQuestion = useMemo(() => tonightDayQuestion(behaviorLogs, now), [behaviorLogs, now]);
  const tonightNotice = noticeCards.find((c) => !pick || c.shelf !== pick.shelf) ?? null;
  const tonightNoticeActions = tonightNotice ? noticeHandlers(tonightNotice.milestone, tonightNotice.shelf) : undefined;
  const quoteAttempt = useRef<{ scope: string; text: string; doc: KeepsakeDoc } | null>(null);
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
  const tonight = {
    scopeKey: notices.scopeKey,
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
      if (!pick) return false;
      // The seam's own toast is this write's one failure message (Tonight has no inline error).
      if (!await addMoment(text, {
        shelf: pick.shelf, ...(pick.milestone ? { milestoneId: pick.milestone.id } : {}),
        requireAcknowledgement: true, retryKey: `tonight:${dayKey(now)}:${pick.practice.id}`, isCurrent: notices.isCurrent,
      })) return false;
      // B-LOOP-13: the line also lands on the day's dose row (tomorrow's choice).
      const row = tonightLineEntry(dose ?? practiceDoseEntry(pick, "did", childProfile.id, sayText), text);
      if (row) recordPracticeDose(row);
      return true;
    },
    dayQuestion,
    onQuote: async (text: string) => {
      if (!notices.isCurrent()) throw new Error("The child changed");
      const previous = quoteAttempt.current;
      const built = quoteKeepsakeDoc(text);
      if (!built) throw new Error("Add words before keeping the moment");
      const doc = previous?.scope === notices.scopeKey
        ? previous.text === text ? previous.doc : { ...built, id: previous.doc.id, createdAt: previous.doc.createdAt, noticedOn: previous.doc.noticedOn }
        : built;
      quoteAttempt.current = { scope: notices.scopeKey, text, doc };
      await keepsakes.upsert(doc, { requireAcknowledgement: true });
      if (!notices.isCurrent()) throw new Error("The child changed");
      quoteAttempt.current = null;
    },
    notice: tonightNotice,
    noticeActions: tonightNoticeActions,
    onNotice: (status: ObserveStatus) => tonightNoticeActions?.onAnswer(status),
    onNoticeWhen: (when: ObservedWhen) => tonightNoticeActions?.onWhen(when),
    onNoticeUndo: tonightNoticeActions?.onUndo,
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
