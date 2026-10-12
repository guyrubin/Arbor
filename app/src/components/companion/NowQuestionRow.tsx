import React, { useId, useRef } from "react";
import { useArbor } from "../../context/ArborContext";
import Icon from "../ui/Icon";
import type { FamilyTopic } from "../../lib/familyTopics";
import { NOW_COPY } from "./nowViewCopy";
import { guideFaceFor } from "./nowGuideFace";
import { requestFamilyTopicEdit } from "./familyTopicEvents";

const INTENT_ICON: Record<FamilyTopic["intent"], string> = { understand: "lightbulb", support: "volunteer_activism", enjoy: "favorite" };
const intentIcon = (intent?: string) => INTENT_ICON[intent as FamilyTopic["intent"]] ?? "help";
/** F-NOW-1: a question wears its guide topic's glyph; one no guide matches keeps its intent's. */
const questionIcon = (title: string, intent: string | undefined, lang: "en" | "he") => guideFaceFor(title, lang).glyph ?? intentIcon(intent);

/**
 * v3 Now (11 Oct 2026): the parent's question as a row under the title — the
 * active question, the other saved ones one tap away, and the full sheet.
 * Only real saved questions appear; set-aside ones stay in the sheet.
 * F-NOW-1: talking about the question lives in the launcher and the sheet,
 * not here; the edit glyph opens the sheet on this question's wording.
 */
export default function NowQuestionRow({ lang, topic, onOpen, onCreate, "data-module": module }: {
  lang: "en" | "he";
  topic?: { id: string; title: string; intent?: string } | null;
  /** The full questions sheet; without it the row still shows the active question. */
  onOpen?: () => void;
  onCreate?: () => void;
  /** The Today module stamp, set by NowView; it counts only while a question is active. */
  "data-module"?: string;
}) {
  const { familyTopics = [], selectFamilyTopic } = useArbor();
  const copy = NOW_COPY[lang];
  const id = useId();
  const row = useRef<HTMLDivElement>(null);
  const others = familyTopics.filter(item => item.id !== topic?.id && !item.asideAt);
  const count = familyTopics.length;
  // RTL scrolls toward negative offsets; "forward" always means toward the reading end.
  const scroll = (forward: boolean) => row.current?.scrollBy({ left: (forward ? 1 : -1) * (lang === "he" ? -1 : 1) * 240, behavior: "smooth" });

  return <section className="now-question" aria-labelledby={`${id}-label`} data-module={topic ? module : undefined}>
    <div className="now-question-head">
      <p id={`${id}-label`} className="now-kicker">{copy.questionLabel}</p>
      {topic && <span className="now-question-note">{copy.questionNote}</span>}
      {onCreate && <button type="button" className="now-question-new" onClick={onCreate}><Icon name="add" size={18} />{copy.newQuestion}</button>}
    </div>
    <div className="now-question-row">
      {topic ? <div className="now-question-active" data-testid="now-question-active">
        <Icon name={questionIcon(topic.title, topic.intent, lang)} size={24} className="now-question-icon" />
        <div className="now-question-text"><small>{copy.activeNow}</small><b dir="auto">{topic.title}</b></div>
        {onOpen && <button type="button" className="now-question-edit" aria-label={copy.editQuestion} title={copy.editQuestion} onClick={() => { requestFamilyTopicEdit(topic.id); onOpen(); }}><Icon name="edit" size={18} /></button>}
      </div> : (onOpen || onCreate) && <button type="button" className="now-question-empty" data-testid="now-question-empty" onClick={count && onOpen ? onOpen : onCreate ?? onOpen}>
        <Icon name="help" size={22} />
        <span><b>{copy.noQuestion}</b><small>{count ? copy.noQuestionBody : copy.firstQuestionBody}</small></span>
      </button>}
      {others.length > 0 && <>
        {others.length > 2 && <button type="button" className="now-question-scroll" aria-label={copy.earlierQuestions} onClick={() => scroll(false)}><Icon name="arrow_back" size={22} className="rtl:-scale-x-100" /></button>}
        <div ref={row} className="now-question-chips" role="group" aria-label={copy.otherQuestions}>
          {others.map(item => <button key={item.id} type="button" className="now-question-chip" onClick={() => selectFamilyTopic(item.id)}>
            <Icon name={questionIcon(item.title, item.intent, lang)} size={20} /><span dir="auto">{item.title}</span>
          </button>)}
        </div>
        {others.length > 2 && <button type="button" className="now-question-scroll" aria-label={copy.moreQuestions} onClick={() => scroll(true)}><Icon name="arrow_forward" size={22} className="rtl:-scale-x-100" /></button>}
      </>}
      {onOpen && <button type="button" className="now-question-all" onClick={onOpen}><Icon name="list" size={20} />{copy.topics}{count > 0 ? ` (${count})` : ""}</button>}
    </div>
  </section>;
}
