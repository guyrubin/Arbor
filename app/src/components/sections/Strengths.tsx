import React from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { isolate } from "../../lib/i18n";
import { PageHeader, SectionCard, cardCls } from "../ui/kit";

/** Child Intelligence › Strengths & Challenges. */
export default function Strengths() {
  const { childProfile, setActiveTab } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <PageHeader eyebrow={t("cp.eyebrow")} title={t("sec.strengths.title")} subtitle={t("sec.strengths.sub", { name: first })} />

      <div className="grid lg:grid-cols-2 gap-5">
        <SectionCard title={t("cp.ch.strengths")} icon={<Icon name="diamond" size={20} />} tone="mint">
          <ul className="space-y-3">
            {childProfile.strengths.map((s) => (
              <li key={s} className="flex items-start gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "var(--arbor-clay)" }} />
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{s}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title={t("cp.ch.support")} icon={<Icon name="eco" size={20} />} tone="coral">
          <ul className="space-y-3">
            {childProfile.challenges.map((c) => (
              <li key={c} className={`${cardCls} p-3.5 flex items-start justify-between gap-3`}>
                <span className="text-sm" style={{ color: "var(--arbor-ink)" }}>{c}</span>
                <button onClick={() => setActiveTab("plans")} className="touch-target flex-shrink-0 gap-1 px-2 text-xs font-bold" style={{ color: "var(--arbor-peach-ink)" }}>
                  {t("cp.buildPlan")} <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <div className="rounded-[22px] p-6 flex flex-col sm:flex-row items-center gap-5" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
        <div className="flex-1 text-center sm:text-start">
          <h3 className="text-2xl" style={{ fontFamily: "var(--font-editorial)", color: "var(--arbor-ink)", lineHeight: 1.15 }}>{t("elev.growthTruth.strengths.ctaTitle")}</h3>
          <p className="text-sm mt-1" style={{ color: "var(--arbor-muted)" }}>{t("elev.growthTruth.strengths.ctaBody", { name: isolate(first) })}</p>
        </div>
        <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "var(--arbor-gradient-primary)" }}>
          <Icon name="auto_awesome" size={16} /> {t("nav.ask")}
        </button>
      </div>
    </motion.div>
  );
}
