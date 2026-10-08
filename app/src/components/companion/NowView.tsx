import React, { useEffect, useId, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import { nextChosenAction } from "./companionChoices";
import Icon from "../ui/Icon";
import "./companionExperience.css";

export interface NowViewProps {
  topic?: { id: string; title: string; intent?: string } | null;
  onTopicCreate?: (title: string) => void;
  onTopicOpen?: () => void;
  /** Shell owns voice entry, so this never creates a second voice session. */
  onVoiceOpen?: () => void;
}

export default function NowView({ topic, onTopicCreate, onTopicOpen, onVoiceOpen }: NowViewProps) {
  const { childProfile, actionLoop, seedCoach, setActiveTab, openCaptureSheet, openHardMomentNow,
    saveTodayOutcome, pendingCaptureMode, consumeCaptureRequest } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (t("companion.now-view.your-child"));
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const program = useMemo(() => activeProgramWeek(programs.items), [programs.items]);
  const action = useMemo(() => nextChosenAction(actionLoop, topic?.id), [actionLoop, topic?.id]);
  const [questionDraft, setQuestionDraft] = useState({ childId: childProfile.id, value: "" });
  const question = questionDraft.childId === childProfile.id ? questionDraft.value : "";
  const setQuestion = (value: string) => setQuestionDraft({ childId: childProfile.id, value });
  const [receiptChild, setReceiptChild] = useState<string | null>(null);
  const receipt = receiptChild === childProfile.id;
  const setReceipt = (value: boolean) => setReceiptChild(value ? childProfile.id : null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const inputId = useId();
  const saveOutcome = async (outcome: "helped" | "not_today") => {
    if (!action || saving) return;
    setSaving(true); setSaveError(false);
    try { await saveTodayOutcome(action.id, outcome); setReceipt(true); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  useEffect(() => { setQuestion(""); setReceipt(false); }, [childProfile.id, topic?.id]);
  useEffect(() => {
    if (!pendingCaptureMode) return;
    consumeCaptureRequest();
    openCaptureSheet({ mode: pendingCaptureMode });
    // The pending request is consumed once; handler identities are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);
  const ask = () => seedCoach({ prompt: question.trim() || topic?.title || "", source: "companion-now" });
  const openProgram = () => { setActiveTab("development"); window.location.hash = "#/development?view=program"; };

  return (
    <div className="companion-page companion-now" dir={he ? "rtl" : "ltr"}>
      <header className="companion-heading">
        <span className="companion-eyebrow">{t("companion.now-view.now-room-to-pause-and-choose")}</span>
        <h1 className="arbor-type-hero">{t("companion.now-view.what-would-help-with", { value0: name })}</h1>
        <p>{t("companion.now-view.start-with-what-matters-to-you-there-is-no")}</p>
      </header>

      <div className="companion-now-grid">
        <section data-module="now-focus" className="companion-focus arbor-depth-primary" aria-labelledby={`${inputId}-focus`}>
          <div className="companion-kicker"><Icon name="chat_bubble" size={19} /><span>{topic ? (t("companion.now-view.the-question-you-re-exploring")) : (t("companion.now-view.a-place-for-your-question"))}</span></div>
          <h2 id={`${inputId}-focus`} className="companion-family-words" dir="auto">{topic?.title || (t("companion.now-view.something-hard-something-curious-a-moment"))}</h2>
          {onTopicOpen && <button type="button" className="companion-text-button" onClick={onTopicOpen}>{topic ? (t("companion.now-view.see-the-moments-and-steps-behind-this-ques")) : (t("companion.now-view.our-saved-questions"))}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>}
          <form className="companion-question" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <label htmlFor={inputId}>{topic ? (t("companion.now-view.what-would-you-like-to-understand-now")) : (t("companion.now-view.what-s-on-your-mind"))}</label>
            <textarea id={inputId} value={question} maxLength={1200} rows={2} onChange={(event) => setQuestion(event.target.value)} placeholder={t("companion.now-view.for-example-mornings-have-become-a-struggl")} />
            <div className="companion-question-actions">
              <button type="submit" className="companion-primary" data-primary-move="choose-next-step"><Icon name="chat_bubble" size={19} />{t("companion.now-view.think-it-through-with-arbor")}</button>
              {onVoiceOpen && <button type="button" className="companion-icon-button" onClick={onVoiceOpen} aria-label={t("companion.now-view.talk-to-arbor-by-voice")}><Icon name="mic" size={21} /></button>}
            </div>
            {!topic && onTopicCreate && question.trim() && <button type="button" className="companion-text-button" onClick={() => onTopicCreate(question.trim())}><Icon name="bookmark_add" size={17} />{t("companion.now-view.keep-as-a-question-to-return-to")}</button>}
          </form>
          <div className="companion-quiet-note"><Icon name="auto_awesome" size={16} /><span>{t("companion.now-view.arbor-offers-possibilities-you-decide-what")}</span></div>
        </section>

        <aside className="companion-next" data-module="now-step" aria-labelledby={`${inputId}-next`}>
          <span className="companion-eyebrow">{t("companion.now-view.your-next-small-step")}</span>
          {action ? <>
            <h2 id={`${inputId}-next`}>{topic && action.topicId !== topic.id ? (t("companion.now-view.another-step-you-chose")) : (t("companion.now-view.continue-what-you-chose"))}</h2>
            <p className="companion-chosen-step" dir="auto">{action.recommendation}</p>
            <p className="companion-caption">{t("companion.now-view.a-step-you-already-chose-come-back-to-it-w")}</p>
            <div className="companion-outcomes" role="group" aria-label={t("companion.now-view.how-did-it-go-for-you")}>
              <button type="button" className="companion-secondary" disabled={saving} onClick={() => void saveOutcome("helped")}>{t("companion.now-view.it-helped")}</button>
              <button type="button" className="companion-secondary" disabled={saving} onClick={() => void saveOutcome("not_today")}>{t("companion.now-view.not-this-time")}</button>
            </div>
            <button type="button" className="companion-text-button" onClick={() => seedCoach({ prompt: t("companion.now-view.we-chose-to-try-help-us-adapt-it-to-what-i", { value0: action.recommendation }), source: "companion-action" })}>{t("companion.now-view.adapt-this-step")}<Icon name="arrow_forward" size={17} className="companion-arrow rtl:-scale-x-100" /></button>
          </> : program ? <>
            <h2 id={`${inputId}-next`}>{program.content.skill[lang]}</h2>
            <p>{t("companion.now-view.week-of-your-chosen-program-one-step-on-yo", { value0: program.week })}</p>
            <button type="button" className="companion-secondary" onClick={openProgram}>{t("companion.now-view.continue-your-program")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          </> : <>
            <h2 id={`${inputId}-next`}>{receipt ? (t("companion.now-view.you-can-pause-here")) : (t("companion.now-view.a-good-moment-is-a-place-to-start"))}</h2>
            <p>{receipt ? (t("companion.now-view.your-response-stays-with-this-step-continu")) : (t("companion.now-view.a-story-a-game-or-a-small-idea-for-time-to"))}</p>
            <button type="button" className="companion-secondary" onClick={() => setActiveTab("practice")}>{t("companion.now-view.find-something-to-enjoy-together")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
          </>}
          {saveError && <p role="alert" className="companion-caption">{t("companion.now-view.your-response-wasn-t-saved-please-try-agai")}</p>}
          {receipt && <p role="status" className="companion-caption">{t("companion.now-view.your-response-is-saved-with-your-step")}</p>}
          <img src="/visuals/companion/together-table.webp" width="960" height="640" alt="" className="companion-now-art" loading="lazy" />
        </aside>
      </div>

      <div className="companion-support-strip" aria-label={t("companion.now-view.support-and-capture")}>
        <button type="button" onClick={() => openHardMomentNow()}><Icon name="volunteer_activism" size={21} /><span><b>{t("companion.now-view.a-hard-moment")}</b><small>{t("companion.now-view.words-and-one-step-for-right-now")}</small></span><Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></button>
        <button type="button" onClick={() => openCaptureSheet({ mode: "text" })}><Icon name="edit_note" size={22} /><span><b>{t("companion.now-view.a-moment-worth-keeping")}</b><small>{t("companion.now-view.in-words-by-voice-or-with-a-photo")}</small></span><Icon name="add" size={20} /></button>
      </div>

      <section className="companion-explore" data-module="now-explore" aria-label={t("companion.now-view.understand-more-with-support")}>
        <button type="button" className="companion-editorial-door" onClick={() => setActiveTab("learn")}><Icon name="menu_book" size={27} /><span><span className="companion-eyebrow">{t("companion.now-view.for-you")}</span><h2>{t("companion.now-view.understand-more-at-your-pace")}</h2><p>{t("companion.now-view.a-library-of-ideas-and-courses-that-connec")}</p><span className="companion-door-link">{t("companion.now-view.explore-learning")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></span></span></button>
        <button type="button" className="companion-editorial-door" onClick={() => setActiveTab("consult")}><Icon name="group" size={27} /><span><span className="companion-eyebrow">{t("companion.now-view.you-don-t-have-to-do-it-alone")}</span><h2>{t("companion.now-view.a-shared-picture-with-the-people-who-help")}</h2><p>{t("companion.now-view.prepare-for-a-conversation-and-choose-what")}</p><span className="companion-door-link">{t("companion.now-view.care-and-collaboration")}<Icon name="arrow_forward" size={18} className="companion-arrow rtl:-scale-x-100" /></span></span></button>
      </section>
    </div>
  );
}

