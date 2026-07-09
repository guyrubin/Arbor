import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { PageHeader, SectionCard, cardCls } from "../ui/kit";

/** Child Intelligence › Strengths & Challenges. */
export default function Strengths() {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow="My Child" title={t("sec.strengths.title")} subtitle={t("sec.strengths.sub", { name: first })} />

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title="Strengths" icon={<Icon name="diamond" size={20} />} tone="mint">
          <ul className="space-y-3">
            {childProfile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Where to support" icon={<Icon name="eco" size={20} />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                  Build a plan <Icon name="arrow_forward" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="rounded-[22px] p-6 flex flex-col sm:flex-row items-center gap-5" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex-1 text-center sm:text-start">
          <h3 className="text-2xl" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)", lineHeight: 1.15 }}>Turn a challenge into a calm next step</h3>
          <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>Arbor reads {first}'s profile and proposes an age-aware plan or script.</p>
        </div>
        <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
          <Icon name="auto_awesome" size={16} /> Ask Arbor
        </button>
      </div>
    </motion.div>
  );
}
