import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { savedOnPhoneKey } from "../../lib/firestoreWrite";
import { useOnline } from "../../hooks/useSyncStatus";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useTodaysFocus, type Focus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { resolveHebrewSlash } from "../../lib/hebrewSlashGender";
import NowPlanLead from "../plans/NowPlanLead";
import PlansSection from "../plans/PlansSection";
import { closePlan, keepPlan, leadPlan, nightMomentText, recordNight, unrecordNight } from "../../lib/plans/planWeek";
import { usePlanVisibility } from "../../lib/plans/usePlanVisibility";
import { openPrintablePlan } from "../../lib/plans/planPrint";
import type { PlanBookDoc } from "../../lib/library/plans/planBookDoc";
import { dayKey } from "../../practice/signals";
import { isObservationAction, type ActionLoopEntry } from "../../actionLoop/model";
import { nextChosenAction, requestedObservation } from "./companionChoices";
import { scrollQuestionIntoMain } from "./nowDeepLinkScroll";
import { NOW_COPY } from "./nowViewCopy";
import NowRecommendation from "./NowRecommendation";
import { NowAgendaExtras, NowNoticeExtras, NowWhatChangedLines } from "./NowTodayLines";
import { BrandChip } from "../ui/BrandChip";
import { NowNoticeBlock, NowNoticeLead, NowPracticeLead, NowTonightLead, NowTonightPointer } from "./NowLoopBlocks";
import { focusSignalsForNow, stepLines } from "./nowRecommendationModel";
import { useNowClock } from "./useNowClock";
import { useNowRecord } from "./useNowRecord";
import { selectNowLead } from "../../lib/today/dayCard";
import { markPracticeShown } from "../../lib/practice/todayPin";
import { appointmentRoleLabel } from "../../lib/appointmentLabel";
import { isKidModeActive } from "../../lib/kidModeGate";
import { goToRoute, useHashQuery } from "../../hooks/useHashQuery";
import FromRecordCard, { FromRecordReceipt } from "../overview/FromRecordCard";
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
import NowPlanFrame, { type NowPlanKind } from "./NowPlanFrame";
import NowPlanBody from "./NowPlanBody";
import NowGuideReader from "./NowGuideReader";
import { NowKidWorld, NowWeekSoFar } from "./NowDayPanels";

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
  const { childProfile, actionLoop, seedCoach, setActiveTab, openCaptureSheet,
    saveTodayOutcome, saveTodayObservation, requestJournalFocus, pendingCaptureMode, consumeCaptureRequest, addMoment } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const copy = NOW_COPY[lang];
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
  // S1 (surfacing): the plan's front door on Today — the ONE "Everyday plans"
  // card under the lead (the running plan(s), then "Something hard right
  // now?" → the pattern chooser → the existing composer on #/journal?plan=).
  const planVisibility = usePlanVisibility();
  const openPattern = (pattern: string) => { setActiveTab("journal"); window.location.hash = `#/journal?plan=${pattern}`; };
  const openPlan = () => openPattern(plan?.def.id ?? "");
  // v4: the agenda row says where the family is in it ("Week 2 of 4"), counts only.
  const programWeeks = Array.isArray(program?.program.weeks) ? program.program.weeks.length : 0;
  // B-TODAY-37: "Record a moment" on an older question asks Now for THAT question's form.
  const observeId = useHashQuery().get("observe");
  const action = useMemo(() => requestedObservation(actionLoop, observeId) ?? nextChosenAction(actionLoop, topic?.id), [actionLoop, observeId, topic?.id]);
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
  const loop = useNowLoop({
    now,
    aiPracticeId: focus?.practiceVia === "ai" ? focus.practiceId : undefined,
    openPhotoCapture: () => openCaptureSheet({ mode: "photo" }),
  });
  const [tonightOpen, setTonightOpen] = useState(false);
  // ── Return hooks (parity 9 Oct): the visit stamp, a lifecycle note, the offer. ──
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);
  const lifecycle = useLifecycleMoment({ previousVisitAt, now: now.getTime() });
  const todayOffer = useCompanionOffer("today", { now, whatChanged: lifecycle.moment ? { id: lifecycle.moment.kind } : null });
  const visit = todayOffer.appointment;
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
    fallback: plan ? "plan" : loop.pick ? "practice" : loop.slotNotice ? "notice" : program ? "program" : "recommendation",
  });
  const showNotice = lead !== "notice" && loop.plan.order.includes("notice") && loop.blockNotices.length > 0;
  const showPointer = lead !== "tonight" && loop.tonightHasQuestions && (loop.plan.tonightPointer || (lead === "step" && loop.evening));
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
      : lead === "program" && program ? "program" : lead === "plan" && plan ? "plan" : "recommendation";
  const lifecycleKey = lifecycle.moment && todayOffer.offer?.kind === "what-changed" ? LIFECYCLE_NOTE[lifecycle.moment.kind] : undefined;
  const lifecycleNote = lifecycleKey ? t(lifecycleKey, { name }) : null;
  // v3 F-NOW-1: the plan card's face — the lead's own words when it has them
  // (the practice's say line, in the locale's quotes), else its one-liner; and
  // a line of plan meta about the parent's own step, in words, never a count.
  const practiceSay = shownLead === "practice" && loop.pick ? practiceText(loop.pick.practice, "say", lang, childProfile.gender) : "";
  // The urgent lead's face carries only the reviewed safety header; no say line,
  // no plan meta, no "picked because" — nothing is invented beside the help lines.
  const planTag = shownLead === "urgent" ? t("elev.safety.header.title") : copy.planTag[shownLead];
  const planSay = shownLead === "urgent" ? null : practiceSay ? t("elev.loop.ms.quoted", { text: practiceSay }) : copy.planSay[shownLead];
  const planMeta = shownLead === "urgent" ? null : shownLead === "step" ? (receipt ? (receiptQueued ? t(savedOnPhoneKey(online)) : copy.saved) : copy.today) : shownLead === "program" && program ? copy.programWeek(program.week) : copy.planMeta[shownLead];
  const planWeekTitle = shownLead === "plan" && plan ? <h2 id={`${id}-plan`} className="now-plan-title" dir="auto">{plan.def.title[lang]}</h2> : undefined;
  // v3 F-NOW-1 r2: the guide's title on the face is the lead's own h2, moved up
  // from its section (which keeps it as its label). The loop leads' cards carry
  // their own heading, so their face has the say line and meta only.
  const planTitle = shownLead === "step" && chosen ? <h2 ref={stepTitle} id={`${id}-step`} className="now-plan-title" dir="auto" style={observation ? { whiteSpace: "pre-wrap", scrollMarginBlockStart: "calc(var(--sticky-offset) + 12px)" } : undefined}>{receipt && !observation ? copy.finishedTitle : chosen.recommendation}</h2>
    : shownLead === "visit" && visit ? <h2 id={`${id}-visit`} className="now-plan-title" dir="auto">{copy.visitTitle(appointmentRoleLabel(visit, t), new Date(visit.whenIso!).toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "short" }))}</h2>
      : shownLead === "program" && program ? <h2 id={`${id}-program`} className="now-plan-title" dir="auto">{programSkill}</h2> : planWeekTitle;
  // The one plan body under every lead: why it was picked, always visible. The
  // practice says its own reason (the AI's sentence beside its own pick); the
  // question is quoted only for a step chosen under it.
  const practiceWhy = shownLead === "practice" && loop.pick
    ? (loop.pick.via === "ai" && focus?.why?.trim()) || t(loop.whyReason && (loop.whyReason !== "since" || loop.whyDate) ? WHY_KEY[loop.whyReason] : "elev.loop.practice.whyShelf", { shelf: shelfLabel(loop.pick.shelf, t), name, date: loop.whyDate ?? "" })
    : "";
  const planWhy = shownLead === "practice" ? practiceWhy || copy.pickedWhy.practice : shownLead === "tonight" && tonightOpen ? copy.pickedTonightOpen : copy.pickedWhy[shownLead];
  const planQuestion = shownLead === "step" && chosen && topic && chosen.topicId === topic.id ? topic.title : null;

  return <div className="companion-page now-page" dir={he ? "rtl" : "ltr"}>
    <header className="now-heading">
      <div>
        <p className="companion-eyebrow" data-testid="now-kicker">{copy.kicker}</p>
        <h1 className="arbor-type-title">{copy.title(name)}</h1>
      </div>
    </header>
    {(topic || onTopicOpen) && <NowQuestionRow data-module="now-focus" lang={lang} topic={topic} onOpen={onTopicOpen} onCreate={onTopicCreate ? () => onTopicCreate("") : undefined} />}

    <div className="now-main-column">
        {lead === "practice" && <PracticeFocus now={now} journal={loop.journal} onFocus={setFocus} onPending={setFocusPending} />}
        {/* The recommendation frames itself (its screened words face the art panel), so its frame here is bare. */}
        <NowPlanFrame kind={shownLead} lang={lang} tag={planTag} say={planSay} quoted={!!practiceSay} title={planTitle} meta={planMeta} question={topic?.title} bare={shownLead === "recommendation"}>
        {lead === "urgent" ? <section className="now-loop-lead" data-module="now-urgent" aria-label={t("elev.safety.header.title")}>
          <UrgentSupport testId="now-urgent-setup-support" className="now-urgent-lead" />
        </section> : lead === "record" ? <section className="now-loop-lead" data-module="now-record" aria-label={t("today.record.aria")}>
          {record.receipt ? <FromRecordReceipt queued={record.queued} /> : record.opener && <FromRecordCard opener={record.opener} childName={name} stampMove="choose-next-step" disabled={record.saving} onAnswer={answer => void record.answer(answer)} />}
          {record.saving && <p role="status" className="now-inline-status">{record.confirming ? t("elev.today.record.confirming") : copy.saving}</p>}
          {record.error && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : lead === "visit" && visit ? <section className="now-lead arbor-depth-primary" data-module="now-visit" aria-labelledby={`${id}-visit`}>
          <p className="now-plan-kicker">{copy.visit}</p>
          <p className="now-lead-body">{copy.visitBody}</p>
          <div className="now-lead-actions">
            <PrimaryMove type="button" className="companion-primary" onClick={openVisit}>{copy.visitOpen}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove>
            <button type="button" className="companion-secondary" onClick={() => todayOffer.snooze("appointment")}>{copy.visitLater}</button>
          </div>
        </section> : lead === "tonight" ? <section className="now-loop-lead" data-module="today-tonight" aria-label={t("elev.loop.today.tonight")}>
          <NowTonightLead loop={loop} />
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
            <PrimaryMove type="button" className="companion-primary" disabled={saving} onClick={() => void saveOutcome("helped")}><Icon name="check" size={19} />{saving ? copy.saving : copy.helped}</PrimaryMove>
            <button type="button" className="companion-secondary" disabled={saving} onClick={() => void saveOutcome("not_today")}><Icon name="replay" size={18} />{copy.notToday}</button>
            <button type="button" className="companion-secondary" disabled={saving} aria-pressed={notYetFor === chosen.id} onClick={() => setNotYetFor(chosen.id)}>{copy.notYet}</button>
          </div>}
          {!observation && !receipt && notYetFor === chosen.id && <p role="status" className="now-inline-status">{copy.notYetAck}</p>}
          {!observation && <PrimaryMove primary={!!receipt} type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(chosen.recommendation))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></PrimaryMove>}
          {currentSaveError && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : lead === "practice" && loop.pick ? <section className="now-loop-lead" data-module="today-practice" aria-label={copy.today}>
          <NowPracticeLead loop={loop} name={name} whyText={focus?.why} headerNote={lifecycleNote} adaptLabel={copy.adapt} choosing={focusPending}
            onAdapt={() => talk(copy.adaptPrompt(practiceText(loop.pick!.practice, "do", lang, childProfile.gender)))} />
        </section> : lead === "notice" ? <section className="now-loop-lead" data-module="today-practice" aria-label={t("elev.loop.today.notice.title")}>
          <NowNoticeLead loop={loop} name={name} />
        </section> : lead === "plan" && plan ? <NowPlanLead plan={plan} lang={lang} childName={name} now={now} evening={loop.evening}
          onNight={(happened) => { if (happened) void planRows.upsert(recordNight(plan.doc, now)); }}
          onUndoNight={() => void planRows.upsert(unrecordNight(plan.doc, now))}
          onJournal={() => void addMoment(nightMomentText(plan.def, lang, name))}
          onOpen={openPlan} />
        : lead === "program" && program ? <section className="now-lead arbor-depth-primary" data-module="now-program" aria-labelledby={`${id}-program`}>
          <p className="now-plan-kicker">{copy.programLabel}</p>
          <p className="now-lead-body">{copy.programWhy(program.week)}</p>
          <div className="now-lead-actions"><PrimaryMove type="button" className="companion-primary" onClick={openProgram}>{copy.continueProgram}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove></div>
          <button type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(programSkill))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></button>
        </section> : <NowRecommendation name={name} onTalkOpen={talk} journal={loop.journal} />}
        {shownLead !== "recommendation" && shownLead !== "urgent" && <div className="now-plan-foot"><NowPlanBody why={planWhy} time={copy.planTime[shownLead]} size={copy.planSize[shownLead]} question={planQuestion} /></div>}
        </NowPlanFrame>
        {lifecycleNote && lead !== "practice" && <p className="now-lifecycle-note" role="note">{lifecycleNote}</p>}
        {/* S1: the Everyday plans card sits under the lead, where the lifecycle note does; a plan already leading is not
            repeated, and on the urgent day (B-TODAY-38) the help lines stand alone in the column. */}
        {lead !== "urgent" && <PlansSection surface="today" childName={name} planRows={planRows.items} visibility={planVisibility} now={now} excludePlanId={shownLead === "plan" && plan ? plan.doc.id : undefined}
          onOpenDoor={openPattern} onOpenPlan={(p) => openPattern(p.def.id)} onChange={(p) => openPattern(p.def.id)}
          onKeep={(p) => void planRows.upsert(keepPlan(p.doc, now))} onClose={(p) => void planRows.upsert(closePlan(p.doc, now))}
          onPrint={(p) => void openPrintablePlan({ doc: p.doc, child: childProfile, lang, now })} />}

        {/* v4: the say-back question and "Arbor noticed" are Notice today's last rows; with no notice rows today they stand
            alone — except beside the urgent help lines, which stand alone in the column (B-TODAY-38). */}
        {showNotice ? <div data-module="today-notice"><NowNoticeBlock loop={loop} name={name} practiceLeads={lead === "practice"}
          extras={<NowNoticeExtras keepsakeDocs={loop.keepsakeDocs} now={loop.now} isReturning={isReturning} suppressSayBack={lead === "record"} />} /></div>
          : lead !== "urgent" && <NowNoticeExtras keepsakeDocs={loop.keepsakeDocs} now={loop.now} isReturning={isReturning} suppressSayBack={lead === "record"} />}
    </div>

    <NowKidWorld observations={observations} now={now} name={name} onAll={() => setActiveTab("development")} />

    <div className="now-day-grid">
      <NowWeekSoFar observations={observations} now={now} onReport={() => setActiveTab("weekly")}>
        <NowWhatChangedLines previousVisitAt={previousVisitAt} isReturning={isReturning} rhythmDaysNeeded={loop.rhythm.daysNeeded} />
      </NowWeekSoFar>
      <section className="now-glance" aria-labelledby={`${id}-glance`}>
        <h2 id={`${id}-glance`} className="now-kicker">{copy.glanceTitle}</h2>
        {visit && lead !== "visit" && <button type="button" className="now-weekly-door now-glance-visit" onClick={openVisit}>
          <BrandChip icon="event" tone="sky" shape="leaf" /><span><b dir="auto">{copy.visitTitle(appointmentRoleLabel(visit, t), new Date(visit.whenIso!).toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "short" }))}</b><small>{copy.visitPrep}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
        </button>}
        {showPointer && <NowTonightPointer onOpen={() => { loop.setTonightEarly(true); setTonightOpen(true); }} />}
        {/* B-PROG-03: the program is Today's frame: one line beside the practice, never a second lead. */}
        {program && lead !== "program" && <button type="button" className="now-weekly-door now-program-line" data-testid="now-program-line" onClick={openProgram}>
          <BrandChip icon="menu_book" tone="green" shape="drop" /><span><b>{copy.programLabel}</b><small dir="auto">{programSkill}</small></span>
          {programWeeks > 0 && <span className="now-agenda-badge" data-testid="now-program-week">{copy.programWeekOf(program.week, Math.max(program.week, programWeeks))}</span>}
          <Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" />
        </button>}
        <NowAgendaExtras evening={loop.evening} storyFits={loop.storyFits} todayOffer={todayOffer} suppressVisit={lead === "visit" || !!visit} storyRow={!showPointer} />
        <button type="button" className="now-weekly-door now-glance-reminders" onClick={() => setActiveTab("smart-reminders")}><BrandChip icon="notifications" tone="sapphire" shape="arch" /><span><b>{copy.remindersTitle}</b><small>{copy.remindersBody}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>
      </section>
    </div>

  </div>;
}
