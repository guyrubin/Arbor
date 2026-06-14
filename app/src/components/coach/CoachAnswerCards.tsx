import React, { useState } from "react";
import {
  Lightbulb, ListChecks, MessageSquareQuote, Ban, Eye, AlertTriangle,
  Volume2, Square, Copy, ListPlus, ClipboardList, Send, Compass, Check, Users,
} from "lucide-react";
import type { CoachContract, CouncilTake } from "../../types";
import { speak, stopSpeaking, ttsSupported } from "../../lib/tts";

/**
 * Generative answer surface (v6 UX-3 / v5 GUI-1·2·3). Renders the coach's real
 * structured `contract` as an attributed, actionable card stack instead of a
 * markdown wall — each block is a thing the parent can DO (check off, say aloud,
 * save to a plan, prefill a log, hand off). The data already exists server-side;
 * this stops it being flattened to prose and regex-scraped.
 */

const RISK_TONE: Record<string, { fg: string; bg: string; label: string }> = {
  low: { fg: "var(--arbor-green-ink)", bg: "var(--arbor-green-soft)", label: "Low" },
  moderate: { fg: "var(--arbor-yellow-ink)", bg: "var(--arbor-yellow-soft)", label: "Moderate" },
  elevated: { fg: "var(--arbor-yellow-ink)", bg: "var(--arbor-yellow-soft)", label: "Elevated" },
  high: { fg: "var(--arbor-pink-ink)", bg: "var(--arbor-pink-soft)", label: "High" },
  severe: { fg: "var(--arbor-pink-ink)", bg: "var(--arbor-pink-soft)", label: "Severe" },
  urgent: { fg: "var(--arbor-pink-ink)", bg: "var(--arbor-pink-soft)", label: "Urgent" },
};

const FRAME_LABELS: Record<string, string> = {
  aim: "Aim", twoAxes: "Warmth ↔ Structure", story: "Story",
  shadow: "Hard feeling", marriage: "Co-parent", shepherd: "Who holds next",
};

