import React from "react";
import { motion } from "motion/react";
import { ExternalLink, Sparkles, ArrowLeft } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { scholarsInfo } from "../../initialData";
import { PageHeader, cardCls, PASTEL, PastelKey } from "../ui/kit";

const TONES: PastelKey[] = ["mint", "sky", "lav", "coral", "yellow", "pink"];

export default function ScholarTab() {
  const { setSelectedLens, setChatInput, setActiveTab, childProfile } = useArbor();
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[1180px]">
      <button onClick={() => setActiveTab("coach")} className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--arbor-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Ask Arbor
      </button>
      <PageHeader
        eyebrow="Ask Arbor"
        title="Scholar Frameworks"
        subtitle="A multi-theory developmental system. Pick a scholar to load a focused lens and example prompt straight into Ask Arbor."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 text-xs">
        {scholarsInfo.map((sch, idx) => {
          const tone = TONES[idx % TONES.length];
          const p = PASTEL[tone];
          return (
            <div key={idx} className={`${cardCls} p-5 flex flex-col justify-between gap-5 transition hover:-translate-y-0.5`}>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center flex-shrink-0" style={{ background: p.soft, color: p.ink }}>
                    {sch.initial}
                  </div>
                  <div className="min-w-0">
                    <b className="text-sm font-extrabold block" style={{ color: "var(--arbor-ink)" }}>{sch.name}</b>
                    <p className="text-[10px] uppercase font-bold mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sch.concept}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <span className="text-[10px] font-bold block italic" style={{ color: p.ink }}>Focus: {sch.theory}</span>
                  <p className="leading-relaxed text-[11px]" style={{ color: "var(--arbor-muted)" }}>{sch.value}</p>
                  {sch.useWhen && (
                    <p className="leading-relaxed text-[11px] rounded-lg p-2.5" style={{ background: p.soft, color: p.ink }}>
                      {sch.useWhen}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedLens(sch.name);
                    setChatInput(`Using ${sch.name}'s ${sch.concept} lens, give me practical, non-diagnostic guidance for ${childProfile.name} (age ${childProfile.age}) — what to notice and two things to try this week.`);
                    setActiveTab("coach");
                  }}
                  className="w-full py-2.5 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  style={{ background: "#e4f4ec", color: "#1f8a5a" }}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Apply to {first}
                </button>
                <button
                  onClick={() => {
                    setSelectedLens(sch.name);
                    setChatInput(sch.examplePrompt);
                    setActiveTab("coach");
                  }}
                  className="w-full py-2 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}
                >
                  Try an example <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
