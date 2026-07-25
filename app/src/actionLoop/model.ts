export type ActionCapacity = "tiny" | "standard" | "roomy";
export type ActionOutcome = "helped" | "somewhat" | "not_today";

export interface ActionLoopEntry {
  id: string;
  recommendation: string;
  source: "today-guidance";
  capacity: ActionCapacity;
  status: "accepted" | "completed";
  acceptedAt: string;
  outcome?: ActionOutcome;
  outcomeAt?: string;
}

export const capacityMinutes: Record<ActionCapacity, number> = { tiny: 2, standard: 5, roomy: 10 };

export function todayActionId(childId: string, at = new Date()): string {
  return `today.${childId}.${at.toISOString().slice(0, 10)}`;
}

export function sortActionLoop(items: ActionLoopEntry[]): ActionLoopEntry[] {
  return [...items].sort((a, b) => b.acceptedAt.localeCompare(a.acceptedAt));
}

export function latestAction(items: ActionLoopEntry[]): ActionLoopEntry | null {
  return sortActionLoop(items)[0] ?? null;
}
