import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Stethoscope, ShieldCheck, Copy, Download, Send, Check } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { buildConsultPacket, serializePacket, countIncluded } from "../../consult/packet";

/* Care › Consult › Ask a specialist — the warm handoff.
   Builds a packet from the child's record, lets the parent redact line by line
   (Safety L3: nothing leaves the device until they export), then exports it to
   bring to their own professional. Phase 1 = copy / download; sending to an
   Arbor specialist is the Phase-2 marketplace, signalled honestly. */

const INK = "var(--arbor-ink)";
const MUTED = "var(--arbor-muted)";
const GREEN = "var(--arbor-green-ink)";
const GREEN_SOFT = "var(--arbor-green-soft)";
const RULE = "var(--arbor-rule)";

export default function AskSpecialist() {
  const { childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems } = useArbor();
  const { toast } = useToast();
  const firstName = (childProfile.name || "your child").split(" ")[0];
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const packet = useMemo(
    () => buildConsultPacket({
      profile: {
        name: childProfile.name, age: childProfile.age, languages: childProfile.languages,
        schoolContext: childProfile.schoolContext, strengths: childProfile.strengths, challenges: childProfile.challenges,
      },
      logs: behaviorLogs.map((l) => ({ behaviorType: l.behaviorType, intensity: l.intensity, timestamp: l.timestamp, resolved: l.resolved })),
      milestones: milestones.map((m) => ({ domain: m.domain, title: m.title, checked: m.checked })),
      plans: actionPlans.map((p) => ({ title: p.title, issue: p.issue })),
      memory: approvedMemoryItems.map((m) => ({ fact: m.fact, status: m.status })),
      nowMs: Date.now(),
    }),
    [childProfile, behaviorLogs, milestones, actionPlans, approvedMemoryItems]
  );

  const includedCount = countIncluded(packet, excluded);
  const toggle = (id: string) =>
    setExcluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const markdown = () => serializePacket(packet, excluded);

  const copy = async () => {
    try { await navigator.clipboard.writeText(markdown()); toast("Packet copied. Paste it to your professional.", "success"); }
    catch { toast("Could not copy. Try Download instead.", "error"); }
  };
  const download = () => {
    const blob = new Blob([markdown()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${firstName}-arbor-handoff-${packet.generatedAt}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast("Downloaded. Bring it to your appointment.", "success");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className="space-y-5 max-w-[760px]"
    >
      <header>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: GREEN }}>
          <Stethoscope className="w-3.5 h-3.5" /> Ask a specialist
        </span>
        <h1 className="text-[1.6rem] font-extrabold leading-tight mt-0.5" style={{ fontFamily: "var(--font-display)", color: INK, textWrap: "balance" } as React.CSSProperties}>
          Bring a specialist up to speed in minutes
        </h1>
        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: MUTED, textWrap: "pretty" } as React.CSSProperties}>
          A short, honest summary of {firstName}'s history so a therapist, teacher or doctor starts already in context, not from scratch. You choose exactly what to share.
        </p>
      </header>

      {/* Trust line (Safety L3) */}
      <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: GREEN_SOFT }}>
        <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: GREEN }} />
        <p className="text-[13px] leading-relaxed" style={{ color: GREEN }}>
          Nothing is shared until you export it. Uncheck anything you'd rather keep private. This is a conversation starter, never a diagnosis.
        </p>
      </div>

      {/* Redactable sections */}
      <div className="space-y-3">
        {packet.sections.map((section) => (
          <section key={section.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}` }}>
            <div className="px-5 pt-4 pb-2">
              <h2 className="text-[15px] font-extrabold" style={{ color: INK }}>{section.title}</h2>
              {section.note && <p className="text-[12px] mt-0.5" style={{ color: "var(--arbor-faint)" }}>{section.note}</p>}
            </div>
            <ul className="px-5 pb-3">
              {section.items.map((it) => {
                const on = !excluded.has(it.id);
                return (
                  <li key={it.id}>
                    <button
                      onClick={() => toggle(it.id)}
                      aria-pressed={on}
                      className="w-full flex items-start gap-3 py-2 text-left transition"
                    >
                      <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition"
                        style={on ? { background: "var(--arbor-clay)", color: "#fff" } : { background: "var(--arbor-paper-sunk)", border: `1px solid ${RULE}` }}>
                        {on && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-[14px] leading-relaxed" style={{ color: on ? INK : "var(--arbor-faint)", textDecoration: on ? "none" : "line-through" }}>
                        {it.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Export bar */}
      <div className="sticky bottom-2 rounded-2xl p-4 flex flex-wrap items-center gap-3" style={{ background: "var(--arbor-paper-elevated)", border: `1px solid ${RULE}`, boxShadow: "var(--shadow-md)" }}>
        <span className="text-[13px] font-bold mr-auto" style={{ color: MUTED }}>
          <strong style={{ color: INK }}>{includedCount}</strong> detail{includedCount === 1 ? "" : "s"} selected
        </span>
        <button onClick={copy} disabled={includedCount === 0}
          className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-2.5 transition disabled:opacity-50"
          style={{ background: GREEN_SOFT, color: GREEN }}>
          <Copy className="w-4 h-4" /> Copy
        </button>
        <button onClick={download} disabled={includedCount === 0}
          className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5 transition disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#3cc081,var(--arbor-clay) 60%,var(--arbor-clay-deep))", boxShadow: "var(--shadow-green)" }}>
          <Download className="w-4 h-4" /> Download
        </button>
        <button disabled title="Coming soon — send straight to a vetted Arbor specialist"
          className="inline-flex items-center gap-2 font-bold text-sm rounded-xl px-4 py-2.5 cursor-not-allowed"
          style={{ background: "var(--arbor-paper-sunk)", color: "var(--arbor-faint)" }}>
          <Send className="w-4 h-4" /> Send to an Arbor specialist (soon)
        </button>
      </div>
    </motion.div>
  );
}
