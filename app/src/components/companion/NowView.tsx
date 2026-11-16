import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { savedOnPhoneKey } from "../../lib/firestoreWrite";
import { useOnline } from "../../hooks/useSyncStatus";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useTodaysFocus, type Focus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { programWeekLesson, weekLessonDoor } from "../../lib/programs/weekLesson";
import { programWeekLessonOn, weekLessonBrief } from "../../lib/programs/weekLessonBrief";
import WeekLessonCard from "./WeekLessonCard";
import { programSharedObjectOn } from "../../lib/programs/sharedObject";
import ProgramBookHandback from "../program/ProgramBookHandback";
import { readLearnReadIds } from "../../learn/learnReadState";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import { planString } from "../../lib/plans/planStrings";
import { leadPlan, nightMomentText, recordNight, unrecordNight } from "../../lib/plans/planWeek";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { dayKey } from "../../practice/signals";
import { isObservationAction, type ActionLoopEntry } from "../../actionLoop/model";
import { nextChosenAction, requestedObservation, shelvesForQuestion } from "./companionChoices";
import { scrollQuestionIntoMain } from "./nowDeepLinkScroll";
import { NOW_COPY } from "./nowViewCopy";
import NowRecommendation from "./NowRecommendation";
import { NowAgendaExtras, NowNoticeExtras, NowWhatChangedLines } from "./NowTodayLines";
import { NowNoticeBlock, NowNoticeLead, NowPracticeLead, NowTonightLead, NowTonightPointer } from "./NowLoopBlocks";
import { focusSignalsForNow, stepLines } from "./nowRecommendationModel";
import { useNowClock } from "./useNowClock";
import { useNowRecord } from "./useNowRecord";
import { selectNowLead } from "../../lib/today/dayCard";
import { markPracticeShown } from "../../lib/practice/todayPin";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { isKidModeActive } from "../../lib/kidModeGate";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import { challengePlanHref } from "../../lib/plans/challengeLinks";
import { isPatternId } from "../../lib/library/plans/planVisibility";
import { basedOnLines, FOCUS_MAX_FACTS } from "../../lib/basedOn";
import { useArborPause } from "../../lib/pauseArborStore";
import { fmtDay } from "../../lib/formatDate";
import BasedOnReceipt from "../trust/BasedOnReceipt";
import FromRecordCard, { FromRecordReceipt, recordMeta, recordQuestion } from "../overview/FromRecordCard";
import { useNowLoop } from "./useNowLoop";
import { useLifecycleMoment } from "../overview/useLifecycleMoment";
import { useCompanionOffer } from "../overview/useCompanionOffer";
import { practiceText, WHY_KEY } from "../loop/PracticeCard";
import { shelfLabel } from "../../lib/shelves/registry";
import { trackCompanionPlaceOpen } from "../../lib/kpiEvents";
import { trackActionOffered } from "../../lib/loopEvents";
import Icon from "../ui/Icon";
import { Receipt } from "../ui/Receipt";
import { UrgentSupport } from "../safety/UrgentSupport";
import { screenForImmediateEscalation } from "../../safety/escalation";
import { urgentSetupToday } from "../../lib/onboardingFirstRun";
import "./companionExperience.css";
import "./nowView.css";
import { useObservations } from "../../hooks/useObservations";
import NowQuestionRow from "./NowQuestionRow";
import NowRightNow, { type RightNowTonight } from "./NowRightNow";
import type { TonightStep } from "../loop/TonightFlow";
import { useVisitDraft } from "./visitDraft";
import { VISIT_DRAFT_COPY } from "./nowV41Copy";
import { daysUntil, inDaysLabel } from "../care/CareVisitHead";
import { dayPart } from "./rightNowModel";
import NowPlanFrame, { type NowPlanKind } from "./NowPlanFrame";
import NowPlanBody from "./NowPlanBody";
import NowGuideReader from "./NowGuideReader";
import { NowKidWorld } from "./NowDayPanels";
import { DsRoot, Guide, LivingForm, MoreLink, Route, RouteSection, Row12, Scene, StartHere, Tile, type GuideStop } from "../../design/primitives";
import { useComposition } from "../../design/useComposition";
import { NOW_V10_COPY } from "./now10/nowV10Copy";
import NowDayArc from "./now10/NowDayArc";
import { eveningMoments, clock24, EVENING_FROM_HOUR, EVENING_TO_HOUR } from "./now10/dayArcModel";
import { NowStageContext, type NowStage } from "./now10/nowStage";
import NowWaiting, { NowChallengePlan, NowNotebookBadge, type WaitingStep } from "./now10/NowWaiting";
import NowThisWeek from "./now10/NowThisWeek";
import NowWorthKnowing from "./now10/NowWorthKnowing";
import { NowActionPlan, NowRow } from "./now10/NowComingUp";
import { useFamilyPlanDatesForNow } from "./now10/familyPlanSlot";
import { loadPrefs, shownNudgesToday } from "../../growth/jitaiPrefs";
import "./now10/nowV10.css";
export interface NowViewProps {
  topic?: { id: string; title: string; intent?: string } | null;
  onTopicCreate?: (title: string) => void;
  onTopicOpen?: () => void;
  /** Shell owns one persistent multimodal conversation above the routes. */
  onTalkOpen?: (prompt?: string) => void;
  /** Compatibility for older Shell callers; no second voice session here. */
  onVoiceOpen?: () => void;
}

/** A fresh child/language owns its own focus request, outcomes and disclosures. */
export default function NowView(props: NowViewProps) {
  const { childProfile, actionLoopReady } = useArbor();
  const { uiLang, t } = useLanguage();
  // Do not start a focus request while the accepted onboarding step is loading.
  if (actionLoopReady === false) return <p role="status" className="companion-caption">{t("aria.loading")}</p>;
  return <NowContent key={`${childProfile.id}:${uiLang}`} {...props} />;
}

function PrimaryMove({ primary = true, ...props }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return <button {...props} data-primary-move={primary ? "choose-next-step" : undefined} />;
}

/** B-LOOP-13: the practice lead's AI pick and why — the SAME focus request
 *  NowRecommendation makes (same signals, same journal, one cached call a day),
 *  mounted only while the practice leads. A chosen step or a program never
 *  triggers a request. */
