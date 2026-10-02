import React from "react";
import Icon from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useToastOptional } from "../../context/ToastContext";
import CarryOverActionAsk from "./CarryOverActionAsk";
import RhythmCue from "../coach/RhythmCue";
import TomorrowReasonCard from "../nextopen/TomorrowReasonCard";
import type { CompanionOffer, OfferKind, OfferSurface } from "../../lib/companionOffer";

/**
 * B-AI-06 — the ONE proactive slot. Today and Ask each mount this once; the
 * old cards (carry-over question, rhythm cue, hard-moment offer) stay mounted
 * only as its renderers. Exactly one `data-proactive` frame renders per
 * surface, and it always carries the reason line that says why it is here.
 *
 * The lifecycle re-entry moment ("what-changed") keeps its own position on
 * Today (OverviewTab renders it under the anchor row, gated by the same
 * decision and stamped `data-proactive`), so this slot renders nothing for it.
 */

export interface OfferControls {
  snooze: (kind: OfferKind) => void;
  dismiss: (kind: OfferKind) => void;
  undo: (kind: OfferKind) => void;
  refresh: () => void;
}

/** Kinds whose renderer already carries its own "not now" control. */
const OWN_DISMISS: ReadonlySet<OfferKind> = new Set(["follow-up", "tomorrow-reason", "rhythm", "tonight", "engagement", "what-changed"]);

export function OfferFrame({
  offer,
  surface,
  controls,
  children,
  className = "mt-3 min-w-0",
}: {
  offer: CompanionOffer;
  surface: OfferSurface;
  controls: OfferControls;
  children: React.ReactNode;
  /** B-TODAY-18: the continuation placement sits above the step (no top gap). */
  className?: string;
}) {
  const { t } = useLanguage();
  const toast = useToastOptional();
  const act = (verb: "later" | "notToday") => {
    (verb === "later" ? controls.snooze : controls.dismiss)(offer.kind);
    toast?.toast(t(verb === "later" ? "elev.offer.toast.later" : "elev.offer.toast.notToday"), "info", {
      label: t("elev.offer.toast.undo"),
      onClick: () => controls.undo(offer.kind),
    });
  };
  return (
    <section
      data-proactive=""
      data-offer-kind={offer.kind}
      data-offer-surface={surface}
      data-testid="companion-offer"
      className={className}
    >
      <p dir="auto" data-testid="offer-reason" className="mb-1.5 px-1 text-[12px] font-semibold leading-snug" style={{ color: "var(--arbor-muted)" }}>
        {t(offer.reasonKey, offer.reasonVars)}
      </p>
      {children}
      <div className="mt-1 flex flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => act("later")}
          aria-label={t("elev.offer.ctl.laterAria")}
          className="inline-flex min-h-[44px] items-center px-3 text-[12px] font-bold"
          style={{ color: "var(--arbor-muted)" }}
        >
          {t("elev.offer.ctl.later")}
        </button>
        {!OWN_DISMISS.has(offer.kind) && (
          <button
            type="button"
            onClick={() => act("notToday")}
            aria-label={t("elev.offer.ctl.notTodayAria")}
            className="inline-flex min-h-[44px] items-center px-3 text-[12px] font-bold"
            style={{ color: "var(--arbor-muted)" }}
          >
            {t("elev.offer.ctl.notToday")}
          </button>
        )}
      </div>
    </section>
  );
}

/** The plain-fact card for kinds that had no renderer of their own. */
function CompanionOfferCard({ offer }: { offer: CompanionOffer }) {
  const { t } = useLanguage();
  const { setActiveTab } = useArbor();
  const eyebrow =
    offer.kind === "appointment" ? t("elev.offer.card.appt")
    : offer.kind === "grounded-step" ? t("hm.today.eyebrow")
    : t("elev.offer.card.recheck");
  const ctaLabel = offer.kind === "grounded-step" ? t("elev.brief.grounded.open") : t(offer.cta.labelKey);
  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-3"
      style={{ background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)" }}
    >
      <span aria-hidden className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--arbor-paper)", color: "var(--arbor-green-ink)" }}>
        <Icon name={offer.kind === "appointment" ? "event" : offer.kind === "grounded-step" ? "volunteer_activism" : "fact_check"} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-green-ink)" }}>{eyebrow}</p>
        <button
          type="button"
          onClick={() => setActiveTab(offer.cta.action)}
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-4 text-[12.5px] font-extrabold"
          style={{ background: "var(--arbor-paper)", border: "1px solid var(--arbor-rule-strong)", color: "var(--arbor-green-ink)" }}
        >
          {ctaLabel}
          <Icon name="arrow_forward" size={16} className="flex-shrink-0 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  );
}

export default function CompanionOfferSlot({
  surface,
  offer,
  controls,
  placement = "under-step",
}: {
  surface: OfferSurface;
  offer: CompanionOffer | null;
  controls: OfferControls;
  /** B-TODAY-18: on Today the carry-over / tomorrow's-reason kinds render in
   *  the continuation slot above the step (TodayContinuation wraps this). */
  placement?: "continuation" | "under-step";
}) {
  if (!offer || offer.kind === "what-changed") return null;
  // B-TODAY-12: on Today the grounded hard-moment step lives ON the step card
  // (its Say-this, or its doNow as the step) — one card, one accept.
  if (offer.kind === "grounded-step" && surface === "today") return null;
  let body: React.ReactNode = null;
  switch (offer.kind) {
    case "follow-up":
      body = <CarryOverActionAsk onSkip={controls.refresh} />;
      break;
    case "tomorrow-reason":
      // B-TODAY-18: the card moved here from Growth; the close-of-day WRITE
      // stays with the surfaces that know the signals (Growth, Comics).
      body = <TomorrowReasonCard onResolved={controls.refresh} />;
      break;
    case "appointment":
    case "screening-recheck":
      body = <CompanionOfferCard offer={offer} />;
      break;
    case "rhythm":
    case "tonight":
    case "engagement":
      body = <RhythmCue surface={surface} nudge={offer.nudge ?? null} onDismiss={() => controls.dismiss(offer.kind)} />;
      break;
    case "grounded-step":
      // Ask: a plain door back to Today, where the step card carries it.
      body = <CompanionOfferCard offer={offer} />;
      break;
  }
  return (
    <OfferFrame offer={offer} surface={surface} controls={controls} className={placement === "continuation" ? "min-w-0" : undefined}>
      {body}
    </OfferFrame>
  );
}
