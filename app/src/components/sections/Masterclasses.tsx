import React from "react";
import { motion } from "motion/react";
import { GraduationCap, Clock, PlayCircle } from "lucide-react";
import { PageHeader, cardCls, IconBadge, PASTEL, PastelKey } from "../ui/kit";

const CLASSES: { title: string; mins: number; tone: PastelKey }[] = [
  { title: "Holding the Line Without Anger", mins: 12, tone: "coral" },
  { title: "Building Responsibility by Age", mins: 10, tone: "mint" },
  { title: "What To Do When Your Child Refuses", mins: 9, tone: "yellow" },
  { title: "How to Repair After Conflict", mins: 11, tone: "lav" },
  { title: "School Readiness Beyond Letters", mins: 14, tone: "sky" },
  { title: "Screen Time Without War", mins: 8, tone: "coral" },
  { title: "Raising Courage Without Harshness", mins: 13, tone: "mint" },
  { title: "Language Transition for Expat Children", mins: 12, tone: "sky" },
];

/** Arbor Academy › Parent Masterclasses. */
export default function Masterclasses() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Arbor Academy" title="Parent masterclasses" subtitle="Short, premium lessons that turn hard moments into confident parenting — watch one in a coffee break." />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {CLASSES.map((c) => (
          <button key={c.title} className={`${cardCls} p-5 text-left flex flex-col gap-3 transition hover:-translate-y-0.5`}>
            <div className="flex items-center justify-between">
              <IconBadge tone={c.tone}><GraduationCap className="w-5 h-5" /></IconBadge>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                <Clock className="w-3 h-3" /> {c.mins} min
              </span>
            </div>
            <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{c.title}</h3>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold mt-auto" style={{ color: PASTEL[c.tone].ink }}>
              <PlayCircle className="w-4 h-4" /> Start lesson
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
