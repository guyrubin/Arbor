import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, Sparkles, RefreshCw, Brain, ExternalLink, Download, ChevronDown, Check, RotateCcw, Mic, Square, Trash2, Pencil } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Sparkline } from "../ui/Sparkline";
import { Skeleton } from "../ui/Skeleton";
import { PageHeader, cardCls } from "../ui/kit";
import PatternInsights from "../behaviors/PatternInsights";
import { speechSupported, startDictation } from "../../lib/speech";
import { authHeaders } from "../../lib/api";
import { fileToThumbnail } from "../../lib/image";
import { uploadChildPhoto } from "../../lib/storage";
import { useAuth } from "../../context/AuthContext";
import { weekStartKey, escapeHtml } from "../../lib/behaviorUtils";
import { BehaviorContext, BehaviorLog } from "../../types";

const CONTEXTS: BehaviorContext[] = ["Home", "School", "Transit", "Public"];
const DAY = 86_400_000;

function weekLabel(key: string): string {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
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
  const { user } = useAuth();

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
      <PageHeader
        eyebrow="Child Intelligence"
        title="Behavior & Emotion Tracker"
        subtitle="Log the hard moments to see patterns, triggers, and what actually helps over time."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        {/* Form column */}
        <form onSubmit={handleAddLog} className={`${cardCls} p-5 space-y-4 text-sm self-start`}>
          <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
            <h3 className="text-base font-extrabold flex items-center gap-2" style={{ color: "var(--arbor-ink)" }}>
              {editingLogId ? <Pencil className="w-4 h-4" style={{ color: "#1f8a5a" }} /> : <Plus className="w-4 h-4" style={{ color: "#1f8a5a" }} />}
              {editingLogId ? "Edit log" : "Record Co-Regulation Event"}
            </h3>
            <button
              type="button"
              onClick={toggleVoice}
              disabled={parsing}
              title="Speak to log"
              className={`flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg transition ${listening ? "animate-pulse" : ""}`}
              style={listening
                ? { background: "#fce2ec", color: "#bd4f74", border: "1px solid rgba(189,79,116,0.40)" }
                : { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.30)" }}
            >
              {parsing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {parsing ? "Parsing…" : listening ? "Stop" : "Speak"}
            </button>
          </div>

          <div className="p-3 rounded-xl space-y-1.5" style={{ background: "#fdeada" }}>
            <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1" style={{ color: "#cf6f37" }}>
              <Sparkles className="w-3 h-3" />
              🪄 Quick-Fill AI Scenarios:
            </span>
            <div className="flex flex-wrap gap-1">
              <button type="button" onClick={() => autofillLogTemplate("morning")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>Morning Refusal</button>
              <button type="button" onClick={() => autofillLogTemplate("screen")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>iPad Dispute</button>
              <button type="button" onClick={() => autofillLogTemplate("sibling")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>Sibling Clash</button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Type of Challenge</label>
            <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
              <option value="Transition Refusal">Departure Refusal (Mornings / Leaving home)</option>
              <option value="Sensory Overload">Sensory Overload Meltdown (Loud / Overcrowded spaces)</option>
              <option value="Screentime Dispute">Screen-time Switchoff (Tablet boundary refusal)</option>
              <option value="Sibling Conflict">Sibling Tugging / Dispute</option>
              <option value="Food Refusal">Selective Eating Resistance</option>
              <option value="Sleep Meltdown">Bedtime Resistance / Hiding</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Where did it happen?</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CONTEXTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewLogContext(c)}
                  className="py-1.5 rounded-lg text-[10px] font-bold transition"
                  style={newLogContext === c ? { background: "#e4f4ec", color: "#1f8a5a", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Intensity (1-5)</label>
              <input type="range" min="1" max="5" value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full mt-2.5" style={{ accentColor: "#34b277" }} />
              <span className="text-[10px] font-bold text-center block" style={{ color: "#1f8a5a" }}>Level {newLogIntensity} / 5</span>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Duration (Minutes)</label>
              <input type="number" min="2" value={newLogDuration} onChange={(e) => setNewLogDuration(parseInt(e.target.value) || 5)} className="w-full rounded-xl p-2 text-xs text-center" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>What Triggered This? (Active Stimulus)</label>
            <input type="text" value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder="e.g. Dressing shoe sequence, being told tablet goes off" className="w-full rounded-xl p-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>What Was Your Response?</label>
            <input type="text" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder="e.g. Lowered voice height, used transitional object" className="w-full rounded-xl p-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Observations & Notes (Optional)</label>
            <textarea value={newLogNotes} onChange={(e) => setNewLogNotes(e.target.value)} rows={2} placeholder="Notes on calming down time, physical behavior..." className="w-full rounded-xl p-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>Photo (Optional)</label>
            {newLogPhoto ? (
              <div className="relative inline-block">
                <img src={newLogPhoto} alt="attachment" className="h-20 rounded-lg object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
                <button type="button" onClick={() => setNewLogPhoto("")} className="absolute -top-2 -right-2 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black" style={{ background: "#bd4f74" }}>×</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-[11px] rounded-xl px-3 py-2 cursor-pointer transition" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)", border: "1px dashed var(--arbor-rule-strong)" }}>
                <Plus className="w-3.5 h-3.5" style={{ color: "#1f8a5a" }} /> Add a photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    let thumb: string;
                    try {
                      thumb = await fileToThumbnail(f);
                    } catch {
                      toast("Couldn't process that image", "error");
                      return;
                    }
                    // Prefer Firebase Storage; fall back to inlining if it's unavailable.
                    if (user?.uid && user.uid !== "local-sandbox") {
                      try {
                        setNewLogPhoto(await uploadChildPhoto(user.uid, childProfile.id, thumb));
                        return;
                      } catch {
                        /* fall through to inline */
                      }
                    }
                    setNewLogPhoto(thumb);
                  }}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-3 transition text-white font-extrabold text-xs rounded-xl active:scale-[0.98]" style={{ background: "linear-gradient(135deg,#3cc081,#34b277 60%,#2a9c66)" }}>
              {editingLogId ? "Update log" : "Save Log Incident"}
            </button>
            {editingLogId && (
              <button type="button" onClick={cancelEditLog} className="px-4 py-3 font-bold text-xs rounded-xl transition" style={{ background: "#fff", border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
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
            <div className={`${cardCls} p-5 space-y-3`}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "#1f8a5a" }}>Intensity trend by type (30 days)</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sparkSeries.map(({ type, series }) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <span className="text-[11px] truncate" style={{ color: "var(--arbor-muted)" }}>{type}</span>
                    <Sparkline data={series} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={`${cardCls} p-5 space-y-4`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold" style={{ color: "var(--arbor-ink)" }}>Active observation logs</h3>
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{filtered.length} of {behaviorLogs.length} entries</p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={exportPdf} className="font-bold text-xs px-3 py-2.5 rounded-xl transition flex items-center gap-1.5 bg-white" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
                  <Download className="w-3.5 h-3.5" style={{ color: "#1f8a5a" }} /> Export PDF
                </button>
                <button onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} className="text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 disabled:opacity-60" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
                  {isAnalyzingBehavior ? (<><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing...</>) : (<><Brain className="w-3.5 h-3.5" /> Analyze with AI</>)}
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search triggers, notes…" className="flex-1 min-w-[160px] rounded-xl px-3 py-2 focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-xl px-2 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">All types</option>
                {types.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={intensityFilter} onChange={(e) => setIntensityFilter(e.target.value)} className="rounded-xl px-2 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">Any intensity</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}
              </select>
              <select value={resolvedFilter} onChange={(e) => setResolvedFilter(e.target.value)} className="rounded-xl px-2 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">All status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
              <button onClick={resetFilters} className="flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}><RotateCcw className="w-3 h-3" /> Reset</button>
            </div>

            {behaviorAnalysis && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 rounded-2xl space-y-4 text-xs" style={{ background: "linear-gradient(120deg,#eef6f1,#ece9fb)", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-sm font-extrabold flex items-center gap-1" style={{ color: "#1f8a5a" }}>✨ AI Longitudinal Synthesis & Repair Feedback</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>Parent Response Evaluation:</span><p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{behaviorAnalysis.effectivenessRating}</p></div>
                  <div className="space-y-2"><span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>Developmental Recommendation:</span><p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{behaviorAnalysis.actionPlanSuggestion}</p></div>
                </div>
                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>Expert Insights:</span>
                  <div className="space-y-2">
                    {behaviorAnalysis.expertInsights.map((ins, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: "#1f8a5a" }}>{ins.scholarLens || "Development theory"}</span>
                        <strong className="font-bold block mt-1" style={{ color: "var(--arbor-ink)" }}>{ins.heading}</strong>
                        <p className="mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{ins.text}</p>
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
                <div className="text-center py-10 text-xs rounded-xl" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>No logs match these filters.</div>
              )}
              {grouped.map(([weekKey, logs]) => {
                const collapsed = collapsedWeeks[weekKey];
                return (
                  <div key={weekKey} className="space-y-2">
                    <button
                      onClick={() => setCollapsedWeeks((p) => ({ ...p, [weekKey]: !p[weekKey] }))}
                      className="w-full flex items-center justify-between text-[11px] font-bold rounded-lg px-3 py-2"
                      style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
                    >
                      <span>Week of {weekLabel(weekKey)} · {logs.length} {logs.length === 1 ? "entry" : "entries"}</span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                          {logs.map((log) => (
                            <div key={log.id} className="p-4 rounded-xl space-y-2.5 text-xs text-left" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                              <div className="flex justify-between items-start gap-3">
                                <div>
                                  <span className="font-bold text-sm" style={{ color: "var(--arbor-ink)" }}>{log.behaviorType}</span>
                                  <p className="text-[10px] mt-0.5" style={{ color: "var(--arbor-muted)" }}>{new Date(log.timestamp).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  {log.context && <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>{log.context}</span>}
                                  <span className="px-2 py-0.5 rounded font-extrabold" style={{ background: "#fbf1d4", color: "#a9780f" }}>Level {log.intensity}/5</span>
                                  <span className="px-2 py-0.5 rounded font-bold" style={{ background: "#e5f0fb", color: "#2f7bbf" }}>{log.durationMinutes}m</span>
                                  <button
                                    onClick={() => toggleLogResolved(log.id)}
                                    className="px-2 py-0.5 rounded font-bold flex items-center gap-1 transition"
                                    style={log.resolved ? { background: "#e4f4ec", color: "#1f8a5a" } : { background: "#fff", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                                  >
                                    <Check className="w-3 h-3" /> {log.resolved ? "Resolved" : "Mark resolved"}
                                  </button>
                                  <button
                                    onClick={() => startEditLog(log.id)}
                                    aria-label="Edit log"
                                    className="px-1.5 py-0.5 rounded transition"
                                    style={{ color: "var(--arbor-muted)" }}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => { if (window.confirm("Delete this log?")) deleteLog(log.id); }}
                                    aria-label="Delete log"
                                    className="px-1.5 py-0.5 rounded transition"
                                    style={{ color: "var(--arbor-muted)" }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                                <p><strong style={{ color: "var(--arbor-ink)" }}>Trigger:</strong> {log.trigger}</p>
                                <p><strong style={{ color: "var(--arbor-ink)" }}>Parent Action:</strong> {log.response}</p>
                              </div>
                              {log.notes && <p className="p-2 rounded italic bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}><strong style={{ color: "var(--arbor-ink)" }}>Observer Note:</strong> {log.notes}</p>}
                              {log.photoAttachment && (
                                <img src={log.photoAttachment} alt="log attachment" className="h-24 rounded-lg object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
                              )}

                              <div className="pt-2.5 mt-2 flex flex-col gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-semibold font-mono" style={{ color: "var(--arbor-muted)" }}>Arbor AI Coregulation Layer</span>
                                  <button type="button" onClick={() => handleGetInlineCoRegulationScript(log)} disabled={isGeneratingInlineScript[log.id]} className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>
                                    {isGeneratingInlineScript[log.id] ? (<><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...</>) : inlineCoRegulationScripts[log.id] ? (<><Sparkles className="w-3 h-3" /> Regenerate Script</>) : (<><Sparkles className="w-3 h-3" /> Generate AI Parent Script ➔</>)}
                                  </button>
                                </div>

                                <AnimatePresence initial={false}>
                                  {inlineCoRegulationScripts[log.id] && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-3 rounded-xl space-y-2 mt-1 text-[11px] leading-relaxed select-text overflow-hidden bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                                      <MarkdownBlock text={inlineCoRegulationScripts[log.id]} className="space-y-1.5" />
                                      <div className="flex justify-end pt-1 gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                                        <button type="button" onClick={() => { setChatInput(`Regarding the log event where the child did: "${log.trigger}" and parent responded: "${log.response}". Here is the script I generated: \n\n${inlineCoRegulationScripts[log.id]}\n\nHow do I adapt this if they continue to resist or act physically aggressive?`); setSelectedLens("Bowlby's Attachment Model"); setActiveTab("coach"); }} className="text-[10px] font-bold transition flex items-center gap-1" style={{ color: "#1f8a5a" }}>
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
