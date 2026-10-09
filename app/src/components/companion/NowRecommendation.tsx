import React, { useEffect, useId, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTodaysFocus } from "../../hooks/useTodaysFocus";
import type { JournalRequest } from "../../ai/journalContext";
import { ageYearsOf, knownAgeMonthsOf } from "../../lib/age/forChild";
import { focusBodyFor, focusHeadlineFor, whyLineFor } from "../../lib/todayFocus";
import { localizeActivity } from "../../playbank/content";
import { concernDomainsFromLogs, daySeedFor } from "../../playbank/select";
import { activeGoalDomains } from "../../practice/goalBuilder";
import Icon from "../ui/Icon";
import { TrustLink } from "../trust/TrustLink";
import { dailyPlayForNow, focusSignalsForNow } from "./nowRecommendationModel";
import { NOW_COPY } from "./nowViewCopy";
import { trackActionOffered } from "../../lib/loopEvents";

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
  const { childProfile, behaviorLogs, playLogs, milestones, actionLoop, acceptTodayAction, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const copy = NOW_COPY[lang];
  const id = useId();
  const now = useMemo(() => new Date(), [childProfile, behaviorLogs, playLogs, milestones, actionLoop]);
  const signals = useMemo(() => focusSignalsForNow({ behaviorLogs, playLogs, milestones, actionLoop }, now), [behaviorLogs, playLogs, milestones, actionLoop, now]);
  const { focus, loading, error, regenerate } = useTodaysFocus(childProfile, signals, journal);
  const [libraryIndex, setLibraryIndex] = useState(0);
  const [preferLibrary, setPreferLibrary] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const picks = useMemo(() => dailyPlayForNow({
    ageYears: knownAgeMonthsOf(childProfile, now) === null ? Number.NaN : ageYearsOf(childProfile, now),
    concernDomains: concernDomainsFromLogs(behaviorLogs, now.getTime()),
    goalDomains: activeGoalDomains(childProfile.activeGoals ?? []),
    interests: childProfile.interests,
    // The synced ledger is the source of truth, never a device-local done list.
    recentlyDoneIds: playLogs.filter((row) => Date.parse(row.timestamp) >= now.getTime() - 7 * 86_400_000 && Date.parse(row.timestamp) <= now.getTime()).map((row) => row.activityId),
    daySeed: daySeedFor(now.getTime()),
    ...(signals.lastActionRecommendation && signals.lastActionOutcome ? { lastAction: { recommendation: signals.lastActionRecommendation, outcome: signals.lastActionOutcome } } : {}),
  }), [childProfile, behaviorLogs, playLogs, signals.lastActionRecommendation, signals.lastActionOutcome, now]);
  const pick = picks[libraryIndex % Math.max(1, picks.length)];
  const activity = pick ? localizeActivity(pick.activity, lang) : null;
  const aiHeadline = focusHeadlineFor(focus);
  const aiStep = focus?.tryToday?.trim() || aiHeadline;
  const useAi = !!aiHeadline && !preferLibrary;
  const headline = useAi ? aiStep : activity?.title ?? copy.noOffer;
  const body = useAi ? focusBodyFor(focus) : activity?.whatItBuilds ?? copy.noOfferBody;
  const why = useAi ? whyLineFor({
    name, recentCount: signals.count, confidence: "none",
    goals: childProfile.activeGoals?.length ?? 0, interests: childProfile.interests?.length ?? 0,
    inputsUsed: focus?.inputsUsed,
  }, t) : pick?.continuation ? copy.continuationWhy
    : pick?.reason === "goal-match" ? copy.goalsWhy
      : pick?.reason === "concern-match" ? copy.momentsWhy
        : pick?.reason === "interest-match" && pick.matchedInterest ? copy.interestWhy(pick.matchedInterest)
          : copy.curatedWhy;
  // The funnel's first step (offered → accepted → outcome): one event per
  // distinct AI step a parent is shown, never per render.
  useEffect(() => { if (useAi && aiStep) trackActionOffered("now"); }, [useAi, aiStep]);
  const accept = async () => {
    // Only a genuine screened model step can enter the AI action ledger.
    if (!useAi || !aiStep || saving) return;
    setSaving(true); setSaveError(false);
    try { await acceptTodayAction(aiStep, "standard"); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  const another = () => {
    if (!useAi) setLibraryIndex((value) => value + 1);
    setPreferLibrary(true);
    setStepsOpen(false);
  };

  return <section className="now-lead arbor-depth-primary" data-module="now-recommendation" data-recommendation-source={useAi ? "ai" : "library"} aria-labelledby={`${id}-title`}>
    <div className="now-lead-band">
      <span className="now-glyph" aria-hidden="true"><Icon name={useAi ? "auto_awesome" : "favorite"} size={24} /></span>
      <div><p className="companion-eyebrow">{copy.recommendation}</p><p className="now-provenance">{useAi ? "Arbor" : copy.curated}</p></div>
      {!useAi && activity && <span className="now-duration"><Icon name="schedule" size={16} />{copy.minutes(activity.durationMin)}</span>}
    </div>
    <h2 id={`${id}-title`} className="now-lead-title" dir="auto">{headline}</h2>
    {body && <p className="now-lead-body" dir="auto">{body}</p>}
    {useAi && focus?.sayThis && <div className="now-say"><span>{copy.say}</span><blockquote dir="auto">{t("elev.loop.ms.quoted", { text: focus.sayThis })}</blockquote></div>}

    {!useAi && activity && stepsOpen && <div className="now-activity-steps" id={`${id}-steps`}>
      {!!activity.householdItems.length && <p className="now-materials"><b>{copy.materials}</b> {activity.householdItems.join(" · ")}</p>}
      <ol aria-label={copy.steps}>{activity.steps.map((step, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><p dir="auto">{step}</p></li>)}</ol>
      <p className="companion-caption">{copy.putDown}</p>
    </div>}

    <div className="now-lead-actions">
      {useAi ? <button type="button" className="companion-primary" data-primary-move="choose-next-step" disabled={saving} onClick={() => void accept()}><Icon name="bookmark_add" size={19} />{saving ? copy.saving : copy.choose}</button>
        : activity ? <button type="button" className={stepsOpen ? "companion-secondary" : "companion-primary"} data-primary-move="choose-next-step" aria-expanded={stepsOpen} aria-controls={`${id}-steps`} onClick={() => { setPreferLibrary(true); setStepsOpen(!stepsOpen); }}>{stepsOpen ? copy.hide : copy.begin}<Icon name={stepsOpen ? "expand_less" : "arrow_forward"} size={19} className={!stepsOpen ? "rtl:-scale-x-100" : undefined} /></button>
          : <button type="button" className="companion-primary" data-primary-move="choose-next-step" onClick={() => setActiveTab("practice")}>{copy.togetherTitle}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>}
      {(useAi || activity) && <button type="button" className="companion-text-button" onClick={() => onTalkOpen(copy.adaptPrompt(useAi ? aiStep! : `${activity!.title}. ${activity!.steps.join(" ")}`))}>{copy.adapt}<Icon name="chat_bubble" size={17} /></button>}
    </div>
    {saveError && <p className="now-inline-status" role="alert">{copy.saveError}</p>}

    {(useAi || activity) && <div className="now-why"><Icon name="info" size={17} aria-hidden="true" /><div><p><b>{copy.why}</b> <span dir="auto">{why}</span></p><TrustLink surface="today-focus" /></div></div>}
    <div className="now-alternatives">
      {(useAi ? picks.length > 0 : picks.length > 1) && <button type="button" className="companion-text-button" onClick={another}>{copy.otherIdea}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button>}
      <button type="button" className="companion-text-button" onClick={() => setActiveTab("daily-play")}>{copy.library}</button>
    </div>
    {loading && !useAi && !preferLibrary && <p className="now-inline-status" role="status">{copy.loading}</p>}
    {error && !useAi && <div className="now-inline-status" role="status"><p>{copy.focusError}</p><button type="button" className="companion-text-button" disabled={loading} onClick={() => void regenerate()}>{copy.retry}</button></div>}
  </section>;
}
