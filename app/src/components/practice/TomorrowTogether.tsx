import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { useArbor } from "../../context/ArborContext";
import { comparisonMonthsOf } from "../../lib/age/forChild";
import { fitsTomorrowKit, TOMORROW_KITS, type TomorrowKit } from "../../content/tomorrowTogether";
import { Modal } from "../ui/Modal";

/** Quiet, original vector scenes in the parent register; no child likeness. */
function Scene({ kit, step, label }: { kit: TomorrowKit["id"]; step: number; label: string }) {
  const person = (x: number, y: number, scale: number, accent: string) => <g transform={`translate(${x} ${y}) scale(${scale})`} fill="none" stroke="var(--arbor-ink)" strokeWidth="3" strokeLinecap="round"><circle cy="-36" r="12" fill="var(--arbor-paper-elevated)" /><path d="M-14 4 Q-19-18 0-20 Q19-18 14 4 Z" fill={accent} /><path d="M-8 5 L-10 26 M8 5 L10 26 M-15-9 L-25 2 M15-9 L25 2" /></g>;
  return <svg viewBox="0 0 320 170" role="img" aria-label={label} className="w-full rounded-[var(--r)]" style={{ background: "var(--arbor-paper-deep)" }}>
    <path d="M24 144 H296" stroke="var(--arbor-rule-strong)" strokeWidth="2" />
    {kit === "goodbye" ? <>
      <path d="M214 143 V30 H284 V143 M264 89 h4" fill="var(--arbor-paper-elevated)" stroke="var(--arbor-rule-strong)" strokeWidth="3" />
      {person(step === 1 ? 66 : 116, 98, 1.35, "var(--arbor-clay-soft)")}{person(171, 121, .76, "var(--arbor-clay-soft)")}
      {step === 1 && person(248, 97, 1.35, "var(--arbor-green-soft)")}
      {step === 2 && <path d="M136 104 Q154 115 173 116" fill="none" stroke="var(--arbor-ink)" strokeWidth="3" />}
    </> : <>
      {person(78, 104, 1.25, "var(--arbor-clay-soft)")}{person(step === 1 || (kit === "joining" && step === 2) ? 126 : 153, 122, .72, "var(--arbor-clay-soft)")}{person(247, 122, .72, "var(--arbor-green-soft)")}
      {kit === "turns" ? <circle cx={step === 2 ? 167 : 225} cy="135" r="10" fill="var(--arbor-clay-soft)" stroke="var(--arbor-ink)" strokeWidth="2" /> : <g fill="var(--arbor-paper-elevated)" stroke="var(--arbor-ink)" strokeWidth="2"><rect x="180" y="125" width="20" height="18" rx="2" /><rect x="202" y="125" width="20" height="18" rx="2" /><rect x="190" y="106" width="20" height="18" rx="2" /></g>}
      {step === 1 && <path d="M166 75 Q192 53 218 75" fill="none" stroke="var(--arbor-rule-strong)" strokeWidth="2" strokeDasharray="4 5" />}
      {kit === "joining" && step === 2 && <g fill="var(--arbor-paper-elevated)" stroke="var(--arbor-ink)" strokeWidth="2"><path d="M46 65 L73 58 L99 66 L98 90 L73 82 L48 89 Z M73 58 V82" /><path d="M103 113 Q114 99 126 111" fill="none" /></g>}
    </>}
  </svg>;
}
export default function TomorrowTogether() {
  const { uiLang } = useLanguage();
  const { childProfile } = useArbor();
  const lang = uiLang === "he" ? "he" : "en";
  const text = (en: string, he: string) => lang === "he" ? he : en;
  const [choice, setChoice] = useState<{ childId: string; id: string; step: number } | null>(null);
  const kit = choice?.childId === childProfile.id ? TOMORROW_KITS.find(k => k.id === choice.id) : undefined;
  const step = choice?.step ?? 0;
  if (!fitsTomorrowKit(comparisonMonthsOf(childProfile))) return null;
  const button = "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold";
  const style = { borderColor: "var(--arbor-rule)", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)" };
  return <details data-testid="tomorrow-together" className="mb-5 rounded-[var(--r-lg)] border p-5 sm:p-6" style={{ ...style, background: "var(--arbor-paper)" }}>
    <summary className="min-h-11 cursor-pointer">
    <p className="text-xs font-semibold" style={{ color: "var(--arbor-muted)" }}>{text("A LITTLE REHEARSAL, TOGETHER", "מתכוננים קצת, יחד")}</p>
    <h2 className="mt-2 text-2xl" style={{ fontFamily: "var(--font-display)" }}>{text("Make tomorrow feel familiar", "כדי שמחר יהיה קצת יותר מוכר")}</h2>
    </summary>
    <p className="mt-2 text-sm leading-relaxed">{text("Three pictures and words to borrow. A grown-up leads; your child can join, watch or stop.", "שלוש תמונות ומשפטים שאפשר לאמץ. אתם מובילים; הילד או הילדה יכולים להצטרף, להסתכל או לעצור.")}</p>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">{TOMORROW_KITS.map(k => <button key={k.id} type="button" className={button} style={style} onClick={() => setChoice({ childId: childProfile.id, id: k.id, step: 0 })}>{k.title[lang]}</button>)}</div>
    <Modal open={!!kit} onClose={() => setChoice(null)} title={kit?.title[lang]}>
      {kit && <div dir={lang === "he" ? "rtl" : "ltr"} lang={lang}>
        <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{kit.intro[lang]}</p>
        <Scene kit={kit.id} step={step} label={kit.scenes[step].story[lang]} />
        <div aria-live="polite" aria-atomic="true">
          <p className="mt-4 text-xs" style={{ color: "var(--arbor-muted)" }}>{text(`Picture ${step + 1} of 3`, `תמונה ${step + 1} מתוך 3`)}</p>
          <h3 className="mt-1 text-xl" style={{ fontFamily: "var(--font-display)" }}>{kit.scenes[step].title[lang]}</h3>
          <p className="mt-2 leading-relaxed">{kit.scenes[step].story[lang]}</p>
          <blockquote className="my-4 border-s-2 ps-4 text-lg leading-relaxed" style={{ borderColor: "var(--arbor-clay)", fontFamily: "var(--font-display)" }}>“{kit.scenes[step].say[lang]}”</blockquote>
        </div>
        {step === 2 && <p className="rounded-[var(--r)] p-3 text-sm leading-relaxed" style={{ background: "var(--arbor-paper-deep)" }}>{kit.play[lang]}<br />{text("Watching is enough. You can leave it here.", "גם להסתכל זה בסדר. אפשר לסיים כאן.")}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {step > 0 && <button type="button" className={button} style={style} onClick={() => setChoice({ childId: childProfile.id, id: kit.id, step: step - 1 })}>{text("Previous picture", "לתמונה הקודמת")}</button>}
          {step < 2 && <button type="button" className={button} style={{ background: "var(--arbor-ink)", color: "var(--arbor-on-accent)" }} onClick={() => setChoice({ childId: childProfile.id, id: kit.id, step: step + 1 })}>{text("Next picture", "לתמונה הבאה")}</button>}
          <button type="button" className={button} style={style} onClick={() => setChoice(null)}>{text("Leave it here", "נסיים כאן")}</button>
        </div>
      </div>}
    </Modal>
  </details>;
}
