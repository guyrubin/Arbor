import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDayV10 as fmtDay } from "../../lib/formatDate";
import { aspectOfWords, type AspectState } from "../../lib/aboutAspects";
import { forgetsOnIso, isPermanentRetention } from "../../lib/memoryExpiry";
import { scrubMemoryProposals } from "../../server/parentWordsScrub";
import type { MemoryReviewItem } from "../../types";
import { Icon } from "../ui/Icon";
import { MemoryEditForm } from "../sections/ChildMemory";
import { aboutCopy } from "./aboutViewCopy";

/**
 * v4 → v10.1 — Arbor's notebook on My child › About: the ONE home where a
 * parent answers Arbor (Remember / Not this), corrects (Edit) and forgets.
 *
 * The queue is the proposals no area below shows (an area carries its own
 * Confirm / No, so a proposal is never asked twice on one page). The first is
 * the stage card (the board's card stack: the edges behind it are the others
 * still waiting); the next ones wait as notes in the rail (phone: a snap row);
 * the newest remembered fact sits under them with its forget date. Remember /
 * Not this are the SAME handleMemoryDecision the ledger uses — no second write
 * path — and a card settles only after the server confirms. Edit opens the
 * ledger's one edit form (MemoryEditForm) on the stored text.
 *
 * Counts here are counts of notes in the notebook, never anything about the
 * child. Every text is the scrubbed parent-words version (B-CAREPRO-06).
 */

/** How many proposals the page itself asks about (stage + rail). */
export const SHOWN_PENDING = 4;
/** The sources a fact came from in the parent's own conversation (ChildMemory's set). */
const CONVERSATION_SOURCES: ReadonlySet<string> = new Set(["chat", "coach", "conversation", "journal"]);

/** The notebook as About reads it: scrubbed, split by where each proposal is asked. */
export function useAboutNotebook(areas: readonly AspectState[]) {
  const { approvedMemoryItems, pendingMemoryItems } = useArbor();
  const pending = useMemo(() => scrubMemoryProposals(pendingMemoryItems), [pendingMemoryItems]);
  const approved = useMemo(
    () => scrubMemoryProposals(approvedMemoryItems).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [approvedMemoryItems],
  );
  const inAreas = new Set(areas.map((a) => a.pending?.memoryId).filter(Boolean) as string[]);
  const quoted = new Set(areas.map((a) => a.known?.memoryId).filter(Boolean) as string[]);
  const waiting = pending.filter((m) => !inAreas.has(m.memoryId));
  // The stored row behind each scrubbed one: Edit opens on the parent's own record.
  const stored = new Map([...pendingMemoryItems, ...approvedMemoryItems].map((m) => [m.memoryId, m] as const));
  return {
    pending,
    approved,
    /** Proposals this page asks about outside the areas, oldest decision first. */
    waiting,
    /** Remembered facts no area already quotes. */
    remembered: approved.filter((m) => !quoted.has(m.memoryId)),
    /** Proposals waiting inside an area (asked there with Confirm / No). */
    inAreasCount: pending.length - waiting.length,
    storedOf: (m: MemoryReviewItem) => stored.get(m.memoryId) ?? m,
  };
}

/** B-CAREPRO-38 — the pending facts About itself asks about (in an area, or as
 *  a card): the embedded ledger leaves them out, so each is asked once. */
export function aboutAskedPendingIds(pending: readonly MemoryReviewItem[], areas: readonly AspectState[]): Set<string> {
  const scrubbed = scrubMemoryProposals([...pending]);
  const inAreas = new Set(areas.map((a) => a.pending?.memoryId).filter(Boolean) as string[]);
  const onCards = scrubbed.filter((m) => !inAreas.has(m.memoryId)).slice(0, SHOWN_PENDING).map((m) => m.memoryId);
  return new Set([...inAreas, ...onCards]);
}

/** One decision at a time, settled only after the server confirms. */
function useDecide() {
  const { handleMemoryDecision, isMemoryUpdating } = useArbor();
  const [failed, setFailed] = useState<string | null>(null);
  const decide = async (memoryId: string, status: "approved" | "rejected" | "deleted") => {
    setFailed(null);
    let ok = false;
    try { ok = await handleMemoryDecision(memoryId, status); } catch { ok = false; }
    if (!ok) setFailed(memoryId);
  };
  return { decide, failed, busy: (id: string) => isMemoryUpdating === id };
}

function useSource() {
  const { t, uiLang } = useLanguage();
  return (m: MemoryReviewItem) => {
    const day = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
    if (CONVERSATION_SOURCES.has(m.source)) return day ? t("companion.about.memory.fromTalk", { date: day }) : t("companion.about.memory.fromTalkUndated");
    return day ? t("companion.about.srcNoted", { date: day }) : t("companion.about.srcNotedUndated");
  };
}

const Quote = ({ children, className }: { children: string; className?: string }) => (
  <span className={className} dir="auto">“{children}”</span>
);

