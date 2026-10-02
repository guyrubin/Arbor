import React from "react";
import { useLanguage } from "../../context/LanguageContext";
import type { ContinuationChoice } from "./continuation";

/**
 * B-TODAY-18 — the continuation slot, ABOVE the step card.
 *
 * It holds exactly one of the carry-over outcome ask or tomorrow's reason
 * (or renders nothing), as decided by the single-offer coordinator and mapped
 * by `chooseContinuation`. The resume eyebrow ("Continuing where we left
 * off") that used to float over the anchor is this slot's eyebrow now, so it
 * appears only when there is something to continue.
 *
 * The body is the coordinator's own renderer (CompanionOfferSlot in its
 * continuation placement), passed as children — CarryOverActionAsk and
 * TomorrowReasonCard are unchanged and mounted nowhere else on Today.
 * No gradient here: the step card below owns Today's one primary CTA.
 */
export default function TodayContinuation({
  choice,
  isReturning,
  children,
}: {
  choice: ContinuationChoice;
  isReturning: boolean;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  if (choice === "none") return null;
  return (
    <div data-testid="today-continuation" data-continuation={choice} className="mb-3 min-w-0">
      {/* B-TODAY-26: the day-close line closes the day; it continues nothing. */}
      {isReturning && choice !== "dayClose" && (
        <p className="mb-1 px-1 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--arbor-clay)" }}>
          {t("elev.sincevisit.resume")}
        </p>
      )}
      {children}
    </div>
  );
}
