import React, { useEffect, useMemo, useState } from "react";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { formatChildAge } from "../../lib/age/format";
import { availableHardMomentCards } from "../../content/selectCards";
import { escalationText, locText } from "../../content/hardMomentSurface";
import { acceptHardMomentStep, hardMomentStepFor } from "../overview/hardMomentStep";
import { renderSayThis } from "../../content/hardMomentCards";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import type { StepSayThis } from "../overview/TodayRecommendation";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToast } from "../../context/ToastContext";
import DailyPlayCard from "../overview/DailyPlayCard";
import QuickCaptureBar from "../overview/QuickCaptureBar";
import TodayRecommendation from "../overview/TodayRecommendation";
import TodayActionLoop from "../overview/TodayActionLoop";
import CompanionOfferSlot from "../overview/CompanionOfferSlot";
import TodayContinuation from "../overview/TodayContinuation";
import TonightCard, { DayCloseLine } from "../overview/TonightCard";
import { bedtimeDoorOpen } from "../../lib/timeOfDay";
import { dayStamp, deriveReturnSignals } from "../../lib/tomorrowReason";
import { readRitualRecord } from "../../lib/familyRitualsCadence";
import FamilyOfferLines from "../overview/FamilyOfferLines";
import { chooseContinuation, dayCloseDue, dayCloseKey, isContinuationKind } from "../overview/continuation";
import { useCompanionOffer } from "../overview/useCompanionOffer";
import QuickLogModal from "../overview/QuickLogModal";
import WhatChanged from "../overview/WhatChanged";
import { composeWhatChanged, type WhatChangedLine } from "../overview/whatChangedEvents";
import { firstsStorageKey, type FirstsState } from "../../lib/firsts";
import PromptCaptureCard from "../overview/PromptCaptureCard";
import FromRecordCard, { FromRecordReceipt } from "../overview/FromRecordCard";
import { Avatar } from "../ui/Avatar";
import { childPicture } from "../../lib/childPicture";
import { answeredToday, selectFromRecord } from "../../lib/today/fromRecord";
import { ErrorState } from "../ui/ErrorState";
import ArborNoticedCard, { todayNoticedSignal } from "../sections/ArborNoticedCard";
import type { CaptureMode } from "../../context/ArborContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import { useLastVisit } from "../../hooks/useLastVisit";
import { predictRhythm, hourLabel } from "../../rhythm/predict";
import { selectDailyPlay, concernDomainsFromLogs, daySeedFor, type ScoredActivity, type SessionLength } from "../../playbank/select";
import { useMonitoring } from "../../hooks/useMonitoring";
import { activeGoalDomains, type ActiveGoal } from "../../practice/goalBuilder";
import { playDomainLabel } from "../../playbank/content";
import { focusHeadlineFor, focusBodyFor, whyLineFor } from "../../lib/todayFocus";
import { isIncidentType } from "../../content/behaviorTaxonomy";
import { dailyPromptKeys } from "../../lib/promptBank";
import { chooseTodayAction } from "../overview/chooseTodayAction";
import { resolveTodayModules } from "../overview/todayModules";
import FirstStepsRail, { useFirstStepsRail } from "../onboarding/FirstStepsRail";
import LifecycleMomentCard from "../overview/LifecycleMomentCard";
import { useLifecycleMoment } from "../overview/useLifecycleMoment";
import WeekOpenAnchorCard from "../overview/WeekOpenAnchorCard";
import { readWeekAnchorSeen, weekAnchorRecapDue, weekOpenAnchorDue } from "../overview/weekAnchor";
import WeekAnchorCard, { WeekAnchorLine } from "../overview/WeekAnchorCard";
import { recapWeekId, useWeeklyRecap } from "../../hooks/useWeeklyRecap";
import { track } from "../../lib/analytics";
import { ageYearsOf } from "../../lib/age/forChild";

const DAY = 86_400_000;

// Token shorthands so the screen reads from one palette, not scattered literals.

/**
 * TODAY — one integrated loop, not stacked widgets (TODAY-2/CODEX-1), now under
 * the W1 Rule-A budget (masterplan 2026-08-11): ≤4 visible modules since
 * B-TODAY-17 and exactly ONE primary action above the fold, on every open.
 *
 * What renders now (top → bottom):
 *   Quick Capture bar (W6.2/TODAY-4): ambient capture chrome — first in the
 *       DOM, pinned bottom on phones, inline on lg+.
 *   Row 1 — FIRST, so the day's action clears the fold: the GUARANTEED
 *       action in the left slot — the chooseTodayAction chain picks exactly
 *       one of: loop (accepted action) → focus hero (+why-line) → promptBank
 *       capture card (+why-line) → Daily Play (the ONLY place play renders on
 *       Today, B-TODAY-17) → bare capture card.
 *       · B-TODAY-21: the ONE "What changed since you left" card (returning
 *         parents only, never day-0) in the right column at lg, under the
 *         anchor below lg — it replaced the dev-map count card, the
 *         SinceLastVisit strip and the progress narrative.
 *   Lifecycle moment (ENG-09), FirstStepsRail (E11), Arbor Noticed (DUX-011:
 *       never on day-0; FOLDS into a What-changed line when the budget is
 *       spent).
 *   B-TODAY-17: no "More" drawer — no activity feed, no displaced play, no
 *       wellness check-in.
 *   Day-0 (no data, first visit): header + capture bar + primary action + the
 *       first-steps rail ONLY — no picture, no play, no watch signal.
 *
 * FOLD ORDER (P1-A, 2026-08-12 audit). The since-strip and the first-steps rail
 * both used to sit ABOVE the anchor row (the rail was even mounted by Shell,
 * outside this file's budget), which pushed the single primary CTA to y≈1224 on
 * a 1280×900 desktop open and y≈1697 on a 375×812 phone. Rule A is not "one
 * primary action somewhere on the page" — it is one primary action ABOVE THE
 * FOLD. Nothing may outrank the day's action, so continuity and onboarding both
 * moved below it. The "continuing where we left off" framing survives as the
 * anchor's own eyebrow.
 *
 * MODULE BUDGET: overview/todayModules.ts resolves which modules render from
 * their REAL render conditions. It must never be fed a content-governance gate
 * (see P1-B in that file) — a governed array going empty may change what a
 * module says, never how many modules Today shows.
 *
 * CLINICAL FIREWALL: every child-data surface here shows COUNTS ONLY — never a
 * %, 0–100 score, verdict/status tag, percentile or deficit pointer. The
 * since-visit strip is EVENT language only — never comparative/trend wording.
 */
