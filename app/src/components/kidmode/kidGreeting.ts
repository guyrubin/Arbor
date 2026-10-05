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
import { dayKey } from "../../practice/signals";
import { KID_WORLDS, kidWorldByWorldId, type KidWorld } from "./kidWorlds";

/** The minimal ledger shape the greeting reads (a structural subset of
 *  usePracticeData, so the helper stays node-testable). */
export interface GreetingLedgers {
  speech: { timestamp: string }[];
  mimic: { timestamp: string }[];
  adventures: { timestamp: string }[];
  events: { timestamp: string; kind: PracticeEventKind }[];
}

/** B-KID-68: a kid home tile id from the ONE kid world registry (the copy
 *  names the world with that entry's own name key). */
export type GreetingWorldId = KidWorld["id"];

/** Which world (registry routing id) an event kind was played in. The world's
 *  identity — tile id, name — is the registry's, never restated here. */
const EVENT_WORLD: Partial<Record<PracticeEventKind, string>> = {
  "emotion-id": "feelings",
  "emotion-why": "feelings",
  calm: "feelings",
  memory: "memory",
  rhythm: "beat",
  pose: "pose",
  pattern: "pattern",
  phonics: "reading",
  "sight-word": "reading",
  "letter-trace": "reading",
};

/** The registry tile id for a routing id (undefined = not a kid world). */
const tileOf = (worldId: string): GreetingWorldId | undefined => kidWorldByWorldId(worldId)?.id;

/** The ONE name key of a greeting world (the tile's own title key). */
export function greetingWorldNameKey(id: GreetingWorldId): string | undefined {
  return KID_WORLDS.find((w) => w.id === id)?.nameKey;
}

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
  // OBJ-KID-01: the ledger stores ISO-UTC timestamps; the day a child EXPERIENCED
  // a game is its LOCAL day. Comparing `ts.slice(0,10)` (UTC) against a local
  // dayKey made tonight's play read as "yesterday" between local and UTC midnight
  // (2 h CEST / 3 h IL summer). Derive the key locally, from the same helper the
  // rest of the practice lane uses (practice/signals.ts dayKey).
  const onDay = (ts: string) => dayKey(new Date(ts)) === yesterday;
  const candidates: { ts: string; world: GreetingWorldId }[] = [];
  const add = (ts: string, worldId: string | undefined) => {
    const world = worldId ? tileOf(worldId) : undefined;
    if (world && onDay(ts)) candidates.push({ ts, world });
  };
  for (const s of ledgers.speech) add(s.timestamp, "speech");
  for (const m of ledgers.mimic) add(m.timestamp, "mimic");
  for (const a of ledgers.adventures) add(a.timestamp, "adventures");
  for (const e of ledgers.events) add(e.timestamp, EVENT_WORLD[e.kind]);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return candidates[0].world;
}
