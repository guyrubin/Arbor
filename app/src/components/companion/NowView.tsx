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
    recordTodayOutcome, pendingCaptureMode, consumeCaptureRequest } = useArbor();
  const { uiLang } = useLanguage();
  const he = uiLang === "he";
  const lang = he ? "he" : "en";
  const name = childProfile.name?.split(" ")[0] || (he ? "הילד שלכם" : "your child");
  const programs = useChildCollection<{ id: string }>(childProfile.id, "programs");
  const program = useMemo(() => activeProgramWeek(programs.items), [programs.items]);
  const action = useMemo(() => nextChosenAction(actionLoop, topic?.id), [actionLoop, topic?.id]);
  const [questionDraft, setQuestionDraft] = useState({ childId: childProfile.id, value: "" });
  const question = questionDraft.childId === childProfile.id ? questionDraft.value : "";
  const setQuestion = (value: string) => setQuestionDraft({ childId: childProfile.id, value });
  const [receiptChild, setReceiptChild] = useState<string | null>(null);
  const receipt = receiptChild === childProfile.id;
  const setReceipt = (value: boolean) => setReceiptChild(value ? childProfile.id : null);
  const inputId = useId();
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
        <span className="companion-eyebrow">{he ? "עכשיו · מרחב לנשום ולבחור" : "NOW · ROOM TO PAUSE AND CHOOSE"}</span>
        <h1 className="arbor-type-hero">{he ? `מה יעזור לכם עם ${name}?` : `What would help with ${name}?`}</h1>
        <p>{he ? "מתחילים במה שחשוב לכם. לא צריך להספיק הכול." : "Start with what matters to you. There is no list to keep up with."}</p>
      </header>

      <div className="companion-now-grid">
        <section data-module="now-focus" className="companion-focus arbor-depth-primary" aria-labelledby={`${inputId}-focus`}>
          <div className="companion-kicker"><Icon name="chat_bubble" size={19} /><span>{topic ? (he ? "השאלה שמלווה אתכם" : "THE QUESTION YOU’RE EXPLORING") : (he ? "מקום לשאלה שלכם" : "A PLACE FOR YOUR QUESTION")}</span></div>
          <h2 id={`${inputId}-focus`} className="companion-family-words" dir="auto">{topic?.title || (he ? "משהו שקשה. משהו שמסקרן. או רגע שרוצים להבין." : "Something hard. Something curious. A moment you want to understand.")}</h2>
          {topic && onTopicOpen && <button type="button" className="companion-text-button" onClick={onTopicOpen}>{he ? "הרגעים והצעדים שקשורים לשאלה" : "See the moments and steps behind this question"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>}
          <form className="companion-question" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <label htmlFor={inputId}>{topic ? (he ? "מה תרצו להבין עכשיו?" : "What would you like to understand now?") : (he ? "מה מעסיק אתכם?" : "What’s on your mind?")}</label>
            <textarea id={inputId} value={question} maxLength={1200} rows={2} onChange={(event) => setQuestion(event.target.value)} placeholder={he ? "למשל, הבקרים הפכו למאבק…" : "For example, mornings have become a struggle…"} />
            <div className="companion-question-actions">
              <button type="submit" className="companion-primary" data-primary-move="choose-next-step"><Icon name="chat_bubble" size={19} />{he ? "נחשוב על זה יחד" : "Think it through with Arbor"}</button>
              {onVoiceOpen && <button type="button" className="companion-icon-button" onClick={onVoiceOpen} aria-label={he ? "לדבר עם Arbor בקול" : "Talk to Arbor by voice"}><Icon name="mic" size={21} /></button>}
            </div>
            {!topic && onTopicCreate && question.trim() && <button type="button" className="companion-text-button" onClick={() => onTopicCreate(question.trim())}><Icon name="bookmark_add" size={17} />{he ? "לשמור כשאלה שנחזור אליה" : "Keep as a question to return to"}</button>}
          </form>
          <div className="companion-quiet-note"><Icon name="auto_awesome" size={16} /><span>{he ? "הרעיונות של Arbor הם הצעות. אתם מחליטים מה מתאים למשפחה." : "Arbor offers possibilities. You decide what fits your family."}</span></div>
        </section>

        <aside className="companion-next" data-module="now-step" aria-labelledby={`${inputId}-next`}>
          <span className="companion-eyebrow">{he ? "הצעד שלכם" : "YOUR NEXT SMALL STEP"}</span>
          {action ? <>
            <h2 id={`${inputId}-next`}>{topic && action.topicId !== topic.id ? (he ? "עוד צעד שבחרתם" : "Another step you chose") : (he ? "ממשיכים במה שבחרתם" : "Continue what you chose")}</h2>
            <p className="companion-chosen-step" dir="auto">{action.recommendation}</p>
            <p className="companion-caption">{he ? "צעד שכבר בחרתם לנסות. אפשר לחזור אליו כשהזמן מתאים." : "A step you already chose. Come back to it when the moment fits."}</p>
            <div className="companion-outcomes" role="group" aria-label={he ? "איך היה לכם?" : "How did it go for you?"}>
              <button type="button" className="companion-secondary" onClick={() => { recordTodayOutcome(action.id, "helped"); setReceipt(true); }}>{he ? "זה עזר" : "It helped"}</button>
              <button type="button" className="companion-secondary" onClick={() => { recordTodayOutcome(action.id, "not_today"); setReceipt(true); }}>{he ? "לא הפעם" : "Not this time"}</button>
            </div>
            <button type="button" className="companion-text-button" onClick={() => seedCoach({ prompt: he ? `בחרנו לנסות: ${action.recommendation}. בואו נתאים את זה למה שקורה עכשיו.` : `We chose to try: ${action.recommendation}. Help us adapt it to what is happening now.`, source: "companion-action" })}>{he ? "להתאים את הצעד" : "Adapt this step"}<Icon name="arrow_forward" size={17} className="companion-arrow" /></button>
          </> : program ? <>
            <h2 id={`${inputId}-next`}>{program.content.skill[lang]}</h2>
            <p>{he ? `שבוע ${program.week} בתוכנית שבחרתם. צעד אחד מתוך הדרך שלכם.` : `Week ${program.week} of your chosen program. One step on your own path.`}</p>
            <button type="button" className="companion-secondary" onClick={openProgram}>{he ? "להמשיך בתוכנית" : "Continue your program"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>
          </> : <>
            <h2 id={`${inputId}-next`}>{receipt ? (he ? "אפשר לעצור כאן." : "You can pause here.") : (he ? "גם רגע נעים הוא התחלה." : "A good moment is a place to start.")}</h2>
            <p>{receipt ? (he ? "מה שסיפרתם נשמר עם הצעד. אפשר להמשיך כשהזמן מתאים." : "Your response stays with this step. Continue when it feels right.") : (he ? "ספר, משחק או רעיון קטן לזמן ביחד. בלי להפוך כל רגע למשימה." : "A story, a game or a small idea for time together. Every moment needn’t be a task.")}</p>
            <button type="button" className="companion-secondary" onClick={() => setActiveTab("practice")}>{he ? "למצוא משהו לעשות ביחד" : "Find something to enjoy together"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></button>
          </>}
          {receipt && <p role="status" className="companion-caption">{he ? "התשובה נשמרה עם הצעד שלכם." : "Your response is saved with your step."}</p>}
          <img src="/visuals/companion/together-table.webp" width="960" height="640" alt="" className="companion-now-art" loading="lazy" />
        </aside>
      </div>

      <div className="companion-support-strip" aria-label={he ? "עזרה ותיעוד" : "Support and capture"}>
        <button type="button" onClick={() => openHardMomentNow()}><Icon name="volunteer_activism" size={21} /><span><b>{he ? "קשה עכשיו?" : "A hard moment?"}</b><small>{he ? "מילים וצעד לרגע הזה" : "Words and one step for right now"}</small></span><Icon name="arrow_forward" size={18} className="companion-arrow" /></button>
        <button type="button" onClick={() => openCaptureSheet({ mode: "text" })}><Icon name="edit_note" size={22} /><span><b>{he ? "רגע שכדאי לשמור" : "A moment worth keeping"}</b><small>{he ? "במילים, בקול או בתמונה" : "In words, by voice or with a photo"}</small></span><Icon name="add" size={20} /></button>
      </div>

      <section className="companion-explore" data-module="now-explore" aria-label={he ? "להבין יותר, עם תמיכה" : "Understand more, with support"}>
        <button type="button" className="companion-editorial-door" onClick={() => setActiveTab("learn")}><Icon name="menu_book" size={27} /><span><span className="companion-eyebrow">{he ? "בשבילכם" : "FOR YOU"}</span><h2>{he ? "להבין יותר. בקצב שלכם." : "Understand more. At your pace."}</h2><p>{he ? "ספריית ידע וקורסים שמתחברים לחיים בבית." : "A library of ideas and courses that connect to life at home."}</p><span className="companion-door-link">{he ? "לספרייה ולקורסים" : "Explore learning"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></span></span></button>
        <button type="button" className="companion-editorial-door" onClick={() => setActiveTab("consult")}><Icon name="group" size={27} /><span><span className="companion-eyebrow">{he ? "לא צריכים לבד" : "YOU DON’T HAVE TO DO IT ALONE"}</span><h2>{he ? "תמונה משותפת עם מי שעוזר." : "A shared picture with the people who help."}</h2><p>{he ? "להתכונן לפגישה ולבחור מה לשתף עם הצוות." : "Prepare for a conversation and choose what to share with your care team."}</p><span className="companion-door-link">{he ? "לתמיכה ולצוות" : "Care and collaboration"}<Icon name="arrow_forward" size={18} className="companion-arrow" /></span></span></button>
      </section>
    </div>
  );
}

