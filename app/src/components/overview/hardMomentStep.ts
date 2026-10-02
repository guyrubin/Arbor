/* ════════════════════════════════════════════════════════════════════════════
   hardMomentStep — B-TODAY-12: the matched pilot hard-moment guide as the
   CONTENT of Today's one step card (it replaces HardMomentTodayOffer, the
   second card with a second "Make this today's step").

   · hardMomentStepFor — the matched, currently-released guide for the
     parent's recent moments (todayHardMomentOffer → hardMomentPublication),
     or null. Never for a parent who already has today's step.
   · acceptHardMomentStep — the tap-time recheck the old offer did: the card
     is looked up again in availableHardMomentCards at the moment of the tap
     (retired, edited, age-misfit or expired → nothing is booked), and the
     governed doNow is booked through the EXISTING acceptTodayAction seam with
     source "hard-moment" (B-AI-05).

   Pure apart from the injected `accept` callback. Zero model calls.
   ════════════════════════════════════════════════════════════════════════════ */
import type { BehaviorLog } from "../../types";
import type { ActionCapacity, ActionLoopEntry } from "../../actionLoop/model";
import type { HardMomentCard } from "../../content/hardMomentCards";
import { locText, todayHardMomentOffer } from "../../content/hardMomentSurface";
import { availableHardMomentCards } from "../../content/selectCards";
import { hardMomentPublication, type HardMomentContext } from "../../content/pilotRelease";

export interface HardMomentStep {
  card: HardMomentCard;
  /** Admitted under the editorial pilot (status label shown). */
  pilot: boolean;
}

export function hardMomentStepFor(
  logs: Pick<BehaviorLog, "behaviorType" | "timestamp">[],
  ctx: HardMomentContext,
  hasActiveAction: boolean,
): HardMomentStep | null {
  if (hasActiveAction) return null;
  const offer = todayHardMomentOffer(logs, undefined, ctx.now, ctx.ageMonths, ctx.locale);
  if (!offer) return null;
  const publication = hardMomentPublication(offer.card, ctx);
  if (!publication) return null;
  return { card: offer.card, pilot: publication === "editorial-pilot" };
}

export function acceptHardMomentStep(
  cardId: string,
  ctx: HardMomentContext,
  capacity: ActionCapacity,
  accept: (recommendation: string, capacity: ActionCapacity, source: ActionLoopEntry["source"]) => void,
): boolean {
  const current = availableHardMomentCards(ctx).find((card) => card.id === cardId);
  if (!current) return false;
  accept(locText(current.doNow, ctx.locale), capacity, "hard-moment");
  return true;
}
