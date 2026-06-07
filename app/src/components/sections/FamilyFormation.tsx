import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ScrollText, Repeat, ListChecks, MessageSquareHeart, BookOpen, ShieldCheck, CalendarHeart, Sparkles, Plus, X } from "lucide-react";
import { PageHeader, SectionCard, cardCls, IconBadge, ComingSoon, PastelKey } from "../ui/kit";

const ITEMS: { title: string; desc: string; icon: React.ReactNode; tone: PastelKey; soon?: boolean }[] = [
  { title: "Rituals", desc: "Small repeatable moments that carry meaning and safety.", icon: <Repeat className="w-5 h-5" />, tone: "lav" },
  { title: "Responsibility Ladder", desc: "Age-appropriate responsibilities that build competence.", icon: <ListChecks className="w-5 h-5" />, tone: "yellow" },
  { title: "Hard Conversations", desc: "Scaffolded scripts for the talks that matter.", icon: <MessageSquareHeart className="w-5 h-5" />, tone: "coral" },
  { title: "Family Story Canon", desc: "The stories your family tells about who you are.", icon: <BookOpen className="w-5 h-5" />, tone: "sky" },
  { title: "Truth Practice", desc: "Building honesty and repair as a family habit.", icon: <ShieldCheck className="w-5 h-5" />, tone: "mint" },
  { title: "Weekly Reflection", desc: "A short rhythm to notice growth and reset.", icon: <CalendarHeart className="w-5 h-5" />, tone: "lav" },
  { title: "Co-parent Alignment", desc: "Stay on the same page with your partner.", icon: <Sparkles className="w-5 h-5" />, tone: "pink", soon: true },
];

const KEY = "arbor.familyCharter";
const DEFAULT = ["Courage", "Honesty", "Responsibility", "Kindness"];

/** Arbor Academy › Family Formation. The Family Charter is a real, persisted tool. */
export default function FamilyFormation() {
  const [values, setValues] = useState<string[]>(DEFAULT);
  const [input, setInput] = useState("");

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
      <PageHeader eyebrow="Arbor Academy" title="Family formation" subtitle="The long game: values, rituals and stories that form a family over years, not days." />

      {/* Family Charter — the real, editable tool */}
      <SectionCard title="Family Charter" icon={<ScrollText className="w-5 h-5" />} tone="mint">
        <p className="text-sm mb-4" style={{ color: "var(--arbor-muted)" }}>Name the values you're forming your family around. Arbor uses these to keep guidance and stories aligned with what matters to you.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>
              {v}
              <button onClick={() => remove(v)} aria-label={`Remove ${v}`}><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
          {values.length === 0 && <span className="text-sm" style={{ color: "var(--arbor-muted)" }}>Add a value to begin your charter.</span>}
        </div>
        <div className="flex gap-2 max-w-md">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add a value (e.g. Patience)…" className="flex-1 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <button onClick={add} className="inline-flex items-center gap-1 font-bold text-sm rounded-xl px-4 text-white" style={{ background: "#34b277" }}><Plus className="w-4 h-4" /> Add</button>
        </div>
      </SectionCard>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ITEMS.map((it) => (
          <div key={it.title} className={`${cardCls} p-5 flex items-start gap-4`}>
            <IconBadge tone={it.tone}>{it.icon}</IconBadge>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
                {it.title} <ComingSoon label="Coming soon" />
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
