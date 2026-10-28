import React, { useEffect, useId, useMemo, useState } from "react";
import { GUIDE_ART, guideTopicFor } from "../../lib/guideArt";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import type { JournalRequest } from "../../ai/journalContext";
import { ageYearsOf, knownAgeMonthsOf } from "../../lib/age/forChild";
import { formatChildAge } from "../../lib/age/format";
import { focusBodyFor, focusHeadlineFor, whyLineParts } from "../../lib/todayFocus";
import { localizeActivity } from "../../playbank/content";
import { concernDomainsFromLogs, daySeedFor } from "../../playbank/select";
import { activeGoalDomains } from "../../practice/goalBuilder";
import Icon from "../ui/Icon";
import { dailyPlayForNow, focusSignalsForNow, stepLines } from "./nowRecommendationModel";
import { NOW_COPY } from "./nowViewCopy";
import { trackActionOffered } from "../../lib/loopEvents";
import { PendingLine } from "../ui/Receipt";
import NowPlanFrame from "./NowPlanFrame";
import NowPlanBody from "./NowPlanBody";
import NowGuideReader from "./NowGuideReader";
import { clearAcceptFailed, markAcceptFailed, useAcceptFailed } from "./nowGuideAccept";
import { useNowClock } from "./useNowClock";

/** Mounted only when a chosen step/program does not already lead Now. The
 * parent keys this by child/language, so cached or in-flight AI from another
 * context cannot become the next child's recommendation.
 *
 * v3 F-NOW-1: the plan card — its face carries the say line and the guide's
 * title; its body the kicker, the next step, Begin (which opens the guide
 * reader), then the one plan body every lead shares: time and size in words
 * and why it was picked (always visible, with How Arbor decides). The
 * screened AI step is chosen in the reader; a library guide is read there
 * and never writes a record. With an active question, library ideas in its
 * areas come first, and only such a pick quotes the question. */
