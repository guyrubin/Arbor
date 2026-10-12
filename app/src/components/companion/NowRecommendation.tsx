import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import type { JournalRequest } from "../../ai/journalContext";
import { ageYearsOf, knownAgeMonthsOf } from "../../lib/age/forChild";
import { formatChildAge } from "../../lib/age/format";
import { focusBodyFor, focusHeadlineFor, whyLineParts } from "../../lib/todayFocus";
import { GUIDE_ART, guideArtFor, guideTopicFor } from "../../lib/guideArt";
import { localizeActivity } from "../../playbank/content";
import { concernDomainsFromLogs, daySeedFor } from "../../playbank/select";
import { activeGoalDomains } from "../../practice/goalBuilder";
import Icon from "../ui/Icon";
import { TrustLink } from "../trust/TrustLink";
import { dailyPlayForNow, focusSignalsForNow, type NowPlayPick } from "./nowRecommendationModel";
import { NOW_COPY } from "./nowViewCopy";
import { trackActionOffered } from "../../lib/loopEvents";
import { PendingLine } from "../ui/Receipt";
import NowPlanFrame from "./NowPlanFrame";
import NowGuideReader, { guideReadMinutes, guideSteps, type GuideReaderContent } from "./NowGuideReader";

/** FEAT-02: the guide a parent opened, frozen with what it would write. */
type OpenGuide =
  | { kind: "ai"; step: string; content: GuideReaderContent }
  | { kind: "library"; pick: NowPlayPick; content: GuideReaderContent };

/** Mounted only when a chosen step/program does not already lead Now. The
 * parent keys this by child/language, so cached or in-flight AI from another
 * context cannot become the next child's recommendation. */
