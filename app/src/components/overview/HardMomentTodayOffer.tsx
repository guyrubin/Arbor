import React, { useMemo } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { locText } from "../../content/hardMomentSurface";
import { previewTodayOffer } from "../../content/reviewPreview";
import { useEntitlement } from "../../hooks/useEntitlement";
import DraftReviewBanner from "../review/DraftReviewBanner";
import ReviewQueuePanel from "../review/ReviewQueuePanel";

/**
 * CONT-2 (AR-CONT-01) — the Today hard-moment offer, built dark. When a
 * PUBLISHED card matches the parent's recent behavior-log categories
 * (selectCards.matchToRecentBehaviors, fail-closed on isPublishableContent),
 * its doNow is offered as today's step through the EXISTING acceptTodayAction
 * seam — no new capture path. Renders nothing when an action is already
 * active, when nothing matches, or (today) with the real all-draft pack.
 * TODAY-2 constraint holds: the accept button here is a secondary OUTLINE
 * control — the guidance hero keeps the single gradient-primary CTA.
 *
 * GD-1 reviewer-preview: for the server-verified appointed clinical reviewer
 * ONLY (previewTodayOffer, allow-list gated), a draft card renders under the
 * persistent DRAFT banner so the surface is reviewable in production. Review
 * is READ-ONLY — the accept CTA is withheld in draft preview so draft copy
 * never enters the today-action seam.
 */
export default function HardMomentTodayOffer() {
  const { behaviorLogs, activeTodayAction, acceptTodayAction } = useArbor();
  const { t, uiLang } = useLanguage();
  const { entitlement } = useEntitlement();
  const isReviewer = entitlement.clinicalReviewer === true;

  const offer = useMemo(() => previewTodayOffer(behaviorLogs, isReviewer), [behaviorLogs, isReviewer]);
  if (activeTodayAction || !offer) return null;

  const locale = uiLang === "he" ? "he" : "en";
  const doNow = locText(offer.card.doNow, locale);

  return (
    <section
      className="mt-4 rounded-[20px] p-5"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", boxShadow: "var(--shadow-xs)" }}
      aria-labelledby="hard-moment-offer-title"
      data-testid="hard-moment-today-offer"
    >
      {offer.draftPreview && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DraftReviewBanner />
          <ReviewQueuePanel />
        </div>
      )}
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}>
          <Icon name="volunteer_activism" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--arbor-green-ink)" }}>{t("hm.today.eyebrow")}</p>
          <h2 id="hard-moment-offer-title" className="mt-1 text-base font-bold leading-snug" style={{ color: "var(--arbor-ink)", fontFamily: "var(--font-display)" }}>
            {locText(offer.card.title, locale)}
          </h2>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--arbor-muted)" }}>{doNow}</p>
          {!offer.draftPreview && (
            <button
              type="button"
              onClick={() => acceptTodayAction(doNow, "standard")}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-extrabold transition active:scale-[0.98]"
              style={{ border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)", background: "transparent" }}
            >
              {t("today.action.make")} <Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
