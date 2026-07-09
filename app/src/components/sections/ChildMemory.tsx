import React from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { MemoryReviewItem } from "../../types";
import { PageHeader, SectionCard, Chip, cardCls, TrustSafetyBar } from "../ui/kit";

/** Child Intelligence › Child Memory — parent-approved facts, wired to the real
 *  append-only memory service (/api/memory). A core moat: source-linked,
 *  time-stamped, editable via approve/forget, time-boxed when sensitive. */
export default function ChildMemory() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, handleMemoryDecision, isMemoryUpdating } = useArbor();
  const { t } = useLanguage();
  const first = childProfile.name.split(" ")[0];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader eyebrow="My Child" title={t("sec.mem.title")} subtitle={t("sec.mem.sub", { name: first })} />

      <TrustSafetyBar note="You control everything here. Nothing is shared without your approval." />

      {/* Pending review first — this is the parent's action queue */}
      {pendingMemoryItems.length > 0 && (
        <SectionCard title={`Pending your review (${pendingMemoryItems.length})`} icon={<Icon name="verified_user" size={20} />} tone="yellow">
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

      <SectionCard title="Approved memory" icon={<Icon name="bookmark" size={20} />} tone="lav">
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
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
              <Icon name="bookmark" size={24} />
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

export function MemoryRow({ m, busy, onApprove, onReject, onForget }: {
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
        {m.source && <span className="inline-flex items-center gap-1"><Icon name="link" size={12} /> {m.source}</span>}
        {dated && <span className="inline-flex items-center gap-1"><Icon name="schedule" size={12} /> {dated}</span>}
        {timeBoxed && <Chip tone="pink">Time-boxed · {m.retention}</Chip>}
        <span className="flex-1" />
        {busy && <Icon name="progress_activity" size={14} className="animate-spin" />}
        {onApprove && !busy && (
          <button onClick={onApprove} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="check" size={14} /> Approve
          </button>
        )}
        {onReject && !busy && (
          <button onClick={onReject} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-muted)" }}>
            <Icon name="close" size={14} /> Dismiss
          </button>
        )}
        {onForget && !busy && (
          <button onClick={onForget} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-pink-ink)" }}>
            <Icon name="delete" size={14} /> Forget
          </button>
        )}
      </div>
    </div>
  );
}
