import React from "react";
import { useLanguage } from "../../context/LanguageContext";

/** TODAY-3 — the ONE shared confirmed-capture review contract.
 *
 *  Every capture modality (parent-typed text, voice transcription, photo)
 *  passes through this exact component before a behavior-log write:
 *  QuickLogModal renders it for the Today text path, BehaviorsTab renders it
 *  for voice-originated and requestCapture()-handoff entries. No surface may
 *  fork its own review markup — one contract, one copy set (ql.review.*).
 *
 *  CODEX-7 (firewall, may never return): the provenance line states only the
 *  FACTUAL source of the draft — "written by you" / "voice transcription" /
 *  "photo". No static confidence/certainty wording is allowed here; an
 *  unconditional "high confidence" is an asserted-not-computed system verdict
 *  (guarded by todayConsolidation.test.ts + confirmCaptureReview.test.ts). */

export type CaptureSource = "text" | "voice" | "photo";

const SOURCE_KEY: Record<CaptureSource, string> = {
  text: "ql.review.source",
  voice: "ql.review.source.voice",
  photo: "ql.review.source.photo",
};

export default function ConfirmCaptureReview({
  source,
  rows,
  photoSrc,
  onEdit,
  onDiscard,
  onConfirm,
}: {
  /** Factual provenance of the draft — picks the ql.review.source* line. */
  source: CaptureSource;
  /** Draft fields to review; empty values are skipped. */
  rows: { label: string; value: string }[];
  /** Optional photo attachment preview (photo-originated drafts). */
  photoSrc?: string;
  /** Back to the form without saving. */
  onEdit: () => void;
  /** Throw the draft away — nothing enters the record. */
  onDiscard: () => void;
  /** The ONLY path to the behavior-log write seam. */
  onConfirm: (e: React.FormEvent) => void;
}) {
  const { t } = useLanguage();
  return (
    <form onSubmit={onConfirm} className="space-y-4 text-sm">
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }} role="status">
        <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ql.review.title")}</p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t(SOURCE_KEY[source])}</p>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ql.review.notSaved")}</p>
      </div>
      {rows.filter((r) => r.value.trim()).map((r) => (
        <div key={r.label} className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{r.label}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{r.value}</p>
        </div>
      ))}
      {photoSrc && (
        <img src={photoSrc} alt={t("ql.review.photoAlt")} className="h-24 rounded-xl object-cover" style={{ border: "1px solid var(--arbor-rule)" }} />
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button type="button" onClick={onEdit} className="min-h-11 rounded-xl px-3 text-xs font-bold" style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}>{t("ql.review.edit")}</button>
        <button type="button" onClick={onDiscard} className="min-h-11 rounded-xl px-3 text-xs font-bold" style={{ color: "var(--arbor-muted)" }}>{t("ql.review.discard")}</button>
        <button type="submit" className="col-span-2 min-h-11 rounded-xl px-3 text-xs font-extrabold text-white sm:col-span-1" style={{ background: "var(--arbor-gradient-primary)" }}>{t("ql.review.confirm")}</button>
      </div>
    </form>
  );
}
