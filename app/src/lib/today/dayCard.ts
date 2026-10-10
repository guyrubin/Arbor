/** B-TODAY-28/34: the current Now shell has one lead. No I/O or model work. */
import { appointmentInWindow, ledgerSilence, type OfferLedger } from "../companionOffer";
import { appointmentStatus, isPrepareDue, nextPrepareVisit, type Appointment } from "../careTrack";

export type NowFallback = "practice" | "notice" | "program" | "recommendation";
export type NowLead = "step" | "visit" | "tonight" | "record" | NowFallback;

export function selectNowLead(input: {
  chosen: boolean;
  chosenPending?: boolean;
  manualTonight?: boolean;
  visit: Appointment | null;
  /** Existing loop decision, including its practice-shown safety and explicit Tonight door. */
  tonight: boolean;
  record: boolean;
  /** Never replace an answer in flight or its retry with a newly arrived offer. */
  recordPending: boolean;
  fallback: NowFallback;
}): NowLead {
  // A parent-opened Tonight door is explicit navigation, not an automatic offer.
  if (input.manualTonight && !input.chosenPending && !input.recordPending) return "tonight";
  if (input.chosen) return "step";
  if (input.recordPending && input.record) return "record";
  if (input.visit) return "visit";
  if (input.tonight) return "tonight";
  if (input.record) return "record";
  return input.fallback;
}

/** Reuse the offer's local-calendar window, while excluding elapsed visit
 * hours and unconfirmed requests. Stable ordering resolves same-day ties.
 * Profession remains the appointment's own field; nothing is inferred. */
export function nextNowVisit(items: readonly Appointment[], now: Date, ledger: OfferLedger): Appointment | null {
  const at = now.getTime();
  if (!Number.isFinite(at) || ledgerSilence(ledger, "appointment", at)) return null;
  const upcoming = items.filter(a => appointmentStatus(a) === "confirmed" && a.whenIso && Date.parse(a.whenIso) > at)
    .sort((a, b) => Date.parse(a.whenIso!) - Date.parse(b.whenIso!) || a.id.localeCompare(b.id));
  const selected = appointmentInWindow(upcoming, at);
  return selected ? upcoming.find(a => a.id === selected.id) ?? null : null;
}

/** An explicit target is resolved only inside the active child's collection.
 * If deleted, elapsed or foreign, do not silently substitute another visit.
 * Existing untargeted callers retain their nearest-visit behavior. */
export function visitForConsult(items: Appointment[], now: number, appointmentId: string | null): Appointment | null {
  if (!appointmentId) return nextPrepareVisit(items, now);
  return items.find(a => a.id === appointmentId && appointmentStatus(a) === "confirmed" && isPrepareDue(a, now)) ?? null;
}
