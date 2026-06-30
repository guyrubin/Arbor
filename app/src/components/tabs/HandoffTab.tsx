import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { SchoolBrief } from "../../types";
import { PageHeader, SectionCard, cardCls } from "../ui/kit";

type SavedBrief = { id: string; audience: string; generatedAt: string; brief: SchoolBrief };

const AUDIENCES: { id: "teacher" | "clinician" | "pediatrician"; emoji: string; labelKey: string; subKey: string }[] = [
  { id: "teacher", emoji: "🏫", labelKey: "handoff.aud.teacher", subKey: "handoff.aud.teacher.sub" },
  { id: "clinician", emoji: "🩺", labelKey: "handoff.aud.clinician", subKey: "handoff.aud.clinician.sub" },
  { id: "pediatrician", emoji: "⚕️", labelKey: "handoff.aud.pediatrician", subKey: "handoff.aud.pediatrician.sub" },
];

export default function HandoffTab() {
  const { handleGenerateBrief, isGeneratingBrief, handoffAudience, setHandoffAudience, schoolBrief, setSchoolBrief, childProfile, setActiveTab } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const briefsCol = useChildCollection<SavedBrief>(childProfile.id, "briefs");
  const first = childProfile.name.split(" ")[0];
  const savedBriefs = useMemo(
    () => [...briefsCol.items].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)),
    [briefsCol.items]
  );

  const saveBrief = () => {
    if (!schoolBrief) return;
    void briefsCol.upsert({ id: `brief-${Date.now()}`, audience: handoffAudience, generatedAt: new Date().toISOString(), brief: schoolBrief });
    toast(t("handoff.saved"), "success");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <button onClick={() => setActiveTab("reports")} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <Icon name="arrow_back" size={16} /> {t("handoff.back")}
      </button>
      <PageHeader
        eyebrow={t("schoolBrief.eyebrow")}
        title={t("handoff.title")}
        subtitle={t("handoff.subtitle")}
        action={
          <button
            onClick={handleGenerateBrief}
            disabled={isGeneratingBrief}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-60"
            style={{ background: "var(--arbor-gradient-primary)" }}
          >
            {isGeneratingBrief ? (<><Icon name="progress_activity" size={16} className="animate-spin" /> {t("handoff.weaving")}</>) : (<><Icon name="auto_awesome" size={16} /> {t("handoff.compile")}</>)}
          </button>
        }
      />

      <SectionCard title={t("handoff.audience.title")} icon={<Icon name="auto_awesome" size={20} />} tone="coral">
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--arbor-muted)" }}>
          {t("handoff.audience.body", { name: first })}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {AUDIENCES.map((a) => {
            const on = handoffAudience === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setHandoffAudience(a.id)}
                className="py-2.5 px-3 rounded-xl text-xs font-bold transition flex flex-col justify-center text-start gap-0.5"
                style={on
                  ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                  : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <span className="font-extrabold text-[11px]" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{a.emoji} {t(a.labelKey)}</span>
                <span className="text-[9px] font-normal" style={{ color: "var(--arbor-muted)" }}>{t(a.subKey)}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className={`${cardCls} p-6 md:p-8 space-y-6 text-start printable-area`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 gap-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <Icon name="school" size={20} style={{ color: "var(--arbor-green-ink)" }} />
              {t("handoff.summary.title", { name: first })}
            </h3>
            <p className="text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: "var(--arbor-muted)" }}>
              {t("handoff.summary.audience")}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {schoolBrief && (
              <button onClick={saveBrief} className="px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}>
                <Icon name="save" size={14} /> {t("handoff.save")}
              </button>
            )}
            <button onClick={() => window.print()} className="px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
              <Icon name="print" size={14} /> {t("handoff.print")}
            </button>
          </div>
        </div>

        {schoolBrief ? (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
              <span className="font-bold block text-sm" style={{ color: "var(--arbor-ink)" }}>{t("handoff.overview")}</span>
              <p className="leading-relaxed text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{schoolBrief.overview}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BriefList title={t("handoff.list.strengths")} items={schoolBrief.keyStrengths} />
              <BriefList title={t("handoff.list.challenges")} items={schoolBrief.classroomChallenges} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <BriefList title={t("handoff.list.language")} items={schoolBrief.languageSupportPlan} />
              <BriefList title={t("handoff.list.strategies")} items={schoolBrief.suggestedTeacherStrategies} tone="mint" />
            </div>

            <div className="p-4 rounded-xl mt-4" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
              <strong>{t("handoff.crisis")}</strong> {schoolBrief.crisisEscalationTrigger}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-2">
            <b className="block" style={{ color: "var(--arbor-ink)" }}>{t("handoff.empty.title")}</b>
            <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("handoff.empty.body", { name: first })}</p>
          </div>
        )}
      </div>

      {/* Saved briefs */}
      {savedBriefs.length > 0 && (
        <SectionCard title={t("handoff.saved.title", { n: savedBriefs.length })} icon={<Icon name="folder_open" size={20} />} tone="sky">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {savedBriefs.map((b) => (
              <div key={b.id} className={`${cardCls} p-3 flex items-center justify-between gap-2`}>
                <div className="text-xs min-w-0">
                  <strong className="capitalize block" style={{ color: "var(--arbor-ink)" }}>{t("handoff.saved.item", { audience: b.audience })}</strong>
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{new Date(b.generatedAt).toLocaleDateString()} {new Date(b.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setSchoolBrief(b.brief)} className="text-[10px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>{t("handoff.open")}</button>
                  <button onClick={() => void briefsCol.remove(b.id)} className="text-[10px] font-bold" style={{ color: "var(--arbor-pink-ink)" }}>{t("handoff.delete")}</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

function BriefList({ title, items, tone = "ink" }: { title: string; items: string[]; tone?: "ink" | "mint" }) {
  return (
    <div className="space-y-2">
      <span className="font-bold block text-sm" style={{ color: tone === "mint" ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{title}</span>
      <ul className="list-disc ps-5 space-y-1" style={{ color: "var(--arbor-muted)" }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
