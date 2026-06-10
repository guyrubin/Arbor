import React from "react";
import { motion } from "motion/react";
import { BookMarked, Trash2, Clock, Link2, ShieldCheck, Check, X, Loader2 } from "lucide-react";
import { useArbor } from "../../context/ArborContext";
import type { MemoryReviewItem } from "../../types";
import { PageHeader, SectionCard, Chip, cardCls, TrustSafetyBar } from "../ui/kit";

/** Child Intelligence › Child Memory — parent-approved facts, wired to the real
 *  append-only memory service (/api/memory). A core moat: source-linked,
 *  time-stamped, editable via approve/forget, time-boxed when sensitive. */
export default function ChildMemory() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader eyebrow="My Child" title="Child memory" subtitle={`The facts about ${first} that Arbor remembers — only what you approve. Source-linked, time-stamped and forgettable, always.`} />

      <TrustSafetyBar note="You control everything here. Nothing is shared without your approval." />

      {/* Pending review first — this is the parent's action queue */}
      {pendingMemoryItems.length > 0 && (
        <SectionCard title={`Pending your review (${pendingMemoryItems.length})`} icon={<ShieldCheck className="w-5 h-5" />} tone="yellow">
          <div className="space-y-3">
            {pendingMemoryItems.map((m: MemoryReviewItem) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onApprove={() => handleMemoryDecision(m.memoryId, "approved")}
                onReject={() => handleMemoryDecision(m.memoryId, "rejected")}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Approved memory" icon={<BookMarked className="w-5 h-5" />} tone="lav">
        {approvedMemoryItems.length > 0 ? (
          <div className="space-y-3">
            {approvedMemoryItems.map((m: MemoryReviewItem) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onForget={() => handleMemoryDecision(m.memoryId, "deleted")}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "#ece9fb", color: "#6354c4" }}>
              <BookMarked className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>No memory yet</p>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--arbor-muted)" }}>
              As you log moments and talk with Arbor, it will propose facts about {first} for you to approve. Approved facts make every answer more personal.
            </p>
          </div>
        )}
      </SectionCard>
    </motion.div>
  );
}

function MemoryRow({ m, busy, onApprove, onReject, onForget }: {
  m: MemoryReviewItem;
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onForget?: () => void;
}) {
  const dated = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : null;
  const timeBoxed = m.retention && !/permanent|indefinite/i.test(m.retention);
  return (
    <div className={`${cardCls} p-4 ${busy ? "opacity-60" : ""}`}>
      <p className="text-sm" style={{ color: "var(--arbor-ink)" }}>{m.fact}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
        {m.source && <span className="inline-flex items-center gap-1"><Link2 className="w-3 h-3" /> {m.source}</span>}
        {dated && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {dated}</span>}
        {timeBoxed && <Chip tone="pink">Time-boxed · {m.retention}</Chip>}
        <span className="flex-1" />
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {onApprove && !busy && (
          <button onClick={onApprove} className="inline-flex items-center gap-1 font-bold" style={{ color: "#1f8a5a" }}>
            <Check className="w-3.5 h-3.5" /> Approve
          </button>
        )}
        {onReject && !busy && (
          <button onClick={onReject} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-muted)" }}>
            <X className="w-3.5 h-3.5" /> Dismiss
          </button>
        )}
        {onForget && !busy && (
          <button onClick={onForget} className="inline-flex items-center gap-1 font-bold" style={{ color: "#bd4f74" }}>
            <Trash2 className="w-3.5 h-3.5" /> Forget
          </button>
        )}
      </div>
    </div>
  );
}
