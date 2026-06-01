import React, { useMemo } from "react";
import { motion } from "motion/react";
import { Sparkles, School, Printer, Save, FolderOpen } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useToast } from "../../context/ToastContext";
import { SchoolBrief } from "../../types";

type SavedBrief = { id: string; audience: string; generatedAt: string; brief: SchoolBrief };

export default function HandoffTab() {
  const { handleGenerateBrief, isGeneratingBrief, handoffAudience, setHandoffAudience, schoolBrief, setSchoolBrief, childProfile } = useArbor();
  const { toast } = useToast();
  const briefsCol = useChildCollection<SavedBrief>(childProfile.id, "briefs");
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
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">School & Support Handoff Hub</h2>
          <p className="text-sm text-[#a8a093] mt-1">Export structured summaries detailing behavioral trends and developmental check-ins for teachers, clinics or occupational therapists.</p>
        </div>
        <button onClick={handleGenerateBrief} disabled={isGeneratingBrief} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-5 py-3 rounded-2xl transition flex items-center gap-2">
          {isGeneratingBrief ? "Weaving Brief..." : "Compile Brief Summary"}
        </button>
      </div>

      <div className="bg-[#141821] border border-white/10 p-5 rounded-2xl space-y-3">
        <span className="text-xs font-black uppercase tracking-wider text-[#f4d991] flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#d7aa55]" />
          Customized AI Briefing Audience Strategy:
        </span>
        <p className="text-xs text-slate-400 leading-relaxed">Arbor customizes professional language, support strategies, and developmental observations depending on who is reading Dylan&apos;s progress summary.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <button type="button" onClick={() => setHandoffAudience("teacher")} className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${handoffAudience === "teacher" ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]" : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"}`}>
            <span className="font-extrabold text-white text-[11px]">🏫 Educator focus</span>
            <span className="text-[9px] font-normal text-slate-400">Environment prompts & classroom transitions</span>
          </button>
          <button type="button" onClick={() => setHandoffAudience("clinician")} className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${handoffAudience === "clinician" ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]" : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"}`}>
            <span className="font-extrabold text-white text-[11px]">🩺 Speech/OT Therapist focus</span>
            <span className="text-[9px] font-normal text-slate-400">Somatic checkpoints & dual-language delays</span>
          </button>
          <button type="button" onClick={() => setHandoffAudience("pediatrician")} className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col justify-center text-left gap-0.5 cursor-pointer ${handoffAudience === "pediatrician" ? "bg-[#d7aa55]/10 border-[#d7aa55]/40 text-[#f4d991]" : "bg-white/[0.01] border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/15"}`}>
            <span className="font-extrabold text-white text-[11px]">⚕️ Pediatrician focus</span>
            <span className="text-[9px] font-normal text-slate-400">Developmental watch/wait checks</span>
          </button>
        </div>
      </div>

      <div className="border border-white/10 bg-[#141821] rounded-3xl p-6 md:p-8 space-y-6 text-xs text-left shadow-2xl printable-area">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 pb-5 gap-4">
          <div>
            <h3 className="text-lg font-black text-[#f4d991] flex items-center gap-2">
              <School className="w-5 h-5 text-amber-200" />
              Arbor Child Handoff Development Summary
            </h3>
            <p className="text-[10px] uppercase text-[#a8a093] font-bold tracking-wider mt-1">
              Target Audience: Educators, Occupational Therapists, speech consultants & intake teams
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {schoolBrief && (
              <button onClick={saveBrief} className="border border-white/10 hover:bg-white/5 text-[#f4d991] hover:text-white px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save
              </button>
            )}
            <button onClick={() => window.print()} className="border border-white/10 hover:bg-white/5 text-[#a8a093] hover:text-white px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          </div>
        </div>

        {schoolBrief ? (
          <div className="space-y-6">
            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <span className="font-bold text-white block text-sm">Observation Overview</span>
              <p className="text-gray-350 leading-relaxed text-xs mt-1">{schoolBrief.overview}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <span className="font-bold text-white block text-sm">Relational Strengths (Gardner Intelligences)</span>
                <ul className="list-disc pl-5 text-gray-350 space-y-1">
                  {schoolBrief.keyStrengths.map((ks, i) => (
                    <li key={i}>{ks}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-bold text-white block text-sm">Classroom Sensory & Transition challenges</span>
                <ul className="list-disc pl-5 text-gray-350 space-y-1">
                  {schoolBrief.classroomChallenges.map((cc, i) => (
                    <li key={i}>{cc}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-5">
              <div className="space-y-2">
                <span className="font-bold text-white block text-sm">Transition Dual-Language plan</span>
                <ul className="list-disc pl-5 text-gray-350 space-y-1">
                  {schoolBrief.languageSupportPlan.map((ls, i) => (
                    <li key={i}>{ls}</li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <span className="font-bold text-[#f4d991] block text-sm">Teacher Co-Regulation Strategies</span>
                <ul className="list-disc pl-5 text-gray-350 space-y-1">
                  {schoolBrief.suggestedTeacherStrategies.map((ts, i) => (
                    <li key={i}>{ts}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-red-500/5 p-4 rounded-xl border border-red-500/10 mt-4 text-amber-200">
              <strong>Crisis Trigger Warning Index:</strong> {schoolBrief.crisisEscalationTrigger}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 space-y-2">
            <b className="text-[#a8a093] block">No brief summary compiled yet.</b>
            <p className="text-xs">Click "Compile Brief Summary" at the top to generate a custom printable support brief using {childProfile.name}&apos;s current milestones and logs.</p>
          </div>
        )}
      </div>

      {/* Saved briefs */}
      {savedBriefs.length > 0 && (
        <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
          <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-[#d7aa55]" /> Saved briefs ({savedBriefs.length})
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {savedBriefs.map((b) => (
              <div key={b.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="text-xs min-w-0">
                  <strong className="text-white capitalize block">{b.audience} brief</strong>
                  <span className="text-[10px] text-[#a8a093]">{new Date(b.generatedAt).toLocaleDateString()} {new Date(b.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setSchoolBrief(b.brief)} className="text-[10px] font-bold text-[#f4d991] hover:underline">Open</button>
                  <button onClick={() => void briefsCol.remove(b.id)} className="text-[10px] text-[#a8a093] hover:text-red-400">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
