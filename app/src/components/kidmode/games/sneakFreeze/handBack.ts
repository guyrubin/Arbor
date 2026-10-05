/**
 * B-GAME-10 — what the parent sees at hand-back (minimal), the pure half.
 *
 * When the grown-up leaves Kid Mode after at least one FINISHED Sneak & Freeze
 * sitting today, the exit recap offers ONE card (SneakHandBackCard.tsx):
 * the latest statue picture, one count line, one "play it for real" line,
 * Keep and (sandbox only) Share.
 *
 * FIREWALL (binding): the only number is how many times the child reached the
 * cat — the sitting record's `rounds` (= tags). Nothing else on the records is
 * read: no catches, no misses, no duration, no level, no band, no trend.
 *
 * The pending card lives in memory only (no write, no network): KidExitRecap
 * offers it on exit, the provider shows it once Kid Mode is closed.
 */
import { useSyncExternalStore } from "react";
import { dayKey } from "../../../../practice/signals";
import { SNEAK_GAME_ID } from "./record";

/** Times the child reached the cat in today's finished sittings (0 = no card).
 *  Reads `game`, `day` and `rounds` — nothing else. */
export function reachedTheCatToday(events: readonly { game?: string; day?: string; rounds?: number }[], now: Date): number {
  const today = dayKey(now);
  let n = 0;
  for (const e of events) {
    if (e?.game !== SNEAK_GAME_ID || e.day !== today) continue;
    if (typeof e.rounds === "number" && Number.isFinite(e.rounds) && e.rounds > 0) n += Math.floor(e.rounds);
  }
  return n;
}

export interface SneakHandBack {
  childId: string;
  /** First name ("" when unknown). */
  name: string;
  gender?: string;
  /** Times the child reached the cat today. */
  reached: number;
  /** The line Keep writes as a parent moment (the exit recap's own line when
   *  there is one). */
  keepLine: string | null;
}

let pending: SneakHandBack | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export function offerSneakHandBack(card: SneakHandBack): void {
  pending = card;
  emit();
}

export function dismissSneakHandBack(): void {
  pending = null;
  emit();
}

export function useSneakHandBack(): SneakHandBack | null {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    () => pending,
    () => null,
  );
}

/** Parent copy keys for the card (HE by boy / girl / unspecified). */
export function reachedKey(name: string, gender: string | undefined, reached: number): string {
  const n = reached === 1 ? "one" : "other";
  if (!name.trim()) return `handBack.sneakFreeze.reached.noName.${n}`;
  const form = gender === "boy" || gender === "girl" ? `.${gender}` : "";
  return `handBack.sneakFreeze.reached.${n}${form}`;
}

export function playRealKey(name: string, gender: string | undefined): string {
  if (!name.trim()) return "handBack.sneakFreeze.playReal.noName";
  return gender === "boy" || gender === "girl" ? `handBack.sneakFreeze.playReal.${gender}` : "handBack.sneakFreeze.playReal";
}
