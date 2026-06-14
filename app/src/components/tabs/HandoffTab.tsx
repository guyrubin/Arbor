import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, School, Printer, Save, FolderOpen, RefreshCw, ArrowLeft } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { SchoolBrief } from "../../types";
import { PageHeader, SectionCard, cardCls } from "../ui/kit";

type SavedBrief = { id: string; audience: string; generatedAt: string; brief: SchoolBrief };

const AUDIENCES: { id: "teacher" | "clinician" | "pediatrician"; label: string; sub: string }[] = [
  { id: "teacher", label: "🏫 Educator focus", sub: "Environment prompts & classroom transitions" },
  { id: "clinician", label: "🩺 Speech/OT Therapist focus", sub: "Somatic checkpoints & dual-language delays" },
  { id: "pediatrician", label: "⚕️ Pediatrician focus", sub: "Developmental watch/wait checks" },
];

export default function HandoffTab() {
  const { handleGenerateBrief, isGeneratingBrief, handoffAudience, setHandoffAudience, schoolBrief, setSchoolBrief, childProfile, setActiveTab } = useArbor();
  const { toast } = useToast();
  const briefsCol = useChildCollection<SavedBrief>(childProfile.id, "briefs");
  const first = childProfile.name.split(" ")[0];
  const savedBriefs = useMemo(
    () => [...briefsCol.items].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)),
    [briefsCol.items]
  );

  const saveBrief = () => {
    if (!schoolBrief) return;
    void briefsCol.upsert({ id: `brief-${Date.now()}`, audience: handoffAudience, generatedAt: new Date().toISOString(), brief: schoolBrief });
    toast("Brief saved to history", "success");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <button onClick={() => setActiveTab("reports")} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Reports & Handoffs
      </button>
      <PageHeader
        eyebrow="Care Network"
        title="School & Care Handoff"
        subtitle="Export structured summaries of behavioral trends and developmental check-ins for teachers, clinics and occupational therapists."
        action={
          <button
            onClick={handleGenerateBrief}
            disabled={isGeneratingBrief}
            className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))" }}
          >
            {isGeneratingBrief ? (<><RefreshCw className="w-4 h-4 animate-spin" /> Weaving brief…</>) : (<><Sparkles className="w-4 h-4" /> Compile brief summary</>)}
          </button>
        }
      />

      <SectionCard title="Briefing audience" icon={<Sparkles className="w-5 h-5" />} tone="coral">
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--arbor-muted)" }}>
          Arbor customizes professional language, support strategies and developmental observations depending on who is reading {first}&apos;s progress summary.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {AUDIENCES.map((a) => {
            const on = handoffAudience === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setHandoffAudience(a.id)}
                className="py-2.5 px-3 rounded-xl text-xs font-bold transition flex flex-col justify-center text-left gap-0.5"
                style={on
                  ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }
                  : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                <span className="font-extrabold text-[11px]" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-ink)" }}>{a.label}</span>
                <span className="text-[9px] font-normal" style={{ color: "var(--arbor-muted)" }}>{a.sub}</span>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <div className={`${cardCls} p-6 md:p-8 space-y-6 text-left printable-area`}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-5 gap-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
              <School className="w-5 h-5" style={{ color: "var(--arbor-green-ink)" }} />
              {first}&apos;s Development Handoff Summary
            </h3>
            <p className="text-[10px] uppercase font-bold tracking-wider mt-1" style={{ color: "var(--arbor-muted)" }}>
              Target audience: educators, occupational therapists, speech consultants &amp; intake teams
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {schoolBrief && (
              <button onClick={saveBrief} className="px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-green-ink)" }}>
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            )}
            <button onClick={() => window.print()} className="px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {schoolBrief ? (
          <div className="space-y-6 text-xs">
            <div className="p-4 rounded-xl" style={{ background: "var(--arbor-paper-deep)" }}>
              <span className="font-bold block text-sm" style={{ color: "var(--arbor-ink)" }}>Observation overview</span>
              <p className="leading-relaxed text-xs mt-1" style={{ color: "var(--arbor-muted)" }}>{schoolBrief.overview}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <BriefList title="Relational strengths (Gardner intelligences)" items={schoolBrief.keyStrengths} />
              <BriefList title="Classroom sensory & transition challenges" items={schoolBrief.classroomChallenges} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <BriefList title="Transition dual-language plan" items={schoolBrief.languageSupportPlan} />
              <BriefList title="Teacher co-regulation strategies" items={schoolBrief.suggestedTeacherStrategies} tone="mint" />
            </div>

            <div className="p-4 rounded-xl mt-4" style={{ background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)" }}>
              <strong>Crisis trigger warning index:</strong> {schoolBrief.crisisEscalationTrigger}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-2">
            <b className="block" style={{ color: "var(--arbor-ink)" }}>No brief summary compiled yet.</b>
            <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>Click &quot;Compile brief summary&quot; above to generate a custom printable support brief using {first}&apos;s current milestones and logs.</p>
          </div>
        )}
      </div>

      {/* Saved briefs */}
      {savedBriefs.length > 0 && (
        <SectionCard title={`Saved briefs (${savedBriefs.length})`} icon={<FolderOpen className="w-5 h-5" />} tone="sky">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {savedBriefs.map((b) => (
              <div key={b.id} className={`${cardCls} p-3 flex items-center justify-between gap-2`}>
                <div className="text-xs min-w-0">
                  <strong className="capitalize block" style={{ color: "var(--arbor-ink)" }}>{b.audience} brief</strong>
                  <span className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{new Date(b.generatedAt).toLocaleDateString()} {new Date(b.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setSchoolBrief(b.brief)} className="text-[10px] font-bold" style={{ color: "var(--arbor-green-ink)" }}>Open</button>
                  <button onClick={() => void briefsCol.remove(b.id)} className="text-[10px] font-bold" style={{ color: "var(--arbor-pink-ink)" }}>Delete</button>
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
      <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--arbor-muted)" }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}