function PracticeFocus({ journal, onFocus, onPending, now }: {
  now: Date;
  journal: ReturnType<typeof useNowLoop>["journal"];
  onFocus: (focus: Focus | null) => void;
  /** B-STATUS-01: while the focus request runs, the practice lead shows the pending line. */
  onPending: (pending: boolean) => void;
}) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop } = useArbor();
  const signals = useMemo(() => focusSignalsForNow({ behaviorLogs, playLogs, milestones, actionLoop }, now), [behaviorLogs, playLogs, milestones, actionLoop, now]);
  const { focus, loading } = useTodaysFocus(childProfile, signals, journal);
  useEffect(() => { onFocus(focus); }, [focus, onFocus]);
  useEffect(() => { onPending(loading); }, [loading, onPending]);
  useEffect(() => () => onPending(false), [onPending]);
  return null;
}

/** A lifecycle moment is ONE short note (P5 r1 pass A5), never a card. */
const LIFECYCLE_NOTE: Partial<Record<string, string>> = {
  birthday: "elev.lifecycle.birthday.title",
  "first-week": "elev.lifecycle.week.title",
  "first-month": "elev.lifecycle.month.title",
  "first-moment": "elev.lifecycle.first.title",
};

function NowContent({ topic, onTopicCreate, onTopicOpen, onTalkOpen }: NowViewProps) {
  const { childProfile, actionLoop, approvedMemoryItems, seedCoach, setActiveTab, openCaptureSheet,
    saveTodayOutcome, saveTodayObservation, requestJournalFocus, pendingCaptureMode, consumeCaptureRequest, addMoment, requestLearnRead, pendingMemoryItems } = useArbor();
  const { t, uiLang } = useLanguage();
  const arborPause = useArborPause();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const copy = NOW_COPY[lang];
  const v10 = NOW_V10_COPY[lang];
  const composition = useComposition();
  const now = useNowClock();
  const record = useNowRecord(now);
  const name = childProfile.name?.split(" ")[0] || t("companion.now-view.your-child");
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const program = useMemo(() => activeProgramWeek(programs.items, now), [programs.items, now]);
  // B-PROG-03: the week's skill as the parent reads it — the Hebrew slash
  // forms ("הילד/ה") resolved for this child, like every practice line.
  const programSkill = program ? (he ? resolveHebrewSlash(program.content.skill.he, childProfile.gender) : program.content.skill.en) : "";
  // B-BOOK-78: an active Everyday Plan is the parent's week — its steps lead
  // Today ahead of the day's practice, its night question is answered here,
  // and the answer is a COUNT (the `books` row), never a verdict.
  const planRows = useChildCollection<PlanBookDoc>(childProfile.id, "books");
  const plan = useMemo(() => leadPlan(planRows.items, now), [planRows.items, now]);
  // S1 (surfacing): the plan's front door on Now — the ONE Challenge Plans
  // card (the running plan(s), then "Something hard right now?"). v10.1: it
  // opens the plan's one home, Now › Plans (lib/plans/challengeLinks), not a
  // copy of the composer.
  const openPattern = (pattern: string) => { setActiveTab("plans"); window.location.hash = challengePlanHref(isPatternId(pattern) ? pattern : null); };
  const openPlan = () => openPattern(plan?.def.id ?? "");
  // v4: the agenda row says where the family is in it ("Week 2 of 4"), counts only.
  const programWeeks = Array.isArray(program?.program.weeks) ? program.program.weeks.length : 0;
  // B-PROG-14: the week's one Learn read, until the parent opens it (their own read state, per child).
  const weekLesson = useMemo(() => (program ? weekLessonDoor(program.content, readLearnReadIds(childProfile.id)) : null), [program, childProfile.id]);
  // The four-line face is dark until B-GA-02. A week with no Learn read still shows it; a read week hides once the parent opens the read.
  const namedLesson = program ? programWeekLesson(program.content) : null;
  const lessonFace = program && programWeekLessonOn() ? weekLessonBrief(program.program.id, program.content) : null;
  const showLessonFace = !!lessonFace && (!namedLesson || !!weekLesson);
  // B-TODAY-37: "Record a moment" on an older question asks Now for THAT question's form.
  const observeId = useHashQuery().get("observe");
  const action = useMemo(() => requestedObservation(actionLoop, observeId) ?? nextChosenAction(actionLoop, topic?.id), [actionLoop, observeId, topic?.id]);
  // v3 question continuity (audit #3): the loop's picks are drawn from the question's shelves.
  const questionShelves = useMemo(() => shelvesForQuestion(topic?.title), [topic?.title]);
  const questionGuided = !!topic && questionShelves.length > 0;
  // B-DATA-14: `queued` — kept on this phone, sending when back online.
  const [receiptAction, setReceiptAction] = useState<{ scope: object; action: ActionLoopEntry; queued?: boolean } | null>(null);
  const [, refreshSaving] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const id = useId();
  useEffect(() => { trackCompanionPlaceOpen("now"); }, []);
  const outcomeScope = `${childProfile.id}:${topic?.id ?? ""}`;
  const currentOutcomeScope = useRef({ key: outcomeScope, action });
  const previousChoice = currentOutcomeScope.current.action;
  // A newer explicit choice retires the old pending/retry/receipt lease.
  // An optimistic completion may expose an OLDER open row; that must not
  // cancel this choice's acknowledgement or make its receipt disappear.
  if (currentOutcomeScope.current.key !== outcomeScope || (action && action.id !== previousChoice?.id
    && (!previousChoice || action.acceptedAt >= previousChoice.acceptedAt))) {
    currentOutcomeScope.current = { key: outcomeScope, action };
  }
  const scopeLease = currentOutcomeScope.current;
  const outcomeMounted = useRef(true);
  useEffect(() => { outcomeMounted.current = true; return () => { outcomeMounted.current = false; }; }, []);
  const savingAction = useRef(new Map<string, { scope: object; action: ActionLoopEntry }>());
  const completedAction = useRef(new Set<string>());
  const [retryAction, setRetryAction] = useState<{ scope: object; action: ActionLoopEntry } | null>(null);
  const currentSaveError = saveError && retryAction?.scope === scopeLease;
  const receipt = receiptAction?.scope === scopeLease ? receiptAction.action : null;
  const receiptQueued = !!receipt && !!receiptAction?.queued;
  // B-DATA-14: the kept-on-this-phone line follows the connection live.
  const online = useOnline();
  const pendingAction = [...savingAction.current.values()].find(write => write.scope === scopeLease)?.action;
  const chosen = receipt ?? pendingAction ?? (retryAction?.scope === scopeLease ? retryAction.action : null) ?? action;
  // v3: "Haven't tried yet" writes nothing; the step simply stays. This only acknowledges it.
  const [notYetFor, setNotYetFor] = useState<string | null>(null);
  // v3 F-NOW-1 r2: the chosen step's How to begin, read-only (it is already chosen).
  const [stepReaderOpen, setStepReaderOpen] = useState(false);
  const observations = useObservations();
  const [observationDraft, setObservationDraft] = useState<{ scope: object; id: string; words: string } | null>(null);
  const observationWords = observationDraft?.scope === scopeLease && observationDraft.id === chosen?.id ? observationDraft.words : "";
  const observation = !!chosen && isObservationAction(chosen);
  const saving = !!chosen && savingAction.current.has(chosen.id);
  const observationNeedsWords = !observationWords.trim();
  const observationInput = useRef<HTMLTextAreaElement>(null);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  // B-TODAY-37: the requested question's form takes focus once it is the lead,
  // and <main> alone scrolls the QUESTION (its title) to just under the sticky
  // place pills, so the parent reads what they are answering. Never
  // scrollIntoView: it also scrolled the shell wrapper and the art panel.
  const requestedOpen = !!observeId && chosen?.id === observeId && observation && !receipt;
  useEffect(() => {
    if (!requestedOpen) return;
    const input = observationInput.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    scrollQuestionIntoMain(stepTitle.current);
  }, [requestedOpen, observeId]);
  const talk = (prompt?: string) => onTalkOpen ? onTalkOpen(prompt) : seedCoach({ prompt: prompt ?? "", source: "companion-now" });
  const saveOutcome = async (outcome: "helped" | "not_today" | { whatHappened: string }) => {
    const target = retryAction?.scope === scopeLease ? retryAction.action : action;
    if (!target || savingAction.current.has(target.id) || completedAction.current.has(target.id) || currentOutcomeScope.current !== scopeLease || !outcomeMounted.current) return;
    const isObservation = isObservationAction(target);
    if (isObservation !== (typeof outcome === "object") || (typeof outcome === "object" && (!outcome.whatHappened.trim() || outcome.whatHappened.trim().length > 240))) return;
    savingAction.current.set(target.id, { scope: scopeLease, action: target });
    refreshSaving(n => n + 1); setSaveError(false);
    // B-DATA-14: offline the answer is kept on this phone in bounded time —
    // never an endless "Saving…"; the receipt says so until the server has it.
    let queued = false;
    const offline = {
      onQueued: () => { queued = true; },
      onSynced: () => { if (outcomeMounted.current) setReceiptAction(previous => previous?.action.id === target.id && previous.queued ? { ...previous, queued: false } : previous); },
      // Rejected after the receipt: take it back and offer this answer again.
      onRejected: () => {
        completedAction.current.delete(target.id);
        if (!outcomeMounted.current || currentOutcomeScope.current !== scopeLease) return;
        setReceiptAction(previous => previous?.action.id === target.id ? null : previous);
        setRetryAction({ scope: scopeLease, action: target }); setSaveError(true);
      },
    };
    try {
      const saved = typeof outcome === "object"
        ? await saveTodayObservation(target.id, outcome.whatHappened, { isCurrent: () => outcomeMounted.current && currentOutcomeScope.current === scopeLease, offline })
        : (await saveTodayOutcome(target.id, outcome, "card", undefined, { awaitServer: true, offline }), target);
      completedAction.current.add(target.id);
      if (outcomeMounted.current && currentOutcomeScope.current === scopeLease) setReceiptAction({ scope: scopeLease, action: saved, ...(queued ? { queued: true } : {}) });
    } catch {
      if (outcomeMounted.current && currentOutcomeScope.current === scopeLease) { setRetryAction({ scope: scopeLease, action: target }); setSaveError(true); }
    } finally {
      savingAction.current.delete(target.id);
      if (outcomeMounted.current) refreshSaving(n => n + 1);
    }
  };
  useEffect(() => { setReceiptAction(null); setRetryAction(null); setSaveError(false); }, [scopeLease]);
  useEffect(() => {
    if (!pendingCaptureMode) return;
    consumeCaptureRequest();
    openCaptureSheet({ mode: pendingCaptureMode });
    // The pending request is consumed once; handler identities are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);
  const openProgram = () => { setActiveTab("development"); window.location.hash = "#/development?view=program"; };
  // v4 (blueprint decision 6): the hard-moment door is the launcher rail's,
  // on every screen (CompanionWorkspace); Now no longer duplicates it.

  // ── The milestone loop (parity 9 Oct): practice → Did it → Tonight → notice. ──
  const [focus, setFocus] = useState<Focus | null>(null);
  const [focusPending, setFocusPending] = useState(false);
  useEffect(() => {
    if (arborPause.paused) setFocus(null);
  }, [arborPause.paused]);
  const loop = useNowLoop({
    now,
    aiPracticeId: focus?.practiceVia === "ai" ? focus.practiceId : undefined,
    openPhotoCapture: () => openCaptureSheet({ mode: "photo" }),
    questionShelves,
  });
  const [tonightOpen, setTonightOpen] = useState(false);
  // v4.1: where the opened evening starts (Right now's "Write it down" → its words step).
  const [tonightStep, setTonightStep] = useState<TonightStep | undefined>(undefined);
  const openTonight = (step?: TonightStep) => { setTonightStep(step); loop.setTonightEarly(true); setTonightOpen(true); };
  // ── Return hooks (parity 9 Oct): the visit stamp, a lifecycle note, the offer. ──
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);
  const lifecycle = useLifecycleMoment({ previousVisitAt, now: now.getTime() });
  const todayOffer = useCompanionOffer("today", { now, whatChanged: lifecycle.moment ? { id: lifecycle.moment.kind } : null });
  const visit = todayOffer.appointment;
  // v4.1: the visit summary Care has drafted from the record (null: nothing kept since the anchor).
  const visitDraft = useVisitDraft(visit, now);
  const draftCopy = VISIT_DRAFT_COPY[lang];
  const lead = selectNowLead({
    // B-TODAY-38: the day the first run ended on the urgent notice, the help
    // lines are the ONE lead inside the plan card. A profile marker, not a
    // step: no outcome buttons, no ledger row, gone tomorrow.
    urgent: urgentSetupToday(childProfile, now),
    chosen: !!chosen,
    chosenPending: saving || currentSaveError,
    manualTonight: tonightOpen,
    visit,
    tonight: loop.plan.order[0] === "tonight",
    record: !!record.opener || !!record.receipt || record.saving,
    recordPending: record.saving || record.error,
    // v10.1: a running Challenge plan is drawn in "Waiting for you" (Tonight), never as the stage's lead.
    fallback: loop.pick ? "practice" : loop.slotNotice ? "notice" : program ? "program" : "recommendation",
  });
  const pausedLead = arborPause.paused && lead === "recommendation";
  const pauseUntil = arborPause.record?.until
    ? t("companion.pause.until", { when: fmtDay(arborPause.record.until, uiLang) })
    : t("companion.pause.untilYou");
  const showNotice = lead !== "notice" && loop.plan.order.includes("notice") && loop.blockNotices.length > 0;
  // v10.1: Tonight's row stands in Coming up whenever tonight has questions and another lead holds the stage
  // (morning: the pointer; evening: behind a step, a record question or a visit), so the full flow is one tap away.
  const showPointer = lead !== "tonight" && loop.tonightHasQuestions && (loop.plan.tonightPointer || loop.evening);
  const pickId = loop.pick?.practice.id;
  useEffect(() => { if (lead === "practice" && pickId) trackActionOffered("now-practice"); }, [lead, pickId]);
  // Only an actually rendered daytime practice earns a Tonight premise.
  useEffect(() => {
    if (lead === "practice" && loop.plan.practiceMode === "card" && pickId) markPracticeShown(childProfile.id, pickId, now);
  }, [lead, loop.plan.practiceMode, pickId, childProfile.id, now]);
  const openVisit = () => {
    if (!visit || isKidModeActive()) return;
    goToRoute("consult", { appointment: visit.id });
  };
  // The lead the chain below actually draws (its guards included). Every lead but
  // the recommendation (which frames itself, to show its own words) sits in the v3 plan card.
  const shownLead: NowPlanKind = lead === "urgent" ? "urgent" : lead === "record" ? "record" : lead === "visit" && visit ? "visit" : lead === "tonight" ? "tonight"
    : lead === "step" && chosen ? "step" : lead === "practice" && loop.pick ? "practice" : lead === "notice" ? "notice"
      : lead === "program" && program ? "program" : "recommendation";
  const lifecycleKey = lifecycle.moment && todayOffer.offer?.kind === "what-changed" ? LIFECYCLE_NOTE[lifecycle.moment.kind] : undefined;
  const lifecycleNote = lifecycleKey ? t(lifecycleKey, { name }) : null;
  // v3 F-NOW-1: the plan card's face — the lead's own words when it has them
  // (the practice's say line, in the locale's quotes), else its one-liner; and
  // a line of plan meta about the parent's own step, in words, never a count.
  const practiceSay = shownLead === "practice" && loop.pick ? practiceText(loop.pick.practice, "say", lang, childProfile.gender) : "";
  // The urgent lead's face carries only the reviewed safety header; no say line,
  // no plan meta, no "picked because" — nothing is invented beside the help lines.
  const planTag = pausedLead ? t("companion.pause.on") : shownLead === "urgent" ? t("elev.safety.header.title") : copy.planTag[shownLead];
  // v10.1 (N-Now): the record question rides the arc as the stage's title, the parent's words quoted under it.
  const recordFace = shownLead === "record" && !pausedLead && record.opener && !record.receipt ? record.opener : null;
  const recordQuote = recordFace?.quote?.trim() ? t("elev.loop.ms.quoted", { text: recordFace.quote.trim() }) : null;
  const recordNoteDay = recordFace?.quoteAt && Number.isFinite(Date.parse(recordFace.quoteAt))
    ? new Date(recordFace.quoteAt).toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "short", day: "numeric", month: "short" }) : null;
  const planSay = recordFace ? recordQuote : pausedLead ? t("companion.pause.now") : shownLead === "urgent" ? null : practiceSay ? t("elev.loop.ms.quoted", { text: practiceSay }) : copy.planSay[shownLead];
  const planMeta = recordFace ? recordMeta(recordFace, uiLang, t) : pausedLead ? null : shownLead === "urgent" ? null : shownLead === "step" ? (receipt ? (receiptQueued ? t(savedOnPhoneKey(online)) : copy.saved) : copy.today) : shownLead === "program" && program ? copy.programWeek(program.week) : copy.planMeta[shownLead];
  // v3 F-NOW-1 r2: the guide's title on the face is the lead's own h2, moved up
  // from its section (which keeps it as its label). The loop leads' cards carry
  // their own heading, so their face has the say line and meta only.
  const planTitle = recordFace ? <h2 id={`${id}-record`} data-testid="today-record-question" className="now-plan-title" dir="auto">{recordQuestion(recordFace, name, t)}</h2>
    : pausedLead ? <h2 id={`${id}-pause`} className="now-plan-title" dir="auto">{pauseUntil}</h2>
    : shownLead === "step" && chosen ? <h2 ref={stepTitle} id={`${id}-step`} className="now-plan-title" dir="auto" style={observation ? { whiteSpace: "pre-wrap", scrollMarginBlockStart: "calc(var(--sticky-offset) + 12px)" } : undefined}>{receipt && !observation ? copy.finishedTitle : chosen.recommendation}</h2>
    : shownLead === "visit" && visit ? <h2 id={`${id}-visit`} className="now-plan-title" dir="auto">{copy.visitTitle(appointmentRoleLabel(visit, t), new Date(visit.whenIso!).toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "short" }))}</h2>
      : shownLead === "program" && program ? <h2 id={`${id}-program`} className="now-plan-title" dir="auto">{programSkill}</h2> : undefined;
  // The one plan body under every lead: why it was picked, always visible. The
  // practice says its own reason (the AI's sentence beside its own pick); the
  // question is quoted only for a step chosen under it.
  const practiceWhy = shownLead === "practice" && loop.pick
    ? (loop.pick.via === "ai" && focus?.why?.trim()) || t(loop.whyReason && (loop.whyReason !== "since" || loop.whyDate) ? WHY_KEY[loop.whyReason] : "elev.loop.practice.whyShelf", { shelf: shelfLabel(loop.pick.shelf, t), name, date: loop.whyDate ?? "" })
    : "";
  const planWhy = recordFace && recordNoteDay ? v10.pickedRecord(recordNoteDay) : pausedLead ? t("companion.pause.kept") : shownLead === "practice" ? practiceWhy || copy.pickedWhy.practice : shownLead === "tonight" && tonightOpen ? copy.pickedTonightOpen : copy.pickedWhy[shownLead];
  // The question is named only where it drove the pick: a step chosen under
  // it, or a practice/notice drawn from its shelves.
  // v4.1 Right now: the one line that follows the day. Not beside the urgent
  // help lines or a pause; a state that already leads Now is not offered twice,
  // and the glance does not repeat what Right now shows.
  const showRightNow = lead !== "urgent" && !arborPause.paused;
  const part = dayPart(now.getHours());
  const visitDate = visit?.whenIso ? new Date(visit.whenIso).toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "short" }) : "";
  const rightNowVisit = showRightNow && visit && lead !== "visit"
    ? visitDraft
      ? { head: draftCopy.head, sub: draftCopy.sub(visitDraft.moments, visitDraft.anchor), cta: draftCopy.cta, onOpen: openVisit, drafted: true }
      : { head: copy.visitTitle(appointmentRoleLabel(visit, t), visitDate), sub: copy.visitBody, cta: copy.visitOpen, onOpen: openVisit }
    : null;
  const visitDays = visit ? daysUntil(visit.whenIso, now.getTime()) : null;
  const visitWhen = visitDays === null ? null : t(inDaysLabel(visitDays).key, inDaysLabel(visitDays).vars);
  const visitGlanceLine = visitDraft && visitWhen ? draftCopy.glance(visitWhen) : copy.visitPrep;
  // Tonight's questions answered in Right now, through Tonight's own seams. A
  // practice or notice already leading Now is not asked a second time here.
  const rightNowTonight: RightNowTonight | null = showRightNow && lead !== "tonight" && loop.tonightHasQuestions ? {
    childName: loop.tonight.childName,
    gender: loop.tonight.gender,
    practice: loop.pick && loop.practiceShown && !loop.doseAnswer && lead !== "practice" ? loop.pick.practice : null,
    notice: loop.tonight.notice && !(lead === "notice" && loop.slotNotice?.milestone.id === loop.tonight.notice.milestone.id) ? loop.tonight.notice.milestone : null,
    dayQuestion: loop.tonight.dayQuestion,
    onPractice: loop.answerPractice,
    onNotice: (status) => loop.tonight.onNotice(status),
    onWrite: () => openTonight(2),
    onOpenAll: () => openTonight(),
  } : null;
  const visitInRightNow = !!rightNowVisit && part === "midday";
  const planQuestion = shownLead === "step" && chosen && topic && chosen.topicId === topic.id ? topic.title
    : (shownLead === "practice" || shownLead === "notice") && questionGuided ? topic.title : null;

  // ── v10.1 composition (N-Now-D / N-Now-M): one tree per composition. ──
  const desk = composition === "desk";
  const nudgePrefs = useMemo(() => loadPrefs(), []);
  const hourStamp = Math.floor(now.getTime() / 3_600_000);
  const evening = useMemo(() => eveningMoments(observations, now),
    // Re-read when the records change or the hour turns, not on every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [observations, hourStamp]);
  const shownNudges = useMemo(() => shownNudgesToday(now.getTime()).length, [hourStamp]); // eslint-disable-line react-hooks/exhaustive-deps
  const quietFrom = clock24(nudgePrefs.quietStart * 60);
  const familyDates = useFamilyPlanDatesForNow();
  const notesWaiting = (pendingMemoryItems ?? []).filter(item => item.status === "pending").length;
  const stage: NowStage = {
    // The face (the lead's tag, title, quote) is set inside the arc's bowl, as N-Now draws it on both compositions.
    renderArc: (face, art) => <NowDayArc composition={composition} now={now} quietStart={nudgePrefs.quietStart} quietEnd={nudgePrefs.quietEnd} evening={evening.inBand > 0} copy={v10}>
      <div className={desk ? "nw-face-row" : "nw-face-col"}>
        <LivingForm src={art?.src ?? "/visuals/parent/v2/guidance-480.webp"} srcSet={art?.srcSet} width={desk ? 150 : 88} height={desk ? 115 : 68}
          crop={art ? undefined : desk ? { w: 270.8, h: 152.3, x: -122, y: -24 } : { w: 158.9, h: 89.4, x: -71.6, y: -14 }} className="nw-face-art" />
        {face}
      </div>
    </NowDayArc>,
  };

  const leadChain = <div className="now-main-column">
        {lead === "practice" && <PracticeFocus now={now} journal={loop.journal} onFocus={setFocus} onPending={setFocusPending} />}
        {/* The recommendation frames itself (its screened words ride the arc), so its frame here is bare. */}
        <NowPlanFrame kind={shownLead} lang={lang} tag={recordFace ? v10.arborSuggests : planTag} say={planSay} quoted={(!!practiceSay || !!recordQuote) && !pausedLead} title={planTitle} meta={planMeta} question={topic?.title} bare={shownLead === "recommendation" && !pausedLead}>
        {lead === "urgent" ? <section className="now-loop-lead" data-module="now-urgent" aria-label={t("elev.safety.header.title")}>
          <UrgentSupport testId="now-urgent-setup-support" className="now-urgent-lead" />
        </section> : lead === "record" ? <section className="now-loop-lead" data-module="now-record" aria-label={t("today.record.aria")}>
          {record.receipt ? <FromRecordReceipt queued={record.queued} /> : record.opener && <FromRecordCard stage opener={record.opener} childName={name} stampMove="choose-next-step" disabled={record.saving} onAnswer={answer => void record.answer(answer)} />}
          {record.saving && <p role="status" className="now-inline-status">{record.confirming ? t("elev.today.record.confirming") : copy.saving}</p>}
          {record.error && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : lead === "visit" && visit ? <section className="now-lead arbor-depth-primary" data-module="now-visit" aria-labelledby={`${id}-visit`}>
          <p className="now-plan-kicker">{copy.visit}</p>
          {/* v4.1: when the visit itself leads Now, the drafted summary's count is said here. */}
          <p className="now-lead-body" dir="auto" data-drafted={visitDraft ? "true" : undefined}>{visitDraft ? draftCopy.sub(visitDraft.moments, visitDraft.anchor) : copy.visitBody}</p>
          <div className="now-lead-actions">
            <PrimaryMove type="button" className="companion-primary" onClick={openVisit}>{visitDraft ? draftCopy.cta : copy.visitOpen}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove>
            <button type="button" className="companion-secondary" onClick={() => todayOffer.snooze("appointment")}>{copy.visitLater}</button>
          </div>
        </section> : lead === "tonight" ? <section className="now-loop-lead" data-module="today-tonight" aria-label={t("elev.loop.today.tonight")}>
          <NowTonightLead loop={loop} initialStep={tonightStep} />
        </section> : lead === "step" && chosen ? <section className="now-lead arbor-depth-primary" data-module="now-step" aria-labelledby={`${id}-step`}>
          <p className="now-plan-kicker">{observation ? t("ob.first.observation.chosen") : copy.chosen}</p>
          {receipt && <p className="now-lead-body" dir="auto" style={{ whiteSpace: "pre-wrap" }}>{observation ? chosen.whatHappened : chosen.recommendation}</p>}
          {!observation && <p className="now-lead-body" role={receipt ? "status" : undefined}>{receipt ? copy.finished : chosen.acceptanceKey?.startsWith("onboarding-v1.") && dayKey(new Date(chosen.acceptedAt)) === dayKey(now) ? t("ob.first.tomorrow") : copy.chosenWhy}</p>}
          {!observation && !receipt && <>
            <button type="button" className="companion-text-button now-plan-how" aria-haspopup="dialog" onClick={() => setStepReaderOpen(true)}>{copy.steps}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
            <NowGuideReader open={stepReaderOpen} onClose={() => setStepReaderOpen(false)} lang={lang} title={chosen.recommendation} crumb={copy.planTag.step}
              how={stepLines(chosen.recommendation)} onAdapt={() => talk(copy.adaptPrompt(chosen.recommendation))} />
          </>}
          {observation && (receipt ? <>
            <Receipt testId="now-observation-receipt">{t(receiptQueued ? savedOnPhoneKey(online) : "ob.first.observation.saved")}</Receipt>
            <PrimaryMove type="button" className="companion-text-button" onClick={() => { requestJournalFocus(`action-${chosen.id}`); goToRoute("journal", { view: "all" }); }}>{t("ob.first.observation.open")}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></PrimaryMove>
          </> : <form onSubmit={event => { event.preventDefault(); void saveOutcome({ whatHappened: observationWords }); }}>
            <p id={`${id}-observation-purpose`} className="now-lead-body">{t("ob.first.observation.purpose")}</p>
            <label className="now-observation-field" htmlFor={`${id}-observation`}>{t("ob.first.observation.answer")}</label>
            <textarea ref={observationInput} id={`${id}-observation`} data-testid="now-observation-answer" className="now-observation-input" dir="auto" rows={3} maxLength={240} required
              aria-describedby={`${id}-observation-purpose${!saving && observationNeedsWords ? ` ${id}-observation-required` : ""}`} disabled={saving} value={observationWords}
              onChange={event => setObservationDraft({ scope: scopeLease, id: chosen.id, words: event.target.value })} />
            {screenForImmediateEscalation({ message: observationWords }) && <UrgentSupport testId="now-observation-urgent-support" className="now-lead-body" />}
            {!saving && observationNeedsWords && <p id={`${id}-observation-required`} data-testid="now-observation-required" className="now-observation-required">{t("ob.first.observation.required")}</p>}
            <div className="now-lead-actions"><PrimaryMove type="submit" className="companion-primary now-observation-save" disabled={saving || observationNeedsWords} aria-busy={saving}
              aria-describedby={!saving && observationNeedsWords ? `${id}-observation-required` : undefined}>{!saving && !observationNeedsWords && <Icon name="check" size={19} />}{saving ? copy.saving : t("ob.first.observation.keep")}</PrimaryMove></div>
          </form>)}
          {!observation && !receipt && <div className="now-lead-actions now-followup" role="group" aria-labelledby={`${id}-followup`}>
            <p id={`${id}-followup`} className="now-followup-q"><Icon name="nightlight" size={18} />{copy.outcomes}</p>
            <PrimaryMove type="button" className="companion-primary" disabled={saving} onClick={() => void saveOutcome("helped")}><Icon name="check" size={19} />{saving ? copy.saving : copy.done}</PrimaryMove>
            <button type="button" className="companion-secondary" disabled={saving} aria-pressed={notYetFor === chosen.id} onClick={() => setNotYetFor(chosen.id)}>{copy.haventTried}</button>
          </div>}
          {!observation && !receipt && <button type="button" className="companion-text-button" disabled={saving} onClick={() => void saveOutcome("not_today")}>{copy.notToday}</button>}
          {!observation && !receipt && notYetFor === chosen.id && <p role="status" className="now-inline-status">{copy.notYetAck}</p>}
          {!observation && <PrimaryMove primary={!!receipt} type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(chosen.recommendation))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></PrimaryMove>}
          {currentSaveError && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : lead === "practice" && loop.pick ? <section className="now-loop-lead" data-module="today-practice" aria-label={copy.today}>
          <NowPracticeLead loop={loop} name={name} whyText={focus?.why} headerNote={lifecycleNote} adaptLabel={copy.adapt} choosing={focusPending}
            onAdapt={() => talk(copy.adaptPrompt(practiceText(loop.pick!.practice, "do", lang, childProfile.gender)))} />
        </section> : lead === "notice" ? <section className="now-loop-lead" data-module="today-practice" aria-label={t("elev.loop.today.notice.title")}>
          <NowNoticeLead loop={loop} name={name} />
        </section> : lead === "program" && program ? <section className="now-lead arbor-depth-primary" data-module="now-program" aria-labelledby={`${id}-program`}>
          <p className="now-plan-kicker">{copy.programLabel}</p>
          <p className="now-lead-body">{copy.programWhy(program.week)}</p>
          <div className="now-lead-actions"><PrimaryMove type="button" className="companion-primary" onClick={openProgram}>{copy.continueProgram}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove></div>
          <button type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(programSkill))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></button>
        </section> : pausedLead ? <section className="now-lead" data-testid="now-pause" aria-labelledby={`${id}-pause`}>
          <div className="now-lead-actions">
            <PrimaryMove type="button" className="companion-primary" onClick={() => arborPause.resume()}>{t("companion.pause.resume")}</PrimaryMove>
          </div>
          <button type="button" className="companion-text-button" onClick={() => goToRoute("memory")}>{t("companion.pause.notebook")}</button>
        </section> : <NowRecommendation name={name} onTalkOpen={talk} journal={loop.journal} />}
        {(pausedLead || (shownLead !== "recommendation" && shownLead !== "urgent")) && <div className="now-plan-foot"><NowPlanBody why={planWhy} time={pausedLead ? null : copy.planTime[shownLead]} size={pausedLead ? null : copy.planSize[shownLead]} question={planQuestion} /></div>}
        </NowPlanFrame>
        {lead === "practice" && focus && loop.pick?.via === "ai" && <BasedOnReceipt
          model={{
            ...basedOnLines({ items: approvedMemoryItems, profile: childProfile, maxFacts: FOCUS_MAX_FACTS, reportedFactCount: focus.inputsUsed?.factCount, now: now.getTime() }),
          }}
          onOpenFact={(factId) => goToRoute("memory", { fact: factId })}
        />}
        {lifecycleNote && lead !== "practice" && <p className="now-lifecycle-note" role="note">{lifecycleNote}</p>}
  </div>;

  // ── stop 2: what waits. Now (did you notice), Tonight (the Challenge plan), Later (the notebook). ──
  // v4: the say-back question and "Arbor noticed" are Notice today's last rows; with no notice rows today they stand
  // alone — except beside the urgent help lines, which stand alone (B-TODAY-38).
  const noticeStep = showNotice ? <div data-module="today-notice"><NowNoticeBlock loop={loop} name={name} practiceLeads={lead === "practice"}
    extras={<NowNoticeExtras keepsakeDocs={loop.keepsakeDocs} now={loop.now} isReturning={isReturning} suppressSayBack={lead === "record"} />} /></div>
    : lead !== "urgent" ? <NowNoticeExtras keepsakeDocs={loop.keepsakeDocs} now={loop.now} isReturning={isReturning} suppressSayBack={lead === "record"} /> : null;
  // With no plan running, Tonight is one door line to Challenge Plans (the chooser and the composer live on Now › Plans).
  const plansDoor = lead !== "urgent" && !plan ? <NowRow icon="auto_stories" testId="now-challenge-door" className="now-challenge-door"
    title={planString("section.hard", lang)} sub={planString("section.title", lang)} onOpen={() => openPattern("")} /> : null;
  const waiting: WaitingStep[] = [];
  if (noticeStep) waiting.push({ key: "now", when: v10.whenNow, sub: showNotice ? v10.oneQuestion(loop.blockNotices.filter(c => !c.milestone.observationStatus).length || loop.blockNotices.length) : null, current: true, grow: 1, body: noticeStep });
  if (lead !== "urgent" && plan) waiting.push({ key: "tonight", when: v10.whenTonight, sub: v10.whenTonightSub, current: !showNotice, grow: 2, body:
    <NowChallengePlan plan={plan} lang={lang} childName={name} now={now} evening={loop.evening} copy={v10}
      onNight={(happened) => { if (happened) void planRows.upsert(recordNight(plan.doc, now)); }}
      onUndoNight={() => void planRows.upsert(unrecordNight(plan.doc, now))}
      onJournal={() => void addMoment(nightMomentText(plan.def, lang, name))}
      onOpen={openPlan} /> });
  else if (plansDoor) waiting.push({ key: "tonight", when: v10.whenTonight, body: plansDoor });
  if (lead !== "urgent" && notesWaiting > 0) waiting.push({ key: "later", when: v10.whenLater, sub: v10.whenLaterSub, body:
    <NowNotebookBadge waiting={notesWaiting} copy={v10} notebook={t("companion.about.notebook")} label={t(notesWaiting === 1 ? "elev.childmem.pending.notes.one" : "elev.childmem.pending.notes", { count: notesWaiting })} onOpen={() => goToRoute("memory")} /> });
  // "Waiting for you · n things": the blocks the rail shows (a Now step with only its say-back extras is not counted).
  const thingsWaiting = waiting.filter(w => w.key !== "now" || showNotice).length;
  const waitingTitleId = `${id}-waiting`;

  // ── stop 3: this week, compact, with what changed since the last visit. ──
  const weekTitleId = `${id}-week`;
  const thisWeek = <NowThisWeek composition={composition} observations={observations} actionLoop={actionLoop ?? []} now={now} lang={lang} copy={v10}
    labels={{ moments: copy.weekMoments, helped: copy.weekHelped, milestones: copy.weekMilestones, words: copy.weekWords, kid: copy.weekKid }}
    title={copy.weeklyTitle} emptyLine={copy.weekEmpty} reportLabel={t("nav.pill.weekly")} onReport={() => setActiveTab("weekly")} titleId={weekTitleId}>
    <NowWhatChangedLines previousVisitAt={previousVisitAt} isReturning={isReturning} rhythmDaysNeeded={loop.rhythm.daysNeeded} />
    <NowKidWorld observations={observations} now={now} name={name} onAll={() => setActiveTab("development")} />
  </NowThisWeek>;

  // ── stop 4: coming up, each a line and a link to its home. ──
  const visitDay = visit?.whenIso ? new Date(visit.whenIso) : null;
  const comingRows = <>
    {visit && visitDay && lead !== "visit" && !visitInRightNow && <NowRow className="now-glance-visit" date={{ weekday: visitDay.toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "short" }), day: visitDay.getDate() }}
      title={copy.visitTitle(appointmentRoleLabel(visit, t), visitDate)} sub={<span data-testid="now-glance-visit-line">{visitDraft && visitWhen ? draftCopy.glance(visitWhen) : visitWhen ?? copy.visitPrep}</span>}
      action={visitDraft ? draftCopy.cta : copy.visitPrep} onOpen={openVisit} />}
    {familyDates.map(date => <NowRow key={date.id} date={{ weekday: date.weekday, day: date.day, none: date.nobody }} title={date.title} sub={date.sub} onOpen={date.onOpen} />)}
    {showPointer && <NowTonightPointer onOpen={() => { loop.setTonightEarly(true); setTonightOpen(true); }} />}
    {/* B-PROG-03: the program is Today's frame: one line beside the practice, never a second lead. */}
    {program && lead !== "program" && <NowRow icon="menu_book" testId="now-program-line" className="now-program-line" title={copy.programLabel} sub={programSkill} onOpen={openProgram}
      badge={programWeeks > 0 ? <span className="now-agenda-badge" data-testid="now-program-week">{copy.programWeekOf(program.week, Math.max(program.week, programWeeks))}</span> : undefined} />}
    {/* B-PROG-14: "This week's idea". Flag off: the title door. Flag on: example, words, reason, fallback, and the longer read when this week has one. */}
    {!(showLessonFace && lessonFace) && weekLesson && <NowRow icon="lightbulb" testId="now-week-lesson" className="now-week-lesson" title={copy.weekIdea} sub={weekLesson.title[lang]} onOpen={() => requestLearnRead({ cardId: weekLesson.id, source: "now-week-lesson" })} />}
    <NowRow icon="notifications" className="now-glance-reminders" title={copy.remindersTitle} sub={v10.remindersShown(shownNudges)} onOpen={() => setActiveTab("smart-reminders")} />
  </>;
  const comingExtras = <>
    {/* B-PROG-16: next-day handback of the week's one shared book. Dark until the pilot flag. */}
    {programSharedObjectOn() && <ProgramBookHandback />}
    {showLessonFace && lessonFace && <WeekLessonCard face={lessonFace} lang={lang} gender={childProfile.gender}
      readTitle={weekLesson ? weekLesson.title[lang] : undefined}
      onOpen={weekLesson ? () => requestLearnRead({ cardId: weekLesson.id, source: "now-week-lesson" }) : undefined} />}
    <NowAgendaExtras evening={loop.evening} storyFits={loop.storyFits} todayOffer={todayOffer} suppressVisit={lead === "visit" || !!visit} storyRow={!showPointer} />
  </>;
  const aheadTitleId = `${id}-ahead`;
  const actionPlan = <NowActionPlan composition={composition} copy={v10} plansLabel={t("nav.tab.plans")} nextLine={copy.nextStep} onOpen={() => setActiveTab("plans")} titleId={`${id}-actionplan`} />;
  const worth = lead !== "urgent" ? <NowWorthKnowing lang={lang} kicker={v10.worthKnowing} readMinutes={copy.readMinutes} topicText={topic?.title} composition={composition} now={now} /> : null;

  const stops: GuideStop[] = [
    // The phone guide uses the board's short names for the same four stops.
    { id: "now-tonight", title: desk ? v10.stops.tonight : v10.stopsShort.tonight, sub: planTag },
    ...(waiting.length ? [{ id: "now-waiting", title: desk ? v10.stops.waiting : v10.stopsShort.waiting, sub: v10.stopSubs.waiting }] : []),
    { id: "now-week", title: desk ? v10.stops.week : v10.stopsShort.week, sub: v10.stopSubs.week },
    { id: "now-ahead", title: desk ? v10.stops.ahead : v10.stopsShort.ahead, sub: v10.stopSubs.ahead },
  ];
  const n = (stopId: string) => stops.findIndex(s => s.id === stopId) + 1;

  // The stage: the kicker is the screen's one h1, then the arc with the lead's face, the lead, its why, the question.
  // One door to Your day at a glance: beside the head on desktop, at the stage's foot on the phone.
  const dayGlance = <MoreLink onClick={() => setActiveTab("day-windows")} className="nw-lnk">{t("nav.view.day-windows")}</MoreLink>;
  const stageInner = <>
    <div className="line between nw-stage-head">
      <span className="gsec"><h1 className="kicker" data-testid="now-kicker">{copy.title(name)}</h1><StartHere>{v10.startHere}</StartHere></span>
      {desk && dayGlance}
      {/* Production's subtitle: stop 1's line in the desktop guide, under the h1 on the phone. */}
      {!desk && <p className="nw-stage-sub">{copy.subtitle}</p>}
    </div>
    <NowStageContext.Provider value={stage}>{leadChain}</NowStageContext.Provider>
    {showRightNow && <NowRightNow now={now} lang={lang} visit={rightNowVisit} tonight={rightNowTonight} />}
    {(topic || onTopicOpen) && <div className="nw-stage-q"><NowQuestionRow data-module="now-focus" lang={lang} topic={topic} onOpen={onTopicOpen} onCreate={onTopicCreate ? () => onTopicCreate("") : undefined} phone={!desk} /></div>}
    <div className="nw-meta nw-arc-legend">
      {/* V77: the phone legend names the band; the desktop says its window and its count. */}
      {evening.inBand > 0 && <span data-testid="now-evening-band"><i className="nw-sw" aria-hidden="true" />{desk ? <span><b>{v10.eveningLabel(clock24(EVENING_FROM_HOUR * 60), clock24(EVENING_TO_HOUR * 60))}</b> {v10.eveningCount(evening.inBand, evening.total)}</span> : v10.eveningShort}</span>}
      <span><i className="nw-qh" aria-hidden="true" />{v10.quietFrom(quietFrom)}</span>
      {!desk && dayGlance}
    </div>
  </>;
  const stageScene = <Scene field="now" className={desk ? "x8 nw-stage" : "nw-stage"}
    orbs={desk ? [{ size: 380, left: -210, bottom: -250, opacity: 0.6 }, { size: 340, right: -180, top: -230, opacity: 0.7, b: true }] : [{ size: 260, left: -170, bottom: -170, opacity: 0.55 }, { size: 230, right: -140, top: -150, opacity: 0.65, b: true }]}>
    {stageInner}
  </Scene>;
  const waitingHead = (inline: boolean) => <div className={inline ? "rh" : "rhead"}>
    {inline && <span className="rstop inline" aria-hidden="true">{n("now-waiting")}</span>}
    <h2 className="h3" id={waitingTitleId}>{v10.stops.waiting}</h2>
    {thingsWaiting > 0 && <span className="small">{v10.things(thingsWaiting)}</span>}
  </div>;

  return <DsRoot composition={composition} className="companion-page now-page now-v10" dir={he ? "rtl" : "ltr"}>
    <Guide stops={stops} mini={!desk} label={v10.onThisPage} />
    <Route composition={composition} tight={!desk}>
      <RouteSection id="now-tonight" n={1} on stop={desk || !waiting.length ? true : true}>
        {desk ? <Row12>
          {waiting.length ? <>{stageScene}<aside className="siderail cards x4 nw-rail" id="now-waiting" aria-labelledby={waitingTitleId}>{waitingHead(true)}<NowWaiting composition={composition} steps={waiting} /></aside></> : <div className="x12 nw-stage-solo">{stageScene}</div>}
        </Row12> : stageScene}
      </RouteSection>
      {!desk && waiting.length > 0 && <RouteSection id="now-waiting" n={n("now-waiting")} aria-labelledby={waitingTitleId}>
        {waitingHead(false)}
        <NowWaiting composition={composition} steps={waiting} />
      </RouteSection>}
      <RouteSection id="now-week" n={n("now-week")} aria-labelledby={weekTitleId}>
        {desk ? <Row12>{thisWeek}{worth}</Row12> : thisWeek}
      </RouteSection>
      <RouteSection id="now-ahead" n={n("now-ahead")} aria-labelledby={aheadTitleId}>
        {desk ? <Row12>
          {actionPlan}
          <Tile icon="calendar_month" kind="date" title={v10.stops.ahead} titleId={aheadTitleId} className="nw-ahead"><div className="nw-rows">{comingRows}</div>{comingExtras}</Tile>
        </Row12> : <>
          <div className="rhead"><h2 className="h3" id={aheadTitleId}>{v10.stops.ahead}</h2></div>
          {actionPlan}
          <section className="vt nw-ahead"><div className="nw-rows">{comingRows}</div>{comingExtras}</section>
          {worth}
        </>}
      </RouteSection>
    </Route>
  </DsRoot>;
}
