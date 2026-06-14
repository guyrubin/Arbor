import React from "react";
import { motion } from "motion/react";
import { GraduationCap, Clock } from "lucide-react";
import { PageHeader, cardCls, IconBadge, ComingSoon, PastelKey } from "../ui/kit";
import { useLanguage } from "../../context/LanguageContext";

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
  const { t } = useLanguage();
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Arbor Academy" title={t("sec.master.title")} subtitle={t("sec.master.sub")} />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {CLASSES.map((c) => (
          <div key={c.title} className={`${cardCls} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <IconBadge tone={c.tone}><GraduationCap className="w-5 h-5" /></IconBadge>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--arbor-muted)" }}>
                <Clock className="w-3 h-3" /> {c.mins} min
              </span>
            </div>
            <h3 className="text-[15px] font-extrabold leading-snug" style={{ color: "var(--arbor-ink)" }}>{c.title}</h3>
            <span className="mt-auto"><ComingSoon label="Coming soon" /></span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
