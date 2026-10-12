import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import { useSheetHistory } from "../../hooks/useSheetHistory";
import { SheetBreadcrumb } from "../layout/Breadcrumb";
import { INTENT_ICON, chooseFamilyTopic, type FamilyTopic } from "../../lib/familyTopics";
import type { Observation } from "../../lib/observations";
import "./companionExperience.css";
import "./familyTopicSheet.css";

function sourceLabel(observation: Observation, t: (key: string) => string): string {
  const v = observation.value;
  switch (v.type) {
    case "moment": return t("companion.family-topic-sheet.a-moment-you-recorded");
    case "milestone": case "play": return v.title;
    case "keepsake": return v.note;
    case "word": return v.phrase;
    case "goal_note": return v.text;
    case "practice": return v.activity;
    case "fact": return v.fact;
    case "measurement": return t("companion.family-topic-sheet.a-saved-measurement");
    case "check": return t("companion.family-topic-sheet.a-check-you-chose-to-complete");
  }
}

const INTENTS: readonly FamilyTopic["intent"][] = ["understand", "support", "enjoy"];
const INTENT_KEY: Record<FamilyTopic["intent"], string> = {
  understand: "companion.family-topic-sheet.intent.understand", support: "companion.family-topic-sheet.intent.support", enjoy: "companion.family-topic-sheet.intent.enjoy",
};

/**
 * v3 "All questions" (11 Oct 2026): every saved question on its own row —
 * tap to make it active; edit, set aside or finish it in place. Nothing is
 * deleted: a finished question keeps its records and can be brought back.
 * A question links existing records; it never creates inferred child facts.
 */
