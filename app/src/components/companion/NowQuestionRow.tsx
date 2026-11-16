import React, { useId } from "react";
import { useArbor } from "../../context/ArborContext";
import Icon from "../ui/Icon";
import { INTENT_ICON, type FamilyTopic } from "../../lib/familyTopics";
import { NOW_COPY } from "./nowViewCopy";
import { guideFaceFor } from "./nowGuideFace";
import { requestFamilyTopicEdit } from "./familyTopicEvents";

const intentIcon = (intent?: string) => INTENT_ICON[intent as FamilyTopic["intent"]] ?? "help";
/** F-NOW-1: a question wears its guide topic's glyph; one no guide matches keeps its intent's. */
const questionIcon = (title: string, intent: string | undefined, lang: "en" | "he") => guideFaceFor(title, lang).glyph ?? intentIcon(intent);

/**
 * Now v10.1 (N-Now › "Your question"): the parent's question as one chip in
 * the stage, under the lead — the active question (with its edit glyph) or the
 * empty state, then "New question" and "All questions"; the other saved
 * questions follow as small chips, one tap to switch. Only real saved
 * questions appear; set-aside ones stay in the sheet. Talking about the
 * question lives in the launcher and the sheet, not here.
 */
export default function NowQuestionRow({ lang, topic, onOpen, onCreate, phone = false, "data-module": module }: {
  lang: "en" | "he";
  topic?: { id: string; title: string; intent?: string } | null;
  /** The full questions sheet; without it the row still shows the active question. */
  onOpen?: () => void;
  onCreate?: () => void;
  /** The phone composition: the chip's actions fold under its line. */
  phone?: boolean;
  /** The Today module stamp, set by NowView; it counts only while a question is active. */
  "data-module"?: string;
}) {
  const { familyTopics = [], selectFamilyTopic } = useArbor();
  const copy = NOW_COPY[lang];
  const id = useId();
  const others = familyTopics.filter(item => item.id !== topic?.id && !item.asideAt);
  const count = familyTopics.length;
  const emptyOpen = count && onOpen ? onOpen : onCreate ?? onOpen;

  return <section className="nw-q" aria-labelledby={`${id}-label`} data-module={topic ? module : undefined}>
    <div className={phone ? "nw-qc m" : "nw-qc"}>
      <span className="l">
        <Icon name={topic ? questionIcon(topic.title, topic.intent, lang) : "help"} size={18} className="now-question-icon" />
        <span className="nw-qc-text">
          <span id={`${id}-label`}>{copy.questionLabel}</span>
          {topic ? <span className="nw-qc-active" data-testid="now-question-active">
            {" · "}<b dir="auto">{topic.title}</b>
            {onOpen && <button type="button" className="nw-qc-edit" aria-label={copy.editQuestion} title={copy.editQuestion} onClick={() => { requestFamilyTopicEdit(topic.id); onOpen(); }}><Icon name="edit" size={16} /></button>}
          </span> : emptyOpen ? <button type="button" className="nw-qc-empty" data-testid="now-question-empty" onClick={emptyOpen}>
            <b>{copy.noQuestion}</b><small>{count ? copy.noQuestionBody : copy.firstQuestionBody}</small>
          </button> : null}
        </span>
      </span>
      {(onCreate || onOpen) && <span className="acts">
        <i className="sp" aria-hidden="true" />
        {onCreate && <button type="button" className="now-question-new" onClick={onCreate}><Icon name="add" size={18} />{copy.newQuestion}</button>}
        {onOpen && <button type="button" className="now-question-all" onClick={onOpen}>{copy.topics}{count > 0 ? ` (${count})` : ""}<Icon name="chevron_right" size={16} className="rtl:-scale-x-100" /></button>}
      </span>}
    </div>
    {others.length > 0 && <div className="nw-q-others ds-snap-scroll" role="group" aria-label={copy.otherQuestions}>
      {others.map(item => <button key={item.id} type="button" className="now-question-chip" onClick={() => selectFamilyTopic(item.id)}>
        <Icon name={questionIcon(item.title, item.intent, lang)} size={18} /><span dir="auto">{item.title}</span>
      </button>)}
    </div>}
  </section>;
}
