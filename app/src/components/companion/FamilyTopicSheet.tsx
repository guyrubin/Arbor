import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import type { FamilyTopic } from "../../lib/familyTopics";
import type { Observation } from "../../lib/observations";

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

/** A question links existing records; it never creates inferred child facts. */
export default function FamilyTopicSheet({ onClose, draft, observationIds = [], startNew = false }: {
  onClose: () => void; draft?: string; observationIds?: string[]; startNew?: boolean;
}) {
  const { t, uiLang } = useLanguage();
  const he = uiLang === "he";
  const { childProfile, familyTopics, activeFamilyTopic, createFamilyTopic, updateFamilyTopic,
    selectFamilyTopic, actionLoop, conversations, openConversation, newConversation, seedCoach, setActiveTab } = useArbor();
  const [creating, setCreating] = useState(startNew || !activeFamilyTopic);
  const [title, setTitle] = useState(draft ?? activeFamilyTopic?.title ?? "");
  const [intent, setIntent] = useState<FamilyTopic["intent"]>(activeFamilyTopic?.intent ?? "understand");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const observations = useObservations();
  const topic = creating ? null : activeFamilyTopic;
  const evidence = topic ? observations.filter(item => topic.observationIds.includes(item.id)) : [];
  const actions = topic ? actionLoop.filter(item => item.topicId === topic.id) : [];
  const threads = topic ? conversations.filter(item => item.topicId === topic.id) : [];
  const button = "min-h-11 rounded-xl px-4 py-3 text-sm font-semibold text-start";
  async function save() {
    setBusy(true); setError(false);
    try {
      if (creating) await createFamilyTopic(title, observationIds, intent);
      else if (topic) await updateFamilyTopic(topic.id, { title, intent });
      setCreating(false);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <Sheet open onClose={onClose} title={t("companion.family-topic-sheet.what-we-re-exploring")}>
    <div className="space-y-6 pb-4" dir={he ? "rtl" : "ltr"}>
      <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("companion.family-topic-sheet.a-question-you-chose-for-it-connects-the-r", { value0: childProfile.name })}</p>
      {familyTopics.length > 0 && <div className="flex flex-wrap gap-2" aria-label={t("companion.family-topic-sheet.our-questions")}>
        {familyTopics.map(item => <button key={item.id} className={button} aria-pressed={!creating && topic?.id === item.id}
          style={{ background: !creating && topic?.id === item.id ? "var(--arbor-clay-dim)" : "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
          onClick={() => { selectFamilyTopic(item.id); setTitle(item.title); setIntent(item.intent); setCreating(false); setError(false); }}>{item.title}</button>)}
        <button className={button} onClick={() => { setCreating(true); setTitle(""); setIntent("understand"); }}>{t("companion.family-topic-sheet.new-question")}</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3">
        <label htmlFor="family-question-title" className="block font-semibold text-sm">{t("companion.family-topic-sheet.in-your-words")}</label>
        <textarea id="family-question-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required rows={2}
          placeholder={t("companion.family-topic-sheet.for-example-how-could-mornings-feel-easier")}
          className="w-full rounded-xl p-3 text-base" style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}/>
        <fieldset><legend className="text-sm mb-2">{t("companion.family-topic-sheet.what-would-you-like")}</legend>
          <div className="flex flex-wrap gap-2">{([
            { id: "understand", en: "Understand", he: "להבין" }, { id: "support", en: "Find a way forward", he: "למצוא דרך" }, { id: "enjoy", en: "Enjoy together", he: "ליהנות יחד" },
          ] as const).map(option => <button key={option.id} type="button" className={button} aria-pressed={intent === option.id} onClick={() => setIntent(option.id)}
            style={{ background: intent === option.id ? "var(--arbor-clay-dim)" : "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>{he ? option.he : option.en}</button>)}</div>
        </fieldset>
        <button type="submit" disabled={busy || !title.trim()} className={button} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
          {busy ? (t("companion.family-topic-sheet.saving")) : creating ? (t("companion.family-topic-sheet.keep-this-question")) : (t("companion.family-topic-sheet.save-changes"))}</button>
        {error && <p role="alert" className="text-sm">{t("companion.family-topic-sheet.that-change-wasn-t-saved-please-try-again")}</p>}
      </form>
      {topic && <>
        <div className="grid gap-5" style={{ borderTop: "1px solid var(--arbor-rule)", paddingTop: 20 }}>
          <section><h3 className="font-semibold flex items-center gap-2"><Icon name="edit_note" size={20}/>{t("companion.family-topic-sheet.what-we-recorded")}</h3>
            {evidence.length ? evidence.map(item => <p key={item.id} className="mt-3 text-sm leading-relaxed" dir="auto"><time className="block text-xs" dateTime={item.at}>{new Date(item.at).toLocaleDateString(he ? "he-IL" : "en-GB")}</time>{sourceLabel(item, t)}</p>) : <p className="mt-2 text-sm" style={{ color: "var(--arbor-muted)" }}>{t("companion.family-topic-sheet.no-linked-records-yet-a-question-is-enough")}</p>}
            <button className={button} onClick={() => { onClose(); setActiveTab("development"); }}>{t("companion.family-topic-sheet.see-the-whole-picture")}</button>
          </section>
          <section><h3 className="font-semibold">{t("companion.family-topic-sheet.what-we-chose-to-try")}</h3>
            {actions.length ? actions.slice(0, 8).map(item => <div key={item.id} className="py-3 text-sm" style={{ borderBottom: "1px solid var(--arbor-rule)" }}><p dir="auto">{item.recommendation}</p><p className="mt-1 text-xs" style={{ color: "var(--arbor-muted)" }}>{item.outcome ? ({ helped: t("companion.family-topic-sheet.outcome.helped"), somewhat: t("companion.family-topic-sheet.outcome.somewhat"), not_today: t("companion.family-topic-sheet.outcome.not_today") })[item.outcome] : t("companion.family-topic-sheet.you-haven-t-shared-how-it-went-yet")}</p></div>) : <p className="mt-2 text-sm" style={{ color: "var(--arbor-muted)" }}>{t("companion.family-topic-sheet.a-step-you-choose-will-appear-here")}</p>}
          </section>
          <section><h3 className="font-semibold">{t("companion.family-topic-sheet.our-conversations")}</h3>
            {threads.map(thread => <button key={thread.id} className={`${button} block w-full`} onClick={() => { openConversation(thread.id); onClose(); setActiveTab("coach"); }}>{thread.title}</button>)}
            <button className={`${button} mt-2`} style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }} onClick={() => { newConversation(); seedCoach({ prompt: topic.title, source: "family-topic" }); onClose(); }}>{t("companion.family-topic-sheet.talk-this-through-with-arbor")}</button>
          </section>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => { selectFamilyTopic(null); onClose(); }}>{t("companion.family-topic-sheet.set-aside-for-now")}</button>
          <button disabled={busy} className={button} onClick={async () => { setBusy(true); try { await updateFamilyTopic(topic.id, { status: "archived" }); onClose(); } catch { setError(true); } finally { setBusy(false); } }}>{t("companion.family-topic-sheet.we-re-done-with-this-question")}</button>
        </div>
      </>}
    </div>
  </Sheet>;
}
