import React from "react";
import { motion } from "motion/react";
import { UserCircle, CheckCircle2, Activity, Languages, Gem, ArrowRight, Sparkles } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, Chip, IconBadge, cardCls, PASTEL } from "../ui/kit";

/** Child Intelligence › Development Profile — the section's overview / landing. */
export default function ChildProfile() {
  const { childProfile, milestonesPercent, setActiveTab } = useArbor();
  const first = childProfile.name.split(" ")[0];

  const focus = [
    { label: "Language Transition", tone: "sky" as const },
    { label: "Emotional Regulation", tone: "coral" as const },
    { label: "School Readiness", tone: "mint" as const },
  ];

  const links = [
    { tab: "milestones" as const, tone: "mint" as const, icon: <CheckCircle2 className="w-5 h-5" />, title: "Development Milestones", desc: `${milestonesPercent}% on track for age ${childProfile.age}.` },
    { tab: "behaviors" as const, tone: "coral" as const, icon: <Activity className="w-5 h-5" />, title: "Behavior Patterns", desc: "Log moments and see what helps over time." },
    { tab: "language" as const, tone: "sky" as const, icon: <Languages className="w-5 h-5" />, title: "Language & Communication", desc: "Track the bilingual transition with confidence." },
    { tab: "strengths" as const, tone: "lav" as const, icon: <Gem className="w-5 h-5" />, title: "Strengths & Challenges", desc: "What lights Dylan up, and where to support." },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader
        eyebrow="Child Intelligence"
        title={`${first}'s development profile`}
        subtitle={`Understand ${first}'s patterns, milestones, strengths and progress over time — in one place.`}
        action={
          <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.28)" }}>
            <Sparkles className="w-4 h-4" /> Ask Arbor about {first}
          </button>
        }
      />

      <SectionCard title={`${first}, age ${childProfile.age}`} icon={<UserCircle className="w-5 h-5" />} tone="mint">
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Languages" value={childProfile.languages.join(" · ")} />
          <Field label="School context" value={childProfile.schoolContext} />
          <Field label="Risk level" value={childProfile.riskLevel} />
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--arbor-muted)" }}>Current developmental focus</p>
            <div className="flex flex-wrap gap-1.5">
              {focus.map((f) => <Chip key={f.label} tone={f.tone}>{f.label}</Chip>)}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid sm:grid-cols-2 gap-4">
        {links.map((l) => (
          <button key={l.tab} onClick={() => setActiveTab(l.tab)} className={`${cardCls} p-5 text-left flex items-start gap-4 transition hover:-translate-y-0.5`}>
            <IconBadge tone={l.tone}>{l.icon}</IconBadge>
            <div className="min-w-0">
              <h3 className="text-[15px] font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-ink)" }}>
                {l.title} <ArrowRight className="w-3.5 h-3.5" style={{ color: PASTEL[l.tone].ink }} />
              </h3>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{l.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--arbor-muted)" }}>{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: "var(--arbor-ink)" }}>{value}</p>
    </div>
  );
}
