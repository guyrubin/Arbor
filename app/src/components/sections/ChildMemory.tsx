import React from "react";
import { motion } from "motion/react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import type { MemoryReviewItem } from "../../types";
import { PageHeader, SectionCard, Chip, cardCls, TrustSafetyBar } from "../ui/kit";
import { ErrorState } from "../ui/ErrorState";
import { learnCardById } from "../../learn/learnCards";
import { learnCategoryById, type LearnCard } from "../../learn/learnLibrary";
import { fmtDay } from "../../lib/formatDate";
import { PASTEL } from "../../lib/tokens";

const pick = (he: boolean, txt: { en: string; he: string }) => (he ? txt.he : txt.en);

/** Child Intelligence › Child Memory — parent-approved facts, wired to the real
 *  append-only memory service (/api/memory). A core moat: source-linked,
 *  time-stamped, editable via approve/forget, time-boxed when sensitive. */
export default function ChildMemory() {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, handleMemoryDecision, isMemoryUpdating, memoryReviewError, retryMemoryReview, savedLearnIds, requestLearnRead } = useArbor();
  const { t, aiLang } = useLanguage();
  const he = aiLang === "he";
  const first = childProfile.name.split(" ")[0];
  // Saved Learn Library reads, newest first; stale bookmarks (removed cards) are dropped.
  const savedLearnCards = savedLearnIds
    .map((id) => learnCardById(id))
    .filter((c): c is LearnCard => c !== undefined);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6 max-w-[920px]">
      <PageHeader eyebrow="My Child" title={t("sec.mem.title")} subtitle={t("sec.mem.sub", { name: first })} />

      <TrustSafetyBar note="You control everything here. Nothing is shared without your approval." />

      {/* OWN-1: a failed ledger read renders an honest error + retry card (the
          TrustedSharing twin) INSTEAD of the pending/approved lists — an
          unreadable ledger must never masquerade as "No memory yet". */}
      {memoryReviewError && (
        <ErrorState
          headline={t("err.memory.title", { name: first })}
          body={t("err.memory.body")}
          onRetry={retryMemoryReview}
          retryLabel={t("err.retry")}
        />
      )}

      {/* Pending review first — this is the parent's action queue */}
      {!memoryReviewError && pendingMemoryItems.length > 0 && (
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

      {!memoryReviewError && (
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
      )}

      {/* Learning trail — the parent's saved Learn Library reads, part of the
          child's longitudinal picture. Renders only when something is saved;
          the Library's own Saved tab teaches the empty state. */}
      {savedLearnCards.length > 0 && (
        <div className={`${cardCls} p-5`}>
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}
            >
              <Icon name="local_library" size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("learn.trailTitle")}</h2>
                <Chip tone="lav">{savedLearnCards.length}</Chip>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--arbor-muted)" }}>{t("learn.trailSub")}</p>
            </div>
          </div>
          <div className="mt-3 space-y-1">
            {savedLearnCards.slice(0, 6).map((card) => {
              const cat = learnCategoryById(card.category);
              const tone = PASTEL[cat.tone];
              return (
                <button
                  key={card.id}
                  onClick={() => requestLearnRead({ cardId: card.id, source: "child-memory" })}
                  className="w-full flex items-center gap-3 min-h-[48px] px-2.5 py-2 rounded-xl transition hover:bg-[var(--arbor-paper-deep)] text-start"
                >
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: tone.soft, color: tone.ink }}
                  >
                    <Icon name={cat.msIcon} size={16} />
                  </span>
                  <span className="flex-1 min-w-0 truncate text-[13.5px] font-bold" dir="auto" style={{ color: "var(--arbor-ink)" }}>
                    {pick(he, card.title)}
                  </span>
                  <span className="text-[11px] font-bold shrink-0" style={{ color: "var(--arbor-muted)" }}>
                    {t("learn.minutes", { n: card.minutes })}
                  </span>
                  <span className="shrink-0" style={{ color: "var(--arbor-muted)" }}>
                    <Icon name="arrow_forward" size={14} className="rtl:-scale-x-100" />
                  </span>
                </button>
              );
            })}
          </div>
          {savedLearnCards.length > 6 && (
            <button
              onClick={() => requestLearnRead({ source: "child-memory" })}
              className="w-full mt-1 min-h-[40px] rounded-xl text-xs font-bold transition hover:bg-[var(--arbor-paper-deep)]"
              style={{ color: "var(--arbor-lav-ink)" }}
            >
              {t("learn.trailAll")}
            </button>
          )}
        </div>
      )}
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
  const { uiLang } = useLanguage();
  const dated = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
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
