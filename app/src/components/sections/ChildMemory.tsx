import React, { useState } from "react";
import { motion } from "motion/react";
import { BookMarked, Trash2, Clock, Link2, ShieldCheck, Check } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import { PageHeader, SectionCard, Chip, cardCls, TrustSafetyBar } from "../ui/kit";

type Memory = {
  id: string;
  fact: string;
  source: string;
  date: string;
  sensitive?: boolean;
  status: "approved" | "pending";
};

/** Child Intelligence › Child Memory — parent-approved facts. A core moat:
 *  editable, deletable, source-linked, time-stamped, time-boxed when sensitive. */
export default function ChildMemory() {
  const { childProfile } = useArbor();
  const first = childProfile.name.split(" ")[0];
  const [items, setItems] = useState<Memory[]>([
    { id: "m1", fact: `${first} settles fastest when given a two-choice option before a transition.`, source: "Behavior log · 23 May", date: "2026-05-23", status: "approved" },
    { id: "m2", fact: "Responds well to naming feelings out loud ('I can see this is hard').", source: "Parent Coach session", date: "2026-05-19", status: "approved" },
    { id: "m3", fact: "Hesitates to answer elders in English; more fluent at home in Hebrew.", source: "Language & Communication", date: "2026-05-12", status: "approved" },
    { id: "m4", fact: "Had a difficult week after a schedule change at preschool.", source: "Weekly Insight", date: "2026-05-30", sensitive: true, status: "pending" },
  ]);

  const remove = (id: string) => setItems((p) => p.filter((m) => m.id !== id));
  const approve = (id: string) => setItems((p) => p.map((m) => (m.id === id ? { ...m, status: "approved" } : m)));

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader eyebrow="Child Intelligence" title="Child memory" subtitle={`The facts about ${first} that Arbor remembers — only what you approve. Editable, source-linked and deletable, always.`} />

      <TrustSafetyBar note="You control everything here. Nothing is shared without your approval." />

      <SectionCard title="Approved memory" icon={<BookMarked className="w-5 h-5" />} tone="lav">
        <div className="space-y-3">
          {items.filter((m) => m.status === "approved").map((m) => (
            <MemoryRow key={m.id} m={m} onRemove={() => remove(m.id)} />
          ))}
          {items.every((m) => m.status !== "approved") && <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>No approved memory yet.</p>}
        </div>
      </SectionCard>

      {items.some((m) => m.status === "pending") && (
        <SectionCard title="Pending your review" icon={<ShieldCheck className="w-5 h-5" />} tone="yellow">
          <div className="space-y-3">
            {items.filter((m) => m.status === "pending").map((m) => (
              <MemoryRow key={m.id} m={m} onRemove={() => remove(m.id)} onApprove={() => approve(m.id)} />
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

function MemoryRow({ m, onRemove, onApprove }: { m: Memory; onRemove: () => void; onApprove?: () => void }) {
  return (
    <div className={`${cardCls} p-4`}>
      <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>{m.fact}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
        <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> {m.source}</span>
        <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(m.date).toLocaleDateString()}</span>
        {m.sensitive && <Chip tone="pink">Time-boxed · sensitive</Chip>}
        <span className="flex-1" />
        {onApprove && (
          <button onClick={onApprove} className="inline-flex items-center gap-1 font-bold" style={{ color: "#1f8a5a" }}>
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
        )}
        <button onClick={onRemove} className="inline-flex items-center gap-1 font-bold" style={{ color: "#bd4f74" }}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}
