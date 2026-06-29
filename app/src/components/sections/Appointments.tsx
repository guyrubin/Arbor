import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PageHeader, SectionCard, cardCls, Chip, ComingSoon } from "../ui/kit";

type Appt = { id: string; who: string; role: string; when: string; mode: string };
type PrepQuestion = { id: string; text: string };

/** Care Network › Appointments — persisted per child (Firestore when authed,
 *  localStorage in sandbox) so nothing is lost on refresh. */
export default function Appointments() {
  const { setActiveTab, childProfile } = useArbor();
  const { t } = useLanguage();
  const apptsCol = useChildCollection<Appt>(childProfile.id, "appointments");
  const questionsCol = useChildCollection<PrepQuestion>(childProfile.id, "apptQuestions");
  const appts = useMemo(() => [...apptsCol.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [apptsCol.items]);
  const questions = useMemo(() => [...questionsCol.items].sort((a, b) => (a.id < b.id ? -1 : 1)), [questionsCol.items]);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ who: "", role: "", when: "" });
  const [q, setQ] = useState("");

  const addAppt = () => {
    if (!form.who.trim()) return;
    void apptsCol.upsert({ id: `a${Date.now()}`, who: form.who, role: form.role || "Professional", when: form.when || "TBD", mode: "Online" });
    setForm({ who: "", role: "", when: "" });
    setAdding(false);
  };
  const addQ = () => { if (q.trim()) { void questionsCol.upsert({ id: `q${Date.now()}`, text: q.trim() }); setQ(""); } };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[980px]">
      <PageHeader
        eyebrow="Care Network"
        title={t("sec.appt.title")}
        subtitle={t("sec.appt.sub")}
        action={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
            <Icon name="add" size={18} /> Add appointment
          </button>
        }
      />

      {adding && (
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>New appointment</h3>
            <button onClick={() => setAdding(false)} aria-label={t("aria.cancel")}><Icon name="close" size={17} style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={form.who} onChange={(e) => setForm({ ...form, who: e.target.value })} placeholder="Professional name" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role (e.g. Speech Therapist)" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} placeholder="When (e.g. Mon 9 Jun · 10:00)" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          </div>
          <button onClick={addAppt} className="mt-3 inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5" style={{ background: "var(--arbor-clay)" }}>Save</button>
        </div>
      )}

      <SectionCard title="Upcoming" icon={<Icon name="calendar_month" size={20} />} tone="sky">
        {appts.length ? (
          <div className="space-y-3">
            {appts.map((a) => (
              <div key={a.id} className={`${cardCls} p-4 flex items-center justify-between gap-4`}>
                <div>
                  <h3 className="text-sm font-extrabold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{a.who}</h3>
                  <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{a.role} · {a.mode}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Chip tone="sky">{a.when}</Chip>
                  <button onClick={() => void apptsCol.remove(a.id)} aria-label={t("aria.removeAppointment")}><Icon name="delete" size={16} style={{ color: "var(--arbor-muted)" }} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No appointments scheduled.</p>}
      </SectionCard>

      <SectionCard title="Prepare your questions" icon={<Icon name="help" size={20} />} tone="mint">
        <ul className="space-y-2 mb-3">
          {questions.length === 0 && <li className="text-sm" style={{ color: "var(--arbor-muted)" }}>Add a question you want to ask at the next session.</li>}
          {questions.map((qq) => (
            <li key={qq.id} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--arbor-ink)" }}>
              <Icon name="check_circle" size={16} fill={1} className="mt-0.5" style={{ color: "var(--arbor-green-ink)" }} /> <span className="flex-1">{qq.text}</span>
              <button onClick={() => void questionsCol.remove(qq.id)} aria-label={t("aria.removeQuestion")}><Icon name="close" size={16} style={{ color: "var(--arbor-muted)" }} /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addQ()} placeholder="Add a question to ask…" className="flex-1 rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          <button onClick={addQ} className="inline-flex items-center gap-1 font-bold text-sm rounded-xl px-4" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}><Icon name="add" size={18} /> Add</button>
        </div>
        <button onClick={() => setActiveTab("reports")} className="mt-3 inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-2.5" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <Icon name="description" size={18} /> Share an Arbor summary
        </button>
      </SectionCard>

      <div className={`${cardCls} p-5 flex flex-wrap items-center gap-3`}>
        <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>Coming later:</span>
        <ComingSoon label="Booking" /><ComingSoon label="Payment" /><ComingSoon label="Reminders" /><ComingSoon label="Video consultation" /><ComingSoon label="Insurer routing" />
      </div>
    </motion.div>
  );
}