export default function NowRecommendation({ name, onTalkOpen, journal }: {
  name: string;
  onTalkOpen: (prompt?: string) => void;
  /** B-LOOP-13: the shelves, open milestones and night answers the step is
   *  grounded in (ids and counts only; the same request the practice lead makes). */
  journal?: JournalRequest;
}) {
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, activeFamilyTopic, acceptTodayAction, logPlayCompletion, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = NOW_COPY[lang];
  const id = useId();
  const beginRef = useRef<HTMLButtonElement>(null);
  const now = useMemo(() => new Date(), [childProfile, behaviorLogs, playLogs, milestones, actionLoop]);
  const signals = useMemo(() => focusSignalsForNow({ behaviorLogs, playLogs, milestones, actionLoop }, now), [behaviorLogs, playLogs, milestones, actionLoop, now]);
  const { focus, loading, error, regenerate } = useTodaysFocus(childProfile, signals, journal);
  const [libraryIndex, setLibraryIndex] = useState(0);
  const [preferLibrary, setPreferLibrary] = useState(false);
  const [guide, setGuide] = useState<OpenGuide | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  // FEAT-02: the family's active question names a guide topic; its registry
  // domains put matching library activities first. The AI request never sees
  // the question, so only a matching library pick may quote it.
  const question = activeFamilyTopic?.title?.trim() ?? "";
  const guideTopic = guideTopicFor({ title: question });
  const topicDomains = guideTopic ? GUIDE_ART[guideTopic].domains : undefined;
  const picks = useMemo(() => dailyPlayForNow({
    ageYears: knownAgeMonthsOf(childProfile, now) === null ? Number.NaN : ageYearsOf(childProfile, now),
    concernDomains: concernDomainsFromLogs(behaviorLogs, now.getTime()),
    goalDomains: activeGoalDomains(childProfile.activeGoals ?? []),
    interests: childProfile.interests,
    // The synced ledger is the source of truth, never a device-local done list.
    recentlyDoneIds: playLogs.filter((row) => Date.parse(row.timestamp) >= now.getTime() - 7 * 86_400_000 && Date.parse(row.timestamp) <= now.getTime()).map((row) => row.activityId),
    daySeed: daySeedFor(now.getTime()),
    ...(signals.lastActionRecommendation && signals.lastActionOutcome ? { lastAction: { recommendation: signals.lastActionRecommendation, outcome: signals.lastActionOutcome } } : {}),
    ...(topicDomains ? { topicDomains } : {}),
  }), [childProfile, behaviorLogs, playLogs, signals.lastActionRecommendation, signals.lastActionOutcome, now, topicDomains]);
  const pick = picks[libraryIndex % Math.max(1, picks.length)];
  const activity = pick ? localizeActivity(pick.activity, lang) : null;
  const aiHeadline = focusHeadlineFor(focus);
  const aiStep = focus?.tryToday?.trim() || aiHeadline;
  const useAi = !!aiHeadline && !preferLibrary;
  const headline = useAi ? aiStep : activity?.title ?? copy.noOffer;
  const body = useAi ? focusBodyFor(focus) : activity?.whatItBuilds ?? copy.noOfferBody;
  const libraryWhy = pick?.continuation ? copy.continuationWhy
    : pick?.reason === "goal-match" ? copy.goalsWhy
      : pick?.reason === "concern-match" ? copy.momentsWhy
        : pick?.reason === "interest-match" && pick.matchedInterest ? copy.interestWhy(pick.matchedInterest)
          : copy.curatedWhy;
  // FEAT-02 "Picked because": the real inputs only (ENG-07), never a verdict.
  const ageText = formatChildAge(childProfile, t, now);
  const agePart = ageText ? copy.pickedAge(name, ageText) : "";
  const aiReasons = (): string[] => {
    const { key, vars } = whyLineParts({
      name, recentCount: signals.count, confidence: "none",
      goals: childProfile.activeGoals?.length ?? 0, interests: childProfile.interests?.length ?? 0,
      inputsUsed: focus?.inputsUsed,
    });
    if (key === "today.intent.why.day0") return [agePart || t("today.intent.why.age")];
    return String(vars.list).split("|").map((part) => part === "today.intent.why.age" && agePart ? agePart
      : vars.n !== undefined ? t(part, { n: vars.n }) : t(part));
  };
  const quotedQuestion = question ? t("elev.loop.ms.quoted", { text: question }) : "";
  const picked = (useAi ? aiReasons()
    : activity ? (pick?.topicMatch && quotedQuestion ? [copy.pickedQuestion(quotedQuestion), agePart, copy.pickedLibrary] : [agePart, libraryWhy])
      : [copy.pickedStart]).filter(Boolean).join(" · ");
  // The funnel's first step (offered → accepted → outcome): one event per
  // distinct AI step a parent is shown, never per render.
  useEffect(() => { if (useAi && aiStep) trackActionOffered("now"); }, [useAi, aiStep]);
  const accept = async () => {
    // Only a genuine screened model step can enter the AI action ledger.
    if (!useAi || !aiStep || saving) return;
    setSaving(true); setSaveError(false);
    try { await acceptTodayAction(aiStep, "standard"); }
    catch (cause) { setSaveError(true); throw cause; }
    finally { setSaving(false); }
  };
  const another = () => {
    if (!useAi) setLibraryIndex((value) => value + 1);
    setPreferLibrary(true);
  };

  // v3: the screened "say this" words are the plan card's face; there is no second copy below.
  const say = useAi && focus?.sayThis ? t("elev.loop.ms.quoted", { text: focus.sayThis }) : null;
  // FEAT-02: a shipped illustration only for a guide that matches the question.
  const art = !useAi && pick?.topicMatch ? guideArtFor(guideTopic, lang) : undefined;
  const openGuide = () => {
    setSaveError(false);
    if (useAi && aiStep) {
      setGuide({ kind: "ai", step: aiStep, content: { title: copy.planTag.recommendation, how: guideSteps(aiStep), words: say, receipt: copy.readerSaved } });
    } else if (pick && activity) {
      setPreferLibrary(true);
      setGuide({ kind: "library", pick, content: { title: activity.title, how: activity.steps, materials: activity.householdItems, note: copy.putDown, receipt: t("elev.growth.play.toast.added", { name }) } });
    }
  };
  // The reader's ONE write. An AI guide goes through the single screened
  // accept above (TODAY-1); a library guide logs the play through the shared
  // seam (B-GROWTH-19), never an action-loop step.
  const writeGuide = async () => {
    if (!guide) throw new Error("No guide is open");
    if (guide.kind === "library") return logPlayCompletion(guide.pick, "today");
    if (saving || !useAi || aiStep !== guide.step) throw new Error("The guide no longer matches the step on Now");
    await accept();
  };

  return <NowPlanFrame kind="recommendation" tag={copy.planTag.recommendation} say={say} art={art}>
  <section className="now-lead arbor-depth-primary" data-module="now-recommendation" data-recommendation-source={useAi ? "ai" : "library"} aria-labelledby={`${id}-title`}>
    <div className="now-lead-band">
      <span className="now-glyph" aria-hidden="true"><Icon name={useAi ? "auto_awesome" : "favorite"} size={24} /></span>
      <div><p className="companion-eyebrow">{copy.recommendation}</p><p className="now-provenance">{useAi ? "Arbor" : copy.curated}</p></div>
    </div>
    <h2 id={`${id}-title`} className="now-lead-title" dir="auto">{headline}</h2>
    <p className="now-picked" data-testid="now-picked-because"><Icon name="auto_awesome" size={17} /><span><b>{copy.pickedBecause}</b> <span dir="auto">{picked}</span></span></p>
    {(useAi || activity) && <TrustLink surface="today-focus" />}
    {body && <p className="now-lead-body" dir="auto">{body}</p>}
    {(useAi || activity) && <ul className="now-guide-meta" data-testid="now-guide-meta">
      <li><Icon name="schedule" size={16} />{useAi ? copy.readMinutes(guideReadMinutes([aiStep, focus?.sayThis])) : copy.minutes(activity!.durationMin)}</li>
      <li><Icon name="task_alt" size={16} />{copy.oneAction}</li>
    </ul>}

    <div className="now-lead-actions">
      {useAi || activity
        ? <button ref={beginRef} type="button" className="companion-primary" data-primary-move="choose-next-step" aria-haspopup="dialog" disabled={saving} onClick={openGuide}>{copy.begin}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>
        : <button type="button" className="companion-primary" data-primary-move="choose-next-step" onClick={() => setActiveTab("practice")}>{copy.togetherTitle}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>}
      {useAi && <button type="button" className="companion-secondary" disabled={saving} onClick={() => void accept().catch(() => {})}><Icon name="bookmark_add" size={19} />{saving ? copy.saving : copy.choose}</button>}
      {(useAi || activity) && <button type="button" className="companion-text-button" onClick={() => onTalkOpen(copy.adaptPrompt(useAi ? aiStep! : `${activity!.title}. ${activity!.steps.join(" ")}`))}>{copy.adapt}<Icon name="chat_bubble" size={17} /></button>}
    </div>
    {saveError && !guide && <p className="now-inline-status" role="alert">{copy.saveError}</p>}

    <div className="now-alternatives">
      {(useAi ? picks.length > 0 : picks.length > 1) && <button type="button" className="companion-text-button" onClick={another}>{copy.otherIdea}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button>}
      <button type="button" className="companion-text-button" onClick={() => setActiveTab("daily-play")}>{copy.library}</button>
    </div>
    {/* B-STATUS-01: Arbor's idea is still coming — the ONE pending line,
        quiet and only after 400 ms (a cached focus never flashes it). */}
    <PendingLine active={loading && !useAi && !preferLibrary} testId="now-recommendation-pending" className="now-inline-status">{copy.loading}</PendingLine>
    {error && !useAi && <div className="now-inline-status" role="status"><p>{copy.focusError}</p><button type="button" className="companion-text-button" disabled={loading} onClick={() => void regenerate()}>{copy.retry}</button></div>}
    {guide && <NowGuideReader content={guide.content} lang={lang} onClose={() => setGuide(null)} onDone={writeGuide} returnFocusRef={beginRef} />}
  </section>
  </NowPlanFrame>;
}
