import { useMemo, useState } from "react";
import { useChildCollection } from "./useChildCollection";
import { activeTopicsFor, makeFamilyTopic, type FamilyTopic } from "../lib/familyTopics";

function readSelection(childId: string): string | null {
  try { return localStorage.getItem(`arbor.familyTopic.${childId}`); } catch { return null; }
}

export function useFamilyTopics(childId: string) {
  const collection = useChildCollection<FamilyTopic>(childId, "familyTopics");
  const [selection, setSelection] = useState({ childId, id: readSelection(childId) });
  const familyTopics = useMemo(() => activeTopicsFor(collection.items, childId), [collection.items, childId]);
  const selectedId = selection.childId === childId ? selection.id : readSelection(childId);
  const activeFamilyTopic = familyTopics.find(topic => topic.id === selectedId) ?? null;
  function selectFamilyTopic(id: string | null) {
    if (id && !familyTopics.some(topic => topic.id === id)) return;
    setSelection({ childId, id });
    try {
      if (id) localStorage.setItem(`arbor.familyTopic.${childId}`, id);
      else localStorage.removeItem(`arbor.familyTopic.${childId}`);
    } catch { /* Current-session selection still works without storage. */ }
  }
  async function createFamilyTopic(title: string, observationIds: string[] = [], intent: FamilyTopic["intent"] = "understand") {
    const topic = makeFamilyTopic({ id: crypto.randomUUID(), childId, title, observationIds, intent });
    await collection.upsert(topic);
    setSelection({ childId, id: topic.id });
    try { localStorage.setItem(`arbor.familyTopic.${childId}`, topic.id); } catch { /* optional device preference */ }
    return topic;
  }
  async function updateFamilyTopic(id: string, patch: { title?: string; intent?: FamilyTopic["intent"]; status?: FamilyTopic["status"] }) {
    const topic = familyTopics.find(item => item.id === id);
    if (!topic) return;
    const normalized = makeFamilyTopic({ ...topic, title: patch.title ?? topic.title, intent: patch.intent ?? topic.intent });
    await collection.upsert({ ...normalized, createdAt: topic.createdAt, status: patch.status ?? topic.status });
    if (patch.status === "archived" && activeFamilyTopic?.id === id) selectFamilyTopic(null);
  }
  return { familyTopics, activeFamilyTopic, familyTopicsLoaded: collection.loaded, selectFamilyTopic, createFamilyTopic, updateFamilyTopic };
}
