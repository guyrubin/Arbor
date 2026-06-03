import React from "react";
import { motion } from "motion/react";
import { ScrollText, Repeat, ListChecks, MessageSquareHeart, BookOpen, ShieldCheck, CalendarHeart, Sparkles } from "lucide-react";
import { PageHeader, cardCls, IconBadge, ComingSoon, PastelKey } from "../ui/kit";

const ITEMS: { title: string; desc: string; icon: React.ReactNode; tone: PastelKey; soon?: boolean }[] = [
  { title: "Family Charter", desc: "Name the values you're forming your family around.", icon: <ScrollText className="w-5 h-5" />, tone: "mint" },
  { title: "Rituals", desc: "Small repeatable moments that carry meaning and safety.", icon: <Repeat className="w-5 h-5" />, tone: "lav" },
  { title: "Responsibility Ladder", desc: "Age-appropriate responsibilities that build competence.", icon: <ListChecks className="w-5 h-5" />, tone: "yellow" },
  { title: "Hard Conversations", desc: "Scaffolded scripts for the talks that matter.", icon: <MessageSquareHeart className="w-5 h-5" />, tone: "coral" },
  { title: "Family Story Canon", desc: "The stories your family tells about who you are.", icon: <BookOpen className="w-5 h-5" />, tone: "sky" },
  { title: "Truth Practice", desc: "Building honesty and repair as a family habit.", icon: <ShieldCheck className="w-5 h-5" />, tone: "mint" },
  { title: "Weekly Reflection", desc: "A short rhythm to notice growth and reset.", icon: <CalendarHeart className="w-5 h-5" />, tone: "lav" },
  { title: "Co-parent Alignment", desc: "Stay on the same page with your partner.", icon: <Sparkles className="w-5 h-5" />, tone: "pink", soon: true },
];

/** Arbor Academy › Family Formation. */
export default function FamilyFormation() {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="Arbor Academy" title="Family formation" subtitle="The long game: values, rituals and stories that form a family over years, not days." />
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ITEMS.map((it) => (
          <button key={it.title} className={`${cardCls} p-5 text-left flex items-start gap-4 transition hover:-translate-y-0.5`}>
            <IconBadge tone={it.tone}>{it.icon}</IconBadge>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
                {it.title} {it.soon && <ComingSoon label="Coming soon" />}
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{it.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