export default function OverviewTab() {
  const {
    setActiveTab, milestones, checkedMilestones,
    behaviorLogs, childProfile, seedCoach,
    donePlayIds, logPlayCompletion, playLogs, actionLoop,
    activeTodayAction, acceptTodayAction, requestJournalFocus, approvedMemoryItems,
    pendingCaptureMode, consumeCaptureRequest, openHardMomentNow,
    actionPlans, memoryReviewItems, recordFromRecordAnswer,
  } = useArbor();

  const { t, uiLang } = useLanguage();
  const { toast } = useToast();
  // W6.2 ambient capture → B-TODAY-19: every tile (text · voice · photo)
  // opens the ONE capture sheet in place (QuickLogModal portals to body), so
  // the parent never leaves Today. No hand-off to Behaviors.
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  // TJB-08: which modality the sheet opens in.
  const [quickLogMode, setQuickLogMode] = useState<CaptureMode>("text");
  // B-TODAY-19: the promptBank question the sheet answers (stored on the log).
  const [quickLogPromptKey, setQuickLogPromptKey] = useState<string | null>(null);
  // ENG-01: the JITAI LOG nudge lands on Today with a pending "text" capture
  // request (the requestCapture seam the rhythm cue uses) — consume it
  // once and open the quick-log here, so the nudge's promise "Log a moment"
  // is one tap, not a hub switch.
  useEffect(() => {
    if (pendingCaptureMode !== "text") return;
    consumeCaptureRequest();
    startCapture("text");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);
  // B-TODAY-10 → B-ASKJB-31: the "Hard moment" tile opens the shared "Hard
  // moment now" sheet (openHardMomentNow, mounted once in Shell); the capture
  // sheet's hard-moment branch stays for a caller that passes hard=true.
  const [quickLogHard, setQuickLogHard] = useState(false);
  const startCapture = (mode: CaptureMode, promptKey: string | null = null, hard = false) => {
    setQuickLogMode(mode);
    setQuickLogPromptKey(promptKey);
    setQuickLogHard(hard);
    setQuickLogOpen(true);
  };

  // Parent-expressed goals (not a child assessment). Feed Daily Play selection
  // and the dev-map "Focus" count; goal editing itself lives in Growth › Daily Play.
  const activeGoals: ActiveGoal[] = childProfile.activeGoals ?? [];
  const goalDomains = useMemo(() => activeGoalDomains(activeGoals), [activeGoals]);

  const firstName = (childProfile.name || "your child").split(" ")[0];

  // ── W1 1.1: two-slot visit tracking (mounted ONCE, here) ──
  const { previousVisitAt, isReturning } = useLastVisit(childProfile);

  // ── Rhythm prediction + Daily Play pick (memory-driven) ──
  const rhythm = useMemo(
    () => predictRhythm(
      behaviorLogs.map((l) => ({ timestamp: l.timestamp, intensity: l.intensity })),
      Date.now(),
      { ageYears: ageYearsOf(childProfile) }
    ),
    [behaviorLogs, ageYearsOf(childProfile)]
  );

  // ── B-TODAY-26: the evening door and the day's kept moments. The hour is
  //    read at render (Today re-renders on every open); bedtimeDoorOpen is the
  //    ONE evening rule (18:00 on, or the family's own wind-down hour). The
  //    count is the day-close signal (deriveReturnSignals.momentsToday) — the
  //    same number closeDay writes tomorrow's reason from; no new count. ──
  const nowHour = new Date().getHours();
  const tonightOpen = bedtimeDoorOpen(nowHour, rhythm.windDownHour);
  const momentsToday = useMemo(
    () => deriveReturnSignals({ behaviorLogs, playLogs, watchFocus: false, ritualRecord: readRitualRecord(), now: Date.now() }).momentsToday,
    [behaviorLogs, playLogs]
  );
  const [dayCloseDismissedDay, setDayCloseDismissedDay] = useState<string | null>(() => {
    try { return window.localStorage.getItem(dayCloseKey(childProfile.id)); } catch { return null; }
  });
  useEffect(() => {
    try { setDayCloseDismissedDay(window.localStorage.getItem(dayCloseKey(childProfile.id))); } catch { setDayCloseDismissedDay(null); }
  }, [childProfile.id]);
  const dismissDayClose = () => {
    const today = dayStamp(Date.now());
    try { window.localStorage.setItem(dayCloseKey(childProfile.id), today); } catch { /* best-effort */ }
    setDayCloseDismissedDay(today);
  };

  const [sessionLength, setSessionLength] = useState<SessionLength>(() => {
    try { return (localStorage.getItem(`arbor.play.sessionLength.${childProfile.id}`) as SessionLength) || "standard"; }
    catch { return "standard"; }
  });
  const [sessionTapped, setSessionTapped] = useState(false);
  const handleSessionLength = (v: SessionLength) => {
    setSessionLength(v);
    setSessionTapped(true);
    try { localStorage.setItem(`arbor.play.sessionLength.${childProfile.id}`, v); } catch { /* ignore */ }
  };

  const latestCompletedAction = useMemo(
    () => actionLoop.find((entry) => entry.status === "completed" && entry.outcome),
    [actionLoop]
  );

  const dailyPlay: ScoredActivity | null = useMemo(() => {
    const concernDomains = concernDomainsFromLogs(
      behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, timestamp: l.timestamp })),
      Date.now()
    );
    const picks = selectDailyPlay({
      ageYears: ageYearsOf(childProfile),
      concernDomains,
      goalDomains,
      recentlyDoneIds: donePlayIds,
      daySeed: daySeedFor(Date.now()),
      interests: childProfile.interests,
      sessionLength,
      // W2.5: continuation weighting from the parent's own reported outcome.
      lastAction: latestCompletedAction?.outcome
        ? { recommendation: latestCompletedAction.recommendation, outcome: latestCompletedAction.outcome }
        : undefined,
    }, 1);
    return picks[0] ?? null;
    // ENG-L2: `childProfile.interests` is READ above, so it must be a dep.
    // Without it, a parent who answered the "one thing {name} loves" ask on
    // this very screen kept the pre-interest pick until some unrelated dep
    // changed — the interest was captured and then visibly ignored, which is
    // worse than never asking. Joined so the identity of the array (a new one
    // per profile write) cannot re-run selection on every render.
  }, [behaviorLogs, ageYearsOf(childProfile), childProfile.id, childProfile.interests?.join(" "), donePlayIds, goalDomains, sessionLength, latestCompletedAction]);

  // AIX-S4: seeds go through i18n (seed.*) — HE parents see Hebrew in the chat box.
  const coachOnPlay = (p: ScoredActivity) => {
    seedCoach({ prompt: t("seed.play", { title: p.activity.title, name: firstName, domain: p.activity.domain }), source: "today-play" });
  };
  const markPlayDone = (p: ScoredActivity) => {
    logPlayCompletion(p, "today");
    toast(t("ov.toast.playDone", { name: firstName }), "success");
  };

  // ── Today's AI focus — "the one thing that matters today" (the hero title) ──
  // B-TODAY-11: what the parent logged in 7 days = moments + plays + milestones
  // noticed (observationUpdatedAt), so play-only and milestone-only families
  // get a step too.
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
  // B-TODAY-11: the newest capture or step outcome — a focus generated before
  // it refreshes once per open.
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

  // B-TODAY-09: the prior-window moment count, the intensity average and the
  // milestone percentage were computed here and never read (the narrative and
  // the focus prompt both ignore them) — deleted, not hidden.

  const topTrigger = useMemo(() => {
    const counts = new Map<string, number>();
    // TJB-01: plain Moments are not a "pattern most often around …" — only
    // incident types compete for the top trigger the focus prompt names.
    behaviorLogs.filter((l) => isIncidentType(l.behaviorType)).forEach((l) => counts.set(l.behaviorType, (counts.get(l.behaviorType) || 0) + 1));
    let top = ""; let max = 0;
    counts.forEach((v, k) => { if (v > max) { max = v; top = k; } });
    return top;
  }, [behaviorLogs]);

  const { focus, loading: focusLoading, error: focusError, regenerate: regenerateFocus } = useTodaysFocus(childProfile, {
    count: recentCount,
    topTrigger,
    lastActionRecommendation: latestCompletedAction?.recommendation,
    lastActionOutcome: latestCompletedAction?.outcome,
    latestAt: latestRecordAt,
  });

  // TODAY-1/CODEX-2: the headline is ALWAYS derived from the AI focus text
  // (pure scrub in lib/todayFocus — no keyword override, no canned copy).
  // null = no real focus (day-0 / failed fetch): W1 1.2 routes that case into
  // the guaranteed-action chain below — TodayActionLoop still gets null so the
  // fallback can never be persisted via acceptTodayAction nor injected into
  // the next focus prompt.
  // TJB-02: the headline is the model's ONE step (`tryToday`) when the record
  // is structured, else the legacy first sentence of `text`; the observation
  // (`focus`) renders as the hero body. Same pure scrub on every path.
  const focusHeadline = useMemo(() => focusHeadlineFor(focus), [focus]);
  const focusBody = useMemo(() => focusBodyFor(focus), [focus]);
  // ENG-07 / AI-19: the why-line names ONLY the inputs that really exist for
  // this child (server-reported inputsUsed when present); day-0 gets the
  // honest "chosen from age" line.
  const focusWhy = useMemo(
    () =>
      whyLineFor(
        {
          name: firstName,
          recentCount,
          confidence: rhythm.confidence,
          goals: activeGoals.length,
          interests: childProfile.interests?.length ?? 0,
          inputsUsed: focus?.inputsUsed,
        },
        t,
      ),
    [firstName, recentCount, rhythm.confidence, activeGoals.length, childProfile.interests?.length, focus?.inputsUsed, t],
  );

  // ── W1 1.2: the guaranteed action — deterministic fallback chain. A fetch
  //    in flight for a child WITH signals keeps the hero (skeleton) so the
  //    slot never flickers prompt→focus mid-load. ──
  const promptKeys = useMemo(
    () => dailyPromptKeys({ ageYears: ageYearsOf(childProfile), childId: childProfile.id, date: new Date() }),
    [ageYearsOf(childProfile), childProfile.id]
  );
  // ── ENG-24: the weekly ritual's Monday anchor. The week identity is the
  //    recap's own (recapWeekId is a PURE date function — importing it opens no
  //    listener and reads no report), and the "already offered" marker is the
  //    recap anchor's own localStorage row, so one week yields one anchor
  //    whichever variant fires and no new `arbor.` key enters the tree.
  //
  //    Both facts are read ONCE into state, not per render: the card writes the
  //    marker on the frame it appears, so a re-derivation mid-session would see
  //    its own write and pull the card out from under the parent. `dismissed`
  //    is the same slot's escape hatch — flipping it falls through to the day's
  //    normal anchor in the same frame.
  const [weekOpen, setWeekOpen] = useState(() => ({
    childId: childProfile.id,
    weekId: recapWeekId(new Date()),
    dayOfWeek: new Date().getDay(),
    seenWeekId: readWeekAnchorSeen(childProfile.id),
    dismissed: false,
  }));
  useEffect(() => {
    setWeekOpen((prev) =>
      prev.childId === childProfile.id
        ? prev
        : {
            childId: childProfile.id,
            weekId: recapWeekId(new Date()),
            dayOfWeek: new Date().getDay(),
            seenWeekId: readWeekAnchorSeen(childProfile.id),
            dismissed: false,
          }
    );
  }, [childProfile.id]);
  // B-TODAY-08: Today's ONE useWeeklyRecap() mount (it used to live inside
  // SinceLastVisit, which now reads it as a prop). The hook's module-level
  // guard keeps it from double-generating with WeeklyTab. A written, unopened
  // recap for this week is the Monday anchor (WeekAnchorCard → #/weekly).
  const weeklyRecap = useWeeklyRecap();
  const recapAnchorDue =
    !weekOpen.dismissed &&
    weekOpen.childId === childProfile.id &&
    weekAnchorRecapDue({
      weekId: weekOpen.weekId,
      recapUnopened: !!weeklyRecap.currentReport && weeklyRecap.recapUnopened,
      anchorSeenWeekId: weekOpen.seenWeekId,
    });
  const weekOpenDue =
    !weekOpen.dismissed &&
    weekOpen.childId === childProfile.id &&
    weekOpenAnchorDue({
      weekId: weekOpen.weekId,
      dayOfWeek: weekOpen.dayOfWeek,
      anchorSeenWeekId: weekOpen.seenWeekId,
    });

  // ── B-TODAY-12: the matched pilot hard-moment guide is the step's content,
  //    never a second card. With a focus, its Say-this rides on the focus
  //    card; with no focus, its doNow IS the step (same accept seam).
  const hmLocale: "en" | "he" = uiLang === "he" ? "he" : "en";
  const hardMoment = useMemo(() => {
    const now = new Date();
    return hardMomentStepFor(behaviorLogs, { now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: hmLocale }, !!activeTodayAction);
  }, [activeTodayAction, behaviorLogs, childProfile, hmLocale]);
  const hardMomentSayThis: StepSayThis | undefined = hardMoment
    ? {
        text: locText(renderSayThis(hardMoment.card, firstName), hmLocale),
        lang: hmLocale,
        title: t("hm.section.sayThis"),
        copyLabel: t("coach.action.copy"),
        copiedLabel: t("coach.cards.copied"),
        pilotLabel: hardMoment.pilot ? hardMomentPilotText(hmLocale).status : undefined,
        escalation: { title: t("hm.section.escalation"), text: escalationText(hardMoment.card, hmLocale) },
      }
    : undefined;

  const todayChoice = useMemo(
    () => chooseTodayAction({
      hasActiveAction: !!activeTodayAction,
      hasHardMomentStep: !!hardMoment,
      hasWeekAnchorRecap: recapAnchorDue,
      hasWeekOpenAnchor: weekOpenDue,
      focusHeadline,
      focusPending: focusLoading && !focus && recentCount > 0,
      promptKeys,
      hasDailyPlay: !!dailyPlay,
      // B-TODAY-26: a family with nothing in the record yet keeps the day-0
      // capture floor; Tonight needs a day to read from.
      tonight: tonightOpen && behaviorLogs.length + playLogs.length > 0,
    }),
    [activeTodayAction, hardMoment, recapAnchorDue, weekOpenDue, focusHeadline, focusLoading, focus, recentCount, promptKeys, dailyPlay, tonightOpen, behaviorLogs.length, playLogs.length]
  );
  const stepIsHardMoment = todayChoice.kind === "hardMoment" && !!hardMoment;
  // B-TODAY-24: the step card's ONE Say-this line — the governed pilot guide's
  // words when one matches (with its escalation), else the focus's own
  // sayThis from /todays-focus (same model call, screened server-side).
  const stepSayThis: StepSayThis | undefined = hardMomentSayThis
    ?? (!stepIsHardMoment && focus?.sayThis
      ? {
          text: focus.sayThis,
          lang: (focus.lang === "he" ? "he" : focus.lang === "en" ? "en" : hmLocale),
          title: t("hm.section.sayThis"),
          copyLabel: t("coach.action.copy"),
          copiedLabel: t("coach.cards.copied"),
        }
      : undefined);
  const hardMomentDoNow = hardMoment ? locText(hardMoment.card.doNow, hmLocale) : "";
  // KPI 0.8: % opens ending in an offered action (target 100%).
  useEffect(() => {
    track("today_action_offered", { kind: todayChoice.kind });
  }, [todayChoice.kind]);

  // B-TODAY-10: the tile shows only while a pilot guide is available for this
  // child's age and locale — after HARD_MOMENT_PILOT.expiresAt the list is
  // empty and the tile is absent (pilotRelease.hardMomentPublication).
  const hardMomentTile = useMemo(() => {
    const now = new Date();
    return availableHardMomentCards({ now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: uiLang === "he" ? "he" : "en" }).length > 0;
  }, [childProfile, uiLang]);

  // B-TODAY-28: the child leads — the top line is the child's name, age and
  // the local weekday + part of day ("Dylan · 5 · Tuesday morning"); the
  // greeting to the parent is gone (CODEX-2's local-time rule stands).
  const now0 = new Date();
  const hour = now0.getHours();
  const whenKey =
    hour < 12 ? "today.when.morning" : hour < 18 ? "today.when.afternoon" : "today.when.evening";
  const weekday = now0.toLocaleDateString(uiLang === "he" ? "he-IL" : "en-GB", { weekday: "long" });
  // B-INF-10: the one child-age formatter (lib/age/format), never `profile.age`.
  const ageText = formatChildAge(childProfile, t);
  // Critic r1: each segment is one unbreakable phrase (no-break spaces), so
  // "3 years 2 months" never splits as "3 שנים ו-2 / חודשים".
  const nowrap = (s: string) => s.replace(/ /g, " ");
  const identityLine = ageText
    ? t("today.identity", { name: firstName, age: nowrap(ageText), when: t(whenKey, { weekday }) })
    : t("today.identity.noAge", { name: firstName, when: t(whenKey, { weekday }) });

  // B-TODAY-28 — "From your record": ONE opener drawn from what the family
  // already told Arbor (active plan → old note → a remembered fact with a
  // time in it). Pure, zero model calls. When it speaks (or was answered
  // today), the generic capture prompt card does not render.
  const recordOpener = useMemo(
    () => selectFromRecord({
      now: new Date(),
      plans: actionPlans,
      loop: actionLoop,
      logs: behaviorLogs,
      facts: memoryReviewItems.map((m) => ({ id: m.memoryId, fact: m.fact, createdAt: m.createdAt, status: m.status })),
    }),
    [actionPlans, actionLoop, behaviorLogs, memoryReviewItems]
  );
  const recordAnswered = useMemo(() => answeredToday(actionLoop, childProfile.id), [actionLoop, childProfile.id]);
  const recordSpeaks = !!recordOpener || !!recordAnswered;
  /** NEXTLEVEL critic r1: the record card is asking (its chips are the move). */
  const recordAsks = !!recordOpener && !recordAnswered;

  // The step card's ONE seeded ask: the focus text, or (B-TODAY-12) the
  // matched guide's doNow when that is the step.
  const beginGuidance = () => {
    const stepText = stepIsHardMoment ? hardMomentDoNow : focus?.text;
    seedCoach({ prompt: stepText ? t("seed.todayFocus", { focus: stepText, name: firstName }) : undefined, source: "today-guidance" });
  };

  // B-TODAY-17: the activity feed (and its "Live" pill) is gone with the
  // drawer it lived in — the ONE What-changed card says what is new, and the
  // Journal holds the whole ledger.

  // ── Rule A budget inputs: which conditional modules would ACTUALLY render? ──
  // P1-B: the previous implementation asked `todayHardMomentOffer(...)` here.
  // That resolves through publishedHardMomentCards, which governance (GD-10)
  // keeps empty, so the budget could never engage AND the hard-moment offer is
  // not even a sibling module — it renders inside the anchor's left column.
  // Every input below is now the module's own render condition.
  //
  // Mirrors ArborNoticedCard's render gate through ITS selector (B-TODAY-05:
  // a pattern-backed monitor signal, not dismissed).
  const monitoring = useMonitoring();
  const noticedWould = useMemo(() => {
    const signal = todayNoticedSignal(monitoring);
    if (!signal || signal.level !== "monitor") return false;
    try {
      const raw = window.localStorage.getItem(`arbor.noticed.dismissed.${childProfile.id}`);
      const dismissed = raw ? (JSON.parse(raw) as unknown) : [];
      return !(Array.isArray(dismissed) && dismissed.includes(`${signal.domain}:${signal.level}`));
    } catch {
      return true;
    }
  }, [monitoring, childProfile.id]);

  // Would the first-steps rail render? The rail owns that answer (dismissed /
  // all-done / established account) — the budget asks it rather than guessing.
  const railWould = useFirstStepsRail().visible;

  // ── Day-0 (first visit, zero data): header + capture bar + primary action +
  //    the first-steps rail ONLY (Rule A day-0 shape). P1-C: the watch card is
  //    inside this guard too — a parent who has answered nothing has produced
  //    no signal, so Today has nothing to have "noticed". ──
  const dayZero =
    !isReturning && behaviorLogs.length === 0 && playLogs.length === 0 && checkedMilestones === 0;

  // ── B-TODAY-21: the ONE "What changed since you left" composer (events
  //    strictly newer than the previous visit). Built WITHOUT the fold line
  //    first, because whether the card has anything to say decides whether
  //    the watch signal has a fold target at all. ──
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
  const composeChanged = (includeNoticed: boolean) =>
    composeWhatChanged({
      previousVisitAt: isReturning && !dayZero ? previousVisitAt : null,
      behaviorLogs,
      playLogs,
      milestones,
      actionLoop,
      approvedFactsSince,
      firstsState,
      firstsCounts: { milestoneCount: checkedMilestones },
      includeNoticed,
    });
  const changedBase = useMemo(
    () => composeChanged(false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReturning, dayZero, previousVisitAt, behaviorLogs, playLogs, milestones, actionLoop, approvedFactsSince, firstsState, checkedMilestones]
  );
  const recapLineDue = !!weeklyRecap.currentReport && weeklyRecap.recapUnopened;
  const changedWould = !dayZero && isReturning && (changedBase.lines.length > 0 || recapLineDue);

  // ── ENG-09 (Wave E): the lifecycle spine. `onboardingCompletedAt` finally
  //    has a reader — the pure resolver in lib/lifecycle.ts turns the account's
  //    own age (plus the child's calendar and the visit gap) into AT MOST ONE
  //    moment per open: the first captured moment and tonight's story (ENG-L0),
  //    day one framed forward (ENG-L1), the "one thing they love" ask (ENG-L2),
  //    the first-week keepsake (ENG-L3), a birthday or a new age band (ENG-20),
  //    and the warm, age-anchored return after a lapse (ENG-L5 — never a loss
  //    frame). It is surfaced IN-APP on the next open: there is no push, email
  //    or local-notification path in this app and nothing here pretends there
  //    is. `previousVisitAt` comes from the SINGLE useLastVisit mount above —
  //    that hook writes, so it must never be mounted twice. ──
  const lifecycle = useLifecycleMoment({ previousVisitAt });
  const lifecycleMoment = lifecycle.moment;

  // ── Rule A: resolve the ≤4-module budget from the REAL render conditions. ──
  const modulePlan = useMemo(
    () => resolveTodayModules(
      {
        // The module's REAL render condition: a moment was resolved for this
        // open. Day-0 with no data still shows nothing — the resolver cannot
        // produce a moment before the first capture (P1-C day-0 shape).
        lifecycle: lifecycleMoment !== null,
        changed: changedWould,
        // NEXTLEVEL critic r1: the day-0 "First steps" rail has no reason to
        // exist once the record speaks (a plan or a parent note).
        rail: railWould && !recordSpeaks,
        noticed: !dayZero && noticedWould,
      },
      { noticedCanFold: changedWould },
    ),
    [changedWould, railWould, recordSpeaks, dayZero, noticedWould, todayChoice.kind, lifecycleMoment]
  );

  // The watch signal degrades by FOLDING into a What-changed line ("Arbor
  // noticed something — look"), never by vanishing (todayModules.ts
  // guarantees it is only demotable while the card is there to receive it).
  const foldNoticed = modulePlan.demoted.includes("noticed");
  const showChanged = modulePlan.visible.has("changed");
  const showLifecycle = modulePlan.visible.has("lifecycle");
  // B-AI-06: ONE proactive offer per open. The coordinator ranks the carry-over
  // question, the lifecycle moment, appointments, a due re-check, the rhythm
  // cue, the hard-moment step and the evening door, and Today renders only the
  // winner (CompanionOfferSlot; the lifecycle card keeps its own position).
  const todayOffer = useCompanionOffer("today", {
    whatChanged: showLifecycle && lifecycleMoment ? { id: lifecycleMoment.kind } : null,
  });
  // B-TODAY-18: ONE slot instance, placed by the coordinator's winner — the
  // carry-over / tomorrow's-reason kinds above the step, every other kind
  // under it. Never two proactive frames.
  // B-TODAY-26: while Tonight holds the step slot, the coordinator's evening
  // cue (offer kind "tonight" — RhythmCue's BEDTIME kind) is not rendered on
  // Today: one voice for the evening.
  const shownOffer = todayChoice.kind === "tonight" && todayOffer.offer?.kind === "tonight" ? null : todayOffer.offer;
  const offerIsContinuation = isContinuationKind(shownOffer?.kind);
  const continuation = chooseContinuation({
    offerKind: shownOffer?.kind,
    // B-TODAY-26: the day-close line fills a continuation slot the
    // coordinator left empty, after the sleep hour, until "Good night".
    dayClose: !dayZero && dayCloseDue({ hour: nowHour, dismissedDay: dayCloseDismissedDay, today: dayStamp(Date.now()) }),
  });
  const offerSlot = (
    <CompanionOfferSlot
      surface="today"
      offer={shownOffer}
      controls={todayOffer}
      placement={offerIsContinuation ? "continuation" : "under-step"}
    />
  );

  const changed = useMemo(
    () => (foldNoticed ? composeChanged(true) : changedBase),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [foldNoticed, changedBase]
  );

  const onChangedLineTap = (line: WhatChangedLine) => {
    if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") {
      setActiveTab("development");
      return;
    }
    if (line.kind === "facts" || line.kind === "ideas") {
      setActiveTab("memory");
      return;
    }
    // moments and steps deep-link to the exact journal timeline signal.
    requestJournalFocus(line.focusId);
    setActiveTab("journal");
  };

  // The Daily Play "Try together" section — B-TODAY-17: it renders ONLY in the
  // anchor's left slot when it IS the day's step (todayChoice.kind "play");
  // otherwise Today shows no play module (its home is Growth › Daily Play).
  const playSection = (
    <section className="border-y py-5" style={{ borderColor: "var(--arbor-rule)" }} aria-label={t("today.feed.title", { name: firstName })}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-clay)" }}>{t("today.feed.eyebrow")}</div>
          <h2 className="mt-1 text-[17px] font-extrabold" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{t("today.feed.title", { name: firstName })}</h2>
        </div>
      </div>
      {dailyPlay ? (
        <DailyPlayCard pick={dailyPlay} childName={firstName} done={donePlayIds.includes(dailyPlay.activity.id)} onDid={markPlayDone} onCoach={coachOnPlay} concernLabel={dailyPlay.reason === "concern-match" ? playDomainLabel(dailyPlay.activity.domain, uiLang) : undefined} goalLabel={dailyPlay.reason === "goal-match" ? activeGoals.find((g) => g.domainId === dailyPlay.activity.domain)?.label : undefined} sessionLength={sessionLength} onSessionLengthChange={handleSessionLength} ageYears={ageYearsOf(childProfile)} sessionTapped={sessionTapped} rhythmHintTime={rhythm.calmWindow ? hourLabel(rhythm.calmWindow.startHour) : undefined} />
      ) : (
        <div className="flex items-center gap-3 px-1 py-3"><Icon name="auto_awesome" size={20} fill={1} style={{ color: "var(--arbor-clay)" }} /><div><div className="text-[13px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ov.recoLoading", { name: firstName })}</div><div className="text-[11px]" style={{ color: "var(--arbor-faint)" }}>{t("ov.play.desc")}</div></div></div>
      )}
    </section>
  );

  return (
    <motion.div
      /* Fade-only entrance (no `y`): a transform on this column would become
         the containing block for the < md position:fixed quick-capture pin
         (TODAY-4), gluing the bar to the column instead of the viewport. */
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col gap-4 md:gap-5 relative max-w-[1180px] mx-auto max-md:pb-20"
    >
      <header className="flex items-start justify-between gap-4 px-1">
        <div>
          {/* P1-A headroom: the "TODAY'S GUIDANCE" eyebrow used to be repeated
              here AND ~90px below as the hero card's own eyebrow. On a 375px
              phone that duplicate cost 21px of the ~360px the greeting block
              leaves the primary CTA before the 812px fold. One eyebrow, on the
              card it labels. */}
          {/* B-TODAY-28: no greeting, no "What would help today?" — the
              child's identity line is the page title; the record speaks
              first in the card below. */}
          {/* B-SHELL-27: the same face as the sidebar/switcher (lib/childPicture), a 28 px circle in the identity line only. */}
          <div className="flex items-center gap-2.5">
            <Avatar name={childProfile.name} photoURL={childPicture(childProfile).url} size={28} />
            {/* Critic r1 (P0, Law 8): NO dir="auto" and no outer <bdi> — auto
                direction skipped the bdi and resolved LTR in every locale, so a
                Hebrew page read "Dylan · 3 2-ו שנים". The h1 inherits the
                document direction; t() already FSI/PDI-isolates {name}, and the
                age travels with no-break spaces so it never splits across the wrap. */}
            <h1 data-testid="today-identity" className="font-semibold leading-tight text-start" style={{ color: "var(--arbor-ink)", fontSize: "var(--t-lg)" }}>
              {identityLine}
            </h1>
          </div>
        </div>
      </header>

      {/* ── Quick Capture (W6.2/TODAY-4) — ambient voice/photo/text capture,
             ABOVE the forms in the hierarchy. First in the DOM (keyboard users
             reach capture first); on phones (< md) the wrapper pins it
             `fixed` above the MobileNav tab bar (--mobile-nav-h + safe-area
             offset) so the ≤20s capture affordance survives any scroll; on
             md+ it renders inline here above the hero. `fixed`, not `sticky`:
             every ancestor (main + both shell wrappers) is an overflow-x-hidden
             scroll container that grows with content on mobile, so a
             sticky-bottom pin can never engage against the real viewport.
             z-30 keeps it under MobileNav (z-40) and QuickLogModal (z-50).
             The max-md:pb-* on the column below reserves its floating slot.
             Capture-only surface: no metrics, no firewall exposure. ── */}
      {/* NEXTLEVEL critic r1 (overview · design · P1): at lg the page is two
             tracks, not a stretched phone column — the record card and the day
             anchor in the main track, capture as a vertical list in the
             inline-end track (placed with col/row-start, so the record card is
             read first while capture stays first in the DOM for keyboards). The
             What-changed card follows the anchor in the main track; edges align
             with the rows below (one column width). */}
      <div data-today-tracks="" className="flex flex-col gap-4 md:gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-5">
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

      {/* ── Row 1: guaranteed action · What changed (B-TODAY-21).
             P1-A: this row is FIRST in the column — the day's action clears the
             fold before anything else competes for the viewport. ── */}

      {/* Item 11 (IA-02): the surface contract reaches the DOM. Five slots
             carry `data-module` — one per TodayModuleId — and `modulePlan`
             lets at most four of them render (B-TODAY-17), so the count on
             screen is the Rule-A budget that todayModules.ts computes, never
             the number of stamps in this file. Deliberately UNSTAMPED: the
             header and the QuickCapture bar (chrome, per todayModules.ts) and
             playSection, which renders only INSIDE the anchor as the step. */}
      {/* B-TODAY-21: the ONE What-changed card follows the anchor in the main
             track (NEXTLEVEL r1: the inline-end track is capture's at lg). */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:gap-5 lg:col-start-1 lg:row-start-1">
      <div data-module="today-anchor" className="min-w-0">
        {/* ── Day anchor (left slot) — W1 1.2 guaranteed action. ONE slot, one
               primary: an accepted action owns it (TodayActionLoop); else the
               chooseTodayAction chain renders the AI focus hero, the promptBank
               capture card, the Daily Play promotion, or the bare capture
               floor. TODAY-1: `accept` is passed ONLY with a real AI focus
               headline — day-0/fallback copy can never reach acceptTodayAction,
               so it can never be persisted into actionLoops nor injected into
               the next focus prompt. */}
        {/* NEXTLEVEL critic r1: while the record card asks, ITS answer chips
            carry the primary-move stamp (stampMove) — the wrapper spanned the
            card AND the week anchor (343 x 523 at 375), so "one thing" read
            as two. Otherwise the wrapper keeps the stamp as before. */}
        <div data-primary-move={recordAsks ? undefined : "do-today-action"} className="min-w-0">
          {/* B-TODAY-28: the record speaks first — the parent's own words, one
              question, three answers (the first chip row of the primary
              move); after an answer, a one-line receipt. */}
          {recordAnswered ? (
            <div className="mb-3"><FromRecordReceipt quote={recordAnswered.recommendation} /></div>
          ) : recordOpener ? (
            <div className="mb-4">
              <FromRecordCard opener={recordOpener} childName={firstName} stampMove onAnswer={(answer) => recordFromRecordAnswer(recordOpener, answer)} />
            </div>
          ) : null}
          {/* B-TODAY-18: the continuation slot ABOVE the step — exactly one of
              the carry-over outcome ask or tomorrow's reason, or nothing, as
              the coordinator decided (chooseContinuation maps its winner to
              this placement). The resume eyebrow is the slot's eyebrow now. */}
          <TodayContinuation choice={continuation} isReturning={isReturning}>
            {continuation === "dayClose"
              ? <DayCloseLine momentsToday={momentsToday} onGoodNight={dismissDayClose} />
              : offerSlot}
          </TodayContinuation>
          {/* ENG-24: the week-open anchor takes the slot at the top of a new
              week. It sits FIRST in this chain only because chooseTodayAction
              already ranked it below an accepted action — kind "weekOpen" is
              unreachable while one exists — so the loop still wins. */}
          {todayChoice.kind === "recap" && recordAsks ? (
            /* NEXTLEVEL critic r1: under the record card the week is ONE quiet
               line — no filled button, no display heading competing with the
               record question. */
            <WeekAnchorLine weekId={weekOpen.weekId} />
          ) : todayChoice.kind === "recap" ? (
            <WeekAnchorCard
              weekId={weekOpen.weekId}
              onDismiss={() => setWeekOpen((prev) => ({ ...prev, dismissed: true }))}
            />
          ) : todayChoice.kind === "tonight" ? (
            /* B-TODAY-26: the evening door IS the step — no generation here. */
            <TonightCard
              momentsToday={momentsToday}
              childName={firstName}
              onRead={() => setActiveTab("bedtime-stories")}
              onRoutine={() => setActiveTab("plans")}
            />
          ) : todayChoice.kind === "weekOpen" ? (
            <WeekOpenAnchorCard
              weekId={weekOpen.weekId}
              childId={childProfile.id}
              childName={firstName}
              onCapture={() => startCapture("text")}
              onDismiss={() => setWeekOpen((prev) => ({ ...prev, dismissed: true }))}
            />
          ) : activeTodayAction ? (
            <TodayActionLoop />
          ) : todayChoice.kind === "focus" || (todayChoice.kind === "hardMoment" && hardMoment) ? (
            /* ONE step card. B-TODAY-12: with a focus, the matched pilot
               guide's Say-this rides on it; with no focus, the guide's doNow
               IS the step (same accept seam, source "hard-moment", B-AI-05).
               One card, one accept, never a second "Make this today's step". */
            <TodayRecommendation
              eyebrow={stepIsHardMoment ? t("hm.today.eyebrow") : t("today.guidance.tag")}
              headline={stepIsHardMoment ? hardMomentDoNow : focusHeadline ?? t("ov.recoEmpty", { name: firstName })}
              body={!stepIsHardMoment && focusHeadline ? focusBody : undefined}
              meta={t("today.meta")}
              action={t("elev.today.askAbout")}
              loading={!stepIsHardMoment && focusLoading && !focus}
              onBegin={beginGuidance}
              accept={stepIsHardMoment || focusHeadline ? {
                label: t("today.action.make"),
                lengthAria: t("today.action.length"),
                minUnit: t("today.action.min"),
                onAccept: (capacity) => {
                  if (!stepIsHardMoment) {
                    if (focusHeadline) acceptTodayAction(focusHeadline, capacity);
                    return;
                  }
                  // Re-check the release at tap time (the pilot can expire mid-session).
                  const now = new Date();
                  if (hardMoment) acceptHardMomentStep(hardMoment.card.id, { now, ageMonths: ageMonthsFromProfile(childProfile, now), locale: hmLocale }, capacity, acceptTodayAction);
                },
              } : undefined}
              // W1 1.2 why-line + masterplan 3.1 chain: the copy rides the card's
              // own ContentWhyLine slot so the TrustLink lands AFTER the why text
              // (it used to sit between the CTA and a sibling <p>).
              why={stepIsHardMoment ? t("elev.brief.hardMoment.why") : focusWhy}
              sayThis={stepSayThis}
            />
          ) : todayChoice.kind === "play" ? (
            playSection
          ) : recordSpeaks ? null : (
            <PromptCaptureCard
              gender={childProfile.gender}
              promptKey={todayChoice.kind === "prompt" ? todayChoice.promptKey : null}
              childName={firstName}
              onCapture={() => startCapture("text", todayChoice.kind === "prompt" ? todayChoice.promptKey : null)}
              /* B-TODAY-04: the card's own why-line — a rotating question
                 picked for the child's age. It names no goals, interests or
                 moments (none of them choose the question); on the bare floor
                 (no prompt) it says nothing. */
              whyLine={todayChoice.kind === "prompt" ? t("elev.ages.today.whyPrompt", { name: firstName, age: ageText }) : undefined}
            />
          )}
          {/* B-AI-06: the ONE proactive slot. Under the step it renders the
              rhythm / evening cue, appointments and a due re-check (the
              carry-over and tomorrow's reason sit ABOVE the step, B-TODAY-18;
              the grounded hard-moment step is the step card's own content,
              B-TODAY-12). At most one renders, with its reason line; the
              coordinator honours quiet hours and the 2/day ceiling and spends
              the shown-ledger. Never a second gradient CTA (Rule A). */}
          {!offerIsContinuation && offerSlot}
          {/* B-TODAY-18 / B-AI-06 framer ruling: the family line — one line
              per sibling, each from that child's own state (familyOfferLines). */}
          <FamilyOfferLines activeChildId={childProfile.id} />
          {/* N2-errfocus: a failed focus fetch used to degrade SILENTLY to the
              guaranteed-action fallback. The inline error renders ALONGSIDE the
              fallback (never instead of it — the anchor above always renders),
              so the day still has its action AND the parent can retry the AI
              focus. Hidden while a focus exists (cached text beats a banner)
              and while an accepted action owns the slot. */}
          {focusError && !focus && !activeTodayAction && (
            <ErrorState
              className="mt-2"
              surface="today-focus"
              headline={t("err.focus.title")}
              body={t("err.focus.body")}
              onRetry={() => void regenerateFocus()}
              retryLabel={t("err.retry")}
              retrying={focusLoading}
            />
          )}
        </div>
      </div>
      {/* ── B-TODAY-21: "What changed since you left" — events from the record
             since the previous visit (≤4 lines, the recap-ready line, the
             cold-start line, days together). Replaces SinceLastVisit,
             ProgressNarrative and the dev-map count card (milestone counts
             live in Growth). Returning parents only; never on day-0. ── */}
      {showChanged && (
        <div data-module="today-changed" className="min-w-0">
          <WhatChanged
            lines={changed.lines}
            hiddenCount={changed.hiddenCount}
            recap={weeklyRecap}
            rhythmDaysNeeded={rhythm.daysNeeded}
            onLineTap={onChangedLineTap}
            onMore={() => setActiveTab("journal")}
          />
        </div>
      )}
      </div>
      </div>

      {/* ── ENG-09 / Wave E: the lifecycle moment. BELOW the anchor row (P1-A —
             nothing outranks the day's action; since B-TODAY-21 that row also
             holds the ONE What-changed card). At most
             one renders, each occurrence once, and it counts against the ≤4
             Rule-A budget like any other module. ── */}
      {showLifecycle && lifecycleMoment && todayOffer.offer?.kind === "what-changed" && (
        <div data-module="today-lifecycle" data-proactive="" data-offer-kind="what-changed" style={{ display: "contents" }}>
        <LifecycleMomentCard
          moment={lifecycleMoment}
          childName={firstName}
          onDismiss={lifecycle.dismiss}
          onSaveInterests={lifecycle.saveInterests}
          onCapture={() => startCapture("text")}
        />
        </div>
      )}

      {/* ── E11 first-steps rail — a Today module now, not Shell chrome. It is
             the day-0 start path, so it renders in every state where it still
             has steps left, but it can never outrank the day's action again. ── */}
      {modulePlan.visible.has("rail") && <div data-module="today-rail" style={{ display: "contents" }}><FirstStepsRail onCapture={() => startCapture("text")} /></div>}

      {/* ── "Arbor Noticed" (DUX-011) — the single highest watch signal from the
             child's own logged data, below the anchor row. Renders NOTHING with
             zero detections and self-hides per-detection once dismissed; copy is
             counts/patterns only (non-diagnostic, monitoring.ts framing).
             P1-C: it is inside the day-0 guard — a parent who has answered
             nothing has produced no signal, so a "worth keeping an eye on" card
             on a brand-new account would be manufactured from ABSENT data.
             Rule A: when the budget is spent it FOLDS into a What-changed line
             instead of rendering as a sibling card (foldNoticed above). ── */}
      {modulePlan.visible.has("noticed") && <div data-module="today-noticed" style={{ display: "contents" }}><ArborNoticedCard /></div>}


      {/* B-TODAY-17: the "Your daily tools" drawer is gone — its feed (the
             What-changed card + Journal say what is new), the displaced Daily
             Play (its home is Growth › Daily Play, #/daily-play) and the
             wellness check-in (no reader; `wellness` stays in export/erase). ── */}

      {/* The ONE capture sheet (text · voice · photo, B-TODAY-19). Portals to
          document.body, so it contributes no box to the flex column. */}
      <QuickLogModal open={quickLogOpen} mode={quickLogMode} promptKey={quickLogPromptKey} hardMomentNow={quickLogHard} onClose={() => setQuickLogOpen(false)} />
    </motion.div>
  );
}
