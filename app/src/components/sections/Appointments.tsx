import React, { useState } from "react";
import { motion } from "motion/react";
import { Calendar, Plus, HelpCircle, FileText, CheckCircle2, X, Trash2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, cardCls, Chip, ComingSoon } from "../ui/kit";

type Appt = { id: string; who: string; role: string; when: string; mode: string };

/** Care Network › Appointments (early implementation, client-side). */
export default function Appointments() {
  const { setActiveTab } = useArbor();
  const [appts, setAppts] = useState<Appt[]>([
    { id: "a0", who: "Dr. Maya Levi", role: "Child Psychologist", when: "Thu, 12 Jun · 16:00", mode: "Online" },
  ]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ who: "", role: "", when: "" });
  const [questions, setQuestions] = useState<string[]>([
    "How can we support transitions at home and school consistently?",
    "What signs would suggest we should seek further assessment?",
  ]);
  const [q, setQ] = useState("");

  const addAppt = () => {
    if (!form.who.trim()) return;
    setAppts((p) => [...p, { id: `a${Date.now()}`, who: form.who, role: form.role || "Professional", when: form.when || "TBD", mode: "Online" }]);
    setForm({ who: "", role: "", when: "" });
    setAdding(false);
  };
  const addQ = () => { if (q.trim()) { setQuestions((p) => [...p, q.trim()]); setQ(""); } };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[980px]">
      <PageHeader
        eyebrow="Care Network"
        title="Appointments"
        subtitle="Prepare for sessions, share context, and capture follow-ups — so every appointment moves your child forward."
        action={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
            <Plus className="w-4 h-4" /> Add appointment
          </button>
        }
      />

      {adding && (
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>New appointment</h3>
            <button onClick={() => setAdding(false)} aria-label="Cancel"><X className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} placeholder="Professional name" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role (e.g. Speech Therapist)" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} placeholder="When (e.g. Mon 9 Jun · 10:00)" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          </div>
          <button onClick={addAppt} className="mt-3 inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5" style={{ background: "#34b277" }}>Save</button>
        </div>
      )}

      <SectionCard title="Upcoming" icon={<Calendar className="w-5 h-5" />} tone="sky">
        {appts.length ? (
          <div className="space-y-3">
            {appts.map((a) => (
              <div key={a.id} className={`${cardCls} p-4 flex items-center justify-between gap-4`}>
                <div>
                  <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{a.who}</h3>
                  <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{a.role} · {a.mode}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="sky">{a.when}</Chip>
                  <button onClick={() => setAppts((p) => p.filter((x) => x.id !== a.id))} aria-label="Remove appointment"><Trash2 className="w-3.5 h-3.5" style={{ color: "var(--arbor-muted)" }} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No appointments scheduled.</p>}
      </SectionCard>

      <SectionCard title="Prepare your questions" icon={<HelpCircle className="w-5 h-5" />} tone="mint">
        <ul className="space-y-2 mb-3">
          {questions.map((qq, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#1f8a5a" }} /> <span className="flex-1">{qq}</span>
              <button onClick={() => setQuestions((p) => p.filter((_, j) => j !== i))} aria-label="Remove question"><X className="w-3.5 h-3.5" style={{ color: "var(--arbor-muted)" }} /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQ()} placeholder="Add a question to ask…" className="flex-1 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <button onClick={addQ} className="inline-flex items-center gap-1 font-bold text-sm rounded-xl px-4" style={{ background: "var(--arbor-paper-deep)", color: "#1f8a5a" }}><Plus className="w-4 h-4" /> Add</button>
        </div>
        <button onClick={() => setActiveTab("reports")} className="mt-3 inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-2.5" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>
          <FileText className="w-4 h-4" /> Share an Arbor summary
        </button>
      </SectionCard>

      <div className={`${cardCls} p-5 flex flex-wrap items-center gap-3`}>
        <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>Coming later:</span>
        <ComingSoon label="Booking" /><ComingSoon label="Payment" /><ComingSoon label="Reminders" /><ComingSoon label="Video consultation" /><ComingSoon label="Insurer routing" />
      </div>
    </motion.div>
  );
}
