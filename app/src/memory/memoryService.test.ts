import { describe, expect, it } from "vitest";
import { appendMemoryProposals, foldMemoryEvents, getApprovedMemoryContext, transitionMemory } from "./memoryService.js";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

const createStore = (seed: MemoryLedgerEvent[] = []): MemoryStore & { events: MemoryLedgerEvent[] } => ({
  events: [...seed],
  async listEvents(childId?: string) {
    return childId ? this.events.filter((event) => event.childId === childId) : this.events;
  },
  async appendEvent(event) {
    this.events.push(event);
  }
});

describe("memory ledger service", () => {
  it("folds append-only events to the latest non-deleted review item", () => {
    const events: MemoryLedgerEvent[] = [
      { eventId: "e1", memoryId: "m1", childId: "c1", eventType: "proposed", status: "pending", fact: "Needs visual transition", source: "chat", retention: "30d", createdAt: "2026-01-01T00:00:00.000Z", actor: "system" },
      { eventId: "e2", memoryId: "m1", childId: "c1", eventType: "approved", status: "approved", fact: "Needs visual transition", source: "chat", retention: "30d", createdAt: "2026-01-02T00:00:00.000Z", actor: "parent" },
      { eventId: "e3", memoryId: "m2", childId: "c1", eventType: "deleted", status: "deleted", fact: "Remove me", source: "chat", retention: "30d", createdAt: "2026-01-03T00:00:00.000Z", actor: "parent" }
    ];

    expect(foldMemoryEvents(events, "c1")).toHaveLength(1);
    expect(foldMemoryEvents(events, "c1")[0]).toMatchObject({ memoryId: "m1", status: "approved" });
  });

  it("transitions memory and injects approved memory only", async () => {
    const store = createStore();
    await appendMemoryProposals(store, "c1", [{ fact: "Uses a picture card before shoes", source: "parent chat", retention: "review in 30 days" }], {
      prompt: "morning transition",
      frameRouting: { aim: "agency", twoAxes: "warmth and structure", story: "morning ritual", shadow: "frustration", marriage: "align", shepherd: "parent" }
    });

    const pending = foldMemoryEvents(store.events, "c1")[0];
    await transitionMemory(store, pending.memoryId, "approved");

    expect(await getApprovedMemoryContext(store, "c1")).toContain("Uses a picture card before shoes");
  });
});
