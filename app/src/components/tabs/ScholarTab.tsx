import React from "react";
import { motion } from "motion/react";
import { ExternalLink, Sparkles } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { scholarsInfo } from "../../initialData";

export default function ScholarTab() {
  const { setSelectedLens, setChatInput, setActiveTab, childProfile } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Scholar Academy</h2>
        <p className="text-sm text-[#a8a093] mt-1">Multi-theory developmental system. Select a scholar detail frame to load example prompts instantly into the AI Coach.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 text-xs">
        {scholarsInfo.map((sch, idx) => (
          <div key={idx} className="bg-[#141821] border border-white/10 rounded-2xl p-5 flex flex-col justify-between gap-5 hover:border-white/20 transition group">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#d7aa55]/10 text-[#f4d991] font-black text-lg flex items-center justify-center">
                  {sch.initial}
                </div>
                <div>
                  <b className="text-sm text-white group-hover:text-[#f4d991] transition font-extrabold">{sch.name}</b>
                  <p className="text-[10px] text-[#a8a093] uppercase font-bold mt-0.5">{sch.concept}</p>
                </div>
              </div>

              <div className="space-y-2 pt-1 border-t border-white/5">
                <span className="text-[10px] font-bold text-gray-400 block italic">Focus: {sch.theory}</span>
                <p className="text-[#a8a093] leading-relaxed text-[11px]">{sch.value}</p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setSelectedLens(sch.name);
                  setChatInput(`Using ${sch.name}'s ${sch.concept} lens, give me practical, non-diagnostic guidance for ${childProfile.name} (age ${childProfile.age}) — what to notice and two things to try this week.`);
                  setActiveTab("coach");
                }}
                className="w-full py-2.5 bg-[#d7aa55]/10 border border-[#d7aa55]/25 hover:bg-[#d7aa55]/20 text-[#f4d991] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> Apply to {childProfile.name}
              </button>
              <button
                onClick={() => {
                  setSelectedLens(sch.name);
                  setChatInput(sch.examplePrompt);
                  setActiveTab("coach");
                }}
                className="w-full py-2 bg-white/5 border border-white/5 hover:text-[#f4d991] text-[#a8a093] font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                Try an example <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