export default function NowRecommendation({ name, onTalkOpen, journal }: {
  name: string;
  onTalkOpen: (prompt?: string) => void;
  /** B-LOOP-13: the shelves, open milestones and night answers the step is
   *  grounded in (ids and counts only; the same request the practice lead makes). */
  journal?: JournalRequest;
}) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, acceptTodayAction, setActiveTab, activeFamilyTopic } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = NOW_COPY[lang];
  const id = useId();
  const now = useNowClock();
  // The clock is a fresh Date each render; the memos below move per minute, not per render.
  const minute = Math.floor(now.getTime() / 60_000);
  const ageText = formatChildAge(childProfile, t, now);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const signals = useMemo(() => focusSignalsForNow({ behaviorLogs, playLogs, milestones, actionLoop }, now), [behaviorLogs, playLogs, milestones, actionLoop, minute]);
  // FEAT-02: the active question's guide topic ranks library ideas in its areas first.
  const topic = activeFamilyTopic?.title ? guideTopicFor({ title: activeFamilyTopic.title }) : undefined;
  const { focus, loading, error, regenerate } = useTodaysFocus(childProfile, signals, journal);
  const [libraryIndex, setLibraryIndex] = useState(0);
  const [preferLibrary, setPreferLibrary] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const picks = useMemo(() => dailyPlayForNow({
    ageYears: knownAgeMonthsOf(childProfile, now) === null ? Number.NaN : ageYearsOf(childProfile, now),
    concernDomains: concernDomainsFromLogs(behaviorLogs, now.getTime()),
    goalDomains: activeGoalDomains(childProfile.activeGoals ?? []),
    interests: childProfile.interests,
    // The synced ledger is the source of truth, never a device-local done list.
    recentlyDoneIds: playLogs.filter((row) => Date.parse(row.timestamp) >= now.getTime() - 7 * 86_400_000 && Date.parse(row.timestamp) <= now.getTime()).map((row) => row.activityId),
    daySeed: daySeedFor(now.getTime()),
    ...(signals.lastActionRecommendation && signals.lastActionOutcome ? { lastAction: { recommendation: signals.lastActionRecommendation, outcome: signals.lastActionOutcome } } : {}),
    ...(topic ? { topicDomains: GUIDE_ART[topic].domains } : {}),
  }), [childProfile, behaviorLogs, playLogs, signals.lastActionRecommendation, signals.lastActionOutcome, topic, minute]);
  const pick = picks[libraryIndex % Math.max(1, picks.length)];
  const aiHeadline = focusHeadlineFor(focus);
  const aiStep = focus?.tryToday?.trim() || aiHeadline;
  const useAi = !!aiHeadline && !preferLibrary;
  // v3 question continuity (audit #3): a question with a guide area, no
  // screened step and no library idea in its areas gets the honest empty
  // state, never a previous question's step or an unrelated idea.
  const questionEmpty = !!topic && !useAi && !picks.some((row) => row.reason === "topic-match");
  const activity = pick && !questionEmpty ? localizeActivity(pick.activity, lang) : null;
  // FEAT-02 r1: a failed choice outlives the remount its optimistic write causes.
  const acceptFailed = useAcceptFailed(childProfile.id, useAi ? aiStep : null);
  const headline = useAi ? aiStep : activity?.title ?? (questionEmpty ? copy.noStepForQuestion : copy.noOffer);
  const body = useAi ? focusBodyFor(focus) : activity?.whatItBuilds ?? (questionEmpty ? copy.noStepForQuestionBody : copy.noOfferBody);
  // Why it was picked, in the parent's words. The child's age is said once, up
  // front, so the list never repeats it; a first idea with no moments yet says
  // so plainly instead of naming age alone.
  const reason = (() => {
    if (useAi) {
      const parts = whyLineParts({
        name, recentCount: signals.count, confidence: "none",
        goals: childProfile.activeGoals?.length ?? 0, interests: childProfile.interests?.length ?? 0,
        inputsUsed: focus?.inputsUsed,
      });
      if (parts.key !== "today.intent.why.list") return copy.pickedFirstLook;
      return String(parts.vars.list).split("|")
        .filter(key => key !== "today.intent.why.age")
        .map(key => (parts.vars.n !== undefined ? t(key, { n: parts.vars.n }) : t(key)))
        .join(t("today.intent.why.sep"));
    }
    if (!activity) return questionEmpty ? copy.noStepForQuestionWhy : copy.noOfferWhy;
    return pick?.continuation ? copy.continuationWhy
      : pick?.reason === "topic-match" ? copy.topicWhy
      : pick?.reason === "goal-match" ? copy.goalsWhy
        : pick?.reason === "concern-match" ? copy.momentsWhy
          : pick?.reason === "interest-match" && pick.matchedInterest ? copy.interestWhy(pick.matchedInterest)
            : copy.curatedWhy;
  })();
  // The funnel's first step (offered → accepted → outcome): one event per
  // distinct AI step a parent is shown, never per render.
  useEffect(() => { if (useAi && aiStep) trackActionOffered("now"); }, [useAi, aiStep]);
  const accept = async () => {
    // Only a genuine screened model step can enter the AI action ledger.
    if (!useAi || !aiStep || saving) return;
    setSaving(true); setSaveError(false); clearAcceptFailed(childProfile.id);
    try { await acceptTodayAction(aiStep, "standard"); setReaderOpen(false); }
    catch { setSaveError(true); markAcceptFailed(childProfile.id, aiStep); }
    finally { setSaving(false); }
  };
  const another = () => {
    if (!useAi) setLibraryIndex((value) => value + 1);
    setPreferLibrary(true);
    setReaderOpen(false);
    setSaveError(false);
    clearAcceptFailed(childProfile.id);
  };
  const adapt = useAi || activity ? () => onTalkOpen(copy.adaptPrompt(useAi ? aiStep! : `${activity!.title}. ${activity!.steps.join(" ")}`)) : undefined;

  // v3: the screened "say this" words are the plan card's face and the reader's words.
  const say = useAi && focus?.sayThis ? t("elev.loop.ms.quoted", { text: focus.sayThis }) : null;
  const readMinutes = Math.max(1, Math.round(`${body ?? ""} ${aiStep ?? ""} ${focus?.sayThis ?? ""}`.trim().split(/\s+/).length / 200));
  const failed = saveError || acceptFailed;
  // FEAT-02 r2: the question is quoted only on a library idea picked for its
  // area, never on an AI pick the model made without it.
  const asked = (!useAi && activity && pick?.reason === "topic-match") || questionEmpty ? activeFamilyTopic?.title ?? null : null;
  const offered = useAi || !!activity;
  const askAboutQuestion = () => onTalkOpen(copy.askQuestionPrompt(activeFamilyTopic?.title ?? ""));
  // The guide's title is the face's h2; the body below never repeats it.
  return <NowPlanFrame kind="recommendation" lang={lang} tag={copy.planTag.recommendation} say={say ?? copy.planSay.recommendation} quoted={!!say} title={headline} titleId={`${id}-title`}
    meta={useAi ? copy.noStepYet : activity ? copy.planMeta.recommendation : undefined} question={activeFamilyTopic?.title}>
  <section className="now-lead arbor-depth-primary" data-module="now-recommendation" data-recommendation-source={useAi ? "ai" : questionEmpty ? "none" : "library"} data-testid={questionEmpty ? "now-question-empty" : undefined} aria-labelledby={`${id}-title`}>
    <p className="now-plan-kicker">{copy.stepKicker}</p>
    {!useAi && activity && activity.steps.length > 0 && <p className="now-next">{copy.nextStep(activity.steps[0])}</p>}
    {body && <p className="now-lead-body" dir="auto">{body}</p>}

    <div className="now-lead-actions">
      {useAi || activity
        ? <button type="button" className="companion-primary" data-primary-move="choose-next-step" aria-haspopup="dialog" onClick={() => { if (!useAi) setPreferLibrary(true); setReaderOpen(true); }}>{copy.begin}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>
        : questionEmpty
          ? <button type="button" className="companion-primary" data-primary-move="choose-next-step" onClick={askAboutQuestion}>{t("ms.askArbor")}<Icon name="chat_bubble" size={19} /></button>
          : <button type="button" className="companion-primary" data-primary-move="choose-next-step" onClick={() => setActiveTab("practice")}>{copy.togetherTitle}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>}
      {adapt && <button type="button" className="companion-text-button" onClick={adapt}>{copy.adapt}<Icon name="chat_bubble" size={17} /></button>}
    </div>
    {failed && !readerOpen && <p className="now-inline-status" role="alert">{copy.saveError}</p>}
    <NowPlanBody why={reason} time={offered ? (useAi ? copy.readMinutes(readMinutes) : copy.minutes(activity!.durationMin)) : null} size={offered ? copy.oneAction : null}
      name={offered && ageText ? name : undefined} ageText={ageText} question={asked} />

    {!questionEmpty && (useAi ? picks.length > 0 : picks.length > 1) && <div className="now-alternatives">
      <button type="button" className="companion-text-button" onClick={another}>{copy.otherIdea}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button>
    </div>}
    {/* B-STATUS-01: Arbor's idea is still coming — the ONE pending line,
        quiet and only after 400 ms (a cached focus never flashes it). */}
    <PendingLine active={loading && !useAi && !preferLibrary} testId="now-recommendation-pending" className="now-inline-status">{copy.loading}</PendingLine>
    {error && !useAi && <div className="now-inline-status" role="status"><p>{copy.focusError}</p><button type="button" className="companion-text-button" disabled={loading} onClick={() => void regenerate()}>{copy.retry}</button></div>}
    <NowGuideReader
      open={readerOpen && (useAi || !!activity)}
      onClose={() => setReaderOpen(false)}
      lang={lang}
      title={headline}
      crumb={copy.planTag.recommendation}
      intro={useAi ? body : activity?.whatItBuilds}
      how={useAi ? stepLines(aiStep ?? "") : activity?.steps ?? []}
      materials={!useAi ? activity?.householdItems : undefined}
      words={say}
      note={!useAi ? copy.putDown : undefined}
      onChoose={useAi ? () => void accept() : undefined}
      saving={saving}
      error={failed}
      onAdapt={adapt}
    />
  </section>
  </NowPlanFrame>;
}
