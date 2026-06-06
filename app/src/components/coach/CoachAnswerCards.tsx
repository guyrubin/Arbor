import React, { useState } from "react";
import {
  Lightbulb, ListChecks, MessageSquareQuote, Ban, Eye, AlertTriangle,
  Volume2, Square, Copy, ListPlus, ClipboardList, Send, Compass, Check,
} from "lucide-react";
import type { CoachContract } from "../../types";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";

/**
 * Generative answer surface (v6 UX-3 / v5 GUI-1·2·3). Renders the coach's real
 * structured `contract` as an attributed, actionable card stack instead of a
 * markdown wall — each block is a thing the parent can DO (check off, say aloud,
 * save to a plan, prefill a log, hand off). The data already exists server-side;
 * this stops it being flattened to prose and regex-scraped.
 */

const RISK_TONE: Record<string, { fg: string; bg: string; label: string }> = {
  low: { fg: "#6f9e6f", bg: "rgba(111,158,111,0.12)", label: "Low" },
  moderate: { fg: "#d7aa55", bg: "rgba(215,170,85,0.12)", label: "Moderate" },
  elevated: { fg: "#d7aa55", bg: "rgba(215,170,85,0.12)", label: "Elevated" },
  high: { fg: "#e2562d", bg: "rgba(226,86,45,0.14)", label: "High" },
  severe: { fg: "#e2562d", bg: "rgba(226,86,45,0.14)", label: "Severe" },
  urgent: { fg: "#e2562d", bg: "rgba(226,86,45,0.14)", label: "Urgent" },
};

const FRAME_LABELS: Record<string, string> = {
  aim: "Aim", twoAxes: "Warmth ↔ Structure", story: "Story",
  shadow: "Hard feeling", marriage: "Co-parent", shepherd: "Who holds next",
};

