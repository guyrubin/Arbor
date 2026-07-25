import React, { useEffect, useState } from "react";
import { Modal } from "../ui/Modal";
import ConfirmCaptureReview from "./ConfirmCaptureReview";
import type { CaptureSource } from "./ConfirmCaptureReview";
import { MarkdownBlock } from "../ui/MarkdownBlock";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useToast } from "../../context/ToastContext";
import { useLanguage } from "../../context/LanguageContext";
import { api, EscalationRequiredError, getAiLanguage } from "../../lib/api";
import { escalationCategories, renderEscalationMarkdown } from "../../safety/escalation";
import { BEHAVIOR_TYPES, behaviorTypeLabel, normalizeExtractedLog } from "../../content/behaviorTaxonomy";
import type { BehaviorContext } from "../../types";

/** Lightweight behavior log capture that can be opened from anywhere (e.g. Overview). */
export default function QuickLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    newLogType,
    setNewLogType,
    newLogIntensity,
    setNewLogIntensity,
    newLogTrigger,
    setNewLogTrigger,
    newLogResponse,
    setNewLogResponse,
    setNewLogDuration,
    setNewLogContext,
    setNewLogNotes,
    childProfile,
    handleAddLog,
  } = useArbor();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [reviewing, setReviewing] = useState(false);
  // AI-CAP-3: factual provenance of the current draft — 'ai-draft' whenever
  // the extraction seam filled the fields (the review line must never claim
  // the parent wrote what the model drafted), 'text' for a hand-filled form.
  const [source, setSource] = useState<CaptureSource>("text");
  const [drafting, setDrafting] = useState(false);
  // AI-CAP-3 firewall condition: a 409 on the TYPED path renders the FULL
  // crisis-resources surface (never a toast) and writes ZERO draft fields —
  // the ApiError must not fall through to sentence-into-trigger.
  const [escalationMarkdown, setEscalationMarkdown] = useState<string | null>(null);
  useEffect(() => {
    if (!open) {
      setReviewing(false);
      setSource("text");
      setEscalationMarkdown(null);
    }
  }, [open]);
  // TODAY-3: the review step is the SHARED ConfirmCaptureReview contract
  // (also rendered by BehaviorsTab for voice/photo/handoff captures — one
  // contract, never a forked path). CODEX-7: its provenance line states only
  // the factual source ("written by you" / "drafted by Arbor"); NO static
  // confidence/certainty wording may return (firewall generative-honesty
  // rule; guarded by todayConsolidation.test.ts + confirmCaptureReview.test.ts).

  // AI-CAP-3: typed capture through the ONE hardened extraction seam — a messy
  // sentence + Enter yields a fully-prefilled review card in one model
  // round-trip. Every field is clamped via the shared taxonomy module
  // (AI-CAP-8); an empty extracted response prefills a neutral, editable
  // placeholder. Extraction failure (non-escalation) leaves today's manual
  // form untouched — the typed sentence stays in the trigger field.
  const TYPED_EXTRACT_MIN_CHARS = 25;
  const extractFromTyped = async (text: string) => {
    setDrafting(true);
    setEscalationMarkdown(null);
    try {
      const d = await api.extractLog({ message: text, childProfile, language: getAiLanguage() });
      const n = normalizeExtractedLog(d, text);
      setNewLogType(n.behaviorType);
      setNewLogIntensity(n.intensity);
      setNewLogDuration(n.durationMinutes);
      setNewLogContext(n.context as BehaviorContext);
      setNewLogTrigger(n.trigger);
      setNewLogResponse(n.response || t("beh.extract.noResponse"));
      if (n.notes) setNewLogNotes(n.notes);
      setSource("ai-draft");
      setReviewing(true);
    } catch (err) {
      // FAIL-CLOSED: the escalation branch runs FIRST and writes no draft field.
      if (err instanceof EscalationRequiredError) {
        const match =
          escalationCategories.find((c) => c.category === err.category) ??
          escalationCategories[0];
        setEscalationMarkdown(renderEscalationMarkdown({ category: match.category, label: match.label, resources: match.resources }));
      } else {
        // Only AFTER the escalation branch: degrade to today's manual form —
        // the sentence is already in the trigger field, nothing is lost.
        toast(t("beh.toast.voiceFallback"), "info");
      }
    } finally {
      setDrafting(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogTrigger.trim() || !newLogResponse.trim()) {
      toast(t("ql.errToast"), "error");
      return;
    }
    setReviewing(true);
  };

  const confirm = (e: React.FormEvent) => {
    handleAddLog(e);
    setReviewing(false);
    setSource("text");
    onClose();
    toast(t("ql.okToast"), "success");
  };

  const discard = () => {
    setNewLogTrigger("");
    setNewLogResponse("");
    setNewLogNotes("");
    setReviewing(false);
    setSource("text");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={t("ql.title")}>
      {escalationMarkdown ? (
        <div role="alert" dir="auto" data-testid="quicklog-escalation" className="space-y-3 text-sm">
          <MarkdownBlock text={escalationMarkdown} className="space-y-2 text-xs leading-relaxed" />
          <button
            type="button"
            onClick={() => setEscalationMarkdown(null)}
            className="min-h-11 w-full rounded-xl px-3 text-xs font-bold"
            style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-muted)" }}
          >
            {t("beh.escalation.dismiss")}
          </button>
        </div>
      ) : reviewing ? <ConfirmCaptureReview
        source={source}
        rows={[
          { label: t("ql.type"), value: behaviorTypeLabel(newLogType, t) },
          { label: t("ql.review.trigger"), value: newLogTrigger },
          { label: t("ql.review.response"), value: newLogResponse },
        ]}
        onEdit={() => setReviewing(false)}
        onDiscard={discard}
        onConfirm={confirm}
      /> : <form onSubmit={submit} className="space-y-4 text-sm">
        <div className="space-y-1.5">
          <label htmlFor="quick-log-type" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.type")}</label>
          {/* AI-CAP-8: options render from the ONE shared taxonomy module — no
              duplicated option literals across capture forms. */}
          <select id="quick-log-type" value={newLogType} onChange={(e) => setNewLogType(e.target.value)} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}>
            {BEHAVIOR_TYPES.map((b) => (
              <option key={b.value} value={b.value}>{t(b.shortLabelKey)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="quick-log-intensity" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.intensity")} <span style={{ color: "var(--arbor-green-ink)" }}>{newLogIntensity} / 5</span></label>
          <input id="quick-log-intensity" type="range" min={1} max={5} value={newLogIntensity} onChange={(e) => setNewLogIntensity(parseInt(e.target.value))} className="w-full" style={{ accentColor: "var(--arbor-clay)" }} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-trigger" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.trigger")}</label>
          <input
            id="quick-log-trigger"
            value={newLogTrigger}
            onChange={(e) => setNewLogTrigger(e.target.value)}
            // AI-CAP-3: Enter on a long fresh description drafts the FULL log
            // through the extraction seam (review opens directly); short
            // inputs keep today's plain-form behavior.
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const typed = newLogTrigger.trim();
              if (!newLogResponse.trim() && typed.length > TYPED_EXTRACT_MIN_CHARS) {
                e.preventDefault();
                void extractFromTyped(typed);
              }
            }}
            placeholder={t("ql.triggerPh")}
            className="w-full rounded-xl p-2.5 text-xs focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="quick-log-response" className="text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.response")}</label>
          <input id="quick-log-response" value={newLogResponse} onChange={(e) => setNewLogResponse(e.target.value)} placeholder={t("ql.responsePh")} className="w-full rounded-xl p-2.5 text-xs focus:outline-none" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }} />
        </div>

        <button type="submit" disabled={drafting} className="w-full py-3 text-white font-extrabold text-xs rounded-xl transition active:scale-[0.98] disabled:opacity-60" style={{ background: "var(--arbor-gradient-primary)" }}>
          {drafting ? (
            <span className="inline-flex items-center gap-1.5"><Icon name="progress_activity" size={14} className="animate-spin" /> {t("beh.parsing")}</span>
          ) : (
            t("ql.save")
          )}
        </button>
      </form>}
    </Modal>
  );
}
