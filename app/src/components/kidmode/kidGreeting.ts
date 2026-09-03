/**
 * kidGreeting — the state-derived Kid Mode sub-greeting (RUN-21, lane K).
 *
 * "You're doing amazing today" was praise-for-nothing on an empty day-0. The
 * greeting now reads REAL state: the game the child played yesterday (by
 * dashboard tile id, so the copy names the same world the tile does), or the
 * neutral invitation when there is nothing to point at. Pure and clock-free —
 * pass `today` (YYYY-MM-DD) in.
 *
 * Counts-never-verdicts: this derives a WORLD, never a score, streak or
 * "missed" state. A day with no play is simply the invitation.
 */
import type { PracticeEventKind } from "../../types";

/** The minimal ledger shape the greeting reads (a structural subset of
 *  usePracticeData, so the helper stays node-testable). */
export interface GreetingLedgers {
  speech: { timestamp: string }[];
  mimic: { timestamp: string }[];
  adventures: { timestamp: string }[];
  events: { timestamp: string; kind: PracticeEventKind }[];
}

/** KidDashboard GAMES tile ids (kid.game.<id>.title) reachable from the ledgers. */
export type GreetingWorldId =
  | "sound-lab"
  | "mood-mountain"
  | "mind-vault"
  | "beat-keeper"
  | "hero-pose"
  | "pattern-power"
  | "story-quest"
  | "mimic-studio";

const EVENT_WORLD: Partial<Record<PracticeEventKind, GreetingWorldId>> = {
  "emotion-id": "mood-mountain",
  "emotion-why": "mood-mountain",
  calm: "mood-mountain",
  memory: "mind-vault",
  rhythm: "beat-keeper",
  pose: "hero-pose",
  pattern: "pattern-power",
};

/** YYYY-MM-DD of the calendar day before `today` (local-date arithmetic on the string). */
export function dayBefore(today: string): string {
  const d = new Date(`${today}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The dashboard tile id of the world played most recently YESTERDAY, or null
 * when nothing was played yesterday (or nothing maps to a tile).
 */
export function lastPlayedWorldYesterday(ledgers: GreetingLedgers, today: string): GreetingWorldId | null {
  const yesterday = dayBefore(today);
  const onDay = (ts: string) => ts.slice(0, 10) === yesterday;
  const candidates: { ts: string; world: GreetingWorldId }[] = [];
  for (const s of ledgers.speech) if (onDay(s.timestamp)) candidates.push({ ts: s.timestamp, world: "sound-lab" });
  for (const m of ledgers.mimic) if (onDay(m.timestamp)) candidates.push({ ts: m.timestamp, world: "mimic-studio" });
  for (const a of ledgers.adventures) if (onDay(a.timestamp)) candidates.push({ ts: a.timestamp, world: "story-quest" });
  for (const e of ledgers.events) {
    const world = EVENT_WORLD[e.kind];
    if (world && onDay(e.timestamp)) candidates.push({ ts: e.timestamp, world });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return candidates[0].world;
}
