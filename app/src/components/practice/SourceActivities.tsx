import React, { useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { availableSourceActivities, sourceActivityForLog } from "../../content/sourceActivities";
import { Icon } from "../ui/Icon";
import { dayKey } from "../../practice/signals";

export default function SourceActivities() {
  const { childProfile, logPlayCompletion, playLogs } = useArbor();
  const today = dayKey(new Date());
  const donePlayIds = playLogs.filter(p => dayKey(new Date(p.timestamp)) === today).map(p => p.activityId);
  const { uiLang } = useLanguage();
  const lang = uiLang === "he" ? "he" : "en";
  const text = (en: string, he: string) => lang === "he" ? he : en;
  const [selected, setSelected] = useState<{ childId: string; id: string } | null>(null);
  const cards = availableSourceActivities(comparisonMonthsOf(childProfile));
  if (!cards.length) return null;
  const current = cards.find(c => c.id === (selected?.childId === childProfile.id ? selected.id : null)) ?? cards[0];
  return <details data-testid="source-activities" className="rounded-[var(--r-lg)] border p-5 sm:p-6" style={{ borderColor: "var(--arbor-rule)", background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)" }}>
    <summary className="min-h-11 cursor-pointer">
    <p className="text-xs font-semibold tracking-wide" style={{ color: "var(--arbor-muted)" }}>{text("IDEAS FOR EVERYDAY MOMENTS", "רעיונות לרגעים של יום־יום")}</p>
    <h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-display)" }}>{text("A small idea to try together", "רעיון קטן לזמן יחד")}</h2>
    </summary>
    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{text("Arbor's editorial pilot, informed by Ministry of Health guidance. These adaptations have not been clinically reviewed; no official affiliation.", "פיילוט תוכן של Arbor בהשראת הנחיות משרד הבריאות. העיבוד לפעילויות טרם עבר סקירה קלינית; אין שיתוף פעולה רשמי.")}</p>
    <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={text("Choose an activity", "בחירת פעילות")}>
      {cards.map(c => <button type="button" key={c.id} aria-pressed={c.id === current.id} onClick={() => setSelected({ childId: childProfile.id, id: c.id })} className="min-h-11 rounded-full border px-4 py-2 text-sm" style={{ borderColor: "var(--arbor-rule)", background: c.id === current.id ? "var(--arbor-ink)" : "var(--arbor-paper)", color: c.id === current.id ? "var(--arbor-on-accent)" : "var(--arbor-ink)" }}>{c.title[lang]}</button>)}
    </div>
    <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--arbor-rule)" }} aria-live="polite">
      <h3 className="text-lg font-semibold">{current.title[lang]}</h3>
      <p className="mt-2 text-base leading-relaxed">{current.do[lang]}</p>
      <blockquote className="my-4 border-s-2 ps-4 text-xl leading-relaxed" style={{ borderColor: "var(--arbor-clay)", fontFamily: "var(--font-display)" }}>“{current.say[lang]}”</blockquote>
      <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{current.materials[lang]} · {text("About five minutes. Stop whenever you like.", "כחמש דקות. אפשר לעצור בכל רגע.")}</p>
      <button type="button" disabled={donePlayIds.includes(current.id)} onClick={() => logPlayCompletion(sourceActivityForLog(current, lang), "library")} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold disabled:opacity-60" style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }}>
        <Icon name={donePlayIds.includes(current.id) ? "check" : "add"} size={18} aria-hidden />{donePlayIds.includes(current.id) ? text("Saved to today's moments", "נשמר ברגעים של היום") : text("We tried this", "ניסינו יחד")}
      </button>
      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}><a href={current.source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">{text("Read the Ministry of Health source", "למקור באתר משרד הבריאות")}</a><br />{text("Source checked: 8 October 2026", "המקור נבדק: 8 באוקטובר 2026")}</p>
    </div>
  </details>;
}