function Panel({ icon, title, tint, children, action }: {
  icon: React.ReactNode; title: string; tint: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: tint }}>
          {icon} {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function CoachAnswerCards({ contract, lens, onSaveToPlan, onCreateLog, onAddToHandoff }: {
  contract: CoachContract;
  lens?: string;
  onSaveToPlan: (topic: string) => void;
  onCreateLog: () => void;
  onAddToHandoff: (note: string) => void;
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const risk = RISK_TONE[(contract.riskLevel || "low").toLowerCase()] || RISK_TONE.low;
  const showLens = lens && lens !== "Integrated Balanced";

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  const sayScript = () => {
    if (!ttsSupported()) return;
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(true);
    speak(contract.parentScript, () => setSpeaking(false));
  };

  const frames = Object.entries(contract.frameRouting || {}).filter(([, v]) => v && String(v).trim());

  return (
    <div className="space-y-2.5">
      {/* Meta header: attribution + age + domains + risk */}
      <div className="flex flex-wrap items-center gap-1.5">
        {showLens && (
          <span className="text-[10px] font-bold bg-[#d7aa55]/12 text-[#f4d991] px-2 py-0.5 rounded-full">Aligned with {lens}</span>
        )}
        {contract.ageBand && <span className="text-[10px] font-bold bg-white/5 text-[#a8a093] px-2 py-0.5 rounded-full">{contract.ageBand}</span>}
        {contract.domains?.slice(0, 3).map((d) => (
          <span key={d} className="text-[10px] font-bold bg-white/5 text-[#a8a093] px-2 py-0.5 rounded-full">{d.replace(/_/g, " ")}</span>
        ))}
        <span className="text-[10px] font-black px-2 py-0.5 rounded-full ml-auto" style={{ color: risk.fg, background: risk.bg }}>Risk: {risk.label}</span>
      </div>

      {/* What may be happening */}
      {contract.nonDiagnosticHypotheses?.length > 0 && (
        <Panel icon={<Lightbulb className="w-3 h-3" />} title="What may be happening" tint="#f4d991">
          <ul className="space-y-1.5">
            {contract.nonDiagnosticHypotheses.map((h, i) => (
              <li key={i} className="text-[12.5px] leading-snug text-gray-200">
                <span className="font-bold text-white">{h.label}</span>
                {h.confidence && <span className="ml-1.5 text-[10px] font-bold text-[#a8a093]">({h.confidence})</span>}
                {h.rationale && <span className="block text-[#a8a093] mt-0.5">{h.rationale}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Today's plan — interactive checklist */}
      {contract.todayPlan?.length > 0 && (
        <Panel
          icon={<ListChecks className="w-3 h-3" />} title="Try today" tint="#6f9e6f"
          action={
            <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan[0])}
              className="text-[10px] font-bold text-[#a8a093] hover:text-white inline-flex items-center gap-1">
              <ListPlus className="w-3 h-3" /> Save as plan
            </button>
          }
        >
          <ul className="space-y-1">
            {contract.todayPlan.map((step, i) => (
              <li key={i}>
                <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="flex items-start gap-2 text-left w-full group">
                  <span className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition ${done[i] ? "bg-[#6f9e6f] border-[#6f9e6f]" : "border-white/20 group-hover:border-white/40"}`}>
                    {done[i] && <Check className="w-3 h-3 text-black" />}
                  </span>
                  <span className={`text-[12.5px] leading-snug ${done[i] ? "text-gray-500 line-through" : "text-gray-200"}`}>{step}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Parent script — say aloud */}
      {contract.parentScript && (
        <Panel
          icon={<MessageSquareQuote className="w-3 h-3" />} title="Say this" tint="#7aa7d0"
          action={
            <div className="flex items-center gap-2">
              {ttsSupported() && (
                <button onClick={sayScript} className="text-[10px] font-bold text-[#a8a093] hover:text-white inline-flex items-center gap-1">
                  {speaking ? <><Square className="w-3 h-3" /> Stop</> : <><Volume2 className="w-3 h-3" /> Say it aloud</>}
                </button>
              )}
              <button onClick={() => copy(contract.parentScript, "script")} className="text-[10px] font-bold text-[#a8a093] hover:text-white inline-flex items-center gap-1">
                {copied === "script" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed text-white italic">&ldquo;{contract.parentScript}&rdquo;</p>
        </Panel>
      )}

      {/* Avoid / Observe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {contract.avoid?.length > 0 && (
          <Panel icon={<Ban className="w-3 h-3" />} title="Avoid" tint="#cf8a6f">
            <ul className="space-y-1 text-[12px] text-[#a8a093] leading-snug list-disc pl-4">
              {contract.avoid.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Panel>
        )}
        {contract.observe?.length > 0 && (
          <Panel icon={<Eye className="w-3 h-3" />} title="Watch for" tint="#a89bd6">
            <ul className="space-y-1 text-[12px] text-[#a8a093] leading-snug list-disc pl-4">
              {contract.observe.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Panel>
        )}
      </div>

      {/* Escalate */}
      {contract.escalateIf?.length > 0 && (
        <Panel icon={<AlertTriangle className="w-3 h-3" />} title="Reach out for help if" tint="#e2562d">
          <ul className="space-y-1 text-[12px] leading-snug list-disc pl-4" style={{ color: "#e9a48f" }}>
            {contract.escalateIf.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Panel>
      )}

      {/* Six-frame routing chips (SF-2) */}
      {frames.length > 0 && (
        <Panel icon={<Compass className="w-3 h-3" />} title="Developmental frame" tint="#d7aa55">
          <div className="flex flex-wrap gap-1.5">
            {frames.map(([k, v]) => (
              <span key={k} className="text-[10.5px] leading-tight bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1">
                <span className="font-black text-[#f4d991]">{FRAME_LABELS[k] || k}:</span>{" "}
                <span className="text-[#a8a093]">{String(v)}</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Structured actions — the answer feeds the rest of the app (ECO-3) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan?.[0] || "")}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-[#d7aa55]/10 hover:bg-[#d7aa55]/20 text-[#f4d991] border border-[#d7aa55]/25 px-2.5 py-1.5 rounded-lg transition">
          <ListPlus className="w-3.5 h-3.5" /> Save to plan
        </button>
        <button onClick={onCreateLog}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition">
          <ClipboardList className="w-3.5 h-3.5" /> Log a moment
        </button>
        {contract.handoffNotes?.teacher && (
          <button onClick={() => { onAddToHandoff(contract.handoffNotes.teacher); copy(contract.handoffNotes.teacher, "handoff"); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/5 hover:bg-white/10 text-[#a8a093] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition">
            {copied === "handoff" ? <><Check className="w-3.5 h-3.5" /> Copied note</> : <><Send className="w-3.5 h-3.5" /> Teacher note</>}
          </button>
        )}
      </div>
    </div>
  );
}
