import { randomUUID } from "crypto";
import type { CoachResponse } from "../contracts/coach.js";
import type { MemoryLedgerEvent, MemoryReviewItem, MemoryStatus, MemoryStore } from "./types.js";

export const toChildId = (childProfile: any) => {
  if (childProfile?.id) return String(childProfile.id);
  if (childProfile?.name) return String(childProfile.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return "default-child";
};

export const toFamilyId = (childProfile: any) => {
  if (childProfile?.familyId) return String(childProfile.familyId);
  return "default-family";
};

export const foldMemoryEvents = (events: MemoryLedgerEvent[], childId?: string): MemoryReviewItem[] => {
  const latest = new Map<string, MemoryReviewItem>();

  for (const event of events) {
    if (childId && event.childId !== childId) continue;
    latest.set(event.memoryId, {
      memoryId: event.memoryId,
      familyId: event.familyId,
      childId: event.childId,
      status: event.status,
      fact: event.fact,
      source: event.source,
      retention: event.retention,
      createdAt: event.createdAt,
      prompt: event.prompt,
      frameRouting: event.frameRouting,
      latestEventId: event.eventId
    });
  }

  return [...latest.values()]
    .filter((item) => item.status !== "deleted" && item.status !== "expired")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

// SAFE-3 / G10: enforce memory time-boxing. The model-generated `retention`
// string is parsed to a TTL; approved memory past its retention is treated as
// expired and is NOT fed back to the AI. Unparseable/permanent retention never
// expires (conservative — we don't silently drop memory we can't interpret).
const DAY_MS = 86_400_000;
export const retentionToMs = (retention?: string): number => {
  if (!retention) return Infinity;
  const r = retention.toLowerCase();
  if (/permanent|indefinite|ongoing|long[-\s]?term/.test(r)) return Infinity;
  const m = r.match(/(\d+)\s*(day|week|month|year)/);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const per = unit === "day" ? DAY_MS : unit === "week" ? 7 * DAY_MS : unit === "month" ? 30 * DAY_MS : 365 * DAY_MS;
    return n * per;
  }
  if (/session|today|24\s*h/.test(r)) return DAY_MS;
  return Infinity;
};

export const isMemoryExpired = (item: { retention?: string; createdAt: string }, now: number = Date.now()): boolean => {
  const ms = retentionToMs(item.retention);
  if (!isFinite(ms)) return false;
  return now - new Date(item.createdAt).getTime() > ms;
};

export const getApprovedMemoryContext = async (store: MemoryStore, childId: string, maxFacts = 40) => {
  const events = await store.listEvents(childId);
  // foldMemoryEvents returns newest-first, so the slice keeps the most recent facts —
  // bounding prompt token growth as a child's memory ledger accumulates over time.
  const approved = foldMemoryEvents(events, childId).filter(
    (item) => item.status === "approved" && !isMemoryExpired(item)
  );
  const windowed = approved.slice(0, Math.max(1, maxFacts));
  const lines = windowed.map((item) => `- ${item.fact} (${item.source}; retention: ${item.retention})`);
  if (approved.length > windowed.length) {
    lines.push(`- (+${approved.length - windowed.length} older facts retained but omitted from this prompt for brevity)`);
  }
  return lines.join("\n");
};

export const appendMemoryProposals = async (
  store: MemoryStore,
  childId: string,
  proposals: CoachResponse["memoryProposals"],
  context: { familyId: string; prompt: string; frameRouting: CoachResponse["frameRouting"] }
) => {
  if (proposals.length === 0) return foldMemoryEvents(await store.listEvents(childId), childId);

  const current = foldMemoryEvents(await store.listEvents(childId), childId);
  const now = new Date().toISOString();

  for (const proposal of proposals) {
    const duplicate = current.find(
      (item) =>
        item.fact.trim().toLowerCase() === proposal.fact.trim().toLowerCase() &&
        item.status !== "rejected"
    );
    if (duplicate) continue;

    await store.appendEvent({
      eventId: randomUUID(),
      memoryId: randomUUID(),
      familyId: context.familyId,
      childId,
      eventType: "proposed",
      status: "pending",
      fact: proposal.fact,
      source: proposal.source,
      retention: proposal.retention,
      createdAt: now,
      actor: "system",
      prompt: context.prompt,
      frameRouting: context.frameRouting
    });
  }

  return foldMemoryEvents(await store.listEvents(childId), childId);
};

export const transitionMemory = async (
  store: MemoryStore,
  memoryId: string,
  status: MemoryStatus,
  edits: Partial<Pick<MemoryLedgerEvent, "fact" | "retention" | "source">> = {}
) => {
  const events = await store.listEvents();
  const current = foldMemoryEvents(events).find((item) => item.memoryId === memoryId);
  if (!current) return null;

  const eventTypeByStatus: Record<MemoryStatus, MemoryLedgerEvent["eventType"]> = {
    pending: "edited",
    approved: "approved",
    rejected: "rejected",
    deleted: "deleted",
    expired: "expired"
  };

  await store.appendEvent({
    eventId: randomUUID(),
    memoryId,
    familyId: current.familyId,
    childId: current.childId,
    eventType: eventTypeByStatus[status],
    status,
    fact: edits.fact ?? current.fact,
    source: edits.source ?? current.source,
    retention: edits.retention ?? current.retention,
    createdAt: new Date().toISOString(),
    actor: "parent",
    prompt: current.prompt,
    frameRouting: current.frameRouting
  });

  const nextEvents = await store.listEvents(current.childId);
  return {
    item: foldMemoryEvents(nextEvents).find((item) => item.memoryId === memoryId),
    items: foldMemoryEvents(nextEvents, current.childId)
  };
};
