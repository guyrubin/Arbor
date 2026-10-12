/** A parent-chosen question, with references to the existing record. */
export interface FamilyTopic {
  id: string;
  childId: string;
  title: string;
  intent: "understand" | "support" | "enjoy";
  status: "active" | "archived";
  observationIds: string[];
  createdAt: string;
  updatedAt: string;
  /** v3 Now: an active question the parent set aside — kept, but out of the quick row. */
  asideAt?: string;
}

/** v3 IA-05r: the glyph a saved question wears, by its intent. One map for the
 *  question row on Now, the question sheet and search. */
export const INTENT_ICON: Readonly<Record<FamilyTopic["intent"], string>> = { understand: "lightbulb", support: "volunteer_activism", enjoy: "favorite" };

/** v3 IA-05r: the one way a parent chooses a saved question, from the question
 *  sheet or from search. A set-aside question comes back to the quick row
 *  first, and becomes the active one only once that write has resolved; a
 *  failed write rejects and nothing is selected. Any other question is chosen
 *  at once (before the first await). Choosing a question ends the current Talk
 *  thread, as ArborContext.selectFamilyTopic does for every explicit choice. */
export async function chooseFamilyTopic(
  topic: Pick<FamilyTopic, "id" | "asideAt">,
  store: {
    updateFamilyTopic: (id: string, patch: { aside: boolean }) => Promise<unknown>;
    selectFamilyTopic: (id: string) => void;
  },
): Promise<void> {
  if (topic.asideAt) await store.updateFamilyTopic(topic.id, { aside: false });
  store.selectFamilyTopic(topic.id);
}

export function makeFamilyTopic(input: {
  id: string; childId: string; title: string; intent?: FamilyTopic["intent"];
  observationIds?: string[]; now?: string;
}): FamilyTopic {
  const title = input.title.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
  if (!title || !input.childId || !input.id) throw new Error("A question and a child are required");
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id, childId: input.childId, title,
    intent: input.intent ?? "understand", status: "active",
    observationIds: [...new Set(input.observationIds ?? [])].filter(id => typeof id === "string" && id.length <= 200).slice(0, 12),
    createdAt: now, updatedAt: now,
  };
}

export function activeTopicsFor(items: readonly FamilyTopic[], childId: string): FamilyTopic[] {
  return items.filter(topic => topic.childId === childId && topic.status === "active")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Finished questions, newest first: the sheet's "finished" list, never Now's row. */
export function archivedTopicsFor(items: readonly FamilyTopic[], childId: string): FamilyTopic[] {
  return items.filter(topic => topic.childId === childId && topic.status === "archived")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
