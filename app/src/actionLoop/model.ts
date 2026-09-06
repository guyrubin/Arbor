import { dayKey } from "../practice/signals";

export type ActionCapacity = "tiny" | "standard" | "roomy";
export type ActionOutcome = "helped" | "somewhat" | "not_today";

/** Provenance of an accepted action. AIX-S6: `digest` marks a step accepted
 *  from the weekly digest's AI-generated tryThisWeek text — only `generated:
 *  "ai"` digests may reach the accept seam (TODAY-1: actionLoops carry only
 *  model-generated focus text, never fallback copy). */
export type ActionSource = "today-guidance" | "digest" | "learn-read";

export interface ActionLoopEntry {
  id: string;
  recommendation: string;
  source: ActionSource;
  capacity: ActionCapacity;
  status: "accepted" | "completed";
  acceptedAt: string;
  outcome?: ActionOutcome;
  outcomeAt?: string;
}

export const capacityMinutes: Record<ActionCapacity, number> = { tiny: 2, standard: 5, roomy: 10 };

/** The one accepted-step id for a child's LOCAL calendar day. OBJ-TODAY-03: the
 *  id used to derive from `toISOString()` (UTC) while Today's greeting and
 *  `dayPartFor` read the local hour — so between local and UTC midnight an
 *  accepted step belonged to "yesterday" and the carry-over strip never
 *  rendered. Same local key helper as the practice lane (practice/signals.ts). */
export function todayActionId(childId: string, at = new Date()): string {
  return `today.${childId}.${dayKey(at)}`;
}

export function sortActionLoop(items: ActionLoopEntry[]): ActionLoopEntry[] {
  return [...items].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

export function latestAction(items: ActionLoopEntry[]): ActionLoopEntry | null {
  return sortActionLoop(items)[0] ?? null;
}
