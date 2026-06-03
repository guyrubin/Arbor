import React, { useState } from "react";
import { motion } from "motion/react";
import { Share2, ShieldCheck, Clock, X, Download, Trash2, History } from "lucide-react";
import { PageHeader, SectionCard, cardCls, Chip, TrustSafetyBar } from "../ui/kit";

type Share = { id: string; recipient: string; role: string; fields: string; expires: string };

const AUDIT = [
  "Teacher Handoff shared with Ms. Tal — 5 days ago",
  "Therapist Summary shared with Dr. Maya Levi — 2 weeks ago",
  "Access to 'sleep logs' revoked — 3 weeks ago",
];

/** Care Network › Trusted Sharing — parents control what is shared, with whom, for how long. */
export default function TrustedSharing() {
  const [shares, setShares] = useState<Share[]>([
    { id: "s1", recipient: "Dr. Maya Levi", role: "Child Psychologist", fields: "Patterns, Therapist Summary", expires: "Expires in 60 days" },
    { id: "s2", recipient: "Ms. Tal (Preschool)", role: "Lead Teacher", fields: "Teacher Handoff only", expires: "Expires end of term" },
  ]);
  const revoke = (id: string) => setShares((p) => p.filter((s) => s.id !== id));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader eyebrow="Care Network" title="Trusted sharing" subtitle="You decide what about Dylan is shared, with whom, and for how long. Approve before sharing, revoke anytime." />

      <TrustSafetyBar note="Every share is parent-approved, time-boxed and fully revocable." />

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
            <button className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "var(--arbor-paper-deep)", color: "var(--arbor-ink)" }}><Download className="w-4 h-4" /> Export all data</button>
            <button className="w-full inline-flex items-center gap-2 text-sm font-bold rounded-xl px-4 py-3" style={{ background: "#fce2ec", color: "#bd4f74" }}><Trash2 className="w-4 h-4" /> Delete child data</button>
          </div>
        </SectionCard>
        <SectionCard title="Audit trail" icon={<History className="w-5 h-5" />} tone="sky">
          <ul className="space-y-2.5 text-xs" style={{ color: "var(--arbor-muted)" }}>
            {AUDIT.map((a) => <li key={a} className="flex items-start gap-2"><span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "#69747f" }} />{a}</li>)}
          </ul>
        </SectionCard>
      </div>
    </motion.div>
  );
}
