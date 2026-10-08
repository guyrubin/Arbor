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