/** The stage card: the next proposal to answer, its thread, and the one action. */
export function StageCard({ m, stored, index, queueLength, compact, onEdited }: {
  m: MemoryReviewItem;
  stored: MemoryReviewItem;
  index: number;
  /** How many proposals wait in the queue this card leads. */
  queueLength: number;
  /** The phone's card: one line of provenance instead of the three knots. */
  compact?: boolean;
  onEdited: () => void;
}) {
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const source = useSource();
  const { decide, failed, busy } = useDecide();
  const [editing, setEditing] = useState(false);
  const fromTalk = CONVERSATION_SOURCES.has(m.source);
  const area = aspectOfWords(m.fact);
  const keptWhere = area ? copy.keptUnder(t(`companion.about.aspect.${area}`)) : copy.keptNotebook;
  const isBusy = busy(m.memoryId);
  return (
    <div className="about-stage-answer" data-testid="about-memory-pending" data-stage="">
      <div className="stk">
        <div className="top draft about-stage-card">
          <div className="line between">
            <span className="about-by"><Icon name="edit" size={14} />{copy.draftLabel}</span>
            {queueLength > 1 && <span className="about-pos">{copy.position(index + 1, queueLength)}</span>}
          </div>
          {editing ? (
            <MemoryEditForm m={stored} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onEdited(); }} />
          ) : (
            <p className="about-stage-fact"><Quote>{m.fact}</Quote></p>
          )}
          {!editing && (compact ? (
            <span className="about-stage-why">{source(m)} · {keptWhere}</span>
          ) : (
            <div className="thread about-thread">
              <div className="knot you">
                <span className="by">{fromTalk ? copy.youSaid : copy.noted}</span>
                <b>{fromTalk ? copy.inTalk : copy.inYourRecord}</b>
                <span className="small">{source(m)}</span>
              </div>
              <span className="thr" aria-hidden="true"><svg viewBox="0 0 40 28" preserveAspectRatio="none"><path className="g-ink" d="M0 14 C13 2, 27 26, 40 14" /></svg></span>
              <div className="knot ai">
                <span className="by about-by"><Icon name="edit" size={14} />{copy.draftLabel}</span>
                <b>{copy.plainWords}</b>
              </div>
              <span className="thr" aria-hidden="true"><svg viewBox="0 0 40 28" preserveAspectRatio="none"><path className="g-ai" d="M0 14 C13 2, 27 26, 40 14" /></svg></span>
              <div className="knot sets">
                <span className="by about-sets">{copy.ifYes}</span>
                <b>{keptWhere}</b>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!editing && (
        <div className="about-answer-row">
          <button type="button" className="btn ink nowrap touch-target" data-testid="about-memory-remember" disabled={isBusy} onClick={() => void decide(m.memoryId, "approved")}>{t("companion.about.memory.remember")}</button>
          <button type="button" className="btn ghost nowrap about-btn-card touch-target" data-testid="about-memory-not" disabled={isBusy} onClick={() => void decide(m.memoryId, "rejected")}>{t("companion.about.memory.not")}</button>
          <button type="button" className="btn text nowrap touch-target" data-testid="about-memory-edit" disabled={isBusy} onClick={() => setEditing(true)}>{t("elev.waveR.mem.edit")}</button>
          {!compact && <span className="about-answer-hint">{copy.answerHint}</span>}
        </div>
      )}
      {failed === m.memoryId && <p className="about-failed" role="alert">{t("companion.about.memory.failed")}</p>}
    </div>
  );
}

/** A proposal waiting in the rail (phone: a snap card), with Remember / Not this. */
export function PendingNote({ m }: { m: MemoryReviewItem }) {
  const { t } = useLanguage();
  const source = useSource();
  const { decide, failed, busy } = useDecide();
  const isBusy = busy(m.memoryId);
  return (
    <div className="pq" data-testid="about-memory-pending">
      <Quote className="q">{m.fact}</Quote>
      <small>{source(m)}</small>
      <span className="bt">
        <button type="button" className="y touch-target" data-testid="about-memory-remember" disabled={isBusy} onClick={() => void decide(m.memoryId, "approved")}>{t("companion.about.memory.remember")}</button>
        <button className="touch-target" type="button" data-testid="about-memory-not" disabled={isBusy} onClick={() => void decide(m.memoryId, "rejected")}>{t("companion.about.memory.not")}</button>
      </span>
      {failed === m.memoryId && <p className="about-failed" role="alert">{t("companion.about.memory.failed")}</p>}
    </div>
  );
}

/** The newest remembered fact: its day, the day it forgets, Edit and Forget. */
export function RememberedNote({ m, stored, onEdited }: { m: MemoryReviewItem; stored: MemoryReviewItem; onEdited: () => void }) {
  const { t, uiLang } = useLanguage();
  const copy = aboutCopy(uiLang);
  const { decide, failed, busy } = useDecide();
  const [editing, setEditing] = useState(false);
  const day = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
  const forgetsOn = forgetsOnIso({ retention: m.retention, createdAt: m.createdAt });
  const expiry = isPermanentRetention(m.retention) || !forgetsOn
    ? t("elev.waveR.mem.keptUntilForget")
    : t("elev.waveR.mem.forgetsOn", { date: fmtDay(forgetsOn, uiLang) });
  const isBusy = busy(m.memoryId);
  return (
    <div className="kn" data-testid="about-memory-approved" data-memory-id={m.memoryId}>
      <span className="when"><Icon name="check" size={14} />{day ? copy.approvedMemory(day) : copy.approvedMemoryUndated} <b data-testid="memory-expiry-chip">{expiry}</b></span>
      {editing
        ? <MemoryEditForm m={stored} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onEdited(); }} />
        : <Quote className="q about-kn-fact">{m.fact}</Quote>}
      {!editing && (
        <span className="line about-kn-actions">
          <button type="button" className="ed touch-target" data-testid="memory-edit-open" disabled={isBusy} onClick={() => setEditing(true)}><Icon name="edit" size={16} />{t("elev.waveR.mem.edit")}</button>
          <button type="button" className="ed rm touch-target" data-testid="about-memory-forget" disabled={isBusy} onClick={() => void decide(m.memoryId, "deleted")}>{t("elev.childmem.action.forget")}</button>
        </span>
      )}
      {failed === m.memoryId && <p className="about-failed" role="alert">{t("companion.about.memory.failed")}</p>}
    </div>
  );
}