function Panel({ icon, title, tint, children, action }: {
  icon: React.ReactNode; title: string; tint: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-3.5 bg-white" style={{ border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ color: tint }}>
          {icon} {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function CoachAnswerCards({ contract, lens, council, onSaveToPlan, onCreateLog, onAddToHandoff }: {
  contract: CoachContract;
  lens?: string;
  council?: CouncilTake[];
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
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>Aligned with {lens}</span>
        )}
        {contract.ageBand && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{contract.ageBand}</span>}
        {contract.domains?.slice(0, 3).map((d) => (
          <span key={d} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{d.replace(/_/g, " ")}</span>
        ))}
        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full ml-auto" style={{ color: risk.fg, background: risk.bg }}>Risk: {risk.label}</span>
      </div>

      {/* Scholar council — each agent's lens, before the synthesis (SAGE-2) */}
      {council && council.length > 0 && (
        <Panel icon={<Users className="w-3 h-3" />} title={`The council weighed in · ${council.length} voices`} tint="var(--arbor-sky-ink)">
          <ul className="space-y-2">
            {council.map((c) => (
              <li key={c.scholarId} className="text-[12.5px] leading-snug">
                <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{c.name}</span>
                <span className="text-[10px] font-bold" style={{ color: "var(--arbor-muted)" }}> · {c.concept}</span>
                {c.takeaway && <span className="block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{c.takeaway}</span>}
                {c.suggestion && <span className="block mt-0.5" style={{ color: "var(--arbor-ink)" }}>→ {c.suggestion}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* What may be happening */}
      {contract.nonDiagnosticHypotheses?.length > 0 && (
        <Panel icon={<Lightbulb className="w-3 h-3" />} title="What may be happening" tint="var(--arbor-yellow-ink)">
          <ul className="space-y-1.5">
            {contract.nonDiagnosticHypotheses.map((h, i) => (
              <li key={i} className="text-[12.5px] leading-snug" style={{ color: "var(--arbor-ink)" }}>
                <span className="font-bold" style={{ color: "var(--arbor-ink)" }}>{h.label}</span>
                {h.confidence && <span className="ml-1.5 text-[10px] font-bold" style={{ color: "var(--arbor-muted)" }}>({h.confidence})</span>}
                {h.rationale && <span className="block mt-0.5" style={{ color: "var(--arbor-muted)" }}>{h.rationale}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Today's plan — interactive checklist */}
      {contract.todayPlan?.length > 0 && (
        <Panel
          icon={<ListChecks className="w-3 h-3" />} title="Try today" tint="var(--arbor-green-ink)"
          action={
            <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan[0])}
              className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
              <ListPlus className="w-3 h-3" /> Save as plan
            </button>
          }
        >
          <ul className="space-y-1">
            {contract.todayPlan.map((step, i) => (
              <li key={i}>
                <button onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))} className="flex items-start gap-2 text-left w-full group">
                  <span className="mt-0.5 w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition" style={done[i] ? { background: "var(--arbor-clay)", border: "1px solid var(--arbor-clay)" } : { border: "1px solid var(--arbor-rule-strong)" }}>
                    {done[i] && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="text-[12.5px] leading-snug" style={done[i] ? { color: "var(--arbor-muted)", textDecoration: "line-through" } : { color: "var(--arbor-ink)" }}>{step}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Parent script — say aloud */}
      {contract.parentScript && (
        <Panel
          icon={<MessageSquareQuote className="w-3 h-3" />} title="Say this" tint="var(--arbor-sky-ink)"
          action={
            <div className="flex items-center gap-2">
              {ttsSupported() && (
                <button onClick={sayScript} className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
                  {speaking ? <><Square className="w-3 h-3" /> Stop</> : <><Volume2 className="w-3 h-3" /> Say it aloud</>}
                </button>
              )}
              <button onClick={() => copy(contract.parentScript, "script")} className="text-[10px] font-bold inline-flex items-center gap-1" style={{ color: "var(--arbor-muted)" }}>
                {copied === "script" ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
              </button>
            </div>
          }
        >
          <p className="text-[13px] leading-relaxed italic" style={{ color: "var(--arbor-ink)" }}>&ldquo;{contract.parentScript}&rdquo;</p>
        </Panel>
      )}

      {/* Avoid / Observe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {contract.avoid?.length > 0 && (
          <Panel icon={<Ban className="w-3 h-3" />} title="Avoid" tint="var(--arbor-peach-ink)">
            <ul className="space-y-1 text-[12px] leading-snug list-disc pl-4" style={{ color: "var(--arbor-muted)" }}>
              {contract.avoid.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </Panel>
        )}
        {contract.observe?.length > 0 && (
          <Panel icon={<Eye className="w-3 h-3" />} title="Watch for" tint="var(--arbor-lav-ink)">
            <ul className="space-y-1 text-[12px] leading-snug list-disc pl-4" style={{ color: "var(--arbor-muted)" }}>
              {contract.observe.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Panel>
        )}
      </div>

      {/* Escalate */}
      {contract.escalateIf?.length > 0 && (
        <Panel icon={<AlertTriangle className="w-3 h-3" />} title="Reach out for help if" tint="var(--arbor-pink-ink)">
          <ul className="space-y-1 text-[12px] leading-snug list-disc pl-4" style={{ color: "var(--arbor-pink-ink)" }}>
            {contract.escalateIf.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </Panel>
      )}

      {/* Six-frame routing chips (SF-2) */}
      {frames.length > 0 && (
        <Panel icon={<Compass className="w-3 h-3" />} title="Developmental frame" tint="var(--arbor-yellow-ink)">
          <div className="flex flex-wrap gap-1.5">
            {frames.map(([k, v]) => (
              <span key={k} className="text-[10.5px] leading-tight rounded-lg px-2 py-1" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
                <span className="font-extrabold" style={{ color: "var(--arbor-yellow-ink)" }}>{FRAME_LABELS[k] || k}:</span>{" "}
                <span style={{ color: "var(--arbor-muted)" }}>{String(v)}</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Structured actions — the answer feeds the rest of the app (ECO-3) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button onClick={() => onSaveToPlan(contract.nonDiagnosticHypotheses?.[0]?.label || contract.todayPlan?.[0] || "")}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <ListPlus className="w-3.5 h-3.5" /> Save to plan
        </button>
        <button onClick={onCreateLog}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
          <ClipboardList className="w-3.5 h-3.5" /> Log a moment
        </button>
        {contract.handoffNotes?.teacher && (
          <button onClick={() => { onAddToHandoff(contract.handoffNotes.teacher); copy(contract.handoffNotes.teacher, "handoff"); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition bg-white" style={{ color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}>
            {copied === "handoff" ? <><Check className="w-3.5 h-3.5" /> Copied note</> : <><Send className="w-3.5 h-3.5" /> Teacher note</>}
          </button>
        )}
      </div>
    </div>
  );
}
