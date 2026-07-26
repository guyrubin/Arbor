import React from "react";
import { Icon } from "../ui/Icon";
import { useLanguage } from "../../context/LanguageContext";

/**
 * GD-1 reviewer-preview — the persistent, unmistakable DRAFT banner. Rendered
 * on EVERY surface and EVERY card that shows unpublished content to the
 * appointed clinical reviewer. Amber/peach token styling (--arbor-peach-*,
 * tokens only) so it can never be mistaken for published parent content.
 * `compact` = the per-card strip; default = the surface-level band.
 */
export default function DraftReviewBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage();

  if (compact) {
    return (
      <span
        role="status"
        data-testid="draft-review-banner"
        className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em]"
        style={{ background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)", border: "1px solid var(--arbor-peach-ink)" }}
      >
        <Icon name="edit_note" size={12} className="flex-shrink-0" />
        <span className="min-w-0 truncate">{t("review.draftBanner")}</span>
      </span>
    );
  }

  return (
    <div
      role="status"
      data-testid="draft-review-banner"
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
      style={{ background: "var(--arbor-peach-soft)", border: "1px solid var(--arbor-peach-ink)" }}
    >
      <Icon name="edit_note" size={18} className="flex-shrink-0" style={{ color: "var(--arbor-peach-ink)" }} />
      <p className="min-w-0 text-xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--arbor-peach-ink)" }}>
        {t("review.draftBanner")}
      </p>
    </div>
  );
}
