import React, { useState } from "react";
import { motion } from "motion/react";
import { Share2, ShieldCheck, Clock, X, Download, Trash2, History, Plus } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { downloadJson } from "../../lib/childData";
import { PageHeader, SectionCard, cardCls, Chip, TrustSafetyBar } from "../ui/kit";

type Share = { id: string; recipient: string; role: string; fields: string; expires: string };

const FIELD_OPTIONS = ["Weekly Insight", "Behavior patterns", "Milestones", "Teacher Handoff", "Therapist Summary"];
const DURATIONS = ["30 days", "60 days", "End of term", "Until revoked"];

/** Care Network › Trusted Sharing — parents control what is shared, with whom,
 *  for how long. New-share flow, working export, guarded delete, audit trail. */
export default function TrustedSharing() {
  const { childProfile, behaviorLogs, actionPlans } = useArbor();
  const first = childProfile.name.split(" ")[0];
  const [shares, setShares] = useState<Share[]>([
    { id: "s1", recipient: "Dr. Maya Levi", role: "Child Psychologist", fields: "Patterns, Therapist Summary", expires: "Expires in 60 days" },
    { id: "s2", recipient: "Ms. Tal (Preschool)", role: "Lead Teacher", fields: "Teacher Handoff only", expires: "Expires end of term" },
  ]);
  const [audit, setAudit] = useState<string[]>([
    "Teacher Handoff shared with Ms. Tal — 5 days ago",
    "Therapist Summary shared with Dr. Maya Levi — 2 weeks ago",
    "Access to 'sleep logs' revoked — 3 weeks ago",
  ]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ recipient: "", role: "", fields: [FIELD_OPTIONS[0]] as string[], duration: DURATIONS[0] });

  const setFields = (f: string) => setDraft((d) => ({ ...d, fields: d.fields.includes(f) ? d.fields.filter((x) => x !== f) : [...d.fields, f] }));

  const createShare = () => {
    if (!draft.recipient.trim() || draft.fields.length === 0) return;
    setShares((p) => [...p, { id: `s${Date.now()}`, recipient: draft.recipient, role: draft.role || "Recipient", fields: draft.fields.join(", "), expires: draft.duration === "Until revoked" ? "Until revoked" : `Expires · ${draft.duration}` }]);
    setAudit((a) => [`${draft.fields.join(", ")} shared with ${draft.recipient} — just now`, ...a]);
    setDraft({ recipient: "", role: "", fields: [FIELD_OPTIONS[0]], duration: DURATIONS[0] });
    setAdding(false);
  };

  const revoke = (id: string) => {
    const s = shares.find((x) => x.id === id);
    setShares((p) => p.filter((x) => x.id !== id));
    if (s) setAudit((a) => [`Access revoked for ${s.recipient} — just now`, ...a]);
  };

  const exportData = () => {
    downloadJson(`arbor-${first.toLowerCase()}-data.json`, {
      exportedAt: new Date().toISOString(),
      child: childProfile,
      behaviorLogs,
      actionPlans,
      note: "Parent-initiated export of Arbor data. Non-diagnostic.",
    });
    setAudit((a) => [`You exported all of ${first}'s data — just now`, ...a]);
  };

  const deleteData = () => {
    const ok = window.confirm(`Permanently delete all of ${first}'s data?\n\nThis cannot be undone. (For your safety this requires account verification and is processed server-side; nothing is wiped until that confirms.)`);
    if (ok) alert("Deletion request recorded. To protect your child's data, permanent deletion is verified and processed server-side.");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader
        eyebrow="Care Network"
        title="Trusted sharing"
        subtitle={`You decide what about ${first} is shared, with whom, and for how long. Approve before sharing, revoke anytime.`}
        action={
          <button onClick={() => setAdding((a) => !a)} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-2xl px-5 py-3" style={{ background: "linear-gradient(135deg,#3cc081,#2a9c66)" }}>
            <Plus className="w-4 h-4" /> New share
          </button>
        }
      />

      <TrustSafetyBar note="Every share is parent-approved, time-boxed and fully revocable." />

      {adding && (
        <div className={`${cardCls} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>Share {first}'s context</h3>
            <button onClick={() => setAdding(false)} aria-label="Cancel"><X className="w-4 h-4" style={{ color: "var(--arbor-muted)" }} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <input value={draft.recipient} onChange={(e) => setDraft({ ...draft, recipient: e.target.value })} placeholder="Recipient name" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
            <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Role (e.g. Teacher)" className="rounded-xl px-3 py-2.5 text-sm" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)" }} />
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>What to share</p>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_OPTIONS.map((f) => {
                const on = draft.fields.includes(f);
                return <button key={f} onClick={() => setFields(f)} aria-pressed={on} className="rounded-full px-3 py-1 text-xs font-bold" style={on ? { background: "#34b277", color: "#fff" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{f}</button>;
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold mb-1.5" style={{ color: "var(--arbor-muted)" }}>Access duration</p>
            <div className="flex flex-wrap gap-1.5">
              {DURATIONS.map((d) => (
                <button key={d} onClick={() => setDraft({ ...draft, duration: d })} aria-pressed={draft.duration === d} className="rounded-full px-3 py-1 text-xs font-bold" style={draft.duration === d ? { background: "#e4f4ec", color: "#1f8a5a" } : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)" }}>{d}</button>
              ))}
            </div>
          </div>
          <button onClick={createShare} className="inline-flex items-center gap-2 text-white font-bold text-sm rounded-xl px-4 py-2.5" style={{ background: "#34b277" }}>Approve & share</button>
        </div>
      )}

      <SectionCard title="Active shares" icon={<Share2 className="w-5 h-5" />} tone="mint">
        <div className="space-y-3">
          {shares.map((s) => (
            <div key={s.id} className={`${cardCls} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{s.recipient}</h3>
                  <p className="text-xs" style={{ color: "var(--arbor-muted)" }}>{s.role}</p>
                </div>
                <button onClick={() => revoke(s.id)} className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#bd4f74" }}>
                  <X className="w-3.5 h-3.5" /> Revoke access
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Chip tone="sky" icon={<ShieldCheck className="w-3.5 h-3.5" />}>{s.fields}</Chip>
                <Chip tone="yellow" icon={<Clock className="w-3.5 h-3.5" />}>{s.expires}</Chip>
              </div>
            </div>
          ))}
          {shares.length === 0 && <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>Nothing is shared right now.</p>}
        </div>
      </SectionCard>

      <div className="grid sm:grid-cols-2 gap-4">
        <SectionCard title="Your data" icon={<Download className="w-5 h-5" />} tone="lav">
          <div className="space-y-2">
            <button onClick={exportData} className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}><Download className="w-4 h-4" /> Export all data</button>
            <button onClick={deleteData} className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "#fce2ec", color: "#bd4f74" }}><Trash2 className="w-4 h-4" /> Delete child data</button>
          </div>
        </SectionCard>
        <SectionCard title="Audit trail" icon={<History className="w-5 h-5" />} tone="sky">
          <ul className="space-y-2.5 text-xs max-h-44 overflow-y-auto" style={{ color: "var(--arbor-muted)" }}>
            {audit.map((a, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#69747f" }} />{a}</li>)}
          </ul>
        </SectionCard>
      </div>
    </motion.div>
  );
}
