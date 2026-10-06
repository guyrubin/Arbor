/**
 * B-LOOP-07 — the parent's OWN words on the practice's shelf, THEN and NOW
 * (critic r3 G2: "it remembered what I wrote" must show a change, not a
 * two-day-old quote). Pure, on-device, zero model calls.
 *
 *   now  = the newest written note on the shelf (the parent's words, P1
 *          `quotableWords`, verbatim);
 *   then = the newest note on the same shelf written at least 7 days before
 *          `now` — so the card can set the two dated sentences side by side.
 *
 * FIREWALL: Arbor quotes and dates; it computes nothing, compares nothing and
 * says nothing about which sentence is "better". With one note only `now`
 * shows; with none the slot is empty.
 */
import type { BehaviorLog } from "../../types";
import type { Observation } from "../observations";
import type { ShelfId } from "../shelves/registry";
import { quotableWords } from "./fromRecord";

export interface DatedWords {
  text: string;
  at: string;
}

const DAY = 86_400_000;
export const THEN_GAP_DAYS = 7;

export function shelfWordsThenNow(
  observations: ReadonlyArray<Pick<Observation, "id" | "origin" | "shelf" | "at">>,
  logs: readonly BehaviorLog[],
  shelf: ShelfId,
): { then: DatedWords | null; now: DatedWords | null } {
  const byId = new Map(logs.map((l) => [`behaviorLogs:${l.id}`, l]));
  const notes: (DatedWords & { t: number })[] = [];
  for (const o of observations) {
    if (o.origin !== "behaviorLogs" || o.shelf !== shelf) continue;
    const log = byId.get(o.id);
    const text = log ? quotableWords(log) : null;
    const t = Date.parse(o.at);
    if (!text || !Number.isFinite(t)) continue;
    notes.push({ text, at: o.at, t });
  }
  notes.sort((a, b) => b.t - a.t);
  const newest = notes[0];
  if (!newest) return { then: null, now: null };
  const older = notes.find((n) => n.t <= newest.t - THEN_GAP_DAYS * DAY);
  return {
    now: { text: newest.text, at: newest.at },
    then: older ? { text: older.text, at: older.at } : null,
  };
}
