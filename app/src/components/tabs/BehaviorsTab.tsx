import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Sparkles, RefreshCw, Brain, ExternalLink, Download, ChevronDown, Check, RotateCcw, Mic, Square, Trash2, Pencil } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Sparkline } from "../ui/Sparkline";
import { Skeleton } from "../ui/Skeleton";
import PatternInsights from "../behaviors/PatternInsights";
import { speechSupported, startDictation } from "../../lib/speech";
import { authHeaders } from "../../lib/api";
import { fileToThumbnail } from "../../lib/image";
import { BehaviorContext, BehaviorLog } from "../../types";

const CONTEXTS: BehaviorContext[] = ["Home", "School", "Transit", "Public"];
const DAY = 86_400_000;

function weekStartKey(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

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
    newLogContext,
    setNewLogContext,
    newLogPhoto,
    setNewLogPhoto,
    toggleLogResolved,
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
    childProfile,
    deleteLog,
    editingLogId,
    startEditLog,
    cancelEditLog,
    logsLoaded,
  } = useArbor();
  const { toast } = useToast();

  // Voice-to-log
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  const parseVoice = async (text: string) => {
    setParsing(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          message: `Extract a structured behavior log from this parent's spoken note about ${childProfile.name}. Return ONLY compact JSON (no prose, no code fence) with keys: type (one of "Transition Refusal","Sensory Overload","Screentime Dispute","Sibling Conflict","Food Refusal","Sleep Meltdown"), intensity (integer 1-5), context (one of "Home","School","Transit","Public"), trigger (string), response (string), notes (string). Spoken note: "${text}"`,
          childProfile,
          scholarLens: "Integrated Balanced",
        }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = await res.json();
      const match = /\{[\s\S]*\}/.exec(String(data.text || ""));
      if (match) {
        const p = JSON.parse(match[0]);
        if (p.type) setNewLogType(p.type);
        if (p.intensity) setNewLogIntensity(Math.max(1, Math.min(5, Number(p.intensity))));
        if (p.context) setNewLogContext(p.context as BehaviorContext);
        if (p.trigger) setNewLogTrigger(p.trigger);
        if (p.response) setNewLogResponse(p.response);
        if (p.notes) setNewLogNotes(p.notes);
        toast("Voice note parsed into the form — review and save", "success");
        return;
      }
      throw new Error("no json");
    } catch {
      // Fallback: keep the raw transcript so nothing is lost.
      setNewLogTrigger(text);
      toast("Captured your note into the trigger field", "info");
    } finally {
      setParsing(false);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      stopRef.current?.();
      return;
    }
    if (!speechSupported()) {
      toast("Voice capture isn't supported in this browser", "error");
      return;
    }
    setListening(true);
    stopRef.current = startDictation({
      onResult: (text) => void parseVoice(text),
      onError: () => toast("Couldn't hear that — try again", "error"),
      onEnd: () => {
        setListening(false);
        stopRef.current = null;
      },
    });
  };

  // Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [intensityFilter, setIntensityFilter] = useState("all");
  const [resolvedFilter, setResolvedFilter] = useState("all");
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<string, boolean>>({});

  const types = useMemo(() => Array.from(new Set(behaviorLogs.map((l) => l.behaviorType))), [behaviorLogs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return behaviorLogs.filter((l) => {
      if (typeFilter !== "all" && l.behaviorType !== typeFilter) return false;
      if (intensityFilter !== "all" && l.intensity !== Number(intensityFilter)) return false;
      if (resolvedFilter === "resolved" && !l.resolved) return false;
      if (resolvedFilter === "open" && l.resolved) return false;
      if (q && !(`${l.behaviorType} ${l.trigger} ${l.response} ${l.notes || ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [behaviorLogs, search, typeFilter, intensityFilter, resolvedFilter]);

  // Group filtered logs by week
  const grouped = useMemo(() => {
    const map = new Map<string, BehaviorLog[]>();
    for (const log of filtered) {
      const key = weekStartKey(log.timestamp);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  // Per-type 30-day intensity series
  const sparkSeries = useMemo(() => {
    const now = Date.now();
    return types.map((type) => {
      const sums = new Array(30).fill(0);
      const counts = new Array(30).fill(0);
      behaviorLogs
        .filter((l) => l.behaviorType === type)
        .forEach((l) => {
          const idx = 29 - Math.floor((now - new Date(l.timestamp).getTime()) / DAY);
          if (idx >= 0 && idx < 30) {
            sums[idx] += l.intensity;
            counts[idx] += 1;
          }
        });
      return { type, series: sums.map((s, i) => (counts[i] ? s / counts[i] : 0)) };
    });
  }, [behaviorLogs, types]);

  const exportPdf = () => {
    const rows = filtered
      .map(
        (l) =>
          `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${escapeHtml(l.behaviorType)}</td><td>${l.context || ""}</td><td>${l.intensity}/5</td><td>${l.durationMinutes}m</td><td>${l.resolved ? "Resolved" : "Open"}</td><td>${escapeHtml(l.trigger)}</td><td>${escapeHtml(l.response)}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><title>Arbor Behavior Summary</title>
      <style>body{font-family:Georgia,serif;color:#14160f;padding:32px} h1{font-size:20px} table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px} th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top} th{background:#f0ece0}</style>
      </head><body>
      <h1>Arbor — Behavior &amp; Emotion Summary</h1>
      <p>Generated ${new Date().toLocaleString()} · ${filtered.length} entries</p>
      <table><thead><tr><th>When</th><th>Type</th><th>Where</th><th>Intensity</th><th>Duration</th><th>Status</th><th>Trigger</th><th>Parent response</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setIntensityFilter("all");
    setResolvedFilter("all");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Behavior & Emotion Tracker</h2>
        <p className="text-sm text-[#a8a093] mt-1">Log dysregulation events to map heatmaps, triggers, duration and attach expert research insights.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Form column */}
        <form onSubmit={handleAddLog} className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4 text-sm self-start">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              {editingLogId ? <Pencil className="w-4 h-4 text-[#d7aa55]" /> : <Plus className="w-4 h-4 text-[#d7aa55]" />}
              {editingLogId ? "Edit log" : "Record Co-Regulation Event"}
            </h3>
            <button
              type="button"
              onClick={toggleVoice}
              disabled={parsing}
              title="Speak to log"
              className={`flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg border transition ${
                listening
                  ? "bg-[#e2562d]/15 text-[#ffb59c] border-[#e2562d]/40 animate-pulse"
                  : "bg-[#d7aa55]/10 text-[#f4d991] border-[#d7aa55]/25 hover:bg-[#d7aa55]/20"
              }`}
            >
              {parsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {parsing ? "Parsing…" : listening ? "Stop" : "Speak"}
            </button>
          </div>

          <div className="p-3 border border-[#d7aa55]/20 bg-[#d7aa55]/5 rounded-xl space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase text-[#f4d991] tracking-wider block flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#d7aa55]" />
              🪄 Quick-Fill AI Scenarios:
            </span>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => autofillLogTemplate("morning")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">Morning Refusal</button>
              <button type="button" onClick={() => autofillLogTemplate("screen")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">iPad Dispute</button>
              <button type="button" onClick={() => autofillLogTemplate("sibling")} className="bg-white/5 hover:bg-[#d7aa55]/20 text-white hover:text-[#f4d991] px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer">Sibling Clash</button>
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

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">Where did it happen?</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewLogContext(c)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold border transition ${
                    newLogContext === c ? "bg-[#d7aa55]/15 text-[#f4d991] border-[#d7aa55]/40" : "bg-white/[0.02] text-[#a8a093] border-white/5 hover:bg-white/5"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
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

          <div className="space-y-1">
            <label className="text-xs text-[#a8a093] font-bold block">Photo (Optional)</label>
            {newLogPhoto ? (
              <div className="relative inline-block">
                <img src={newLogPhoto} alt="attachment" className="h-20 rounded-lg border border-white/10 object-cover" />
                <button type="button" onClick={() => setNewLogPhoto("")} className="absolute -top-2 -right-2 bg-[#e2562d] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black">×</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-[11px] text-[#a8a093] bg-[#08090c] border border-dashed border-white/15 rounded-xl px-3 py-2 cursor-pointer hover:border-[#d7aa55]/40 transition">
                <Plus className="w-3.5 h-3.5 text-[#d7aa55]" /> Add a photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      setNewLogPhoto(await fileToThumbnail(f));
                    } catch {
                      toast("Couldn't process that image", "error");
                    }
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-3 bg-[#d7aa55] hover:bg-[#c39947] transition text-black font-extrabold text-xs rounded-xl active:scale-[0.98]">
              {editingLogId ? "Update log" : "Save Log Incident"}
            </button>
            {editingLogId && (
              <button type="button" onClick={cancelEditLog} className="px-4 py-3 bg-white/5 border border-white/10 text-[#a8a093] hover:text-white font-bold text-xs rounded-xl transition">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* List column */}
        <div className="space-y-6">
          {/* Correlations / pattern intelligence */}
          <PatternInsights logs={behaviorLogs} />

          {/* Per-type intensity sparklines */}
          {sparkSeries.length > 0 && (
            <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-3">
              <span className="text-xs font-bold text-[#f4d991] uppercase tracking-wider">Intensity trend by type (30 days)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sparkSeries.map(({ type, series }) => (
                  <div key={type} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2">
                    <span className="text-[11px] text-[#a8a093] truncate">{type}</span>
                    <Sparkline data={series} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#141821] border border-white/10 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-white">Active observation logs</h3>
                <p className="text-xs text-gray-400">{filtered.length} of {behaviorLogs.length} entries</p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={exportPdf} className="bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs px-3 py-2.5 rounded-xl transition flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5 text-[#d7aa55]" /> Export PDF
                </button>
                <button onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} className="bg-[#d7aa55] hover:bg-[#c39947] disabled:bg-white/5 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2">
                  {isAnalyzingBehavior ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing...</>) : (<><Brain className="w-3.5 h-3.5" /> Analyze with AI</>)}
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search triggers, notes…" className="flex-1 min-w-[160px] bg-[#08090c] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#d7aa55]/50" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="bg-[#08090c] border border-white/10 rounded-xl px-2 py-2 text-white">
                <option value="all">All types</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={intensityFilter} onChange={(e) => setIntensityFilter(e.target.value)} className="bg-[#08090c] border border-white/10 rounded-xl px-2 py-2 text-white">
                <option value="all">Any intensity</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
              </select>
              <select value={resolvedFilter} onChange={(e) => setResolvedFilter(e.target.value)} className="bg-[#08090c] border border-white/10 rounded-xl px-2 py-2 text-white">
                <option value="all">All status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={resetFilters} className="text-[#a8a093] hover:text-white flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Reset</button>
            </div>

            {behaviorAnalysis && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 bg-gradient-to-br from-[#d7aa55]/10 to-transparent border border-[#d7aa55]/20 rounded-2xl space-y-4 text-xs">
                <h4 className="text-sm font-extrabold text-[#f4d991] flex items-center gap-1">✨ AI Longitudinal Synthesis & Repair Feedback</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><span className="font-bold text-white block">Parent Response Evaluation:</span><p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.effectivenessRating}</p></div>
                  <div className="space-y-2"><span className="font-bold text-white block">Developmental Recommendation:</span><p className="text-[#a8a093] leading-relaxed">{behaviorAnalysis.actionPlanSuggestion}</p></div>
                </div>
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <span className="font-bold text-white block">Expert Insights:</span>
                  <div className="space-y-2 text-gray-350">
                    {behaviorAnalysis.expertInsights.map((ins, i) => (
                      <div key={i} className="bg-white/5 p-2.5 rounded-xl border border-white/5">
                        <span className="text-[10px] font-black uppercase text-[#f4d991] tracking-wider block">{ins.scholarLens || "Development theory"}</span>
                        <strong className="text-white font-bold block mt-1">{ins.heading}</strong>
                        <p className="mt-0.5 leading-relaxed text-[#a8a093]">{ins.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Weekly grouped logs */}
            <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              {!logsLoaded && (
                <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              )}
              {logsLoaded && grouped.length === 0 && (
                <div className="text-center py-10 text-xs text-[#a8a093] border border-white/5 rounded-xl bg-white/[0.01]">No logs match these filters.</div>
              )}
              {grouped.map(([weekKey, logs]) => {
                const collapsed = collapsedWeeks[weekKey];
                return (
                  <div key={weekKey} className="space-y-2">
                    <button
                      onClick={() => setCollapsedWeeks((p) => ({ ...p, [weekKey]: !p[weekKey] }))}
                      className="w-full flex items-center justify-between text-[11px] font-bold text-[#a8a093] hover:text-white bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2"
                    >
                      <span>Week of {weekLabel(weekKey)} · {logs.length} {logs.length === 1 ? "entry" : "entries"}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          {logs.map((log) => (
                            <div key={log.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.015] space-y-2.5 text-xs text-left">
                              <div className="flex justify-between items-start gap-3">
                                <div>
                                  <span className="font-bold text-white text-sm">{log.behaviorType}</span>
                                  <p className="text-[10px] text-[#a8a093] mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {log.context && <span className="px-2 py-0.5 rounded bg-white/5 text-[#a8a093] font-bold">{log.context}</span>}
                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-extrabold">Level {log.intensity}/5</span>
                                  <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 font-bold">{log.durationMinutes}m</span>
                                  <button
                                    onClick={() => toggleLogResolved(log.id)}
                                    className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 transition ${log.resolved ? "bg-emerald-500/15 text-emerald-400" : "bg-white/5 text-[#a8a093] hover:text-white"}`}
                                  >
                                    <Check className="w-3 h-3" /> {log.resolved ? "Resolved" : "Mark resolved"}
                                  </button>
                                  <button
                                    onClick={() => startEditLog(log.id)}
                                    aria-label="Edit log"
                                    className="px-1.5 py-0.5 rounded text-[#a8a093] hover:text-[#f4d991] transition"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => { if (window.confirm("Delete this log?")) deleteLog(log.id); }}
                                    aria-label="Delete log"
                                    className="px-1.5 py-0.5 rounded text-[#a8a093] hover:text-red-400 transition"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#a8a093] leading-relaxed">
                                <p><strong>Trigger:</strong> {log.trigger}</p>
                                <p><strong>Parent Action:</strong> {log.response}</p>
                              </div>
                              {log.notes && <p className="p-2 bg-[#08090c] rounded text-gray-400 border border-white/5 italic"><strong>Observer Note:</strong> {log.notes}</p>}
                              {log.photoAttachment && (
                                <img src={log.photoAttachment} alt="log attachment" className="h-24 rounded-lg border border-white/10 object-cover" />
                              )}

                              <div className="pt-2.5 border-t border-white/5 mt-2 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-semibold text-gray-500 font-mono">Arbor AI Coregulation Layer</span>
                                  <button type="button" onClick={() => handleGetInlineCoRegulationScript(log)} disabled={isGeneratingInlineScript[log.id]} className="text-[10px] font-black uppercase tracking-wider text-[#f4d991] hover:text-white bg-[#d7aa55]/15 hover:bg-[#d7aa55]/25 border border-[#d7aa55]/25 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer">
                                    {isGeneratingInlineScript[log.id] ? (<><RefreshCw className="w-3 h-3 animate-spin text-[#d7aa55]" /> Analyzing...</>) : inlineCoRegulationScripts[log.id] ? (<><Sparkles className="w-3 h-3 text-[#d7aa55]" /> Regenerate Script</>) : (<><Sparkles className="w-3 h-3 text-[#d7aa55]" /> Generate AI Parent Script ➔</>)}
                                  </button>
                                </div>

                                <AnimatePresence initial={false}>
                                  {inlineCoRegulationScripts[log.id] && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-3 bg-[#08090c]/40 border border-[#d7aa55]/15 rounded-xl space-y-2 mt-1 shadow-inner text-[11px] leading-relaxed select-text overflow-hidden">
                                      <MarkdownBlock text={inlineCoRegulationScripts[log.id]} className="space-y-1.5" />
                                      <div className="flex justify-end pt-1 border-t border-white/5 gap-2">
                                        <button type="button" onClick={() => { setChatInput(`Regarding the log event where the child did: "${log.trigger}" and parent responded: "${log.response}". Here is the script I generated: \n\n${inlineCoRegulationScripts[log.id]}\n\nHow do I adapt this if they continue to resist or act physically aggressive?`); setSelectedLens("Bowlby's Attachment Model"); setActiveTab("coach"); }} className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition flex items-center gap-1">
                                          Discuss further with Coach <ExternalLink className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
