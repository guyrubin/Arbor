import React from "react";
import { motion } from "motion/react";
import { Plus, Sparkles, RefreshCw, Brain, ExternalLink } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";

export default function BehaviorsTab() {
  const {
    handleAddLog,
    autofillLogTemplate,
    newLogType,
    setNewLogType,
    newLogIntensity,
    setNewLogIntensity,
    newLogDuration,
    setNewLogDuration,
    newLogTrigger,
    setNewLogTrigger,
    newLogResponse,
    setNewLogResponse,
    newLogNotes,
    setNewLogNotes,
    handleAnalyzeBehaviors,
    isAnalyzingBehavior,
    behaviorLogs,
    behaviorAnalysis,
    inlineCoRegulationScripts,
    isGeneratingInlineScript,
    handleGetInlineCoRegulationScript,
    setChatInput,
    setSelectedLens,
    setActiveTab,
  } = useArbor();

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Behavior & Emotion Tracker</h2>
        <p className="text-sm text-[#a8a093] mt-1">Log dysregulation events to map heatmaps, triggers, duration and attach expert research insights.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Form column */}
        <form onSubmit={handleAddLog} className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-sm">
          <h3 className="text-base font-extrabold text-white pb-2 border-b border-white/5 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#d7aa55]" />
            Record Co-Regulation Event
          </h3>

          <div className="p-3 border border-[#d7aa55]/20 bg-[#d7aa55]/5 rounded-xl space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase text-[#f4d991] tracking-wider block flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#d7aa55]" />
              🪄 Quick-Fill AI Scenarios:
            </span>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => autofillLogTemplate("morning")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">
                Morning Refusal
              </button>
              <button type="button" onClick={() => autofillLogTemplate("screen")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">
                iPad Dispute
              </button>
              <button type="button" onClick={() => autofillLogTemplate("sibling")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">
                Sibling Clash
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">Type of Challenge</label>
            <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#d7aa55]">
              <option value="Transition Refusal">Departure Refusal (Mornings / Leaving home)</option>
              <option value="Sensory Overload">Sensory Overload Meltdown (Loud / Overcrowded spaces)</option>
              <option value="Screentime Dispute">Screen-time Switchoff (Tablet boundary refusal)</option>
              <option value="Sibling Conflict">Sibling Tugging / Dispute</option>
              <option value="Food Refusal">Selective Eating Resistance</option>
              <option value="Sleep Meltdown">Bedtime Resistance / Hiding</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-[#a8a093] font-bold block">Intensity (1-5)</label>
              <input type="range" min="1" max="5" value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full accent-[#d7aa55] mt-2.5" />
              <span className="text-[10px] text-[#f4d991] font-bold text-center block">Level {newLogIntensity} / 5</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#a8a093] font-bold block">Duration (Minutes)</label>
              <input type="number" min="2" value={newLogDuration} onChange={(e) => setNewLogDuration(parseInt(e.target.value) || 5)} className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs text-center" />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">What Triggered This? (Active Stimulus)</label>
            <input type="text" value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder="e.g. Dressing shoe sequence, being told tablet goes off" className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">What Was Your Response?</label>
            <input type="text" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder="e.g. Lowered voice height, used transitional object" className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">Observations & Notes (Optional)</label>
            <textarea value={newLogNotes} onChange={(e) => setNewLogNotes(e.target.value)} rows={2} placeholder="Notes on calming down time, physical behavior..." className="w-full bg-[#08090c] border border-white/10 rounded-xl p-2 text-white text-xs" />
          </div>

          <button type="submit" className="w-full py-3 bg-[#d7aa55] hover:bg-[#c39947] transition text-black font-extrabold text-xs rounded-xl">
            Save Log Incident
          </button>
        </form>

        {/* List column */}
        <div className="space-y-6">
          <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-white">Active observation logs</h3>
                <p className="text-xs text-gray-400">Longitudinal log history (newest logged above)</p>
              </div>
              <button onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 ml-auto">
                {isAnalyzingBehavior ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing reports...
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5" /> Analyze Behaviors with AI
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              {["Transition Refusal", "Sensory Overload", "Screentime Dispute", "Sibling Conflict"].map((type, i) => {
                const count = behaviorLogs.filter((log) => log.behaviorType === type || log.behaviorType.includes(type)).length;
                return (
                  <div key={i} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex justify-between items-center">
                    <span className="text-[#a8a093] text-[10px] truncate max-w-[80%]">{type}</span>
                    <strong className="text-white font-black">{count}</strong>
                  </div>
                );
              })}
            </div>

            {behaviorAnalysis && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 bg-gradient-to-br from-[#d7aa55]/10 to-transparent border border-[#d7aa55]/20 rounded-2xl space-y-4 text-xs">
                <h4 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-1">
                  ✨ AI Longitudinal Synthesis & Repair Feedback
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="font-bold text-white block">Parent Response Evaluation:</span>
                    <p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.effectivenessRating}</p>
                  </div>
                  <div className="space-y-2">
                    <span className="font-bold text-white block">Developmental Recommendation:</span>
                    <p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.actionPlanSuggestion}</p>
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  <span className="font-bold text-white block">Expert Insights:</span>
                  <div className="space-y-2 text-gray-350">
                    {behaviorAnalysis.expertInsights.map((ins, i) => (
                      <div key={i} className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-wider block">
                          {ins.scholarLens || "Development theory"}
                        </span>
                        <strong className="text-white font-bold block mt-1">{ins.heading}</strong>
                        <p className="mt-0.5 leading-relaxed text-[#a8a093]">{ins.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {behaviorLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.015] space-y-2.5 text-xs text-left">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <span className="font-bold text-white text-sm">{log.behaviorType}</span>
                      <p className="text-[10px] text-[#a8a093] mt-0.5">Logged: {new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-extrabold">Level {log.intensity}/5</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold">{log.durationMinutes}m</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#a8a093] leading-relaxed">
                    <p><strong>Trigger:</strong> {log.trigger}</p>
                    <p><strong>Parent Action:</strong> {log.response}</p>
                  </div>
                  {log.notes && (
                    <p className="p-2 bg-[#08090c] rounded text-gray-400 border border-white/5 italic">
                      <strong>Observer Note:</strong> {log.notes}
                    </p>
                  )}

                  <div className="pt-2.5 border-t border-white/5 mt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-semibold text-gray-500 font-mono">Arbor AI Coregulation Layer</span>
                      <button
                        type="button"
                        onClick={() => handleGetInlineCoRegulationScript(log)}
                        disabled={isGeneratingInlineScript[log.id]}
                        className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {isGeneratingInlineScript[log.id] ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-[#d7aa55]" /> Analyzing...
                          </>
                        ) : inlineCoRegulationScripts[log.id] ? (
                          <>
                            <Sparkles className="w-3 h-3 text-[#d7aa55]" /> Regenerate Script
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-[#d7aa55]" /> Generate AI Parent Script ➔
                          </>
                        )}
                      </button>
                    </div>

                    {inlineCoRegulationScripts[log.id] && (
                      <div className="p-3 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl space-y-2 mt-1 shadow-inner text-[11px] leading-relaxed select-text">
                        <MarkdownBlock text={inlineCoRegulationScripts[log.id]} className="space-y-1.5" />
                        <div className="flex justify-end pt-1 border-t border-white/5 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setChatInput(`Regarding the log event where Dylan did: "${log.trigger}" and parent responded: "${log.response}". Here is the script I generated: \n\n${inlineCoRegulationScripts[log.id]}\n\nHow do I adapt this if Dylan continues to resist or acts physically aggressive?`);
                              setSelectedLens("Bowlby's Attachment Model");
                              setActiveTab("coach");
                            }}
                            className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1"
                          >
                            Discuss further with Coach <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
