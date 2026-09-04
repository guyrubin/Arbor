import React, { useState } from "react";
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
// GP-13 — the flagship trust mechanic let a parent DELETE but not CORRECT
// ("she is 3" → "she is 4"), and coloured the safest property the ledger has
// (it forgets on its own) in the delete tone with no date attached.
import { authHeaders } from "../../lib/api";
import {
  RETENTION_CHOICES,
  forgetsOnIso,
  isPermanentRetention,
  nearestRetentionChoice,
} from "../../lib/memoryExpiry";
// GP-22 — the memory queue is a why-line surface too: every pending row is a
// claim about the child, and nothing said where it came from.
import { ContentWhyLine } from "../ui/ContentActionBar";
import ArborKnowsTile from "./ArborKnowsTile";
import FirstsMoment from "./FirstsMoment";
import MonthKeepsake from "../weekly/MonthKeepsake";

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
      <PageHeader eyebrow={t("elev.childmem.eyebrow")} title={t("sec.mem.title")} subtitle={t("sec.mem.sub", { name: first })} />

      {/* AI-11: this is the surface where a parent APPROVES or FORGETS what
          Arbor may remember about their child. Its titles, its empty state and
          — worst — its three decision buttons were hard-coded English, so a
          Hebrew-reading parent was asked to make a privacy decision in a
          language the app had promised not to use on them. */}
      <TrustSafetyBar note={t("elev.childmem.trustNote")} />
      <ContentWhyLine why={t("elev.waveR.why.memory")} trustLink surface="child-memory" />

      {/* ENG-13 · the week-1 "first", at a threshold of ONE. Renders at most
          once ever per kind and returns null the rest of the time. */}
      <FirstsMoment />

      {/* ENG-14(a) · what Arbor knows, as a COUNT — answerable on day 0 from
          the profile alone, which is exactly what nothing else in the app
          could do. Never a completeness score: see lib/keepsakeCounts. */}
      <ArborKnowsTile />

      {/* ENG-14(b) · the month keepsake, offered once on the first open of a
          new month and never for a month the family is still living in. */}
      <MonthKeepsake />

      {/* OWN-1: a failed ledger read renders an honest error + retry card (the
          TrustedSharing twin) INSTEAD of the pending/approved lists — an
          unreadable ledger must never masquerade as "No memory yet". */}
      {memoryReviewError && (
        <ErrorState
          surface="child-memory"
          headline={t("err.memory.title", { name: first })}
          body={t("err.memory.body")}
          onRetry={retryMemoryReview}
          retryLabel={t("err.retry")}
        />
      )}

      {/* Pending review first — this is the parent's action queue */}
      {!memoryReviewError && pendingMemoryItems.length > 0 && (
        <SectionCard title={t("elev.childmem.pending.title", { count: pendingMemoryItems.length })} icon={<Icon name="verified_user" size={20} />} tone="yellow">
          <div className="space-y-3">
            {pendingMemoryItems.map((m: MemoryReviewItem) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onApprove={() => handleMemoryDecision(m.memoryId, "approved")}
                onReject={() => handleMemoryDecision(m.memoryId, "rejected")}
                onEdited={retryMemoryReview}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {!memoryReviewError && (
      <SectionCard title={t("elev.childmem.approved.title")} icon={<Icon name="bookmark" size={20} />} tone="lav">
        {approvedMemoryItems.length > 0 ? (
          <div className="space-y-3">
            {approvedMemoryItems.map((m: MemoryReviewItem) => (
              <MemoryRow
                key={m.memoryId}
                m={m}
                busy={isMemoryUpdating === m.memoryId}
                onForget={() => handleMemoryDecision(m.memoryId, "deleted")}
                onEdited={retryMemoryReview}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: "var(--arbor-lav-soft)", color: "var(--arbor-lav-ink)" }}>
              <Icon name="bookmark" size={24} />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{t("elev.childmem.empty.title")}</p>
            <p className="text-xs mt-1 max-w-sm mx-auto" dir="auto" style={{ color: "var(--arbor-muted)" }}>
              {t("elev.childmem.empty.body", { name: first })}
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

export function MemoryRow({ m, busy, onApprove, onReject, onForget, onEdited }: {
  m: MemoryReviewItem;
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onForget?: () => void;
  /** GP-13 — supplied by the surface that owns the ledger read: enables the
   *  inline edit and is called once the corrected row has been written, so the
   *  list re-reads. Surfaces that only DISPLAY a row (the Story timeline
   *  overlay) omit it and keep exactly the controls they had. */
  onEdited?: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const dated = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
  // GP-13 — the expiry was a raw retention string in a PINK chip. Pink is this
  // row's delete tone, so the one property that protects the parent (the fact
  // forgets itself) read as danger; and "Time-boxed · 90 days" is not a date.
  // Now: a neutral lav chip carrying the day it actually forgets.
  const permanent = isPermanentRetention(m.retention);
  const forgetsOn = forgetsOnIso({ retention: m.retention, createdAt: m.createdAt });
  const [editing, setEditing] = useState(false);
  const [factDraft, setFactDraft] = useState(m.fact ?? "");
  const [retentionDraft, setRetentionDraft] = useState(() => nearestRetentionChoice(m.retention));
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const openEdit = () => {
    setFactDraft(m.fact ?? "");
    setRetentionDraft(nearestRetentionChoice(m.retention));
    setSaveFailed(false);
    setEditing(true);
  };

  /** The server has accepted { fact, retention, source } on this transition
   *  since the ledger was written (memory/memoryService.transitionMemory) —
   *  the UI simply never sent them. Editing keeps the row's CURRENT status, so
   *  correcting an approved fact does not silently re-queue it. */
  const saveEdit = async () => {
    const fact = factDraft.trim();
    if (!fact) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/memory/${encodeURIComponent(m.memoryId)}`, {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ status: m.status, fact, retention: retentionDraft }),
      });
      if (!res.ok) throw new Error("edit failed");
      setEditing(false);
      onEdited?.();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`${cardCls} p-4 ${busy ? "opacity-60" : ""}`} data-testid="memory-row">
      {editing ? (
        <div className="space-y-2.5">
          <label className="block text-[11px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.waveR.mem.edit.factLabel")}
            <textarea
              autoFocus
              rows={3}
              dir="auto"
              value={factDraft}
              onChange={(e) => setFactDraft(e.target.value)}
              data-testid="memory-edit-fact"
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm font-normal focus:outline-none"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            />
          </label>
          <label className="block text-[11px] font-extrabold" style={{ color: "var(--arbor-ink)" }}>
            {t("elev.waveR.mem.edit.retentionLabel")}
            <select
              value={retentionDraft}
              onChange={(e) => setRetentionDraft(e.target.value)}
              data-testid="memory-edit-retention"
              className="mt-1 block w-full rounded-xl px-3 py-2 text-xs font-normal"
              style={{ minHeight: 44, background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
            >
              {RETENTION_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{t(c.labelKey)}</option>
              ))}
            </select>
          </label>
          {saveFailed && (
            <p className="text-[11px] font-bold" style={{ color: "var(--arbor-pink-ink)" }}>{t("elev.waveR.mem.saveFailed")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void saveEdit()}
              disabled={saving || !factDraft.trim()}
              data-testid="memory-edit-save"
              // The row is a quiet ledger row and its other controls are token-ink
              // text buttons; a solid white-on-clay button would shout, and a
              // white label inside the row's busy-opacity wrapper has no
              // white-label proof (CR-01 ratchet). Soft-fill + ink instead.
              className="rounded-xl px-4 text-xs font-extrabold transition disabled:opacity-60"
              style={{ minHeight: 44, background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule)" }}
            >
              {t("elev.waveR.mem.save")}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 text-xs font-bold"
              style={{ minHeight: 44, color: "var(--arbor-muted)" }}
            >
              {t("elev.waveR.mem.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm" dir="auto" style={{ color: "var(--arbor-ink)" }}>{m.fact}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>
        {m.source && <span className="inline-flex items-center gap-1"><Icon name="link" size={12} /> {m.source}</span>}
        {dated && <span className="inline-flex items-center gap-1"><Icon name="schedule" size={12} /> {dated}</span>}
        <span data-testid="memory-expiry-chip">
          <Chip tone="lav">
            {permanent || !forgetsOn
              ? t("elev.waveR.mem.keptUntilForget")
              : t("elev.waveR.mem.forgetsOn", { date: fmtDay(forgetsOn, uiLang) })}
          </Chip>
        </span>
        <span className="flex-1" />
        {busy && <Icon name="progress_activity" size={14} className="animate-spin" />}
        {onEdited && !busy && !editing && (
          <button
            onClick={openEdit}
            aria-label={t("elev.waveR.mem.edit.aria")}
            data-testid="memory-edit-open"
            className="inline-flex items-center gap-1 font-bold"
            style={{ color: "var(--arbor-lav-ink)" }}
          >
            <Icon name="edit" size={14} /> {t("elev.waveR.mem.edit")}
          </button>
        )}
        {onApprove && !busy && (
          <button onClick={onApprove} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-green-ink)" }}>
            <Icon name="check" size={14} /> {t("elev.childmem.action.approve")}
          </button>
        )}
        {onReject && !busy && (
          <button onClick={onReject} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-muted)" }}>
            <Icon name="close" size={14} /> {t("elev.childmem.action.dismiss")}
          </button>
        )}
        {onForget && !busy && (
          <button onClick={onForget} className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--arbor-pink-ink)" }}>
            <Icon name="delete" size={14} /> {t("elev.childmem.action.forget")}
          </button>
        )}
      </div>
    </div>
  );
}