export default function FamilyTopicSheet({ onClose, draft, observationIds = [], startNew = false }: {
  onClose: () => void; draft?: string; observationIds?: string[]; startNew?: boolean;
}) {
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const { childProfile, familyTopics, archivedFamilyTopics = [], activeFamilyTopic, createFamilyTopic, updateFamilyTopic,
    selectFamilyTopic, actionLoop, conversations, openConversation, newConversation, seedCoach, setActiveTab } = useArbor();
  // null = the list; "new" = a new question; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(startNew || !familyTopics.length ? "new" : null);
  const [title, setTitle] = useState(draft ?? "");
  const [intent, setIntent] = useState<FamilyTopic["intent"]>("understand");
  const [showFinished, setShowFinished] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const observations = useObservations();
  const topic = activeFamilyTopic;
  const evidence = topic ? observations.filter(item => topic.observationIds.includes(item.id)) : [];
  const actions = topic ? actionLoop.filter(item => item.topicId === topic.id) : [];
  const threads = topic ? conversations.filter(item => item.topicId === topic.id) : [];
  const rows = showFinished ? [...familyTopics, ...archivedFamilyTopics] : familyTopics;
  // v3 IA-06: the sheet owns one history entry (Back closes it). IA-06r: it
  // names where it sits in a crumb its dialog draws over the top bar title
  // (under the phone header below lg). Every way out goes through close; a row
  // that leaves for a route navigates once that entry is gone.
  const close = useSheetHistory(true, onClose);

  // Every write waits for the store: a row changes only once its record is saved.
  async function run(key: string, task: () => Promise<unknown>) {
    setBusy(key); setError(false);
    try { await task(); return true; } catch { setError(true); return false; } finally { setBusy(null); }
  }
  function startEdit(item: FamilyTopic | null) {
    setEditing(item ? item.id : "new"); setTitle(item?.title ?? ""); setIntent(item?.intent ?? "understand"); setError(false);
  }
  async function save() {
    const words = title.trim();
    if (!words || !editing) return;
    const done = await run(editing, () => editing === "new" ? createFamilyTopic(words, observationIds, intent) : updateFamilyTopic(editing, { title: words, intent }));
    if (done) { setEditing(null); setTitle(""); }
  }
  async function pick(item: FamilyTopic) {
    // v3 IA-05r: the one choose path, shared with search. A set-aside question
    // is brought back first; its write shows busy and any error here.
    const choose = () => chooseFamilyTopic(item, { updateFamilyTopic, selectFamilyTopic });
    if (item.asideAt) await run(item.id, choose);
    else await choose();
  }

  return <Sheet open onClose={() => close()} title={t("companion.family-topic-sheet.what-we-re-exploring")}
    companion={<SheetBreadcrumb label={topic?.title ?? t("companion.family-topic-sheet.what-we-re-exploring")} close={close} />}>
    <div className="topic-sheet" dir={he ? "rtl" : "ltr"}>
      <p className="topic-sheet-sub">{t("companion.family-topic-sheet.a-question-you-chose-for-it-connects-the-r", { value0: childProfile.name })}</p>

      {rows.length > 0 && <ul className="topic-rows" aria-label={t("companion.family-topic-sheet.our-questions")}>
        {rows.map(item => {
          const finished = item.status === "archived";
          const active = !finished && topic?.id === item.id;
          const name = { value0: item.title };
          return <li key={item.id} className="topic-row" data-active={active || undefined} data-muted={finished || !!item.asideAt || undefined}>
            <button type="button" className="topic-row-pick" aria-pressed={active} disabled={finished || busy === item.id} onClick={() => void pick(item)}>
              <Icon name={INTENT_ICON[item.intent] ?? "help"} size={20} /><span dir="auto">{item.title}</span>
            </button>
            {active && <span className="topic-tag topic-tag-active">{t("companion.family-topic-sheet.tag.active")}</span>}
            {!finished && item.asideAt && <span className="topic-tag">{t("companion.family-topic-sheet.tag.aside")}</span>}
            {finished && <span className="topic-tag topic-tag-finished">{t("companion.family-topic-sheet.tag.finished")}</span>}
            {!finished && <button type="button" className="topic-row-tool" aria-label={t("companion.family-topic-sheet.edit-named", name)} title={t("companion.family-topic-sheet.edit-named", name)} disabled={!!busy} onClick={() => startEdit(item)}><Icon name="edit" size={19} /></button>}
            {!finished && <button type="button" className="topic-row-tool" disabled={!!busy}
              aria-label={t(item.asideAt ? "companion.family-topic-sheet.bring-back-named" : "companion.family-topic-sheet.set-aside-named", name)}
              title={t(item.asideAt ? "companion.family-topic-sheet.bring-back-named" : "companion.family-topic-sheet.set-aside-named", name)}
              onClick={() => void run(item.id, () => updateFamilyTopic(item.id, { aside: !item.asideAt }))}><Icon name={item.asideAt ? "visibility" : "visibility_off"} size={19} /></button>}
            <button type="button" className="topic-row-tool" disabled={!!busy}
              aria-label={t(finished ? "companion.family-topic-sheet.bring-back-named" : "companion.family-topic-sheet.finish-named", name)}
              title={t(finished ? "companion.family-topic-sheet.bring-back-named" : "companion.family-topic-sheet.finish-named", name)}
              onClick={() => void run(item.id, () => updateFamilyTopic(item.id, { status: finished ? "active" : "archived" }))}><Icon name={finished ? "replay" : "task_alt"} size={19} /></button>
          </li>;
        })}
      </ul>}

      {editing && <form className="topic-edit" onSubmit={event => { event.preventDefault(); void save(); }}>
        <label htmlFor="family-question-title" className="topic-edit-label">{t(editing === "new" ? "companion.family-topic-sheet.new-title" : "companion.family-topic-sheet.edit-title")}</label>
        <textarea id="family-question-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required rows={2} dir="auto"
          placeholder={t("companion.family-topic-sheet.for-example-how-could-mornings-feel-easier")} />
        <fieldset><legend>{t("companion.family-topic-sheet.what-would-you-like")}</legend>
          <div className="topic-intents">{INTENTS.map(option => <button key={option} type="button" aria-pressed={intent === option} onClick={() => setIntent(option)}>
            <Icon name={INTENT_ICON[option]} size={17} />{t(INTENT_KEY[option])}</button>)}</div>
        </fieldset>
        <div className="topic-edit-actions">
          <button type="submit" className="companion-primary" disabled={!!busy || !title.trim()}><Icon name="check" size={18} />
            {busy === editing ? t("companion.family-topic-sheet.saving") : editing === "new" ? t("companion.family-topic-sheet.keep-this-question") : t("companion.family-topic-sheet.save-changes")}</button>
          {(familyTopics.length > 0 || editing !== "new") && <button type="button" className="companion-text-button" onClick={() => { setEditing(null); setTitle(""); setError(false); }}>{t("companion.family-topic-sheet.cancel")}</button>}
        </div>
      </form>}
      {error && <p role="alert" className="topic-sheet-error">{t("companion.family-topic-sheet.that-change-wasn-t-saved-please-try-again")}</p>}

      <div className="topic-sheet-more">
        {archivedFamilyTopics.length > 0 && <button type="button" className="companion-text-button" aria-expanded={showFinished} onClick={() => setShowFinished(value => !value)}>
          {showFinished ? t("companion.family-topic-sheet.hide-finished") : t("companion.family-topic-sheet.show-finished", { value0: archivedFamilyTopics.length })}</button>}
        {!editing && <button type="button" className="topic-new" onClick={() => startEdit(null)}><Icon name="add" size={20} />{t("companion.family-topic-sheet.new-question")}</button>}
      </div>

      {topic && <section className="topic-linked" aria-labelledby="family-question-linked">
        <h3 id="family-question-linked" className="topic-linked-title" dir="auto">{t("companion.family-topic-sheet.linked-to", { value0: topic.title })}</h3>
        <div className="topic-linked-grid">
          <div><h4><Icon name="edit_note" size={18} />{t("companion.family-topic-sheet.what-we-recorded")}</h4>
            {evidence.length ? evidence.map(item => <p key={item.id} className="topic-linked-row" dir="auto"><time dateTime={item.at}>{new Date(item.at).toLocaleDateString(he ? "he-IL" : "en-GB")}</time>{sourceLabel(item, t)}</p>)
              : <p className="topic-linked-empty">{t("companion.family-topic-sheet.no-linked-records-yet-a-question-is-enough")}</p>}
            <button type="button" className="companion-text-button" onClick={() => close(() => setActiveTab("development"))}>{t("companion.family-topic-sheet.see-the-whole-picture")}</button>
          </div>
          <div><h4><Icon name="flag" size={18} />{t("companion.family-topic-sheet.what-we-chose-to-try")}</h4>
            {actions.length ? actions.slice(0, 8).map(item => <div key={item.id} className="topic-linked-row"><p dir="auto">{item.recommendation}</p><small>{item.outcome ? ({ helped: t("companion.family-topic-sheet.outcome.helped"), somewhat: t("companion.family-topic-sheet.outcome.somewhat"), not_today: t("companion.family-topic-sheet.outcome.not_today") })[item.outcome] : t("companion.family-topic-sheet.you-haven-t-shared-how-it-went-yet")}</small></div>)
              : <p className="topic-linked-empty">{t("companion.family-topic-sheet.a-step-you-choose-will-appear-here")}</p>}
          </div>
          <div><h4><Icon name="forum" size={18} />{t("companion.family-topic-sheet.our-conversations")}</h4>
            {threads.map(thread => <button key={thread.id} type="button" className="topic-linked-row topic-linked-thread" dir="auto" onClick={() => { openConversation(thread.id); close(() => setActiveTab("coach")); }}>{thread.title}</button>)}
            <button type="button" className="companion-text-button" onClick={() => { newConversation(); seedCoach({ prompt: topic.title, source: "family-topic" }); close(); }}>{t("companion.family-topic-sheet.talk-this-through-with-arbor")}</button>
          </div>
        </div>
      </section>}

      <div className="topic-sheet-foot">
        <button type="button" className={editing ? "companion-secondary" : "companion-primary"} onClick={() => close()}>{t("companion.family-topic-sheet.close")}</button>
        <p>{t("companion.family-topic-sheet.manage-hint")}</p>
      </div>
    </div>
  </Sheet>;
}
