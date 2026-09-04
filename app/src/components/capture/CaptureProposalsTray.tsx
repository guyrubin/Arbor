import { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToastOptional } from "../../context/ToastContext";
import { PASTEL } from "../ui/kit";
import { attachProposalConflicts } from "../../lib/conversationProposals";
import { buildTypedCaptureProposals, TYPED_TURN_PROMPT } from "../../lib/captureProposals";
import { recordCaptureProvenance } from "../../lib/captureProvenance";
import { track } from "../../lib/analytics";

/**
 * AI-04 — the proposals tray for TYPED coach turns.
 *
 * A live voice turn has had a review tray since the Harbor work
 * (coach/ConversationProposalTray). A typed turn had none: the parent read a
 * structured answer and could keep none of it without retyping. This is that
 * tray for the typed half, and it deliberately reuses BOTH existing seams
 * rather than adding a third:
 *
 *   "Keep this"          → ArborContext.commitConversationProposal — the ONE
 *                          durable-write seam for a proposal. Explicit,
 *                          atomic, auditable, reversible; stamps
 *                          `conversationProposalId` + `sourceExcerpt` on the
 *                          behaviour log and files a ConversationChangeRecord
 *                          in the registered `conversationChanges` collection.
 *   "Edit before keeping"→ requestCapture("ai-draft") — the fail-closed gate
 *                          (review flag armed, factual 'ai-draft' provenance,
 *                          form opened into view; the only write is
 *                          confirmReview). Nothing here writes a log directly.
 *
 * Right after the commit, lib/captureProvenance records the half the shared
 * record cannot carry — which prompt produced the sentence, which structured
 * field it was quoted from, and that the turn was typed — keyed by the log id
 * the commit actually returned. So a kept row can always say where it came
 * from, in the Journal feed and in the entry sheet.
 *
 * CLINICAL FIREWALL: the tray only ever shows lines the allow-list in
 * lib/captureProposals permits (today's steps, words to use, what to watch
 * for). Risk levels, domain pointers and hypotheses can never reach a kept
 * row. Nothing here is scored, ranked, or compared.
 */
