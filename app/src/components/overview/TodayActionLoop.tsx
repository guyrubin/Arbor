import React, { useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { capacityMinutes, type ActionCapacity, type ActionOutcome } from "../../actionLoop/model";

export default function TodayActionLoop({ recommendation }: { recommendation: string }) {
  const { activeTodayAction, acceptTodayAction, recordTodayOutcome, removeTodayAction } = useArbor();
  const { uiLang } = useLanguage();
  const [capacity, setCapacity] = useState<ActionCapacity>("standard");
  const he = uiLang === "he";
  const copy = he ? {
    eyebrow: "הצעד של היום", title: "הפכו את ההמלצה לצעד קטן", body: "בחרו כמה מקום יש לכם היום. אפשר לשנות או להסיר בכל רגע.", make: "בחירת הצעד", tried: "מה קרה כשניסיתם?", helped: "עזר", somewhat: "קצת", notToday: "לא היום", receipt: "נרשם לפי הדיווח שלכם", adapt: "Arbor ישתמש בתוצאה כדי לדייק את הצעד הבא — בלי לתת ציון לילד.", remove: "הסרה",
  } : {
    eyebrow: "Today's step", title: "Turn the guidance into one small action", body: "Choose what fits today. You can change course or remove it at any time.", make: "Make this today's step", tried: "What happened when you tried it?", helped: "Helped", somewhat: "A little", notToday: "Not today", receipt: "Saved as your report", adapt: "Arbor will use this outcome to shape the next step — never to score your child.", remove: "Remove",
  };

  if (!activeTodayAction) return (
    <section className="rounded-[20px] bg-white p-5 sm:p-6" style={{ border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }} aria-labelledby="today-action-title">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name="task_alt" size={19} /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{copy.eyebrow}</p><h2 id="today-action-title" className="mt-1 text-lg font-bold leading-tight" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{copy.title}</h2><p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.body}</p></div></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="inline-flex rounded-xl p-1" style={{ background: "var(--arbor-paper-deep)" }} aria-label={he ? "משך הצעד" : "Action length"}>{(["tiny", "standard", "roomy"] as ActionCapacity[]).map((value) => <button key={value} type="button" onClick={() => setCapacity(value)} aria-pressed={capacity === value} className="min-h-10 rounded-lg px-3 text-xs font-bold transition" style={{ background: capacity === value ? "white" : "transparent", color: capacity === value ? "var(--arbor-ink)" : "var(--arbor-muted)", boxShadow: capacity === value ? "var(--shadow-xs)" : "none" }}>{capacityMinutes[value]} {he ? "דק׳" : "min"}</button>)}</div><button type="button" onClick={() => acceptTodayAction(recommendation, capacity)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-extrabold text-white transition active:scale-[0.98]" style={{ background: "var(--arbor-gradient-primary)" }}>{copy.make}<Icon name="arrow_forward" size={17} className="rtl:-scale-x-100" /></button></div>
    </section>
  );

  const outcomes: { value: ActionOutcome; label: string }[] = [{ value: "helped", label: copy.helped }, { value: "somewhat", label: copy.somewhat }, { value: "not_today", label: copy.notToday }];
  return (
    <section className="rounded-[20px] bg-white p-5 sm:p-6" style={{ border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }} aria-labelledby="active-action-title">
      <div className="flex items-start gap-3"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}><Icon name={activeTodayAction.status === "completed" ? "verified" : "task_alt"} size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{copy.eyebrow} · {capacityMinutes[activeTodayAction.capacity]} {he ? "דק׳" : "min"}</p><button type="button" onClick={() => removeTodayAction(activeTodayAction.id)} className="min-h-9 px-2 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{copy.remove}</button></div><h2 id="active-action-title" className="mt-1 text-lg font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>{activeTodayAction.recommendation}</h2></div></div>
      {activeTodayAction.status === "accepted" ? <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--arbor-rule)" }}><p className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{copy.tried}</p><div className="mt-2 grid grid-cols-3 gap-2">{outcomes.map(({ value, label }) => <button key={value} type="button" onClick={() => recordTodayOutcome(activeTodayAction.id, value)} className="min-h-11 rounded-xl px-2 text-xs font-bold transition active:scale-[0.98]" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "var(--arbor-paper-elevated)" }}>{label}</button>)}</div></div> : <div className="mt-4 flex items-start gap-3 rounded-xl p-3.5" style={{ background: "var(--arbor-green-soft)" }} role="status"><Icon name="check_circle" size={18} style={{ color: "var(--arbor-green-ink)" }} /><div><p className="text-xs font-extrabold" style={{ color: "var(--arbor-green-ink)" }}>{copy.receipt}</p><p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{copy.adapt}</p></div></div>}
    </section>
  );
}
