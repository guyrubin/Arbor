import React, { useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { useLanguage } from "../../context/LanguageContext";
import { reviewQueueEntries, type ReviewQueueEntry } from "../../content/reviewPreview";
import DraftReviewBanner from "./DraftReviewBanner";

/**
 * GD-1 reviewer-preview — the reviewer-only "Review queue" panel. Mounted ONLY
 * when the server bootstrap says clinicalReviewer (allow-list; fail-closed).
 * Read-only: lists every authored hard-moment card (both locales), the two
 * VC-6 voice-safety fallback strings, and the escalation-resource copy — each
 * with its review status from the governance metadata. Approval stamps happen
 * in governance (reviewedBy + contentHash), never from this panel.
 */
export default function ReviewQueuePanel() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const entries = useMemo(() => reviewQueueEntries(), []);

  const statusChip = (entry: ReviewQueueEntry) => {
    const approved = entry.status === "approved" || entry.status === "shipped-reviewed";
    return (
      <span
        className="inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={approved
          ? { background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)", border: "1px solid var(--arbor-rule-strong)" }
          : { background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)", border: "1px solid var(--arbor-peach-ink)" }}
      >
        {t(`review.status.${entry.status}`)}
      </span>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="review-queue-open"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold transition active:scale-[0.98]"
        style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)", border: "1px solid var(--arbor-peach-ink)" }}
      >
        <Icon name="fact_check" size={15} /> {t("review.queueOpen")}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t("review.queueTitle")} maxWidth="max-w-2xl">
        <div className="space-y-3" data-testid="review-queue-panel">
          <DraftReviewBanner />
          <p className="text-xs leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{t("review.queueSub")}</p>

          <div className="space-y-2">
            {entries.map((entry) => (
              <details
                key={entry.id}
                className="rounded-xl p-3"
                style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
              >
                <summary className="flex min-w-0 cursor-pointer list-none items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold" style={{ color: "var(--arbor-ink)" }}>{entry.titleEn}</span>
                    <span dir="rtl" className="block truncate text-sm" style={{ color: "var(--arbor-muted)" }}>{entry.titleHe}</span>
                  </span>
                  {statusChip(entry)}
                </summary>
                <div className="mt-2 space-y-2">
                  {entry.reviewedBy.trim() !== "" && (
                    <p className="text-[11px]" style={{ color: "var(--arbor-muted)" }}>
                      {t("review.reviewedBy")}: {entry.reviewedBy} {entry.reviewedAt ? `· ${entry.reviewedAt}` : ""}
                    </p>
                  )}
                  {entry.fields.map((field) => (
                    <div key={field.labelKey} className="rounded-lg p-2.5" style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-peach-ink)" }}>{t(field.labelKey)}</p>
                      {field.en.trim() !== "" && (
                        <p dir="ltr" className="mt-1 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{field.en}</p>
                      )}
                      {field.he.trim() !== "" && (
                        <p dir="rtl" className="mt-1 whitespace-pre-wrap text-xs leading-relaxed" style={{ color: "var(--arbor-ink)" }}>{field.he}</p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
