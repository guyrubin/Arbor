/**
 * B-ASKJB-33 — "Last time, this helped with {name}": the hard-moment card
 * remembers the sentence that helped.
 *
 * A hard-moment step is booked through the ONE accept seam with the card's
 * doNow as its text (acceptHardMomentStep, source "hard-moment"), so a ledger
 * row belongs to the card whose doNow it carries (either locale). Only the
 * FIRST answer of the two-tap ask feeds this: the adult held the plan calmly
 * (`held: "yes"`). The child's response is stored for the visit packet and is
 * never read here. Pure; zero model calls.
 */
import type { ActionLoopEntry } from "../../actionLoop/model";
import { hardMomentCatalogue, type HardMomentCard } from "../../content/hardMomentCards";
import type { BehaviorLog } from "../../types";

/** True when a ledger row is this card's booked step. */
export function rowIsCard(row: Pick<ActionLoopEntry, "source" | "recommendation">, card: Pick<HardMomentCard, "doNow">): boolean {
  if (row.source !== "hard-moment") return false;
  const rec = row.recommendation.trim();
  return rec === card.doNow.en.trim() || rec === card.doNow.he.trim();
}

/** The newest "held the plan" answer for this card, or null. */
export function lastHeldFor(
  card: Pick<HardMomentCard, "doNow">,
  loop: readonly ActionLoopEntry[],
): { at: string } | null {
  const rows = loop
    .filter((r) => rowIsCard(r, card) && r.held === "yes" && r.outcomeAt)
    .sort((a, b) => (b.outcomeAt ?? "").localeCompare(a.outcomeAt ?? ""));
  return rows[0] ? { at: rows[0].outcomeAt! } : null;
}

/** "Held the plan" sentences of a period, one per card, newest first (B-TODAY-29). */
export function heldRowsSince(loop: readonly ActionLoopEntry[], sinceMs: number, nowMs: number = Date.now()): ActionLoopEntry[] {
  return loop
    .filter((r) => r.source === "hard-moment" && r.held === "yes" && r.outcomeAt)
    .filter((r) => { const t = Date.parse(r.outcomeAt!); return Number.isFinite(t) && t >= sinceMs && t <= nowMs; })
    .sort((a, b) => (b.outcomeAt ?? "").localeCompare(a.outcomeAt ?? ""));
}

/** B-DATA-16 — the authored guide a stored `coRegulationScript` names (any
 *  age pack), or undefined for an unknown / retired id. */
export function scriptCard(id: string | undefined): HardMomentCard | undefined {
  return id ? hardMomentCatalogue.find((card) => card.id === id) : undefined;
}

/** B-DATA-16 — the newest hard moment on which the parent said they used this
 *  guide's words (`coRegulationScript`), or null. A fact about the parent's
 *  action only: it never says the words helped. */
export function lastUsedFor(
  card: Pick<HardMomentCard, "id">,
  logs: readonly Pick<BehaviorLog, "coRegulationScript" | "timestamp">[],
): { at: string } | null {
  const rows = logs
    .filter((l) => l.coRegulationScript === card.id && Number.isFinite(Date.parse(l.timestamp)))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return rows[0] ? { at: rows[0].timestamp } : null;
}

/** "What helped last time" for one guide: the parent's own "held the plan"
 *  answer leads (B-ASKJB-33, the one that may say "helped"); without one, the
 *  last hard moment the parent logged with these words names them as USED. */
export function lastTimeFor(
  card: Pick<HardMomentCard, "id" | "doNow">,
  loop: readonly ActionLoopEntry[],
  logs: readonly Pick<BehaviorLog, "coRegulationScript" | "timestamp">[],
): { at: string; basis: "held" | "used" } | null {
  const held = lastHeldFor(card, loop);
  if (held) return { ...held, basis: "held" };
  const used = lastUsedFor(card, logs);
  return used ? { ...used, basis: "used" } : null;
}
