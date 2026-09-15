import React, { useEffect, useRef } from "react";
import type { ConversationProposal } from "../../lib/conversationProposals";
import { proposalConfidenceLabel } from "../../lib/conversationProposals";
import { useArborOptional } from "../../context/ArborContext";
import { useToastOptional } from "../../context/ToastContext";
import { undoKeptCapture, undoRefusalOf } from "../../lib/captureUndo";
import { trackKeepUndone } from "../../lib/kpiEvents";
import { en as journalEn, he as journalHe } from "../../lib/i18nElevation/journal";

/**
 * N1-08 — the Keep toast's provenance wording and its Undo label come from
 * lib/i18nElevation/journal.ts, never from an inline ternary: the ternary below
 * picks the DICTIONARY (exactly as this file's own `COPY[language]` does), not
 * the string. The context-free `useArborOptional` / `useToastOptional` variants
 * keep this tray renderable outside any provider, which is how its own test
 * mounts it.
 */
const JOURNAL_COPY = { en: journalEn, he: journalHe } as const;

const COPY = {
  en: {
    title: "Review before saving", none: "Nothing has been saved yet.", save: "Save", discard: "Discard",
    source: "From what you said", conflict: "This may change or repeat an existing record.",
    observation: "Observation", milestone: "Milestone", journal: "Journal", report_fact: "Report fact",
    clear: "Clear", check: "Check", uncertain: "Needs clarification",
  },
  he: {
    title: "בדיקה לפני השמירה", none: "עדיין לא נשמר דבר.", save: "שמירה", discard: "ויתור",
    source: "מתוך מה שאמרתם", conflict: "ייתכן שהעדכון משנה או חוזר על מידע קיים.",
    observation: "תצפית", milestone: "אבן דרך", journal: "יומן", report_fact: "פרט לדוח",
    clear: "ברור", check: "כדאי לבדוק", uncertain: "דרושה הבהרה",
  },
} as const;

export default function ConversationProposalTray({
  proposals,
  language,
  busyId,
  onEdit,
  onConfirm,
  onDiscard,
}: {
  proposals: ConversationProposal[];
  language: "en" | "he";
  busyId?: string | null;
  onEdit: (id: string, summary: string) => void;
  /** Widened to allow awaiting the caller's commit before the Keep toast. */
  onConfirm: (proposal: ConversationProposal) => void | Promise<void>;
  onDiscard: (id: string) => void;
}) {
  const arbor = useArborOptional();
  const toastCtx = useToastOptional();
  const j = JOURNAL_COPY[language];

  // The Undo is pressed from a toast closure built before the commit landed,
  // so the audit collection is read through a live ref (N1-08).
  const changesRef = useRef(arbor?.conversationChanges ?? []);
  useEffect(() => { changesRef.current = arbor?.conversationChanges ?? []; }, [arbor?.conversationChanges]);

  /**
   * Keep, then offer the reversal in the same frame. The toast appears only
   * once the audit record has actually landed as "committed" — if the caller's
   * commit threw it has already raised its own error toast, and telling the
   * parent something was kept when it was not is the one failure this surface
   * must never have. BLOCK #1: a milestone confirmation gets no Undo.
   */
  const confirmThenOfferUndo = async (proposal: ConversationProposal) => {
    await onConfirm(proposal);
    if (proposal.target === "milestone" || !arbor || !toastCtx) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const landed = changesRef.current.some(
      (item) => item.id === proposal.id && item.status === "committed",
    );
    if (!landed) return;
    toastCtx.toast(j["elev.keep.kept"], "success", {
      label: j["elev.keep.undo"],
      onClick: () => {
        void (async () => {
          const outcome = await undoKeptCapture(proposal.id, {
            readChanges: () => changesRef.current,
            undoChange: arbor.undoConversationChange,
          });
          const refusal = undoRefusalOf(outcome);
          if (refusal) {
            if (refusal !== "already_undone") toastCtx.toast(j["elev.keep.undoFailed"], "error");
            return;
          }
          try { trackKeepUndone("coach-voice-tray"); } catch { /* noop */ }
          toastCtx.toast(j["elev.keep.undone"], "info");
        })();
      },
    });
  };

  if (!proposals.length) return null;
  const c = COPY[language];
  return (
    <aside
      aria-label={c.title}
      dir={language === "he" ? "rtl" : "ltr"}
      className="fixed inset-x-3 bottom-[250px] z-50 mx-auto max-h-[48vh] w-auto max-w-[620px] overflow-y-auto rounded-[22px] p-4"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-lg)" }}
    >
      <div className="mb-3">
        <h2 className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{c.title}</h2>
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{c.none}</p>
      </div>
      <div className="space-y-3">
        {proposals.map((proposal) => {
          const confidence = proposalConfidenceLabel(proposal.confidence);
          const busy = busyId === proposal.id;
          return (
            <article key={proposal.id} className="rounded-2xl p-3" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "var(--arbor-green-ink)" }}>
                <span>{c[proposal.target]}</span><span aria-hidden>·</span><span>{c[confidence]}</span>
              </div>
              <label className="mt-2 block">
                <span className="sr-only">{c[proposal.target]}</span>
                <textarea
                  value={proposal.summary}
                  onChange={(event) => onEdit(proposal.id, event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl px-3 py-2 text-sm leading-relaxed focus:outline-none focus-visible:ring-2"
                  style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                />
              </label>
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
                <strong>{c.source}:</strong> “{proposal.sourceExcerpt}”
              </p>
              {proposal.conflict && <p role="alert" className="mt-2 text-[11px] font-bold" style={{ color: "var(--arbor-clay-ink)" }}>{c.conflict}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => onDiscard(proposal.id)} className="min-h-10 rounded-xl px-3 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{c.discard}</button>
                <button type="button" disabled={busy || !proposal.summary.trim() || proposal.conflict?.code === "missing_milestone"} onClick={() => void confirmThenOfferUndo(proposal)} className="min-h-10 rounded-xl px-4 text-xs font-extrabold disabled:opacity-50" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>{c.save}</button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
}
