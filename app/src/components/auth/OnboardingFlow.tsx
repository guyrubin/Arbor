import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useProfile } from "../../context/ProfileContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { findIncompleteOnboardingChild } from "../../lib/onboardingGate";
import { isoDateOf } from "../../lib/childAge";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { DOMAIN_ICONS } from "../../lib/domains/icons";
import { useChildCollection } from "../../hooks/useChildCollection";
import { acceptTodayAction } from "../../actionLoop/accept";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { choiceName, firstRunCard, firstRunAgeMonths, FirstRunController, validAbout, type FirstRunState, type FirstRunCard, type OnboardingChoice } from "../../lib/onboardingFirstRun";
import { availableHardMomentCards } from "../../content/selectCards";
import { locText, escalationText } from "../../content/hardMomentSurface";
import { renderSayThis } from "../../content/hardMomentCards";
import { hardMomentPilotText } from "../../content/hardMomentPilotText";
import { hardMomentPublication } from "../../content/pilotRelease";
import { HardMomentGuideContent } from "../behaviors/HardMomentsSection";
import { trackOnboardingCompleted } from "../../lib/kpiEvents";
import { LegalLinks } from "../billing/LegalLinks";
import { Icon } from "../ui/Icon";
import { ArborMark } from "../ui/ArborMark";
import { languageName } from "../../lib/languageName";
import "./onboardingFirstRun.css";
import { screenForImmediateEscalation } from "../../safety/escalation";

import { UrgentSupport } from "../safety/UrgentSupport";
import DescribeChild from "../describe/DescribeChild";
import DescribeReadback from "../describe/DescribeReadback";
import DescribeThread from "../describe/DescribeThread";
import { describeServices, primeQuestionVoice, type QuestionVoice } from "../../lib/describeChildClient";
import type { DescribeSession } from "../../lib/describeChild";
import type { ChildProfile } from "../../types";

const LANGUAGES = ["Hebrew", "English", "Arabic", "Russian", "French", "Other"];
export const ONBOARDING_CHOICES: readonly OnboardingChoice[] = [...DOMAIN_IDS, "hard-moment", "nothing"];


export function StepChild({ state, onEdit, onNext }: {
  state: FirstRunState; onEdit: FirstRunController["edit"]; onNext: () => void;
}) {
  const { t } = useLanguage();
  const max = isoDateOf().slice(0, 7);
  return <section className="first-run-step" data-testid="onboarding-about">
    <h1>{t("ob.first.about")}</h1>
    <label className="first-run-field">{t("ob.name")}<input autoFocus autoComplete="off" value={state.name} maxLength={80}
      onChange={e => onEdit({ name: e.target.value })} disabled={state.busy} required /></label>
    <label className="first-run-field">{t("ob.first.birthMonth")}<input type="month" value={state.birthMonth} max={max}
      readOnly={!!state.exactBirthDate} onChange={e => onEdit({ birthMonth: e.target.value })} disabled={state.busy} required data-testid="onboarding-birth-month" /></label>
    <p className="first-run-hint">{t("ob.first.birthHint")}</p>
    <fieldset disabled={state.busy}><legend>{t("ob.first.languages")}</legend><div className="first-run-languages">
      {LANGUAGES.map(language => <button type="button" key={language} data-language={language} aria-pressed={state.languages.includes(language)}
        onClick={() => onEdit({ languages: state.languages.includes(language) ? state.languages.filter(value => value !== language) : [...state.languages, language] })}>
        {state.languages.includes(language) && <span data-selection-check="" aria-hidden="true"><Icon name="check" size={16} /></span>}
        <span>{language === "Other" ? t("ob.lang.other") : languageName(language, t)}</span>
      </button>)}
    </div></fieldset>
    <div className="first-run-consent"><label><input type="checkbox" checked={state.consent} disabled={state.busy}
      onChange={e => onEdit({ consent: e.target.checked })} /><span>{t("ob.consent.controller")}</span></label><LegalLinks /></div>
    <div className="first-run-footer"><button type="button" className="first-run-primary" onClick={onNext} disabled={state.busy || !validAbout(state)} aria-busy={state.busy}>
      {state.busy ? t("ob.settingUp") : t("ob.step.continue")}
    </button></div>
  </section>;
}

