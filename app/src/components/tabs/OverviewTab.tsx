import React, { useEffect, useMemo, useRef, useState } from "react";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { formatChildAge } from "../../lib/age/format";
import { availableHardMomentCards } from "../../content/selectCards";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import { bedtimeDoorOpen } from "../../lib/timeOfDay";
import QuickLogModal from "../overview/QuickLogModal";
import WhatChanged from "../overview/WhatChanged";
import { composeWhatChanged, type WhatChangedLine } from "../overview/whatChangedEvents";
import { firstsStorageKey, type FirstsState } from "../../lib/firsts";
import { Avatar } from "../ui/Avatar";
import { SectionHead } from "../ui/SectionHead";
import { childPicture } from "../../lib/childPicture";
import type { CaptureMode } from "../../context/ArborContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { predictRhythm } from "../../rhythm/predict";
import { planToday } from "../overview/todayModules";
import { useLifecycleMoment } from "../overview/useLifecycleMoment";
import CompanionOfferSlot from "../overview/CompanionOfferSlot";
import { useCompanionOffer } from "../overview/useCompanionOffer";
import TodayStepLine from "../overview/TodayStepLine";
import TodaySayBackLine from "../overview/TodaySayBackLine";
import FamilyOfferLines from "../overview/FamilyOfferLines";
import ArborNoticedCard from "../sections/ArborNoticedCard";
import { useWeeklyRecap } from "../../hooks/useWeeklyRecap";
import { track } from "../../lib/analytics";
import { ageYearsOf, comparisonMonthsOf } from "../../lib/age/forChild";
import { storyFitsChild } from "../../lib/age/playGate";
import { HERO_STORIES } from "../../lib/heroJourneys";
import { useChildCollection } from "../../hooks/useChildCollection";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { useObservations } from "../../hooks/useObservations";
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
import PracticeCard, { practiceText, type PracticeQuote, type PracticeWhyReason } from "../loop/PracticeCard";
import { adaptPractice, adaptationSessionKey, type PracticeAdaptationKey } from "../../content/practiceAdaptations";
import NoticeCard from "../loop/NoticeCard";
import TonightFlow from "../loop/TonightFlow";

const DAY = 86_400_000;

/**
 * TODAY — B-LOOP-07: THREE BLOCKS, the milestone loop (design of record:
 * execution/2026-10-06--milestone-loop/art/mockups/today-option-1.html,
 * Guy's option 1 — the practice leads, no shelf strip on Today).
 *
 *   child line (name · age · day) → "One small thing for {name} today"
 *   1 · Today's practice (PracticeCard, B-LOOP-09) — the primary move
 *       (data-primary-move="do-practice"); the parent's own words on the
 *       practice's shelf, THEN and NOW, sit under the title (P1's record
 *       card, absorbed — the standalone FromRecordCard mount is gone). With no
 *       practice for the window, the thin shelf's Notice card takes the slot.
 *   2 · Notice today — ≤ 2 Notice cards (B-LOOP-04), never the practice's shelf.
 *   3 · Tonight — before the evening door: ONE pointer line; after it: the
 *       three-question flow (B-LOOP-10) leads and carries the ONE stamp on
 *       its current step; Notice follows. The morning receipt is not shown
 *       while Tonight is open (critic c2 r1), and the story is a door line.
 *   "More for today" — ONE collapsed door (chrome, never counted), LINES
 *       only (P5 r1 pass A5): what changed since you left (≤ 3 lines), then
 *       hard-moment words · this week's letter · Daily Play · the ONE proactive
 *       offer (B-AI-06 CompanionOfferSlot: ENG-12 carry-over, B-TODAY-18
 *       resume / tomorrow reason) · an accepted step still open today as ONE
 *       line with its two answers (TodayStepLine) · the watch signal
 *       (ArborNoticedCard, clinical, no other home) · the sibling lines. A
 *       lifecycle moment is a short note in the practice header; the first-
 *       steps rail is superseded by the three blocks (REJECTIONS.md, P5-LOOP
 *       session A, pass A5).
 *
 * todayModules.ts v3 (planToday) decides the ≤ 3 modules from their REAL
 * render conditions. chooseTodayAction is retired for Today (kept for its
 * other importers). The quick-capture bar stays (ambient chrome).
 *
 * CLINICAL FIREWALL: no count, %, streak, score or verdict on Today; the only
 * age sentence is the Notice card's sourced line; dose is logged, never scored.
 */
