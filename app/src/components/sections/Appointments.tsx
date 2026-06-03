import React from "react";
import { motion } from "motion/react";
import { Calendar, Plus, HelpCircle, FileText, MessageSquarePlus, CheckCircle2 } from "lucide-react";
import { PageHeader, SectionCard, cardCls, Chip, ComingSoon } from "../ui/kit";

const UPCOMING = [
  { who: "Dr. Maya Levi", role: "Child Psychologist", when: "Thu, 12 Jun · 16:00", mode: "Online" },
];

const ACTIONS = [
  { icon: <Plus className="w-4 h-4" />, label: "Add appointment" },
  { icon: <HelpCircle className="w-4 h-4" />, label: "Prepare questions" },
  { icon: <FileText className="w-4 h-4" />, label: "Share Arbor summary" },
  { icon: <MessageSquarePlus className="w-4 h-4" />, label: "Add professional feedback" },
  { icon: <CheckCircle2 className="w-4 h-4" />, label: "Follow up after session" },
];

/** Care Network › Appointments (early implementation). */
export default function Appointments() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[980px]">
      <PageHeader eyebrow="Care Network" title="Appointments" subtitle="Prepare for sessions, share context, and capture follow-ups — so every appointment moves Dylan forward." />

      <SectionCard title="Upcoming" icon={<Calendar className="w-5 h-5" />} tone="sky">
        {UPCOMING.length ? UPCOMING.map((a) => (
          <div key={a.who} className={`${cardCls} p-4 flex items-center justify-between gap-4`}>
            <div>
              <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{a.who}</h3>
              <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{a.role} · {a.mode}</p>
            </div>
            <Chip tone="sky">{a.when}</Chip>
          </div>
        )) : <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No appointments scheduled.</p>}
      </SectionCard>

      <SectionCard title="Session toolkit" icon={<MessageSquarePlus className="w-5 h-5" />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-3">
          {ACTIONS.map((a) => (
            <button key={a.label} className="inline-flex items-center gap-2.5 text-sm font-bold rounded-xl px-4 py-3 text-left" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}>
              <span style={{ color: "#1f8a5a" }}>{a.icon}</span> {a.label}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className={`${cardCls} p-5 flex flex-wrap items-center gap-3`}>
        <span className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>Coming later:</span>
        <ComingSoon label="Booking" /><ComingSoon label="Payment" /><ComingSoon label="Reminders" /><ComingSoon label="Video consultation" /><ComingSoon label="Insurer routing" />
      </div>
    </motion.div>
  );
}
