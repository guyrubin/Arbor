import React, { useState } from "react";
import {
  Sparkles, Brain, FileText, Activity, ShieldCheck, BookOpen, FileBarChart,
  BookMarked, HeartHandshake, Check, ChevronRight, RefreshCw,
} from "lucide-react";
import { useArbor, ActiveTab } from "../../context/ArborContext";
import { PASTEL, PastelKey } from "../ui/kit";

type Engine = { n: string; title: string; tab: ActiveTab; icon: React.ReactNode; tone: PastelKey; status: string; description: string };

const ENGINES: Engine[] = [
  { n: "01", title: "Parent Guidance Engine", tab: "coach", icon: <Brain className="w-4 h-4" />, tone: "coral", status: "Active", description: "Turns a hard moment into an age-aware explanation, boundary and exact parent script." },
  { n: "02", title: "Case Summary Engine", tab: "reports", icon: <FileText className="w-4 h-4" />, tone: "sky", status: "Ready", description: "Generates diagnosis-free professional summaries for teachers, pediatricians and therapists." },
  { n: "03", title: "Pattern Intelligence Engine", tab: "behaviors", icon: <Activity className="w-4 h-4" />, tone: "lav", status: "Scanning", description: "Reads behavior logs and routines to surface triggers, timing and what helps." },
  { n: "04", title: "Risk & Safety Classifier", tab: "safety", icon: <ShieldCheck className="w-4 h-4" />, tone: "mint", status: "Safe", description: "Screens every input and routes medical, trauma or regression signals toward professional support." },
  { n: "05", title: "Story Formation Engine", tab: "stories", icon: <BookOpen className="w-4 h-4" />, tone: "yellow", status: "Standby", description: "Crafts personalized stories that build courage, responsibility and resilience." },
  { n: "06", title: "Handoff Generator", tab: "handoff", icon: <FileBarChart className="w-4 h-4" />, tone: "sky", status: "Synced", description: "Builds teacher, therapist and pediatrician handoffs from approved child memory." },
  { n: "07", title: "Memory Proposal Engine", tab: "memory", icon: <BookMarked className="w-4 h-4" />, tone: "lav", status: "Reviewing", description: "Proposes new child-memory facts for your approval — never saved without you." },
  { n: "08", title: "Care Matching Engine", tab: "find-pro", icon: <HeartHandshake className="w-4 h-4" />, tone: "pink", status: "Connected", description: "Matches Dylan's needs to verified professionals in the Care Network." },
];

const TRUST = [
  "Developmental fit checked",
  "Safety guidance applied",
  "Child memory considered",
  "Next step generated",
];

export default function AiRail() {
  const { setShowAiRail, setActiveTab } = useArbor();
  const [pro, setPro] = useState(false); // Parent mode by default

  return (
    <aside
      className="hidden xl:flex flex-col gap-5 p-5 h-screen sticky top-0 overflow-y-auto z-20 w-[340px] 2xl:w-[365px] bg-white"
      style={{ borderLeft: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fdeada", color: "#cf6f37" }}><Sparkles className="w-4.5 h-4.5" /></span>
          <div>
            <h3 className="font-extrabold text-sm" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>{pro ? "AI Engines" : "Arbor is on it"}</h3>
            <p className="text-[10px]" style={{ color: "var(--arbor-muted)" }}>{pro ? "Capability architecture" : "Every answer, quality-checked"}</p>
          </div>
        </div>
        <button onClick={() => setShowAiRail(false)} title="Collapse panel" aria-label="Collapse panel" className="p-1.5 rounded-lg transition" style={{ color: "var(--arbor-muted)" }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex p-1 rounded-2xl" style={{ background: "var(--arbor-paper-deep)" }}>
        {[{ k: false, l: "Parent" }, { k: true, l: "Professional" }].map((m) => (
          <button key={m.l} onClick={() => setPro(m.k)} aria-pressed={pro === m.k} className="flex-1 py-2 rounded-xl text-xs font-bold transition"
            style={pro === m.k ? { background: "#fff", color: "#1f8a5a", boxShadow: "0 1px 2px rgba(41,51,63,0.06)" } : { color: "var(--arbor-muted)" }}>
            {m.l}
          </button>
        ))}
      </div>

      {!pro ? (
        /* PARENT MODE — subtle trust indicators only */
        <div className="space-y-3 flex-1">
          <div className="rounded-2xl p-4" style={{ background: "#e4f4ec" }}>
            <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "#1f8a5a" }}>Behind every answer</p>
            <ul className="mt-3 space-y-2.5">
              {TRUST.map((t) => (
                <li key={t} className="flex items-center gap-2.5 text-[13px] font-semibold" style={{ color: "var(--arbor-ink)" }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#34b277", color: "#fff" }}><Check className="w-3 h-3" /></span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] leading-relaxed px-1" style={{ color: "var(--arbor-muted)" }}>
            Arbor is non-diagnostic and keeps your child's data private. For anything urgent, it will always point you to a professional.
          </p>
          <button onClick={() => setActiveTab("coach")} className="w-full inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-3 mt-1" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
            <Sparkles className="w-4 h-4" /> Ask Arbor
          </button>
        </div>
      ) : (
        /* PROFESSIONAL / DEMO MODE — full engine panel */
        <div className="space-y-2.5 flex-1 select-text">
          {ENGINES.map((e) => (
            <button key={e.n} onClick={() => setActiveTab(e.tab)} className="w-full text-left p-3 rounded-2xl border transition flex flex-col gap-1" style={{ borderColor: "var(--arbor-rule)", background: "#fff" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold flex items-center gap-2 text-[13px]" style={{ color: "var(--arbor-ink)" }}>
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: PASTEL[e.tone].soft, color: PASTEL[e.tone].ink }}>{e.icon}</span>
                  {e.title}
                </span>
                <span className="text-[8.5px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider" style={{ background: PASTEL[e.tone].soft, color: PASTEL[e.tone].ink }}>{e.status}</span>
              </div>
              <p className="text-[11px] leading-normal pl-8" style={{ color: "var(--arbor-muted)" }}>{e.description}</p>
            </button>
          ))}
        </div>
      )}

      <div className="pt-4 mt-auto" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
        <button
          onClick={() => alert("Arbor capability check: developmental routing, safety guardrails, child memory and escalation are healthy and verified.")}
          className="w-full py-2.5 font-bold rounded-2xl transition flex items-center justify-center gap-1.5 text-sm"
          style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}
        >
          <RefreshCw className="w-3.5 h-3.5" style={{ color: "#1f8a5a" }} /> Run capability check
        </button>
      </div>
    </aside>
  );
}
