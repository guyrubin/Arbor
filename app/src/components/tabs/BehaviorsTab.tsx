import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HeartHandshake } from "lucide-react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Skeleton } from "../ui/Skeleton";
import { cardCls, PASTEL, type PastelKey } from "../ui/kit";
import { HubHero } from "../ui/HubHero";
import { T } from "../../lib/tokens";
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

/** behaviorType enum → {Material Symbols glyph, layout-kit tone} for the
 *  event-row icon tile + 5-dot meter. Glyph names match the .design-source mock
 *  (bolt / volume_up / sentiment_very_dissatisfied / block …). Layout-kit tones
 *  only (mint|coral|lav|yellow|pink|sky); unknown types fall back to coral so a
 *  row never renders blank. */
const TYPE_VISUAL: Record<string, { icon: string; tone: PastelKey }> = {
  "Transition Refusal": { icon: "bolt", tone: "coral" },
  "Sensory Overload": { icon: "volume_up", tone: "pink" },
  "Screentime Dispute": { icon: "devices", tone: "sky" },
  "Sibling Conflict": { icon: "group", tone: "lav" },
  "Food Refusal": { icon: "restaurant", tone: "yellow" },
  "Sleep Meltdown": { icon: "bedtime", tone: "lav" },
};
function typeVisual(type: string): { icon: string; tone: PastelKey } {
  return TYPE_VISUAL[type] ?? { icon: "monitoring", tone: "coral" };
}

/** behaviorType → the developmental-domain i18n key for the expanded chip.
 *  Deterministic; unmapped types fall back to Regulation. */
const TYPE_DOMAIN_KEY: Record<string, string> = {
  "Transition Refusal": "beh.domain.regulation",
  "Sensory Overload": "beh.domain.sensory",
  "Screentime Dispute": "beh.domain.regulation",
  "Sibling Conflict": "beh.domain.social",
  "Food Refusal": "beh.domain.independence",
  "Sleep Meltdown": "beh.domain.regulation",
};
function domainKeyOf(type: string): string {
  return TYPE_DOMAIN_KEY[type] ?? "beh.domain.regulation";
}

