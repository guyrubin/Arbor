import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Icon } from "../ui/Icon";

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
 *  "photo" / "drafted by Arbor" (AI-CAP-4). No static confidence/certainty
 *  wording is allowed here; an unconditional "high confidence" is an
 *  asserted-not-computed system verdict (guarded by todayConsolidation.test.ts
 *  + confirmCaptureReview.test.ts).
 *
 *  AI-CAP-3/4: "ai-draft" is the provenance for EVERY extraction-filled draft
 *  (typed-sentence extraction and the coach Create-log handoff) — the review
 *  line must never claim the parent wrote what the model drafted.
 *
 *  AI-CAP-5 (review honesty): the review now surfaces exactly the fields the
 *  extraction seam infers most aggressively — intensity, context, duration —
 *  with inline correction IN PLACE (intensity = 1-5 stepper, context = the
 *  4-chip row, duration = numeric row, text rows = tap-to-edit). A parent must
 *  never one-tap-confirm an AI-guessed intensity they were never shown. The
 *  "from your note" tag on those rows is a FACTUAL provenance label (where the
 *  value came from), never a certainty claim. */

export type CaptureSource = "text" | "voice" | "photo" | "ai-draft";

const SOURCE_KEY: Record<CaptureSource, string> = {
  text: "ql.review.source",
  voice: "ql.review.source.voice",
  photo: "ql.review.source.photo",
  "ai-draft": "ql.review.source.aiDraft",
};

export type ReviewRow = {
  label: string;
  value: string;
  /** AI-CAP-5: providing a setter makes the row tap-to-edit in place. */
  onChange?: (value: string) => void;
};

/** AI-CAP-5 — tap-to-edit text row: renders as plain text until tapped, then
 *  as an inline input bound straight to the draft state (no form round-trip). */
function EditableRow({ row, fromNoteLabel }: { row: ReviewRow; fromNoteLabel?: string }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{row.label}</p>
        {fromNoteLabel && <span className="text-[9px] font-bold" style={{ color: "var(--arbor-muted)" }}>{fromNoteLabel}</span>}
      </div>
      {row.onChange && editing ? (
        <textarea
          value={row.value}
          onChange={(e) => row.onChange!(e.target.value)}
          onBlur={() => setEditing(false)}
          rows={2}
          autoFocus
          dir="auto"
          className="mt-1 w-full rounded-lg p-2 text-xs leading-relaxed focus:outline-none"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
        />
      ) : row.onChange ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${row.label} — ${t("ql.review.tapToEdit")}`}
          className="mt-1 flex w-full items-start justify-between gap-2 text-start"
        >
          <span className="text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{row.value}</span>
          <Icon name="edit" size={13} className="flex-shrink-0" style={{ color: "var(--arbor-muted)" }} aria-hidden />
        </button>
      ) : (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{row.value}</p>
      )}
    </div>
  );
}

export default function ConfirmCaptureReview({
  source,
  rows,
  intensity,
  onIntensityChange,
  context,
  contextOptions,
  onContextChange,
  durationMinutes,
  onDurationChange,
  photoSrc,
  onEdit,
  onDiscard,
  onConfirm,
}: {
  /** Factual provenance of the draft — picks the ql.review.source* line. */
  source: CaptureSource;
  /** Draft fields to review; empty values are skipped. A row with onChange is tap-to-edit. */
  rows: ReviewRow[];
  /** AI-CAP-5: intensity 1-5, corrected in place via the stepper. */
  intensity?: number;
  onIntensityChange?: (n: number) => void;
  /** AI-CAP-5: context, corrected in place via the 4-chip row. */
  context?: string;
  contextOptions?: string[];
  onContextChange?: (c: string) => void;
  /** AI-CAP-5: duration in minutes, corrected in place. */
  durationMinutes?: number;
  onDurationChange?: (n: number) => void;
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
  // AI-CAP-5: "from your note" — a factual where-this-value-came-from label on
  // the AI/voice-populated rows only (never certainty wording, CODEX-7).
  const aiFilled = source === "voice" || source === "ai-draft";
  const fromNote = aiFilled ? t("ql.review.fromNote") : undefined;
  return (
    <form onSubmit={onConfirm} className="space-y-4 text-sm">
      <div className="rounded-2xl p-4" style={{ background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-rule)" }} role="status">
        <p className="text-sm font-extrabold" style={{ color: "var(--arbor-ink)" }}>{t("ql.review.title")}</p>
        <p className="mt-1 text-[11px]" style={{ color: "var(--arbor-muted)" }}>{t(SOURCE_KEY[source])}</p>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("ql.review.notSaved")}</p>
      </div>
      {rows.filter((r) => r.value.trim()).map((r) => (
        <EditableRow key={r.label} row={r} fromNoteLabel={r.onChange ? fromNote : undefined} />
      ))}
      {typeof intensity === "number" && onIntensityChange && (
        <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{t("ql.review.intensity")}</p>
            {fromNote && <span className="text-[9px] font-bold" style={{ color: "var(--arbor-muted)" }}>{fromNote}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onIntensityChange(Math.max(1, intensity - 1))}
              disabled={intensity <= 1}
              aria-label={t("ql.review.intensityDown")}
              className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
              style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name="remove" size={16} />
            </button>
            <span className="inline-flex items-center gap-1.5" role="status" aria-live="polite" aria-label={t("beh.level", { n: intensity })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className="rounded-full" style={{ width: 9, height: 9, background: n <= intensity ? "var(--arbor-green-ink)" : "var(--arbor-rule)" }} />
              ))}
              <span className="ms-1 text-xs font-bold" style={{ color: "var(--arbor-ink)" }}>{intensity} / 5</span>
            </span>
            <button
              type="button"
              onClick={() => onIntensityChange(Math.min(5, intensity + 1))}
              disabled={intensity >= 5}
              aria-label={t("ql.review.intensityUp")}
              className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-40"
              style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}
            >
              <Icon name="add" size={16} />
            </button>
          </div>
        </div>
      )}
      {context !== undefined && contextOptions && onContextChange && (
        <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{t("ql.review.context")}</p>
            {fromNote && <span className="text-[9px] font-bold" style={{ color: "var(--arbor-muted)" }}>{fromNote}</span>}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label={t("ql.review.context")}>
            {contextOptions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onContextChange(c)}
                aria-pressed={context === c}
                className="min-h-9 rounded-lg py-1.5 text-[10px] font-bold transition"
                style={context === c
                  ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)" }
                  : { background: "var(--arbor-paper-deep)", color: "var(--arbor-muted)", border: "1px solid var(--arbor-rule)" }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
      {typeof durationMinutes === "number" && onDurationChange && (
        <div className="rounded-xl p-3" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="review-duration" className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-green-ink)" }}>{t("ql.review.duration")}</label>
            {fromNote && <span className="text-[9px] font-bold" style={{ color: "var(--arbor-muted)" }}>{fromNote}</span>}
          </div>
          <input
            id="review-duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => onDurationChange(Math.max(1, parseInt(e.target.value) || 1))}
            className="mt-1 w-24 rounded-lg p-2 text-xs focus:outline-none"
            style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-ink)" }}
          />
        </div>
      )}
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