export default function OverviewTab() {
  const {
    setActiveTab, milestones, checkedMilestones,
    behaviorLogs, childProfile,
    playLogs, actionLoop, requestJournalFocus, approvedMemoryItems,
    pendingCaptureMode, consumeCaptureRequest, openHardMomentNow,
    setMilestoneObservation, restoreMilestone, recordPracticeDose, removeTodayAction,
    addMoment, activeTodayAction,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  // W6.2 ambient capture → B-TODAY-19: every tile opens the ONE capture sheet in place.
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [quickLogMode, setQuickLogMode] = useState<CaptureMode>("text");
  const [quickLogPromptKey, setQuickLogPromptKey] = useState<string | null>(null);
  const [quickLogHard, setQuickLogHard] = useState(false);
  const startCapture = (mode: CaptureMode, promptKey: string | null = null, hard = false) => {
    setQuickLogMode(mode);
    setQuickLogPromptKey(promptKey);
    setQuickLogHard(hard);
    setQuickLogOpen(true);
  };
  // ENG-01: a pending "text" capture request lands here as the open sheet.
  useEffect(() => {
    if (pendingCaptureMode !== "text") return;
    consumeCaptureRequest();
    startCapture("text");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);

  const firstName = (childProfile.name || "your child").split(" ")[0];
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);

  // ── The evening door: bedtimeDoorOpen is the ONE evening rule (18:00 on, or
  //    the family's own wind-down hour). The parent may also open Tonight early
  //    from the pointer line. ──
  const rhythm = useMemo(
    () => predictRhythm(behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })), Date.now(), { ageYears: ageYearsOf(childProfile) }),
    [behaviorLogs, ageYearsOf(childProfile)]
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
  // The focus route keeps its existing signals (B-TODAY-11: moments + plays +
  // milestones noticed in 7 days; the top incident pattern; the last rated
  // step); B-LOOP-13 adds the practice candidates it may choose from.
  const recentCount = useMemo(() => {
    const since = Date.now() - 7 * DAY;
    const inWindow = (raw?: string) => {
      const at = raw ? new Date(raw).getTime() : NaN;
      return Number.isFinite(at) && at >= since;
    };
    return (
      behaviorLogs.filter((l) => inWindow(l.timestamp)).length +
      playLogs.filter((p) => inWindow(p.timestamp)).length +
      milestones.filter((m) => m.checked && inWindow(m.observationUpdatedAt)).length
    );
  }, [behaviorLogs, playLogs, milestones]);
  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    behaviorLogs.filter((l) => isIncidentType(l.behaviorType)).forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = "";
    let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);
  const latestCompletedAction = useMemo(() => actionLoop.find((entry) => entry.status === "completed" && entry.outcome), [actionLoop]);
  const latestRecordAt = useMemo(() => {
    let latest = 0;
    const consider = (raw?: string) => {
      const at = raw ? new Date(raw).getTime() : NaN;
      if (Number.isFinite(at) && at > latest) latest = at;
    };
    for (const l of behaviorLogs) consider(l.timestamp);
    for (const p of playLogs) consider(p.timestamp);
    for (const a of actionLoop) consider(a.outcomeAt);
    return latest || undefined;
  }, [behaviorLogs, playLogs, actionLoop]);
  // B-LOOP-13: the journal the focus route chooses from — ids and counts the
  // client already holds (every text is resolved on the server from the
  // catalogue): 30-day shelf counts, the open milestones, TODAY's candidates
  // (the same list the pure chooser ranks), the "not sure" shelves, the day
  // pin and the practice dose rows (night answers). Zero new model calls: it
  // rides on the one focus request.
  const recentIds = useMemo(() => recentPracticeIds(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
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
  const { focus } = useTodaysFocus(childProfile, {
    count: recentCount,
    topTrigger,
    lastActionRecommendation: latestCompletedAction?.recommendation,
    lastActionOutcome: latestCompletedAction?.outcome,
    latestAt: latestRecordAt,
  }, journal);
  // B-LOOP-13: only the AI's OWN pick (practiceVia "ai") is offered to the
  // chooser, which honours it inside today's candidates and below a dose row
  // or the parent's pin; the why-line rides with it.
  const aiPracticeId = focus?.practiceVia === "ai" ? focus.practiceId : undefined;
  const basePick = useMemo(
    () => choosePractice({
      childId: childProfile.id,
      milestones,
      comparisonMonths,
      practices: PRACTICES,
      coverage,
      today: now,
      recentPracticeIds: recentIds,
      // B-LOOP-11: "Try it today" on a journal shelf page pins the practice
      // for the day (lib/practice/todayPin); a dose row always wins.
      todayPracticeId: dose?.practiceId ?? readTodayPin(childProfile.id, now),
      todayAdaptation: dose?.practiceAdaptation,
      aiPracticeId,
    }),
    [childProfile.id, milestones, comparisonMonths, coverage, now, recentIds, dose?.practiceId, dose?.practiceAdaptation, aiPracticeId]
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
    [pick, observations, behaviorLogs]
  );
  const dateOf = (iso: string) => new Date(iso).toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short" });
  // P5-LOOP critic c2 r1 (product P1-2, stronger target a): the words slot is
  // fed by the LOOP — last night's "What happened?" line on yesterday's
  // practice, quoted with its shelf — and falls back to the practice shelf's
  // own notes at any age (THEN and NOW), else nothing (no filler).
  const lastNight = useMemo(() => lastNightWords(actionLoop, childProfile.id, now), [actionLoop, childProfile.id, now]);
  const quotes: PracticeQuote[] = lastNight
    // c2 r2 (P1-1, B-LOOP-NEW-2a): verbatim, shelved AND dated ("· Sleep · 6 Oct").
    // B-DESIGN-04 (P2-N1): onShelf tells the receipt whether "next to your words" is true.
    ? [{ text: lastNight.text, lead: t("elev.loop.practice.lastNight"), shelf: `${shelfLabel(lastNight.shelf, t)} · ${dateOf(lastNight.at)}`, onShelf: !!pick && lastNight.shelf === pick.shelf }]
    : [words.then, words.now].filter((w): w is NonNullable<typeof w> => !!w).map((w) => ({ text: w.text, date: dateOf(w.at) }));
  // The newest of the parent's words ON THIS SHELF (the "since" reason's date).
  const shelfNewestAt = useMemo(() => {
    const ats = [words.now?.at, lastNight && pick && lastNight.shelf === pick.shelf ? lastNight.at : undefined].filter((x): x is string => !!x);
    return ats.sort().pop() ?? null;
  }, [words.now, lastNight, pick]);
  // P5 r1 pass A3: the why-line states the chooser's reason from the SAME
  // coverage count it ranked by (never rendered as a number): nothing on the
  // shelf this month, or the fewest notes of all the child's shelves; the
  // alternation's second shelf gets the plain line — never a false "fewest".
  // c2 r1: with the parent's words on this shelf the line answers them ("your
  // last words … are from {date}; tonight's answer goes next to them"); with
  // none, "tonight's answer starts that page". The reason chosen for a
  // practice is FROZEN for the session (P2-1: "Did it" adds a row to the
  // shelf, and the line must not fall back to the reasonless one).
  const liveWhy = useMemo<PracticeWhyReason | null>(() => {
    if (!pick) return null;
    const n = coverage[pick.shelf] ?? 0;
    if (shelfNewestAt && dayKey(new Date(shelfNewestAt)) !== dayKey(now)) return "since";
    if (n === 0) return shelfNewestAt ? "empty" : "startsPage";
    return n <= Math.min(...Object.values(coverage)) ? "fewest" : null;
  }, [pick, coverage, shelfNewestAt, now]);
  // live until the day's answer exists (the record may still be loading), then held
  const frozenWhy = useRef<{ id: string; reason: PracticeWhyReason | null } | null>(null);
  if (pick && !dose) frozenWhy.current = { id: pick.practice.id, reason: liveWhy };
  const whyReason = pick && dose && frozenWhy.current?.id === pick.practice.id ? frozenWhy.current.reason : liveWhy;
  const whyDate = whyReason === "since" && shelfNewestAt ? dateOf(shelfNewestAt) : null;

  // ── B-LOOP-04: Notice today. A card the parent just answered stays in place
  //    for the session (its receipt); the block never shows the practice's shelf.
  //    B-PROG-03 (seam): with an ACTIVE program (lib/programs/enrolment), the
  //    program's shelf is skipped by the thinnest-shelf rule and the week's
  //    watchFor rows are served first (lib/programs/notice); no enrolment =
  //    exactly the previous selection. ──
  const programRows = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const noticeProgram = useMemo<NoticeProgram | null>(() => {
    const active = activeProgramWeek(programRows.items, now);
    return active ? { shelf: active.program.shelf, watchFor: active.content.watchFor } : null;
  }, [programRows.items, now]);
  // B-PROG-07: on the LAST day of the active program week, Tonight asks how
  // each of the family's goals went (step 4, the family's own words) — never
  // while a coach step is open (one question line at a time, the step first).
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
      perShelf: 1,
      total: 3,
      coverage,
      now,
      excludeShelves: pick ? [pick.shelf] : [],
    }, noticeProgram)),
    [milestones, comparisonMonths, coverage, now, pick, noticeProgram]
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
  // No practice for the window → block 1 is the thinnest shelf's Notice card.
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
    onKeepPhoto: () => startCapture("photo"),
    onUndo: () => {
      const previous = beforeNotice[m.id];
      if (previous) restoreMilestone(previous);
    },
  });

  // ── B-LOOP-10: Tonight's wiring — each step through its named seam. ──
  const dayQuestion = useMemo(() => tonightDayQuestion(behaviorLogs, now), [behaviorLogs, now]);
  const tonightNotice = noticeCards.find((c) => !pick || c.shelf !== pick.shelf) ?? null;
  const storyFits = HERO_STORIES.some((s) => storyFitsChild(s, childProfile));
  const tonightHasQuestions = !!pick || behaviorLogs.length + playLogs.length > 0 || !!tonightNotice;

  // P5-LOOP critic c2 r2 (product P1-2, B-LOOP-NEW-2a): Tonight asks "Did
  // you try it today?" only about a practice the parent SAW today — a dose
  // row, the parent opening Tonight from the pointer, the day pin, or the
  // card's day-mode impression. Otherwise the evening offers the practice.
  const practiceShown = !!dose || tonightEarly || !!readTodayPin(childProfile.id, now) || (!!pick && readPracticeShown(childProfile.id, now) === pick.practice.id);
  const plan = planToday({
    evening,
    practice: !!pick || !!slotNotice,
    notice: blockNotices.length > 0,
    tonight: tonightHasQuestions,
    practiceAnswered: !!dose,
    practiceShown: pick ? practiceShown : true,
  });
  // The impression is written by the DAY card only (the tonight-mode card
  // must not flip itself into the question it replaced).
  const shownPracticeId = plan.practiceMode === "card" && pick ? pick.practice.id : null;
  useEffect(() => {
    if (shownPracticeId) markPracticeShown(childProfile.id, shownPracticeId, now);
  }, [childProfile.id, shownPracticeId, now]);
  useEffect(() => {
    track("today_action_offered", { kind: plan.order[0] ?? "none" });
  }, [plan.order[0]]);

  // ── The door: "More for today" (one row, collapsed; chrome, not a module). ──
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
  const changed = useMemo(
    () => composeWhatChanged({
      previousVisitAt: isReturning && !dayZero ? previousVisitAt : null,
      behaviorLogs,
      playLogs,
      milestones,
      actionLoop,
      approvedFactsSince,
      firstsState,
      firstsCounts: { milestoneCount: checkedMilestones },
      // the watch signal renders as its own card behind the door (never twice)
      includeNoticed: false,
    }),
    [isReturning, dayZero, previousVisitAt, behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState, checkedMilestones]
  );
  // Returning parents only, never day-0 (B-TODAY-21 gate, now behind the door).
  const changedWould = !dayZero && isReturning && changed.lines.length > 0;
  const weeklyRecap = useWeeklyRecap();
  const onChangedLineTap = (line: WhatChangedLine) => {
    if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") {
      setActiveTab("development");
      return;
    }
    if (line.kind === "facts" || line.kind === "ideas") {
      setActiveTab("memory");
      return;
    }
    requestJournalFocus(line.focusId);
    setActiveTab("journal");
  };
  const hardMomentTile = useMemo(() => {
    const at = new Date();
    return availableHardMomentCards({ now: at, ageMonths: ageMonthsFromProfile(childProfile, at), locale: lang }).length > 0;
  }, [childProfile, lang]);
  // P5 r1 pass A5: a lifecycle moment is ONE short note inside the practice
  // header (the pack), never a card in the door. Kinds whose title restates
  // the age (welcome-back, age-band) add nothing the H1 does not say.
  const lifecycle = useLifecycleMoment({ previousVisitAt });
  const LIFECYCLE_NOTE: Partial<Record<string, string>> = {
    birthday: "elev.lifecycle.birthday.title",
    "first-week": "elev.lifecycle.week.title",
    "first-month": "elev.lifecycle.month.title",
    "first-moment": "elev.lifecycle.first.title",
  };
  // B-AI-06: ONE proactive offer per open — the coordinator ranks the
  // lifecycle moment with the carry-over ask, appointments and the cues
  // (a "what-changed" winner renders as the header note, the slot stays empty).
  const todayOffer = useCompanionOffer("today", {
    whatChanged: lifecycle.moment ? { id: lifecycle.moment.kind } : null,
  });
  const lifecycleKey = lifecycle.moment && todayOffer.offer?.kind === "what-changed" ? LIFECYCLE_NOTE[lifecycle.moment.kind] : undefined;
  const lifecycleNote = lifecycleKey ? t(lifecycleKey, { name: firstName }) : null;

  // B-TODAY-28 / B-INF-10: the child leads — name · age · weekday + part of day.
  const hour = now.getHours();
  const whenKey = hour < 12 ? "today.when.morning" : hour < 18 ? "today.when.afternoon" : "today.when.evening";
  const weekday = now.toLocaleDateString(lang === "he" ? "he-IL" : "en-GB", { weekday: "long" });
  const ageText = formatChildAge(childProfile, t);
  const nowrap = (s: string) => s.replace(/ /g, " ");
  // P5 design r1 P0-1 (6 Oct): the H1 carries name · age on ONE line; the
  // weekday moves into the one eyebrow line ("Tuesday morning · one small
  // thing for Dylan"), and the shell's hub line is quiet on this route
  // (Shell HUB_LINE_QUIET_TABS) — together ≈ 50 px back above the fold.
  const identityLine = ageText ? t("elev.loop.today.identity", { name: firstName, age: nowrap(ageText) }) : firstName;
  // c2 r2 P1-2: "three quick questions" only when Tonight's flow leads.
  const eyebrowLine = t(evening && plan.order[0] === "tonight" ? "elev.loop.today.eyebrowEvening" : "elev.loop.today.eyebrow", { when: t(whenKey, { weekday }), name: firstName });
  // Law 7 (P5 design r1 P0-1): ONE stamp literal on this route, placed on the
  // first block's ANSWER group (h ≈ 48) — never on a whole card, whose height
  // let the fold gate pass while "Did it" sat under the capture dock.
  const primaryStamp = { "data-primary-move": "do-practice" } as const;
  // the same id for the components that take it as a prop (no second literal)
  const [primaryMoveId] = Object.values(primaryStamp);
  const firstBlock = plan.order[0];

  const doorLine = (testId: string, icon: string, label: string, onClick: () => void) => (
    <button
      key={testId}
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[14px] font-semibold"
      style={{ color: "var(--arbor-ink)" }}
    >
      <Icon name={icon} size={18} style={{ color: "var(--arbor-muted)" }} />
      <span className="min-w-0 flex-1">{label}</span>
      <Icon name="chevron_right" size={18} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
    </button>
  );

  const practiceBlock = pick ? (
    <PracticeCard
      key={adaptationKey}
      practice={pick.practice}
      milestone={pick.milestone}
      shelf={pick.shelf}
      childName={firstName}
      gender={childProfile.gender}
      answered={doseAnswer}
      onAnswer={answerPractice}
      onUndo={dose ? () => removeTodayAction(dose.id) : undefined}
      quotes={quotes}
      whyReason={whyReason}
      whyDate={whyDate}
      /* B-LOOP-13: the AI's why sentence replaces the chooser's reason ONLY
         beside its own pick; the mock provider / a dropped pick keeps the line. */
      whyText={pick.via === "ai" ? focus?.why : null}
      headerNote={lifecycleNote}
      stampMove={firstBlock === "practice" ? primaryMoveId : undefined}
      mode={plan.practiceMode === "tonight" ? "tonight" : "day"}
      adaptation={pick.adaptation?.key ?? null}
      onAdapt={(key) => setAdaptationPreview({ session: adaptationKey, key })}
    />
  ) : slotNotice ? (
    <NoticeCard key={slotNotice.milestone.id} milestone={slotNotice.milestone} shelf={slotNotice.shelf} gender={childProfile.gender} childName={firstName} variant="card" answers="segmented" answersAttrs={firstBlock === "practice" ? primaryStamp : undefined} {...noticeHandlers(slotNotice.milestone, slotNotice.shelf)} />
  ) : null;

  const noticeBlock = (
    // B-DESIGN-04 (blend frame 01): the section opens on the editorial section
    // head (glyph · title · hairline) with its sub-line; the rows sit in ONE
    // card on the hairline-ring depth (the deep shadow is the practice card's).
    <section data-testid="today-notice" aria-labelledby="today-notice-title" className="min-w-0">
      <SectionHead id="today-notice-title" icon="visibility" title={t("elev.loop.today.notice.title")} sub={t("elev.loop.today.notice.sub")} />
      <div className="arbor-depth-card mt-3 px-4 sm:px-5" style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)" }}>
        {blockNotices.map((c, i) => (
          <div key={c.milestone.id} style={i > 0 ? { borderTop: "1px solid var(--arbor-rule)" } : undefined}>
            {/* Practice answered: the move passes to the first Notice row's answers. */}
            <NoticeCard milestone={c.milestone} shelf={c.shelf} gender={childProfile.gender} childName={firstName} variant="row" answers="segmented" answersAttrs={i === 0 && firstBlock === "practice" && pick && doseAnswer ? primaryStamp : undefined} {...noticeHandlers(c.milestone, c.shelf)} />
          </div>
        ))}
      </div>
    </section>
  );

  const tonightBlock = (
    <TonightFlow
      childName={firstName}
      gender={childProfile.gender}
      practice={pick}
      doseAnswer={doseAnswer}
      doseAt={dose?.acceptedAt ?? null}
      onPracticeAnswer={answerPractice}
      onOutcome={(outcome) => {
        if (!pick) return;
        const row = dose ?? practiceDoseEntry(pick, "did", childProfile.id, sayText);
        recordPracticeDose(tonightOutcomeEntry(row, outcome));
      }}
      onWhatHappened={async (text) => {
        if (!pick) return;
        if (!await addMoment(text, { shelf: pick.shelf, ...(pick.milestone ? { milestoneId: pick.milestone.id } : {}) })) return;
        // B-LOOP-13: the line also lands on the day's dose row — the night
        // answer tomorrow's practice is chosen from (≤ 240 chars; the helper
        // line under the field says so), and tomorrow morning's line 1 on
        // Today (c2 r1). Never the quote keepsake.
        const row = tonightLineEntry(dose ?? practiceDoseEntry(pick, "did", childProfile.id, sayText), text);
        if (row) recordPracticeDose(row);
      }}
      dayQuestion={dayQuestion}
      onQuote={(text) => {
        const doc = quoteKeepsakeDoc(text);
        if (doc) void keepsakes.upsert(doc);
      }}
      notice={tonightNotice}
      onNotice={(status) => tonightNotice && noticeHandlers(tonightNotice.milestone, tonightNotice.shelf).onAnswer(status)}
      onNoticeWhen={(when) => tonightNotice && setMilestoneObservation(tonightNotice.milestone.id, "yes", { when })}
      onNoticeUndo={() => tonightNotice && noticeHandlers(tonightNotice.milestone, tonightNotice.shelf).onUndo()}
      weeklyGoals={weeklyGoals}
      onGoalScore={(goalId, value) => {
        const goal = familyGoals.items.find((g) => g.id === goalId);
        if (goal) void familyGoals.upsert(scoreGoal(goal, value, new Date()));
      }}
      stampMove={firstBlock === "tonight" ? primaryMoveId : undefined}
    />
  );

  const blocks: Record<string, React.ReactNode> = { practice: practiceBlock, notice: noticeBlock, tonight: tonightBlock };

  return (
    <motion.div
      /* Fade-only entrance (no `y`): a transform here would capture the < md
         position:fixed quick-capture pin (TODAY-4). */
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 md:gap-5 relative max-w-[1180px] mx-auto max-md:pb-20"
    >
      <header className="px-1">
        {/* P5 design r1 P0-1: ONE caption line (the day folded in) above a one-line H1. */}
        {/* B-DESIGN-04 (blend frame 01): the kicker opens on the part of day's glyph. */}
        <p data-testid="today-caption" className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--arbor-ink-soft)", fontSize: "var(--t-sm)" }}>
          <Icon name={evening ? "dark_mode" : "wb_sunny"} size={18} fill={1} aria-hidden style={{ color: evening ? "var(--arbor-lav-ink)" : "var(--arbor-yellow-ink)" }} />
          <span className="min-w-0">{eyebrowLine}</span>
        </p>
        {/* B-SHELL-27: the same face as the sidebar/switcher, a 28 px circle in the identity line only. */}
        <div className="mt-1 flex items-center gap-2.5">
          <Avatar name={childProfile.name} photoURL={childPicture(childProfile).url} size={28} />
          {/* Critic r1 (P0, Law 8): no dir="auto", no outer bdi — the h1 inherits the page direction. */}
          <h1 data-testid="today-identity" className="min-w-0 truncate font-semibold leading-tight text-start" style={{ color: "var(--arbor-ink)", fontSize: "var(--t-lg)" }}>
            {identityLine}
          </h1>
        </div>
      </header>

      <div data-today-tracks="" className="flex flex-col gap-4 md:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-5">
        {/* Quick Capture — ambient chrome, first in the DOM, pinned above the
            phone tab bar, the inline-end track at lg. Not a module. */}
        <div className="max-md:fixed max-md:inset-x-4 max-md:z-30 max-md:bottom-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+8px)] lg:col-start-2 lg:row-start-1">
          <QuickCaptureBar
            key="today-primary-capture"
            stack
            childName={firstName}
            onText={() => startCapture("text")}
            onMode={(mode) => startCapture(mode)}
            onHardMoment={hardMomentTile ? () => openHardMomentNow() : undefined}
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:gap-5 lg:col-start-1 lg:row-start-1">
          {/* The three blocks, in planToday's order — ≤ 3 modules, the first is
              the day's ONE primary move (morning: the practice; evening:
              Tonight's first answer). */}
          {plan.order.map((id) => (
            <div key={id} data-module={`today-${id}`} className="min-w-0">
              {blocks[id]}
            </div>
          ))}

          {/* Morning: Tonight is ONE pointer line under Notice, not a module. */}
          {plan.tonightPointer && (
            <button
              type="button"
              data-testid="today-tonight-pointer"
              onClick={() => setTonightEarly(true)}
              className="arbor-depth-card flex min-h-11 w-full items-center gap-3 px-4 py-3 text-start"
              style={{ background: "var(--arbor-paper-elevated)", borderRadius: "var(--r-lg)" }}
            >
              {/* B-DESIGN-04: the 44 px duotone chip recipe (ui/ShelfGlyph) on a
                  non-shelf glyph — lav fill at 30 % under the -ink outline. */}
              <span aria-hidden="true" className="inline-grid h-11 w-11 flex-none place-items-center" style={{ background: "var(--arbor-lav-soft)", borderRadius: "var(--r)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--arbor-lav-ink) 12%, transparent)" }}>
                <Icon name="dark_mode" size={23} fill={1} weight={400} style={{ gridArea: "1 / 1", color: "color-mix(in srgb, var(--arbor-lav) 30%, transparent)" }} />
                <Icon name="dark_mode" size={23} fill={0} weight={500} style={{ gridArea: "1 / 1", color: "var(--arbor-lav-ink)" }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block t-md font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.loop.today.tonight")}</span>
                <span className="block t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.today.tonightSub")}</span>
              </span>
              <Icon name="chevron_right" size={20} className="rtl:-scale-x-100" style={{ color: "var(--arbor-muted)" }} />
            </button>
          )}

          {/* "More for today" — ONE collapsed door (demotion target: disclosure). */}
          {/* B-DESIGN-04: the door on a solid hairline (design critic P2-18: a
              dashed border is not a DESIGN.md hairline); content unchanged. */}
          <details data-module-disclosure="today-more" data-testid="today-door" style={{ border: "1px solid var(--arbor-rule)", borderRadius: "var(--r-lg)" }}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block t-md font-semibold" style={{ color: "var(--arbor-ink-soft)" }}>{t("elev.loop.today.door")}</span>
                <span className="block t-sm" style={{ color: "var(--arbor-muted)" }}>{t("elev.loop.today.doorSub")}</span>
              </span>
              <Icon name="expand_more" size={20} style={{ color: "var(--arbor-muted)" }} />
            </summary>
            <div className="space-y-2 px-2 pb-3">
              {changedWould && (
                <WhatChanged
                  lines={changed.lines.slice(0, 3)}
                  hiddenCount={0}
                  recap={weeklyRecap}
                  rhythmDaysNeeded={rhythm.daysNeeded}
                  onLineTap={onChangedLineTap}
                  onMore={() => setActiveTab("journal")}
                />
              )}
              {/* Critic c2 r1 (design P1): at night the story is one line in the
                  door, never a second line under the open Tonight card. */}
              {evening && storyFits && doorLine("today-door-story", "auto_stories", t("elev.loop.tonight.story"), () => setActiveTab("bedtime-stories"))}
              {hardMomentTile && doorLine("today-door-hard", "favorite", t("elev.loop.door.hardMoment"), () => openHardMomentNow())}
              {weeklyRecap.currentReport && doorLine("today-door-week", "auto_stories", t("elev.loop.door.week"), () => setActiveTab("weekly"))}
              {doorLine("today-door-play", "sports_esports", t("elev.loop.door.play"), () => setActiveTab("daily-play"))}
              <TodayStepLine />
              {/* B-GROWTH-36 (ruling P2-WORDS): the say-back question, one door
                  line, only while no coach step is open (one question line at a time). */}
              <TodaySayBackLine keepsakeDocs={keepsakes.items} now={now} />
              <CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} placement="under-step" />
              {/* Kept (pass A5, Law 6): the hard-moment watch signal ("worth
                  mentioning to your pediatrician") has no other home — clinical. */}
              {!dayZero && <ArborNoticedCard />}
              <FamilyOfferLines activeChildId={childProfile.id} />
            </div>
          </details>
        </div>
      </div>

      {/* The ONE capture sheet (portals to document.body). */}
      <QuickLogModal open={quickLogOpen} mode={quickLogMode} promptKey={quickLogPromptKey} hardMomentNow={quickLogHard} onClose={() => setQuickLogOpen(false)} />
    </motion.div>
  );
}
