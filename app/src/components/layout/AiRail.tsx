import React from "react";
import { Sparkles, Check, ChevronRight, ShieldCheck, Lock, ArrowRight } from "lucide-react";
import { useArbor } from "../../context/ArborContext";

/** Behind-the-answer trust panel. Reassures the parent about how Arbor reaches a
 *  suggestion without exposing model internals or jargon. */
const BEHIND = [
  { label: "Right for their age", note: "Tuned to where your child is now" },
  { label: "Safety checked", note: "Flags anything that needs a professional" },
  { label: "Remembers your child", note: "Only what you've approved" },
  { label: "Ends with a next step", note: "Something you can do today" },
];

export default function AiRail() {
  const { setShowAiRail, setActiveTab } = useArbor();

  return (
    <aside
      className="hidden xl:flex flex-col gap-5 p-5 h-screen sticky top-0 overflow-y-auto z-20 w-[340px] 2xl:w-[365px] bg-white"
      style={{ borderLeft: "1px solid var(--arbor-rule)" }}
    >
      <div className="flex items-center justify-between pb-4" style={{ borderBottom: "1px solid var(--arbor-rule)" }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#e4f4ec", color: "#1f8a5a" }}>
            <ShieldCheck className="w-[18px] h-[18px]" />
          </span>
          <div>
            <h3 className="font-extrabold text-sm" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>How Arbor helps</h3>
            <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>What goes into every answer</p>
          </div>
        </div>
        <button onClick={() => setShowAiRail(false)} title="Hide this panel" aria-label="Hide this panel" className="p-1.5 rounded-lg transition" style={{ color: "var(--arbor-muted)" }}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <ul className="space-y-2.5 flex-1">
        {BEHIND.map((b) => (
          <li key={b.label} className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: "var(--arbor-paper-deep)" }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#34b277", color: "#fff" }}>
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold" style={{ color: "var(--arbor-ink)" }}>{b.label}</span>
              <span className="block text-[11.5px] leading-snug mt-0.5" style={{ color: "var(--arbor-muted)" }}>{b.note}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl p-4" style={{ background: "#e4f4ec" }}>
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5" style={{ color: "#1f8a5a" }} />
          <span className="text-[12px] font-extrabold" style={{ color: "#1f8a5a" }}>Your child's data stays private</span>
        </div>
        <p className="text-[11.5px] leading-relaxed mt-1.5" style={{ color: "#1f6f4b" }}>
          Arbor never diagnoses, and nothing is remembered without your say-so. You can see and delete it anytime.
        </p>
        <button onClick={() => setActiveTab("memory")} className="inline-flex items-center gap-1 text-[12px] font-bold mt-2.5" style={{ color: "#1f8a5a" }}>
          See what Arbor remembers <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <button
        onClick={() => setActiveTab("coach")}
        className="w-full inline-flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-3"
        style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)", boxShadow: "0 8px 20px rgba(52,178,119,0.24)" }}
      >
        <Sparkles className="w-4 h-4" /> Ask Arbor about your child
      </button>
    </aside>
  );
}
