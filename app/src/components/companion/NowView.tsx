import React, { useEffect, useId, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { activeProgramWeek } from "../../lib/programs/enrolment";
import type { ActionLoopEntry } from "../../actionLoop/model";
import { nextChosenAction } from "./companionChoices";
import { NOW_COPY } from "./nowViewCopy";
import NowRecommendation from "./NowRecommendation";
import Icon from "../ui/Icon";
import "./companionExperience.css";
import "./nowView.css";

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
  const { childProfile } = useArbor();
  const { uiLang } = useLanguage();
  return <NowContent key={`${childProfile.id}:${uiLang}`} {...props} />;
}

function PrimaryMove({ primary = true, ...props }: React.ComponentProps<"button"> & { primary?: boolean }) {
  return <button {...props} data-primary-move={primary ? "choose-next-step" : undefined} />;
}

function NowContent({ topic, onTopicOpen, onTalkOpen }: NowViewProps) {
  const { childProfile, actionLoop, seedCoach, setActiveTab, openCaptureSheet, openHardMomentNow,
    saveTodayOutcome, pendingCaptureMode, consumeCaptureRequest } = useArbor();
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const copy = NOW_COPY[lang];
  const name = childProfile.name?.split(" ")[0] || t("companion.now-view.your-child");
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const program = useMemo(() => activeProgramWeek(programs.items), [programs.items]);
  const action = useMemo(() => nextChosenAction(actionLoop, topic?.id), [actionLoop, topic?.id]);
  const [receiptAction, setReceiptAction] = useState<ActionLoopEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const id = useId();
  const chosen = receiptAction ?? action;
  const talk = (prompt?: string) => onTalkOpen ? onTalkOpen(prompt) : seedCoach({ prompt: prompt ?? "", source: "companion-now" });
  const saveOutcome = async (outcome: "helped" | "not_today") => {
    if (!action || saving) return;
    setSaving(true); setSaveError(false);
    try { await saveTodayOutcome(action.id, outcome); setReceiptAction(action); }
    catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  useEffect(() => { setReceiptAction(null); setSaveError(false); }, [topic?.id]);
  useEffect(() => {
    if (!pendingCaptureMode) return;
    consumeCaptureRequest();
    openCaptureSheet({ mode: pendingCaptureMode });
    // The pending request is consumed once; handler identities are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);
  const openProgram = () => { setActiveTab("development"); window.location.hash = "#/development?view=program"; };

  return <div className="companion-page now-page" dir={he ? "rtl" : "ltr"}>
    <header className="now-heading">
      <div><p className="companion-eyebrow">{new Date().toLocaleDateString(he ? "he-IL" : "en-GB", { weekday: "long", day: "numeric", month: "long" })}</p><h1 className="arbor-type-hero">{copy.title(name)}</h1><p>{copy.subtitle}</p></div>
    </header>

    <div className="now-main-grid">
      <div className="now-main-column">
        {chosen ? <section className="now-lead arbor-depth-primary" data-module="now-step" aria-labelledby={`${id}-step`}>
          <div className="now-lead-band"><span className="now-glyph" aria-hidden="true"><Icon name={receiptAction ? "check" : "bookmark"} size={24} /></span><div><p className="companion-eyebrow">{copy.chosen}</p><p className="now-provenance">{receiptAction ? copy.saved : copy.today}</p></div></div>
          <h2 id={`${id}-step`} className="now-lead-title">{receiptAction ? copy.finishedTitle : copy.chosenTitle}</h2>
          <p className="now-chosen-words" dir="auto">{chosen.recommendation}</p>
          <p className="now-lead-body" role={receiptAction ? "status" : undefined}>{receiptAction ? copy.finished : copy.chosenWhy}</p>
          {!receiptAction && <div className="now-lead-actions" role="group" aria-label={copy.outcomes}>
            <PrimaryMove type="button" className="companion-primary" disabled={saving} onClick={() => void saveOutcome("helped")}><Icon name="check" size={19} />{saving ? copy.saving : copy.helped}</PrimaryMove>
            <button type="button" className="companion-secondary" disabled={saving} onClick={() => void saveOutcome("not_today")}>{copy.notToday}</button>
          </div>}
          <PrimaryMove primary={!!receiptAction} type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(chosen.recommendation))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></PrimaryMove>
          {saveError && <p role="alert" className="now-inline-status">{copy.saveError}</p>}
        </section> : program ? <section className="now-lead arbor-depth-primary" data-module="now-program" aria-labelledby={`${id}-program`}>
          <div className="now-lead-band"><span className="now-glyph" aria-hidden="true"><Icon name="menu_book" size={24} /></span><p className="companion-eyebrow">{copy.programLabel}</p></div>
          <h2 id={`${id}-program`} className="now-lead-title">{program.content.skill[lang]}</h2>
          <p className="now-lead-body">{copy.programWhy(program.week)}</p>
          <div className="now-lead-actions"><PrimaryMove type="button" className="companion-primary" onClick={openProgram}>{copy.continueProgram}<Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></PrimaryMove></div>
          <button type="button" className="companion-text-button" onClick={() => talk(copy.adaptPrompt(program.content.skill[lang]))}>{copy.adapt}<Icon name="chat_bubble" size={18} /></button>
        </section> : <NowRecommendation name={name} onTalkOpen={talk} />}

        <button type="button" className="now-hard-moment" onClick={() => openHardMomentNow()}><Icon name="volunteer_activism" size={24} /><span><b>{copy.hardTitle}</b><small>{copy.hardBody}</small></span><Icon name="arrow_forward" size={19} className="rtl:-scale-x-100" /></button>
      </div>

      <aside className="now-side-column">
        <section className="now-conversation" data-module="now-focus" aria-labelledby={`${id}-talk`}>
          <div className="now-section-icon" aria-hidden="true"><Icon name="chat_bubble" size={25} /></div>
          {topic && <p className="companion-eyebrow">{copy.topic}</p>}
          <h2 id={`${id}-talk`} dir="auto">{topic?.title || copy.talkTitle}</h2>
          <p>{copy.talkBody}</p>
          <button type="button" className="companion-secondary" onClick={() => talk(topic?.title)}>{copy.talk}<Icon name="arrow_forward" size={18} className="rtl:-scale-x-100" /></button>
          {onTopicOpen && <button type="button" className="companion-text-button" onClick={onTopicOpen}>{copy.topics}<Icon name="bookmark" size={17} /></button>}
        </section>
        <section className="now-capture" aria-labelledby={`${id}-capture`}>
          <h2 id={`${id}-capture`}>{copy.capture}</h2><p>{copy.captureBody}</p>
          <div className="now-capture-modes" role="group" aria-label={copy.quickSave}>
            <button type="button" onClick={() => openCaptureSheet({ mode: "text" })}><Icon name="edit_note" size={21} />{copy.write}</button>
            <button type="button" onClick={() => openCaptureSheet({ mode: "voice" })}><Icon name="mic" size={21} />{copy.dictate}</button>
            <button type="button" onClick={() => openCaptureSheet({ mode: "photo" })}><Icon name="photo_camera" size={21} />{copy.photo}</button>
          </div>
        </section>
      </aside>
    </div>

    <section className="now-open-doors" data-module="now-explore" aria-label={t("companion.now-view.understand-more-with-support")}>
      <button type="button" className="now-picture-door" onClick={() => setActiveTab("development")}><span className="now-door-icon" aria-hidden="true"><Icon name="auto_stories" size={29} /></span><span><h2>{copy.pictureTitle(name)}</h2><p>{copy.pictureBody}</p></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></button>
      <button type="button" className="now-together-door" onClick={() => setActiveTab("practice")}><img src="/visuals/companion/together-table.webp" width="960" height="640" alt="" loading="lazy" /><span><h2>{copy.togetherTitle}</h2><p>{copy.togetherBody}</p></span><Icon name="arrow_forward" size={20} className="rtl:-scale-x-100" /></button>
    </section>
    <footer className="now-footer"><button type="button" className="companion-text-button" onClick={() => setActiveTab("learn")}><Icon name="menu_book" size={18} />{copy.learning}</button><button type="button" className="companion-text-button" onClick={() => setActiveTab("consult")}><Icon name="group" size={19} />{copy.care}</button></footer>
  </div>;
}
