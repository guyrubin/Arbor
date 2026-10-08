import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useObservations } from "../../hooks/useObservations";
import { Sheet } from "../ui/Sheet";
import { Icon } from "../ui/Icon";
import type { FamilyTopic } from "../../lib/familyTopics";
import type { Observation } from "../../lib/observations";

function sourceLabel(observation: Observation, he: boolean): string {
  const v = observation.value;
  switch (v.type) {
    case "moment": return he ? "רגע שתיעדתם" : "A moment you recorded";
    case "milestone": case "play": return v.title;
    case "keepsake": return v.note;
    case "word": return v.phrase;
    case "goal_note": return v.text;
    case "practice": return v.activity;
    case "fact": return v.fact;
    case "measurement": return he ? "מדידה שנשמרה" : "A saved measurement";
    case "check": return he ? "בדיקה שבחרתם למלא" : "A check you chose to complete";
  }
}

/** A question links existing records; it never creates inferred child facts. */
export default function FamilyTopicSheet({ onClose, draft, observationIds = [], startNew = false }: {
  onClose: () => void; draft?: string; observationIds?: string[]; startNew?: boolean;
}) {
  const { uiLang } = useLanguage();
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
  return <Sheet open onClose={onClose} title={he ? "מה מעסיק אותנו" : "What we’re exploring"}>
    <div className="space-y-6 pb-4" dir={he ? "rtl" : "ltr"}>
      <p className="text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{he
        ? `שאלה שבחרתם עבור ${childProfile.name}. היא מחברת את התיעוד, השיחות ומה שניסיתם — ומשמשת הקשר לשיחה עם Arbor כל עוד היא נבחרת.`
        : `A question you chose for ${childProfile.name}. It connects the record, conversations and what you tried, and gives Arbor context while selected.`}</p>
      {familyTopics.length > 0 && <div className="flex flex-wrap gap-2" aria-label={he ? "השאלות שלנו" : "Our questions"}>
        {familyTopics.map(item => <button key={item.id} className={button} aria-pressed={!creating && topic?.id === item.id}
          style={{ background: !creating && topic?.id === item.id ? "var(--arbor-clay-dim)" : "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
          onClick={() => { selectFamilyTopic(item.id); setTitle(item.title); setIntent(item.intent); setCreating(false); setError(false); }}>{item.title}</button>)}
        <button className={button} onClick={() => { setCreating(true); setTitle(""); setIntent("understand"); }}>{he ? "+ שאלה חדשה" : "+ New question"}</button>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3">
        <label htmlFor="family-question-title" className="block font-semibold text-sm">{he ? "במילים שלכם" : "In your words"}</label>
        <textarea id="family-question-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={160} required rows={2}
          placeholder={he ? "למשל: איך להפוך את הבוקר לזמן נעים יותר?" : "For example: How could mornings feel easier?"}
          className="w-full rounded-xl p-3 text-base" style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}/>
        <fieldset><legend className="text-sm mb-2">{he ? "מה הייתם רוצים?" : "What would you like?"}</legend>
          <div className="flex flex-wrap gap-2">{([
            { id: "understand", en: "Understand", he: "להבין" }, { id: "support", en: "Find a way forward", he: "למצוא דרך" }, { id: "enjoy", en: "Enjoy together", he: "ליהנות יחד" },
          ] as const).map(option => <button key={option.id} type="button" className={button} aria-pressed={intent === option.id} onClick={() => setIntent(option.id)}
            style={{ background: intent === option.id ? "var(--arbor-clay-dim)" : "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>{he ? option.he : option.en}</button>)}</div>
        </fieldset>
        <button type="submit" disabled={busy || !title.trim()} className={button} style={{ background: "var(--arbor-clay)", color: "var(--arbor-on-accent)" }}>
          {busy ? (he ? "שומרים…" : "Saving…") : creating ? (he ? "לשמור את השאלה" : "Keep this question") : (he ? "לשמור שינוי" : "Save changes")}</button>
        {error && <p role="alert" className="text-sm">{he ? "השינוי לא נשמר. אפשר לנסות שוב." : "That change wasn’t saved. Please try again."}</p>}
      </form>
      {topic && <>
        <div className="grid gap-5" style={{ borderTop: "1px solid var(--arbor-rule)", paddingTop: 20 }}>
          <section><h3 className="font-semibold flex items-center gap-2"><Icon name="edit_note" size={20}/>{he ? "מה תיעדנו" : "What we recorded"}</h3>
            {evidence.length ? evidence.map(item => <p key={item.id} className="mt-3 text-sm leading-relaxed" dir="auto"><time className="block text-xs" dateTime={item.at}>{new Date(item.at).toLocaleDateString(he ? "he-IL" : "en-GB")}</time>{sourceLabel(item, he)}</p>) : <p className="mt-2 text-sm" style={{ color: "var(--arbor-muted)" }}>{he ? "אין תיעוד מקושר כרגע. אפשר להתחיל משאלה בלבד." : "No linked records yet. A question is enough to start."}</p>}
            <button className={button} onClick={() => { onClose(); setActiveTab("development"); }}>{he ? "לתמונה השלמה" : "See the whole picture"}</button>
          </section>
          <section><h3 className="font-semibold">{he ? "מה בחרנו לנסות" : "What we chose to try"}</h3>
            {actions.length ? actions.slice(0, 8).map(item => <div key={item.id} className="py-3 text-sm" style={{ borderBottom: "1px solid var(--arbor-rule)" }}><p dir="auto">{item.recommendation}</p><p className="mt-1 text-xs" style={{ color: "var(--arbor-muted)" }}>{item.outcome ? (he ? { helped: "דיווחתם שעזר", somewhat: "דיווחתם שעזר קצת", not_today: "לא התאים הפעם" } : { helped: "You said it helped", somewhat: "You said it helped a little", not_today: "Not this time" })[item.outcome] : he ? "עדיין לא שיתפתם איך היה" : "You haven’t shared how it went yet"}</p></div>) : <p className="mt-2 text-sm" style={{ color: "var(--arbor-muted)" }}>{he ? "כשתבחרו צעד, הוא יופיע כאן." : "A step you choose will appear here."}</p>}
          </section>
          <section><h3 className="font-semibold">{he ? "השיחות שלנו" : "Our conversations"}</h3>
            {threads.map(thread => <button key={thread.id} className={`${button} block w-full`} onClick={() => { openConversation(thread.id); onClose(); setActiveTab("coach"); }}>{thread.title}</button>)}
            <button className={`${button} mt-2`} style={{ background: "var(--arbor-clay-dim)", color: "var(--arbor-clay-deep)" }} onClick={() => { newConversation(); seedCoach({ prompt: topic.title, source: "family-topic" }); onClose(); }}>{he ? "לדבר על זה עם Arbor" : "Talk this through with Arbor"}</button>
          </section>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={button} onClick={() => { selectFamilyTopic(null); onClose(); }}>{he ? "להניח בצד בינתיים" : "Set aside for now"}</button>
          <button disabled={busy} className={button} onClick={async () => { setBusy(true); try { await updateFamilyTopic(topic.id, { status: "archived" }); onClose(); } catch { setError(true); } finally { setBusy(false); } }}>{he ? "סיימנו לעסוק בזה" : "We’re done with this question"}</button>
        </div>
      </>}
    </div>
  </Sheet>;
}