export function StepDomains({ state, onWorry, onNext, onSkip, describe, onAnswer, onFinish }: {
  state: FirstRunState; onWorry: FirstRunController["worry"]; onNext: () => void | Promise<void>;
  /** B-SHELL-39: one tap drops the description and takes today's path. */
  onSkip?: () => void;
  /** B-SHELL-39: the guided conversation (onboarding's controller owns it). */
  describe?: DescribeSession; onAnswer?: (text: string) => Promise<void>; onFinish?: () => Promise<void>;
}) {
  const { t, uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const [viaMic, setViaMic] = useState(false);
  const primed = useRef<QuestionVoice | null>(null);
  const conversing = !!describe && (state.describe.status === "asking" || (state.describe.status === "drafting" && state.describe.thread.length > 1));
  const proceed = async () => {
    // Inside the tap: a mic answer primes the voice for the first question.
    primed.current?.cancel();
    primed.current = viaMic && state.worry.words.trim() ? primeQuestionVoice() : null;
    await onNext();
    if (describe?.snapshot().status !== "asking") { primed.current?.cancel(); primed.current = null; }
  };
  const guides = availableHardMomentCards({ ageMonths: firstRunAgeMonths(state), locale: lang });
  return <section className="first-run-step" data-testid="onboarding-worry">
    <h1>{t("ob.first.worry", { name: state.name.trim() })}</h1>
    <div className="first-run-choices" role="group" aria-label={t("ob.first.worry", { name: state.name.trim() })}>
      {ONBOARDING_CHOICES.map(choice => <button type="button" key={choice} data-choice={choice} disabled={state.busy}
        aria-pressed={state.worry.choice === choice} onClick={() => onWorry({ choice, hardMomentId: "", quote: "" })}>
        <span data-selection-check={state.worry.choice === choice ? "" : undefined} aria-hidden="true"><Icon name={state.worry.choice === choice ? "check" : choice === "hard-moment" ? "volunteer_activism" : choice === "nothing" ? "wb_sunny" : DOMAIN_ICONS[choice]} size={20} /></span>
        <span>{choiceName(choice, lang)}</span>
      </button>)}
    </div>
    {/* B-SHELL-39: the guided conversation replaces the one-line field. */}
    {!conversing && <DescribeChild name={state.name.trim()} lang={lang} value={state.worry.words} disabled={state.busy} onChange={words => onWorry({ words })} onVoiceText={() => setViaMic(true)} />}
    {conversing && <DescribeThread name={state.name.trim()} lang={lang} session={describe!} onAnswer={onAnswer} onSkip={onFinish} onDone={onFinish} primedVoice={primed} />}
    {screenForImmediateEscalation({ message: state.worry.words, childQuote: state.worry.quote }) && <UrgentSupport />}
    {state.worry.choice === "hard-moment" && guides.length > 0 && <label className="first-run-field">{t("ob.first.pickMoment")}
      <select value={state.worry.hardMomentId} onChange={e => onWorry({ hardMomentId: e.target.value })} disabled={state.busy}>
        <option value="">{t("ob.first.pickMoment")}</option>{guides.map(card => <option key={card.id} value={card.id}>{locText(card.title, lang)}</option>)}
      </select>
    </label>}
    <div className="first-run-footer">
      {onSkip && !!state.worry.words.trim() && <button type="button" className="first-run-skip" onClick={onSkip} disabled={state.busy || state.describe.status === "drafting"} data-testid="onboarding-describe-skip">{t("elev.describe.skip")}</button>}
      {!conversing && <button type="button" className="first-run-primary" onClick={() => void proceed()} disabled={state.busy || (state.worry.choice === "hard-moment" && guides.length > 0 && !state.worry.hardMomentId)} aria-busy={state.busy}>
      {state.describe.status === "drafting" ? t("elev.describe.drafting") : state.busy ? t("ob.settingUp") : t("ob.step.continue")}
    </button>}</div>
  </section>;
}

export function StepReady({ state, card, onWorry, onSubmit, ready, describe, profile }: {
  state: FirstRunState; card: FirstRunCard; onWorry: FirstRunController["worry"]; onSubmit: () => void; ready: boolean;
  /** B-SHELL-39: the readback session (onboarding's controller owns it). */
  describe?: DescribeSession; profile?: Partial<ChildProfile> | null;
}) {
  const { t, uiLang } = useLanguage();
  const locale: "en" | "he" = uiLang === "he" ? "he" : "en";
  const context = { ageMonths: firstRunAgeMonths(state), locale };
  const pilot = card.guide && hardMomentPublication(card.guide, context) === "editorial-pilot";
  const readback = !!describe && ["ready", "committing", "kept"].includes(state.describe.status);
  return <section className="first-run-step" data-testid="onboarding-card">
    {readback && <DescribeReadback name={state.name.trim()} lang={locale} session={describe!} profile={profile ?? null} />}
    {!card.urgent && state.describe.status === "failed" && state.describe.error === "model" && <p className="first-run-hint" role="status">{t("elev.describe.failedKept")}</p>}
    <p className="first-run-hint">{t("ob.first.card")}</p><h1>{card.title}</h1>
    <div className="first-run-authored-card">
      {card.urgent ? <div role="alert" className="flex flex-col gap-3.5">
        <p className="first-run-notice" dir="auto">{card.notice}</p>
        <UrgentSupport showInstructions={false} />
      </div> : <p className="first-run-notice" dir="auto">{card.notice}</p>}
      {card.guide && <><p className="first-run-say" dir="auto">{locText(renderSayThis(card.guide, state.name.trim()), locale)}</p>
        {pilot && <p className="first-run-hint">{hardMomentPilotText(locale).status}: {hardMomentPilotText(locale).explanation}</p>}
        <p className="first-run-hint" data-testid="onboarding-escalation">{escalationText(card.guide, locale)}</p>
        <details><summary>{t("ob.first.details")}</summary><HardMomentGuideContent card={card.guide} context={context} childName={state.name.trim()} t={t} /></details>
      </>}
      {state.worry.choice === "talking" && <><label className="first-run-field">{t("ob.first.quote")}<input value={state.worry.quote} maxLength={160} onChange={e => onWorry({ quote: e.target.value })} disabled={state.busy} /></label>
        {!card.urgent && (card.sayBack ? <div className="first-run-say"><p>{card.sayBack.heading}</p><p dir="auto">{card.sayBack.line}</p></div> : <p className="first-run-hint">{t("ob.first.whyQuote")}</p>)}
      </>}
    </div>
    <div className="first-run-footer"><button type="button" className="first-run-primary" onClick={onSubmit} disabled={state.busy || !ready} aria-busy={state.busy}>
      {state.busy ? t("ob.settingUp") : card.urgent ? t("ob.step.continue") : card.observation ? t("ob.first.notice") : t("ob.first.try")}
    </button></div>
  </section>;
}

/** Signed-in → about → one worry + "Tell Arbor about {name}" → readback and the
 * authored card → the accepted step in Now. The ONE model request is the
 * parent-initiated describe readback (B-SHELL-39, an injected service); no
 * coach seed, comic prewarm or journey mutation belongs here. */
export default function OnboardingFlow() {
  const { profiles, addChild, updateChild, setActiveChild, isCurrentSession, captureOnboardingLifetime } = useProfile();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const owner = user?.uid;
  const controllerRef = useRef<FirstRunController | null>(null);
  const originalOwner = useRef(owner);
  const sessionKey = useRef({}).current;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  if (!controllerRef.current) controllerRef.current = new FirstRunController(findIncompleteOnboardingChild(profiles), {
    addChild, updateChild, lang: () => uiLang === "he" ? "he" : "en", accept: async () => { throw new Error("Collection not ready"); },
  });
  const controller = controllerRef.current;
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  const actions = useChildCollection<ActionLoopEntry>(state.childId ?? "", "actionLoops");
  const collection = useRef({ actions, childId: state.childId, owner });
  collection.current = { actions, childId: state.childId, owner };
  const accepted = useRef<ActionLoopEntry | null>(null);
  controller.services = { sessionKey, captureLifetime: captureOnboardingLifetime, isCurrent: () => mounted.current && collection.current.owner === originalOwner.current && isCurrentSession(), addChild, updateChild, lang: () => uiLang === "he" ? "he" : "en",
    accept: async (childId, card, acceptanceKey, operationCurrent) => {
      const current = collection.current;
      if (!mounted.current || current.owner !== originalOwner.current || current.childId !== childId || !current.actions.loaded || current.actions.error) throw new Error("Child record is not ready");
      const prior = accepted.current?.acceptanceKey === acceptanceKey && !current.actions.items.some(item => item.id === accepted.current!.id) ? [accepted.current] : [];
      const assertCurrent = () => {
        if (operationCurrent?.() === false || !mounted.current || !isCurrentSession() || collection.current.owner !== originalOwner.current || collection.current.childId !== childId) throw new Error("The profile session changed");
      };
      const entry = await acceptTodayAction({ childId, items: [...current.actions.items, ...prior],
        upsert: item => { assertCurrent(); return current.actions.upsert(item, { requireAcknowledgement: true }); }, confirmExisting: true,
        recommendation: card.recommendation, source: card.source, capacity: "tiny", acceptanceKey, ...(card.observation ? { observation: true as const } : {}) });
      assertCurrent();
      accepted.current = entry;
    },
    // B-SHELL-39: the readback's request and writes (nothing before "Keep these").
    describe: describeServices({
      profile: () => profiles.find(child => child.id === collection.current.childId) ?? null,
      language: () => uiLang === "he" ? "he" : "en",
      updateChild: (id, patch) => updateChild(id, patch, { isCurrent: () => mounted.current && collection.current.owner === originalOwner.current && isCurrentSession() }),
    }),
    onComplete: () => {
      if (state.childId) setActiveChild(state.childId);
      window.location.hash = "#/overview";
      trackOnboardingCompleted({ domainCount: DOMAIN_IDS.includes(state.worry.choice as typeof DOMAIN_IDS[number]) ? 1 : 0, hasAvatar: false });
    },
  };
  const card = state.step === 3 ? firstRunCard(state, uiLang === "he" ? "he" : "en") : null;
  return <main className="arbor-app first-run" dir={uiLang === "he" ? "rtl" : "ltr"}>
    <div className="first-run-shell"><header className="first-run-header">
      {state.step > 1 ? <button type="button" className="touch-target" onClick={() => controller.back()} disabled={state.busy} aria-label={t("ob.step.back")} data-testid="onboarding-back"><Icon name="chevron_left" size={20} style={uiLang === "he" ? { transform: "scaleX(-1)" } : undefined} /></button> : <ArborMark size={32} />}
      <div role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={state.step} aria-label={t("ob.progress.step", { step: state.step, total: 3 })} className="first-run-progress">
        {[1, 2, 3].map(step => <span key={step} data-active={step === state.step} />)}
      </div>
    </header>
      {state.step === 1 && <StepChild state={state} onEdit={edit => controller.edit(edit)} onNext={() => void controller.next()} />}
      {state.step === 2 && <StepDomains state={state} onWorry={worry => controller.worry(worry)} onNext={() => controller.next()} onSkip={() => void controller.skipDescribe()}
        describe={controller.describe} onAnswer={text => controller.describeAnswer(text)} onFinish={() => controller.describeFinish()} />}
      {card && <StepReady state={state} card={card} onWorry={worry => controller.worry(worry)} onSubmit={() => void controller.finish(card)} ready={actions.loaded && !actions.error}
        describe={controller.describe} profile={profiles.find(child => child.id === state.childId) ?? null} />}
      {state.error && <p role="alert" className="first-run-error">{t("ob.fail")}</p>}
    </div>
  </main>;
}
