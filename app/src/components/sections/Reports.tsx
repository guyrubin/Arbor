import React from "react";
import { motion } from "motion/react";
import { FileBarChart, Download, FileText } from "lucide-react";
import { PageHeader, SectionCard, cardCls, PASTEL, PastelKey } from "../ui/kit";
import { useArbor } from "../../context/ArborContext";

const REPORTS: { title: string; desc: string; tone: PastelKey }[] = [
  { title: "Weekly Insight PDF", desc: "This week's summary for your records or to share.", tone: "mint" },
  { title: "Teacher Handoff PDF", desc: "Classroom-ready context, what helps and what escalates.", tone: "sky" },
  { title: "Therapist Summary PDF", desc: "Concern, timeline, patterns and tried interventions.", tone: "lav" },
  { title: "Pediatrician Summary PDF", desc: "Duration, frequency, milestones — no-diagnosis framing.", tone: "coral" },
  { title: "Development Snapshot PDF", desc: "A point-in-time picture of Dylan's development.", tone: "yellow" },
  { title: "Behavior Pattern Report PDF", desc: "Triggers, intensity and recovery over time.", tone: "pink" },
  { title: "Language Transition Note PDF", desc: "Home/school languages, comfort and useful phrases.", tone: "sky" },
  { title: "Growth Plan Progress PDF", desc: "Plan steps completed and what's next.", tone: "mint" },
];

/** Care Network › Reports — exportable artifacts only. "Report" lives here; the
 *  parent-facing analytics live as "Weekly Insight" under Child Intelligence. */
export default function Reports() {
  const { childProfile } = useArbor();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Care Network" title="Reports" subtitle={`Export ${childProfile.name.split(" ")[0]}'s information as a clean, shareable PDF for teachers, therapists and doctors.`} />
      <SectionCard title="Exportable reports" icon={<FileBarChart className="w-5 h-5" />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-3">
          {REPORTS.map((r) => (
            <div key={r.title} className={`${cardCls} p-4 flex items-start gap-3`}>
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0" style={{ background: PASTEL[r.tone].soft, color: PASTEL[r.tone].ink }}><FileText className="w-4.5 h-4.5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{r.title}</h3>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{r.desc}</p>
              </div>
              <button className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold rounded-lg px-2.5 py-1.5" style={{ background: "var(--arbor-paper-deep)", color: "#1f8a5a" }}>
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </motion.div>
  );
}
