import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ScrollText, ListChecks, BookOpen, ShieldCheck, CalendarHeart, Plus, X, ChevronDown, type LucideIcon } from "lucide-react";
import { PageHeader, SectionCard, cardCls, IconBadge, type PastelKey } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";
import { FAMILY_RITUALS, type FamilyRitual } from "../../lib/familyRituals";
import type { FrameId } from "../../lib/masterclasses";

const RITUAL_ICON: Record<string, LucideIcon> = {
  "truth-practice-weekly": ShieldCheck,
  "responsibility-ladder": ListChecks,
  "family-story-canon": BookOpen,
  "weekly-reflection-sunday-reset": CalendarHeart,
};
const FRAME_TONE: Record<FrameId, PastelKey> = {
  aim: "sky", twoAxes: "mint", story: "lav", shadow: "coral", marriage: "pink", shepherd: "yellow",
};

const KEY = "arbor.familyCharter";
const DEFAULT = ["Courage", "Honesty", "Responsibility", "Kindness"];

/** Arbor Academy › Family Formation. The Family Charter is a real, persisted tool;
 *  the rituals are real, repeatable practices (family as the first institution). */
export default function FamilyFormation() {
  const { t, aiLang } = useLanguage();
  const he = aiLang === "he";
  const [values, setValues] = useState<string[]>(DEFAULT);
  const [input, setInput] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setValues(JSON.parse(raw)); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* ignore */ }
  }, [values]);

  const add = () => { const v = input.trim(); if (v && !values.includes(v)) { setValues((p) => [...p, v]); setInput(""); } };
  const remove = (v: string) => setValues((p) => p.filter((x) => x !== v));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader title={t("sec.family.title")} subtitle={t("sec.family.sub")} />

      {/* Family Charter — the real, editable tool (names the family's aim) */}
      <SectionCard title={he ? "מגילת המשפחה" : "Family Charter"} icon={<ScrollText className="w-5 h-5" />} tone="mint">
        <p className="text-sm mb-4" dir="auto" style={{ color: "var(--arbor-muted)" }}>
          {he
            ? "תנו שם לערכים שאתם מגדלים סביבם את המשפחה. ארבור משתמש בהם כדי לשמור שההכוונה והסיפורים נשארים מחוברים למה שחשוב לכם."
            : "Name the values you're forming your family around. Arbor uses these to keep guidance and stories aligned with what matters to you."}
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold" dir="auto" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
              {v}
              <button onClick={() => remove(v)} aria-label={`Remove ${v}`}><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          {values.length === 0 && <span className="text-sm" style={{ color: "var(--arbor-muted)" }}>{he ? "הוסיפו ערך כדי להתחיל." : "Add a value to begin your charter."}</span>}
        </div>
        <div className="flex gap-2 max-w-md">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={he ? "הוסיפו ערך (למשל סבלנות)…" : "Add a value (e.g. Patience)…"} dir="auto" className="flex-1 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <button onClick={add} className="inline-flex items-center gap-1 font-bold text-sm rounded-xl px-4 text-white" style={{ background: "var(--arbor-clay)" }}><Plus className="w-4 h-4" /> {he ? "הוסיפו" : "Add"}</button>
        </div>
      </SectionCard>

      {/* Family rituals — real, repeatable practices */}
      <div>
        <h2 className="text-[15px] font-extrabold mb-3" style={{ color: "var(--arbor-ink)" }}>{he ? "טקסי משפחה" : "Family rituals"}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FAMILY_RITUALS.map((r) => {
            const Icon = RITUAL_ICON[r.id] ?? ScrollText;
            const isOpen = openId === r.id;
            return (
              <div key={r.id} className={`${cardCls} p-5`}>
                <button onClick={() => setOpenId(isOpen ? null : r.id)} className="w-full flex items-start gap-4 text-left">
                  <IconBadge tone={FRAME_TONE[r.frame]}><Icon className="w-5 h-5" /></IconBadge>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-extrabold flex items-center justify-between gap-2" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                      <span>{he ? r.titleHe : r.title}</span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--arbor-muted)" }} />
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed" dir="auto" style={{ color: "var(--arbor-muted)" }}>{he ? r.purposeHe : r.purpose}</p>
                    <span className="inline-block text-[10.5px] font-bold mt-2 px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{he ? r.cadenceHe : r.cadence}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                    <ol className="space-y-2">
                      {(he ? r.stepsHe : r.steps).map((s, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[13px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink-soft)" }}>
                          <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold text-white" style={{ background: "var(--arbor-clay)" }}>{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="rounded-xl p-3" style={{ background: "var(--arbor-green-soft)" }}>
                      <p className="text-[10.5px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--arbor-green-ink)" }}>{he ? "למה זה חשוב" : "Why it matters"}</p>
                      <p className="text-[12.5px] leading-relaxed" dir="auto" style={{ color: "var(--arbor-ink)" }}>{he ? r.whyHe : r.why}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