export default function CaptureProposalsTray({ surface }: { surface: string }) {
  const {
    chatMessages, childProfile, behaviorLogs, milestones,
    conversationChanges, commitConversationProposal,
    requestCapture, setActiveTab, setNewLogNotes,
  } = useArbor();
  const { t, uiLang } = useLanguage();
  const toastCtx = useToastOptional();
  const toast = (message: string, type?: "success" | "error" | "info") => toastCtx?.toast(message, type);

  // Session-local: a proposal the parent waved away must not come back on the
  // next render. Kept out of storage on purpose — a dismissed suggestion is
  // not a fact about the child and does not belong in the per-child record.
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const proposals = useMemo(() => {
    const built = buildTypedCaptureProposals(chatMessages, {
      childId: childProfile.id,
      language: uiLang === "he" ? "he" : "en",
      now: new Date().toISOString(),
    });
    if (!built.length) return built;
    // Conflicts are computed from canonical records, never trusted to a model:
    // the SAME deterministic check the voice tray runs, so a line already in
    // the journal is marked rather than silently kept twice.
    const checked = attachProposalConflicts(
      built.map((b) => b.proposal),
      { behaviorLogs, milestones, committedChanges: conversationChanges },
    );
    return built.map((b, i) => ({ ...b, proposal: checked[i] }));
  }, [chatMessages, childProfile.id, uiLang, behaviorLogs, milestones, conversationChanges]);

  const visible = proposals.filter((p) => !dismissed.has(p.proposal.id));
  if (!visible.length) return null;

  const summaryOf = (id: string, fallback: string) => edits[id] ?? fallback;

  const keep = async (entry: (typeof visible)[number]) => {
    const id = entry.proposal.id;
    const summary = summaryOf(id, entry.proposal.summary).trim();
    if (!summary) return;
    setBusyId(id);
    try {
      // The ONE durable write. It returns the committed record, whose
      // commitRef names the row that was actually created.
      // "typed" is not decoration: it decides the stored row's id prefix and its
      // `response` line, which the parent reads in the Journal and which is
      // printed into reports. Committing a typed keep without it would tell them
      // they said this out loud.
      const record = await commitConversationProposal({ ...entry.proposal, summary }, "typed");
      const logId = record.commitRef?.id;
      if (logId) {
        recordCaptureProvenance(childProfile.id, {
          logId,
          proposalId: id,
          origin: "coach-answer",
          turnKind: "typed",
          field: entry.field,
          promptKey: TYPED_TURN_PROMPT.key,
          promptVersion: TYPED_TURN_PROMPT.version,
          sourceExcerpt: entry.proposal.sourceExcerpt,
          keptAt: record.confirmedAt,
        });
      }
      setDismissed((prev) => new Set([...prev, id]));
      try { track("capture_proposal_kept", { surface, field: entry.field, turnKind: "typed" }); } catch { /* noop */ }
      toast(t("elev.waveR.capture.kept"), "success");
    } catch {
      toast(t("elev.waveR.capture.keepFailed"), "error");
    } finally {
      setBusyId(null);
    }
  };

  /** The fail-closed route for a parent who wants to change it first. */
  const editFirst = (entry: (typeof visible)[number]) => {
    setNewLogNotes(summaryOf(entry.proposal.id, entry.proposal.summary).slice(0, 400));
    requestCapture("ai-draft");
    setActiveTab("behaviors");
    setDismissed((prev) => new Set([...prev, entry.proposal.id]));
  };

  return (
    <section
      data-testid="capture-proposals-tray"
      aria-label={t("elev.waveR.capture.title")}
      className="rounded-[18px] p-4 sm:p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule-strong)", boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex items-start gap-3">
        <span
          className="inline-flex flex-shrink-0 items-center justify-center rounded-full"
          style={{ width: 34, height: 34, background: PASTEL.mint.soft, color: PASTEL.mint.ink }}
        >
          <Icon name="bookmark_add" size={19} fill={1} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: "var(--arbor-green-ink)" }}>
            {t("elev.waveR.capture.eyebrow")}
          </p>
          <h2 className="mt-1 text-[17px] font-extrabold tracking-[-0.01em]" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
            {t("elev.waveR.capture.title")}
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--arbor-muted)" }}>
            {t("elev.waveR.capture.body")}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {visible.map((entry) => {
          const id = entry.proposal.id;
          const busy = busyId === id;
          const value = summaryOf(id, entry.proposal.summary);
          return (
            <article
              key={id}
              data-testid="capture-proposal"
              className="rounded-2xl p-3"
              style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
            >
              <p className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: "var(--arbor-lav-ink)" }}>
                {t(`elev.waveR.capture.field.${entry.field}`)}
              </p>
              <label className="mt-2 block">
                <span className="sr-only">{t("elev.waveR.capture.editLabel")}</span>
                <textarea
                  value={value}
                  rows={2}
                  dir="auto"
                  onChange={(e) => setEdits((prev) => ({ ...prev, [id]: e.target.value.slice(0, 600) }))}
                  className="w-full resize-none rounded-xl px-3 py-2 text-[13.5px] leading-relaxed focus:outline-none focus-visible:ring-2"
                  style={{ background: "var(--arbor-paper-elevated)", color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                />
              </label>
              <p className="mt-2 text-[11.5px] leading-snug" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                <strong>{t("elev.waveR.capture.asked")}:</strong> {entry.proposal.sourceExcerpt}
              </p>
              {entry.proposal.conflict && (
                <p role="alert" className="mt-2 text-[11.5px] font-bold" dir="auto" style={{ color: "var(--arbor-clay-ink)" }}>
                  {t("elev.waveR.capture.duplicate")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDismissed((prev) => new Set([...prev, id]))}
                  className="min-h-[44px] rounded-xl px-3 text-[12px] font-bold"
                  style={{ color: "var(--arbor-muted)" }}
                >
                  {t("elev.waveR.capture.skip")}
                </button>
                <button
                  type="button"
                  onClick={() => editFirst(entry)}
                  data-testid="capture-proposal-edit"
                  className="min-h-[44px] rounded-xl px-3 text-[12px] font-bold"
                  style={{ color: "var(--arbor-ink)", border: "1px solid var(--arbor-rule)" }}
                >
                  {t("elev.waveR.capture.edit")}
                </button>
                <button
                  type="button"
                  disabled={busy || !value.trim()}
                  onClick={() => void keep(entry)}
                  data-testid="capture-proposal-keep"
                  className="min-h-[44px] rounded-xl px-4 text-[12px] font-extrabold disabled:opacity-50"
                  style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
                >
                  {t("elev.waveR.capture.keep")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
