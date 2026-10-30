import React, { useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { fmtDay } from "../../lib/formatDate";
import type { AspectState } from "../../lib/aboutAspects";
import { scrubMemoryProposals } from "../../server/parentWordsScrub";
import type { MemoryReviewItem } from "../../types";
import { BrandChip } from "../ui/BrandChip";
import { Icon } from "../ui/Icon";

/**
 * v4 — "What Arbor remembers" on My child › About (the consolidation
 * blueprint's About › What Arbor remembers object; also reachable from Talk's
 * menu and Settings through #/memory).
 *
 * One card between the describe card and the eight areas: the proposals that
 * wait for the parent and are NOT already placed inside an area below (an
 * area shows its own with Confirm / No, so a proposal is never asked twice on
 * one page), then the newest facts the parent approved, each in plain words
 * with where it came from and the day. Remember / Not this are the SAME
 * handleMemoryDecision #/memory and the area cards use — no second write path
 * — and the row settles only after the server confirms. The door opens the
 * full ledger (#/memory: every fact, edit, forget, retention).
 *
 * Counts here are counts of facts in the ledger, never anything about the
 * child. Every text is the scrubbed parent-words version (B-CAREPRO-06).
 */
const SHOWN_PENDING = 3;
/** B-CAREPRO-38 — the pending facts About itself asks about (in an area, or on
 *  this card): the embedded ledger leaves them out, so each is asked once. */
export function aboutAskedPendingIds(pending: readonly MemoryReviewItem[], areas: readonly AspectState[]): Set<string> {
  const scrubbed = scrubMemoryProposals([...pending]);
  const inAreas = new Set(areas.map((a) => a.pending?.memoryId).filter(Boolean) as string[]);
  const onCard = scrubbed.filter((m) => !inAreas.has(m.memoryId)).slice(0, SHOWN_PENDING).map((m) => m.memoryId);
  return new Set([...inAreas, ...onCard]);
}
const SHOWN_APPROVED = 3;
/** The sources a fact came from in the parent's own conversation (ChildMemory's set). */
const CONVERSATION_SOURCES: ReadonlySet<string> = new Set(["chat", "coach", "conversation", "journal"]);

export default function AboutMemoryCard({ areas, ledgerOpen, onLedger }: {
  areas: readonly AspectState[];
  /** B-CAREPRO-38: the page's "Everything Arbor remembers" ledger is open below. */
  ledgerOpen?: boolean;
  /** B-CAREPRO-38: the door opens the ledger in place (#/memory retired into About). */
  onLedger?: () => void;
}) {
  const { childProfile, approvedMemoryItems, pendingMemoryItems, handleMemoryDecision, isMemoryUpdating, memoryReviewError, setActiveTab } = useArbor();
  const { t, uiLang } = useLanguage();
  const first = childProfile.name.split(" ")[0] || childProfile.name;
  const [failed, setFailed] = useState<string | null>(null);
  const pending = useMemo(() => scrubMemoryProposals(pendingMemoryItems), [pendingMemoryItems]);
  const approved = useMemo(
    () => scrubMemoryProposals(approvedMemoryItems).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [approvedMemoryItems],
  );
  // The proposals no area below shows: an area carries its own Confirm / No.
  const inAreas = useMemo(() => new Set(areas.map((a) => a.pending?.memoryId).filter(Boolean) as string[]), [areas]);
  const waitingHere = pending.filter((m) => !inAreas.has(m.memoryId));
  const othersInAreas = pending.length - waitingHere.length;
  // An approved fact an area already quotes is not printed twice on the page.
  const quoted = useMemo(() => new Set(areas.map((a) => a.known?.memoryId).filter(Boolean) as string[]), [areas]);
  const approvedHere = approved.filter((m) => !quoted.has(m.memoryId));

  const source = (m: MemoryReviewItem) => {
    const day = m.createdAt ? fmtDay(m.createdAt, uiLang) : null;
    if (CONVERSATION_SOURCES.has(m.source)) return day ? t("companion.about.memory.fromTalk", { date: day }) : t("companion.about.memory.fromTalkUndated");
    return day ? t("companion.about.srcNoted", { date: day }) : t("companion.about.srcNotedUndated");
  };
  const decide = async (memoryId: string, status: "approved" | "rejected") => {
    setFailed(null);
    let ok = false;
    try { ok = await handleMemoryDecision(memoryId, status); } catch { ok = false; }
    if (!ok) setFailed(memoryId);
  };

  const badge = pending.length > 0
    ? t(pending.length === 1 ? "companion.about.memory.waitingOne" : "companion.about.memory.waiting", { n: pending.length })
    : approved.length > 0 ? t("companion.about.memory.allChecked") : null;

  return (
    <section className="about-memory" data-testid="about-memory" aria-labelledby="about-memory-title">
      <div className="about-memory-head">
        <BrandChip icon="psychology" tone="lav" size={40} />
        <div className="about-memory-titles">
          <h2 id="about-memory-title">{t("companion.about.memory.title", { name: first })}</h2>
          <p>{t("companion.about.memory.sub")}</p>
        </div>
        {badge && <span className="about-memory-badge" data-pending={pending.length > 0 ? "" : undefined} data-testid="about-memory-badge">{badge}</span>}
      </div>

      {memoryReviewError ? (
        <p className="about-memory-note" role="status">{t("companion.about.memory.loadFailed")}</p>
      ) : (
        <ul className="about-memory-rows" role="list">
          {waitingHere.slice(0, SHOWN_PENDING).map((m) => {
            const busy = isMemoryUpdating === m.memoryId;
            return (
              <li key={m.memoryId} className="about-memory-row" data-pending="" data-testid="about-memory-pending">
                <Icon name="help" size={18} className="about-memory-row-icon" />
                <p className="about-memory-fact"><span dir="auto">{m.fact}</span> <span className="about-memory-src">· {source(m)}</span></p>
                <span className="about-memory-actions">
                  <button type="button" className="about-memory-keep min-h-11" data-testid="about-memory-remember" disabled={busy} onClick={() => void decide(m.memoryId, "approved")}>
                    {t("companion.about.memory.remember")}
                  </button>
                  <button type="button" className="about-memory-not min-h-11" data-testid="about-memory-not" disabled={busy} onClick={() => void decide(m.memoryId, "rejected")}>
                    {t("companion.about.memory.not")}
                  </button>
                </span>
                {failed === m.memoryId && <p className="about-memory-failed" role="alert">{t("companion.about.memory.failed")}</p>}
              </li>
            );
          })}
          {approvedHere.slice(0, SHOWN_APPROVED).map((m) => (
            <li key={m.memoryId} className="about-memory-row" data-testid="about-memory-approved">
              <p className="about-memory-fact"><span dir="auto">{m.fact}</span> <span className="about-memory-src">· {source(m)}</span></p>
              <Icon name="check_circle" size={18} className="about-memory-row-ok" fill={1} />
            </li>
          ))}
          {pending.length === 0 && approved.length === 0 && (
            <li className="about-memory-empty" data-testid="about-memory-empty">{t("companion.about.memory.empty")}</li>
          )}
        </ul>
      )}
      {(othersInAreas > 0 || approved.length > approvedHere.length) && (
        <p className="about-memory-note" data-testid="about-memory-in-areas">{t("companion.about.memory.inAreas")}</p>
      )}
      <div className="about-memory-foot">
        <p className="about-memory-note">{t("companion.about.memory.note")}</p>
        {/* B-CAREPRO-38: the ledger opens IN PLACE on this page (one home for
            approve, correct and forget); without a host it still names #/memory,
            which lands here. */}
        <button type="button" className="about-memory-open min-h-11" data-testid="profile-remember-check"
          aria-expanded={onLedger ? !!ledgerOpen : undefined}
          aria-controls={onLedger ? "about-memory-ledger" : undefined}
          onClick={() => (onLedger ? onLedger() : setActiveTab("memory"))}
        >
          {t("companion.about.memory.open")}<Icon name={onLedger ? (ledgerOpen ? "expand_less" : "expand_more") : "arrow_forward"} size={18} className={onLedger ? undefined : "rtl:-scale-x-100"} />
        </button>
      </div>
    </section>
  );
}