function weekLabel(key: string): string {
  const start = new Date(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

/** 5-dot intensity meter — dots filled by the type tone up to `intensity`,
 *  empties in --arbor-rule. Replaces the "Lv N" badge on the collapsed row
 *  (the numeric level stays available in the expanded meta + filters). */
function IntensityMeter({ intensity, tone }: { intensity: number; tone: PastelKey }) {
  const ink = PASTEL[tone].ink;
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${intensity} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="rounded-full"
          style={{ width: 7, height: 7, background: n <= intensity ? ink : "var(--arbor-rule)" }}
        />
      ))}
    </span>
  );
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
    seedCoach,
    setActiveTab,
    pendingCaptureMode,
    consumeCaptureRequest,
    childProfile,
    deleteLog,
    editingLogId,
    startEditLog,
    cancelEditLog,
    logsLoaded,
  } = useArbor();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, uiLang } = useLanguage();
  const behFirst = (childProfile.name || "").split(" ")[0];
  const captureCopy = uiLang === "he"
    ? {
        intro: "תעדו את הרגע בשתי שורות. אפשר להוסיף פרטים רק אם הם יעזרו אחר כך.",
        open: "תיעוד מהיר",
        close: "סגירה",
        details: "הוספת הקשר ופרטים",
        hideDetails: "פחות פרטים",
        happened: "מה קרה?",
        tried: "מה ניסיתם?",
        optional: "אופציונלי — עוזר לארבור לזהות הקשר לאורך זמן",
      }
    : {
        intro: "Capture the moment in two lines. Add detail only when it will help later.",
        open: "Quick capture",
        close: "Close",
        details: "Add context and details",
        hideDetails: "Show fewer details",
        happened: "What happened?",
        tried: "What did you try?",
        optional: "Optional — helps Arbor notice context over time",
      };

  // Voice-to-log
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  // Refs for the QuickLog tiles: scroll the form into view, focus the photo input.
  const formRef = useRef<HTMLFormElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const focusForm = (showDetails = false) => {
    setCaptureOpen(true);
    if (showDetails) setDetailsOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    });
  };
  const openPhoto = () => {
    focusForm(true);
    window.setTimeout(() => photoInputRef.current?.click(), 120);
  };

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
        toast(t("beh.toast.voiceParsed"), "success");
        return;
      }
      throw new Error("no json");
    } catch {
      // Fallback: keep the raw transcript so nothing is lost.
      setNewLogTrigger(text);
      toast(t("beh.toast.voiceFallback"), "info");
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
      toast(t("beh.toast.voiceUnsupported"), "error");
      return;
    }
    setListening(true);
    stopRef.current = startDictation({
      onResult: (text) => void parseVoice(text),
      onError: () => toast(t("beh.toast.voiceError"), "error"),
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
  // Single-open accordion for the event rows (design behOpen). Scripts are cached
  // by id in inlineCoRegulationScripts, so collapsing a row never loses one.
  const [openEventId, setOpenEventId] = useState<string | null>(null);

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

  // E2 hero stat trio — THIS-WEEK aggregates of PARENT-LOGGED events (last 7d):
  // events · avg intensity · resolved (N/total). These are aggregates of the
  // parent's own observations, NOT a child clinical score, so they clear the
  // firewall: no %, no 0–100, no verdict. "Resolved" stays in COUNT form
  // (`N/total`), never a resolution %.
  const heroStats = useMemo(() => {
    const now = Date.now();
    const last7 = behaviorLogs.filter((l) => now - new Date(l.timestamp).getTime() < 7 * DAY);
    const resolvedWeek = last7.filter((l) => l.resolved).length;
    const contexts = new Set(last7.map((l) => l.context).filter(Boolean)).size;
    return {
      events: last7.length,
      contexts,
      resolved: `${resolvedWeek}/${last7.length}`,
    };
  }, [behaviorLogs]);

  // Per-type 30-day FLAT COUNT (Wave-3 clinical subtraction, 2026-06-26).
  // Replaces the prior 30-day intensity-over-time sparkline series — a behavior-
  // intensity trend per type on a child metric = verdict-shaped (same firewall
  // class as TrendsChart). The replacement is a flat parent-log count per type
  // in the window; no time axis, no avg, no line, no verdict.
  const typeCounts30d = useMemo(() => {
    const now = Date.now();
    return types.map((type) => ({
      type,
      count: behaviorLogs.filter(
        (l) => l.behaviorType === type && now - new Date(l.timestamp).getTime() < 30 * DAY,
      ).length,
    }));
  }, [behaviorLogs, types]);

  const exportPdf = () => {
    const rows = filtered
      .map(
        (l) =>
          `<tr><td>${new Date(l.timestamp).toLocaleString()}</td><td>${escapeHtml(l.behaviorType)}</td><td>${l.context || ""}</td><td>${l.intensity}/5</td><td>${l.durationMinutes}m</td><td>${l.resolved ? t("beh.resolved") : t("beh.open")}</td><td>${escapeHtml(l.trigger)}</td><td>${escapeHtml(l.response)}</td></tr>`
      )
      .join("");
    // print stylesheet — intentional literals (printed report has its own static
    // palette; design tokens don't apply to the export window, m3-hex-sweep skip).
    const html = `<!doctype html><html><head><title>${t("beh.pdf.title")}</title>
      <style>body{font-family:Georgia,serif;color:#14160f;padding:32px} h1{font-size:20px} table{width:100%;border-collapse:collapse;font-size:11px;margin-top:16px} th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top} th{background:#f0ece0}</style>
      </head><body>
      <h1>${t("beh.pdf.heading")}</h1>
      <p>${t("beh.pdf.generated", { date: new Date().toLocaleString(), n: filtered.length })}</p>
      <table><thead><tr><th>${t("beh.pdf.col.when")}</th><th>${t("beh.pdf.col.type")}</th><th>${t("beh.pdf.col.where")}</th><th>${t("beh.pdf.col.intensity")}</th><th>${t("beh.pdf.col.duration")}</th><th>${t("beh.pdf.col.status")}</th><th>${t("beh.triggerField")}</th><th>${t("beh.parentAction")}</th></tr></thead><tbody>${rows}</tbody></table>
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

  // Save with clear, non-blocking feedback (replaces handleAddLog's blocking
  // alert, which read as "it didn't save even though I typed something").
  const submitLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      toast(t("beh.toast.fillBoth"), "error");
      return;
    }
    const wasEditing = !!editingLogId;
    handleAddLog(e);
    toast(wasEditing ? t("beh.toast.updated") : t("beh.toast.logged"), "success");
    setCaptureOpen(false);
    setDetailsOpen(false);
  };

  // QuickLog tiles — shortcuts INTO the existing form (no new capability).
  // Glyphs match the mock log-modes (mic / photo_camera / keyboard).
  const quickModes: { key: string; icon: string; label: string; onClick: () => void; tone: PastelKey }[] = [
    { key: "voice", icon: "mic", label: t("beh.mode.voice"), onClick: () => { focusForm(); toggleVoice(); }, tone: "mint" },
    { key: "photo", icon: "photo_camera", label: t("beh.mode.photo"), onClick: openPhoto, tone: "sky" },
    { key: "text", icon: "keyboard", label: t("beh.mode.text"), onClick: () => focusForm(), tone: "coral" },
  ];

  // A capture entry tile elsewhere (Journal) named the modality it promised —
  // open that mode here, then clear the request so it fires exactly once.
  useEffect(() => {
    if (!pendingCaptureMode) return;
    quickModes.find((m) => m.key === pendingCaptureMode)?.onClick();
    consumeCaptureRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCaptureMode]);

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-full min-w-0 max-w-[1180px] space-y-6">
      {/* E2 — the shared hub-hero grammar (replaces PageHeader + the hand-rolled
          coral hero; same job, one kit). Warm tone; stat trio = this-week flat
          counts only — no averages, no trends (clinical firewall). */}
      <HubHero
        tone="coral"
        icon={HeartHandshake}
        eyebrow={t("beh.hero.tag")}
        title={t("beh.hero.title", { name: behFirst })}
        subtitle={t("beh.hero.sub")}
        stats={[
          { value: heroStats.events, label: t("beh.stats.events") },
          { value: heroStats.contexts, label: t("beh.stats.contexts") },
          { value: heroStats.resolved, label: t("beh.stats.resolved") },
        ]}
        testId="behaviors-hub-hero"
      />

      <section className={`${cardCls} overflow-hidden`} aria-labelledby="behavior-next-step">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-peach-ink)" }}>{t("beh.next.eyebrow")}</span>
            <h2 id="behavior-next-step" className="mt-1 text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{t("beh.next.title")}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("beh.next.body")}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-shrink-0">
            <button type="button" onClick={() => focusForm()} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition active:scale-[0.98] sm:flex-none" style={{ background: T.gradientCta }}>
              <Icon name="add_circle" size={18} /> {t("beh.next.log")}
            </button>
            <button type="button" onClick={() => setActiveTab("plans")} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition sm:flex-none" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}>
              <Icon name="route" size={18} /> {t("beh.next.plan")}
            </button>
          </div>
        </div>
        <ol className="grid grid-cols-1 border-t sm:grid-cols-3" style={{ borderColor: "var(--arbor-rule)" }}>
          {(["capture", "notice", "try"] as const).map((step, index) => (
            <li key={step} className="flex items-center gap-3 px-5 py-3.5 sm:border-s first:sm:border-s-0" style={{ borderColor: "var(--arbor-rule)" }}>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-extrabold" style={{ background: index === 0 ? "var(--arbor-peach-soft)" : "var(--arbor-paper-deep)", color: index === 0 ? "var(--arbor-peach-ink)" : "var(--arbor-muted)" }}>{index + 1}</span>
              <span className="text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{t(`beh.next.${step}`)}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Row 1 — QuickLog tiles (full width under the hero) */}
      <div className="grid grid-cols-1 gap-3">
        {/* QuickLog mode tiles — Voice / Photo / Text */}
        <div className={`${cardCls} p-5 flex flex-col`}>
          <span className="text-xs font-extrabold uppercase tracking-wider mb-3" style={{ color: "var(--arbor-green-ink)" }}>{t("beh.captureTitle")}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 flex-1">
            {quickModes.map((m) => {
              const p = PASTEL[m.tone];
              const active = m.key === "voice" && listening;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={m.onClick}
                  className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-5 transition active:scale-[0.98] ${active ? "animate-pulse" : ""}`}
                  style={{ background: p.soft, color: p.ink, border: "1px solid var(--arbor-rule)" }}
                >
                  <Icon name={m.icon} size={24} />
                  <span className="text-xs font-extrabold">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 2 — events main column + right rail (patterns) */}
      <div className="grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Main column: events + the full log form */}
        <div className="min-w-0 space-y-6">
          <div className={`${cardCls} p-5 space-y-4`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--arbor-ink)" }}>{t("beh.activeLogs")}</h3>
                <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{t("beh.entriesOf", { n: filtered.length, total: behaviorLogs.length })}</p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:ms-auto sm:w-auto">
                <button onClick={exportPdf} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-bold transition sm:flex-none" style={{ border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}>
                  <Icon name="download" size={15} style={{ color: "var(--arbor-green-ink)" }} /> {t("beh.exportPdf")}
                </button>
                <button onClick={handleAnalyzeBehaviors} disabled={isAnalyzingBehavior} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold text-white transition disabled:opacity-60 sm:flex-none" style={{ background: T.gradientCta }}>
                  {isAnalyzingBehavior ? (<><Icon name="progress_activity" size={15} className="animate-spin" /> {t("beh.synthesizing")}</>) : (<><Icon name="psychology" size={15} /> {t("beh.analyze")}</>)}
                </button>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("beh.searchPlaceholder")} className="min-h-11 min-w-0 flex-[1_1_220px] rounded-xl px-3 py-2 focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="min-h-11 min-w-0 flex-[1_1_150px] rounded-xl px-2 py-2 sm:max-w-[220px]" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">{t("beh.allTypes")}</option>
                {types.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
              <select value={intensityFilter} onChange={(e) => setIntensityFilter(e.target.value)} className="min-h-11 min-w-0 flex-[1_1_130px] rounded-xl px-2 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">{t("beh.anyIntensity")}</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{t("beh.level", { n })}</option>)}
              </select>
              <select value={resolvedFilter} onChange={(e) => setResolvedFilter(e.target.value)} className="min-h-11 min-w-0 flex-[1_1_120px] rounded-xl px-2 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="all">{t("beh.allStatus")}</option>
                <option value="open">{t("beh.open")}</option>
                <option value="resolved">{t("beh.resolved")}</option>
              </select>
              <button onClick={resetFilters} className="flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}><Icon name="restart_alt" size={13} /> {t("beh.reset")}</button>
            </div>

            {behaviorAnalysis && (
              // m3-hex-sweep: #eef6f1 insight-wash start has no m2 token yet; left
              // as-is per spec (would become --gradient-insight if m2 adds it).
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="p-5 rounded-2xl space-y-4 text-xs" style={{ background: "linear-gradient(120deg,#eef6f1,var(--arbor-lav-soft))", border: "1px solid var(--arbor-rule)" }}>
                <h4 className="text-sm font-extrabold flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}><Icon name="auto_awesome" size={15} fill={1} /> {t("beh.patternShows")}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("beh.responseEval")}</span><p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{behaviorAnalysis.effectivenessRating}</p></div>
                  <div className="space-y-2"><span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("beh.devRec")}</span><p className="leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{behaviorAnalysis.actionPlanSuggestion}</p></div>
                </div>
                <div className="space-y-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <span className="font-bold block" style={{ color: "var(--arbor-ink)" }}>{t("beh.expertInsights")}</span>
                  <div className="space-y-2">
                    {behaviorAnalysis.expertInsights.map((ins, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block" style={{ color: "var(--arbor-green-ink)" }}>{ins.scholarLens || t("beh.theoryFallback")}</span>
                        <strong className="font-bold block mt-1" style={{ color: "var(--arbor-ink)" }}>{ins.heading}</strong>
                        <p className="mt-0.5 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{ins.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Capability-depth: the analysis is no longer a dead-end report.
                    One tap carries the detected pattern + the suggested plan into
                    Ask Arbor (the same setChatInput -> coach route the inline-script
                    "Discuss in Coach" button uses). Surfaces existing AI content;
                    adds no new claim. */}
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                  <button
                    onClick={() => {
                      seedCoach({ prompt: `${t("beh.analyzeCoachPrompt", { name: behFirst })}\n\n${behaviorAnalysis.actionPlanSuggestion}`, source: "behavior-analysis" });
                    }}
                    className="inline-flex items-center gap-2 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition active:scale-[0.98]"
                    style={{ background: T.gradientCta }}
                  >
                    <Icon name="auto_awesome" size={15} fill={1} /> {t("beh.analyzeCoachCta")}
                  </button>
                </div>
              </motion.div>
            )}

            {/* Weekly grouped logs — expandable event rows */}
            <div className="space-y-4 max-h-[520px] overflow-y-auto pe-1">
              {!logsLoaded && (
                <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
              )}
              {logsLoaded && grouped.length === 0 && (
                <div className="text-center py-10 text-xs rounded-xl" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>{t("beh.noMatch")}</div>
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
                      <span>{t("beh.weekOf")} {weekLabel(weekKey)} · {logs.length} {logs.length === 1 ? t("beh.entry") : t("beh.entries")}</span>
                      <Icon name="expand_more" size={18} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    </button>

                    <AnimatePresence initial={false}>
                      {!collapsed && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-2.5 overflow-hidden">
                          {logs.map((log) => {
                            const tv = typeVisual(log.behaviorType);
                            const tonePal = PASTEL[tv.tone];
                            const isOpen = openEventId === log.id;
                            return (
                              <div key={log.id} className="rounded-xl text-xs text-start" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                                {/* Collapsed row header — click to expand */}
                                <button
                                  type="button"
                                  onClick={() => setOpenEventId(isOpen ? null : log.id)}
                                  aria-expanded={isOpen}
                                  className="w-full flex items-center gap-3 p-3 text-start"
                                >
                                  <span className="inline-flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 42, height: 42, background: tonePal.soft, color: tonePal.ink }}>
                                    <Icon name={tv.icon} size={22} />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm truncate" style={{ color: "var(--arbor-ink)" }}>{log.behaviorType}</div>
                                    <div className="text-[10px] mt-0.5 flex items-center gap-2" style={{ color: "var(--arbor-muted)" }}>
                                      <span className="truncate">{log.context ? `${log.context} · ` : ""}{new Date(log.timestamp).toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <span className="hidden min-[520px]:inline-flex"><IntensityMeter intensity={log.intensity} tone={tv.tone} /></span>
                                  {/* Status icon — resolved (mint check_circle) / open (amber pending) */}
                                  {log.resolved
                                    ? <Icon name="check_circle" size={20} fill={1} style={{ color: "var(--arbor-green-ink)" }} aria-label={t("beh.resolved")} />
                                    : <Icon name="pending" size={20} style={{ color: "var(--arbor-yellow-ink)" }} aria-label={t("beh.open")} />}
                                  <Icon name="expand_more" size={18} className={`flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--arbor-muted)" }} />
                                </button>

                                {/* Expanded detail */}
                                <AnimatePresence initial={false}>
                                  {isOpen && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                      <div className="px-3 pb-3 space-y-2.5">
                                        {/* domain + trigger chips */}
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-bold text-[10px]" style={{ background: tonePal.soft, color: tonePal.ink }}>{t(domainKeyOf(log.behaviorType))}</span>
                                          {log.context && <span className="inline-flex items-center px-2.5 py-1 rounded-full font-bold text-[10px]" style={{ background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>{log.context}</span>}
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-bold text-[10px]" style={{ background: "var(--arbor-sky-soft)", color: "var(--arbor-sky-ink)" }}>{log.durationMinutes}m</span>
                                          <span className="inline-flex items-center px-2.5 py-1 rounded-full font-extrabold text-[10px]" style={{ background: "var(--arbor-yellow-soft)", color: "var(--arbor-yellow-ink)" }}>{t("beh.level", { n: log.intensity })}</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                                          <p><strong style={{ color: "var(--arbor-ink)" }}>{t("beh.triggerField")}</strong> {log.trigger}</p>
                                          <p><strong style={{ color: "var(--arbor-ink)" }}>{t("beh.parentAction")}</strong> {log.response}</p>
                                        </div>
                                        {log.notes && <p className="p-2 rounded italic bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}><strong style={{ color: "var(--arbor-ink)" }}>{t("beh.observerNote")}</strong> {log.notes}</p>}
                                        {log.photoAttachment && (
                                          <img src={log.photoAttachment} alt={t("beh.logPhotoAlt")} className="h-24 rounded-lg object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
                                        )}

                                        {/* action cluster — resolve / edit / delete */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            onClick={() => toggleLogResolved(log.id)}
                                            className="px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition text-[10px]"
                                            style={log.resolved ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" } : { background: T.paperElevated, color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                                          >
                                            <Icon name="check" size={13} /> {log.resolved ? t("beh.resolved") : t("beh.markResolved")}
                                          </button>
                                          <button
                                            onClick={() => { startEditLog(log.id); focusForm(true); }}
                                            aria-label={t("beh.editLogAria")}
                                            className="px-2 py-1 rounded-lg transition flex items-center gap-1 text-[10px]"
                                            style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                                          >
                                            <Icon name="edit" size={13} /> {t("beh.editMoment")}
                                          </button>
                                          <button
                                            onClick={() => { if (window.confirm(t("beh.deleteConfirm"))) deleteLog(log.id); }}
                                            aria-label={t("beh.deleteLogAria")}
                                            className="px-2 py-1 rounded-lg transition"
                                            style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                                          >
                                            <Icon name="delete" size={13} />
                                          </button>
                                        </div>

                                        {/* co-regulation script */}
                                        <div className="pt-2.5 mt-1 flex flex-col gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                                          <div className="flex flex-col items-start gap-2 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }}>
                                              <Icon name="record_voice_over" size={14} fill={1} /> {t("beh.coRegScript")}
                                            </span>
                                            <button type="button" onClick={() => handleGetInlineCoRegulationScript(log)} disabled={isGeneratingInlineScript[log.id]} className="flex min-h-9 max-w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-start text-[10px] font-extrabold uppercase tracking-wider transition-all" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
                                              {isGeneratingInlineScript[log.id] ? (<><Icon name="progress_activity" size={13} className="animate-spin" /> {t("beh.analyzing")}</>) : inlineCoRegulationScripts[log.id] ? (<><Icon name="auto_awesome" size={13} fill={1} /> {t("beh.regenerateScript")}</>) : (<><Icon name="auto_awesome" size={13} fill={1} /> {t("beh.generateScript")}</>)}
                                            </button>
                                          </div>

                                          <AnimatePresence initial={false}>
                                            {inlineCoRegulationScripts[log.id] && (
                                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-3 rounded-xl space-y-2 mt-1 text-[11px] leading-relaxed select-text overflow-hidden bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
                                                <MarkdownBlock text={inlineCoRegulationScripts[log.id]} className="space-y-1.5" />
                                                <div className="flex justify-end pt-1 gap-2" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
                                                  <button type="button" onClick={() => seedCoach({ prompt: `Regarding the log event where the child did: "${log.trigger}" and parent responded: "${log.response}". Here is the script I generated: \n\n${inlineCoRegulationScripts[log.id]}\n\nHow do I adapt this if they continue to resist or act physically aggressive?`, lens: "Bowlby's Attachment Model", source: "behavior-coreg" })} className="text-[10px] font-bold transition flex items-center gap-1" style={{ color: "var(--arbor-green-ink)" }}>
                                                    {t("beh.discussCoach")} <Icon name="open_in_new" size={11} />
                                                  </button>
                                                </div>
                                              </motion.div>
                                            )}
                                          </AnimatePresence>
                                        </div>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full log-entry form — the "Text" QuickLog target; also the edit surface.
              Kept fully reachable (scrolled to via the tiles) and unchanged in
              capability. */}
          <AnimatePresence initial={false}>
          {(captureOpen || !!editingLogId) && (
          <motion.form
            ref={formRef}
            onSubmit={submitLog}
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            className={`${cardCls} min-w-0 overflow-hidden p-4 text-sm sm:p-5`}
          >
            <div className="flex items-start justify-between gap-3 pb-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
              <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-lg" style={{ fontFamily: "var(--font-display)", fontWeight: 600, color: "var(--arbor-ink)" }}>
                {editingLogId ? <Icon name="edit" size={18} style={{ color: "var(--arbor-green-ink)" }} /> : <Icon name="add" size={18} style={{ color: "var(--arbor-green-ink)" }} />}
                {editingLogId ? t("beh.editMoment") : captureCopy.open}
              </h3>
              <p className="mt-1 max-w-xl text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{captureCopy.intro}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={toggleVoice}
                disabled={parsing}
                title={t("beh.speakToLog")}
                className={`flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-lg transition ${listening ? "animate-pulse" : ""}`}
                style={listening
                  ? { background: "var(--arbor-pink-soft)", color: "var(--arbor-pink-ink)", border: "1px solid rgba(189,79,116,0.40)" }
                  : { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.30)" }}
              >
                {parsing ? <Icon name="progress_activity" size={15} className="animate-spin" /> : listening ? <Icon name="stop" size={15} fill={1} /> : <Icon name="mic" size={15} />}
                {parsing ? t("beh.parsing") : listening ? t("beh.stop") : t("beh.speak")}
              </button>
              {!editingLogId && (
                <button type="button" onClick={() => { setCaptureOpen(false); setDetailsOpen(false); }} aria-label={captureCopy.close} className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)" }}>
                  <Icon name="close" size={16} />
                </button>
              )}
              </div>
            </div>

            <div className="mt-4 space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.typeLabel")}</label>
              <select value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="min-h-11 w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
                <option value="Transition Refusal">{t("beh.type.transition")}</option>
                <option value="Sensory Overload">{t("beh.type.sensory")}</option>
                <option value="Screentime Dispute">{t("beh.type.screen")}</option>
                <option value="Sibling Conflict">{t("beh.type.sibling")}</option>
                <option value="Food Refusal">{t("beh.type.food")}</option>
                <option value="Sleep Meltdown">{t("beh.type.sleep")}</option>
              </select>
            </div>

            <AnimatePresence initial={false}>
            {detailsOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4 overflow-hidden">
            <div className="p-3 rounded-xl space-y-1.5" style={{ background: "var(--arbor-peach-soft)" }}>
              <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1" style={{ color: "var(--arbor-peach-ink)" }}>
                <Icon name="auto_awesome" size={13} fill={1} />
                {t("beh.quickFill")}
              </span>
              <div className="flex flex-wrap gap-1">
                <button type="button" onClick={() => autofillLogTemplate("morning")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>{t("beh.qf.morning")}</button>
                <button type="button" onClick={() => autofillLogTemplate("screen")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>{t("beh.qf.screen")}</button>
                <button type="button" onClick={() => autofillLogTemplate("sibling")} className="px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer bg-white" style={{ color: "var(--arbor-ink)" }}>{t("beh.qf.sibling")}</button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.whereLabel")}</label>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {CONTEXTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewLogContext(c)}
                    className="py-1.5 rounded-lg text-[10px] font-bold transition"
                    style={newLogContext === c ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid rgba(52,178,119,0.40)" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.intensity")}</label>
                <input type="range" min="1" max="5" value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full mt-2.5" style={{ accentColor: "var(--arbor-clay)" }} />
                <span className="text-[10px] font-bold text-center block" style={{ color: "var(--arbor-green-ink)" }}>{t("beh.level", { n: newLogIntensity })}</span>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.duration")}</label>
                <input type="number" min="2" value={newLogDuration} onChange={(e) => setNewLogDuration(parseInt(e.target.value) || 5)} className="w-full rounded-xl p-2 text-xs text-center" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
              </div>
            </div>
            </motion.div>
            )}
            </AnimatePresence>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-ink)" }}>{captureCopy.happened} <span style={{ color: "var(--arbor-peach-ink)" }}>*</span></label>
              <input type="text" value={newLogTrigger} onChange={(e) => setNewLogTrigger(e.target.value)} placeholder={t("beh.triggerPlaceholder")} className="min-h-11 w-full rounded-xl p-3 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>

            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-ink)" }}>{captureCopy.tried} <span style={{ color: "var(--arbor-peach-ink)" }}>*</span></label>
              <input type="text" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("beh.responsePlaceholder")} className="min-h-11 w-full rounded-xl p-3 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>

            <button type="button" onClick={() => setDetailsOpen((open) => !open)} className="mt-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-start" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }} aria-expanded={detailsOpen}>
              <span className="min-w-0">
                <span className="block text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{detailsOpen ? captureCopy.hideDetails : captureCopy.details}</span>
                {!detailsOpen && <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: "var(--arbor-muted)" }}>{captureCopy.optional}</span>}
              </span>
              <Icon name={detailsOpen ? "expand_less" : "expand_more"} size={18} style={{ color: "var(--arbor-muted)" }} />
            </button>

            <AnimatePresence initial={false}>
            {detailsOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-4 overflow-hidden">
            <div className="space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.notes")}</label>
              <textarea value={newLogNotes} onChange={(e) => setNewLogNotes(e.target.value)} rows={2} placeholder={t("beh.notesPlaceholder")} className="w-full rounded-xl p-2 text-xs" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold block" style={{ color: "var(--arbor-muted)" }}>{t("beh.photo")}</label>
              {newLogPhoto ? (
                <div className="relative inline-block">
                  <img src={newLogPhoto} alt="attachment" className="h-20 rounded-lg object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
                  <button type="button" onClick={() => setNewLogPhoto("")} className="absolute -top-2 -right-2 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-black" style={{ background: "var(--arbor-pink-ink)" }}>×</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-[11px] rounded-xl px-3 py-2 cursor-pointer transition" style={{ color: "var(--arbor-muted)", background: "var(--arbor-paper-deep)", border: "1px dashed var(--arbor-rule-strong)" }}>
                  <Icon name="add_a_photo" size={15} style={{ color: "var(--arbor-green-ink)" }} /> {t("beh.addPhoto")}
                  <input
                    ref={photoInputRef}
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
                        toast(t("beh.toast.imageError"), "error");
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
            </motion.div>
            )}
            </AnimatePresence>

            <div className="mt-5 flex gap-2">
              <button type="submit" className="flex-1 py-3 transition text-white font-extrabold text-xs rounded-xl active:scale-[0.98]" style={{ background: T.gradientCta }}>
                {editingLogId ? t("beh.update") : t("beh.save")}
              </button>
              {editingLogId && (
                <button type="button" onClick={cancelEditLog} className="px-4 py-3 font-bold text-xs rounded-xl transition" style={{ background: T.paperElevated, border: "1px solid var(--arbor-rule)", color: "var(--arbor-muted)" }}>
                  {t("beh.cancel")}
                </button>
              )}
            </div>
          </motion.form>
          )}
          </AnimatePresence>
        </div>

        {/* Right rail — detected patterns + flat-count card */}
        <div className="min-w-0 space-y-6">
          <PatternInsights logs={behaviorLogs} />

          {/* Per-type 30-day FLAT COUNT (Wave-3 clinical subtraction). Replaces
              the prior per-type intensity sparkline cluster — a behavior-intensity
              trend on a child metric = verdict-shaped. Now a flat parent-log
              count per type in the window; no time axis, no avg, no verdict. */}
          {typeCounts30d.length > 0 && (
            <div className={`${cardCls} p-5 space-y-3`}>
              <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-green-ink)" }}>{t("beh.countLabel")}</span>
              <div className="space-y-2">
                {typeCounts30d.map(({ type, count }) => (
                  <div key={type} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                    <span className="text-[11px] truncate" style={{ color: "var(--arbor-muted)" }}>{type}</span>
                    <span className="text-[11px] font-bold flex-shrink-0" style={{ color: "var(--arbor-ink)" }}>
                      {t("beh.countEntry", { count })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
