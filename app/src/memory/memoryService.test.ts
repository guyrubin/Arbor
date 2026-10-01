import { describe, expect, it } from "vitest";
import { appendMemoryProposals, enforceMemoryRetention, foldMemoryEvents, getApprovedMemoryContext, memoryDomainsFrom, transitionMemory } from "./memoryService.js";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

const createStore = (seed: MemoryLedgerEvent[] = []): MemoryStore & { events: MemoryLedgerEvent[] } => ({
  events: [...seed],
  async listEvents(childId?: string) {
    return childId ? this.events.filter((event) => event.childId === childId) : this.events;
  },
  async appendEvent(event) {
    this.events.push(event);
  },
  async eraseChild(childId: string) {
    const before = this.events.length;
    this.events = this.events.filter((event) => event.childId !== childId);
    return before - this.events.length;
  }
});

describe("memory ledger service", () => {
  it("folds append-only events to the latest non-deleted review item", () => {
    const events: MemoryLedgerEvent[] = [
      { eventId: "e1", memoryId: "m1", familyId: "f1", childId: "c1", eventType: "proposed", status: "pending", fact: "Needs visual transition", source: "chat", retention: "30d", createdAt: "2026-01-01T00:00:00.000Z", actor: "system" },
      { eventId: "e2", memoryId: "m1", familyId: "f1", childId: "c1", eventType: "approved", status: "approved", fact: "Needs visual transition", source: "chat", retention: "30d", createdAt: "2026-01-02T00:00:00.000Z", actor: "parent" },
      { eventId: "e3", memoryId: "m2", familyId: "f1", childId: "c1", eventType: "deleted", status: "deleted", fact: "Remove me", source: "chat", retention: "30d", createdAt: "2026-01-03T00:00:00.000Z", actor: "parent" }
    ];

    expect(foldMemoryEvents(events, "c1")).toHaveLength(1);
    expect(foldMemoryEvents(events, "c1")[0]).toMatchObject({ memoryId: "m1", status: "approved" });
  });

  it("transitions memory and injects approved memory only", async () => {
    const store = createStore();
    await appendMemoryProposals(store, "c1", [{ fact: "Uses a picture card before shoes", source: "parent chat", retention: "review in 30 days" }], {
      familyId: "f1",
      prompt: "morning transition",
      frameRouting: { aim: "agency", twoAxes: "warmth and structure", story: "morning ritual", shadow: "frustration", marriage: "align", shepherd: "parent" }
    });

    const pending = foldMemoryEvents(store.events, "c1")[0];
    await transitionMemory(store, pending.memoryId, "approved");

    expect(await getApprovedMemoryContext(store, "c1")).toContain("Uses a picture card before shoes");
  });

  /* B-GROWTH-29 — domain tags on approved memory facts (spine §3, §4.3). */
  it("a proposal from an answer tagged language_communication stores domains [talking]; approve, edit, export keep it; erase removes it", async () => {
    const store = createStore();
    await appendMemoryProposals(store, "c1", [{ fact: "Says 'more' to ask for juice", source: "parent chat", retention: "3 months" }], {
      familyId: "f1", prompt: "words", frameRouting: null as never, answerDomains: ["language_communication"],
    });
    expect(store.events[0].domains).toEqual(["talking"]);
    const pending = foldMemoryEvents(store.events, "c1")[0];
    expect(pending.domains).toEqual(["talking"]);

    await transitionMemory(store, pending.memoryId, "approved");
    await transitionMemory(store, pending.memoryId, "approved", { fact: "Says 'more' for juice" });
    const approved = foldMemoryEvents(store.events, "c1")[0];
    expect(approved).toMatchObject({ status: "approved", fact: "Says 'more' for juice", domains: ["talking"] });
    for (const e of store.events) expect(e.domains).toEqual(["talking"]);

    // the export path serialises the raw ledger events (routes/api.ts GDPR export)
    const exported = JSON.parse(JSON.stringify(await store.listEvents("c1")));
    expect(exported.every((e: MemoryLedgerEvent) => Array.isArray(e.domains) && e.domains[0] === "talking")).toBe(true);

    // a retention tombstone carries it too
    const expiredAt = Date.parse(approved.createdAt) + 400 * 86_400_000;
    await enforceMemoryRetention(store, foldMemoryEvents(store.events, "c1"), expiredAt);
    expect(store.events[store.events.length - 1]).toMatchObject({ eventType: "expired", domains: ["talking"] });

    expect(await store.eraseChild("c1")).toBeGreaterThan(0);
    expect(JSON.stringify(await store.listEvents("c1"))).not.toContain("talking");
  });

  it("no answer domains → no domains key (older and untagged facts stay byte-identical); unknown ids drop out", async () => {
    const store = createStore();
    await appendMemoryProposals(store, "c2", [{ fact: "Likes trains", source: "chat", retention: "3 months" }], {
      familyId: "f1", prompt: "p", frameRouting: null as never,
    });
    expect("domains" in store.events[0]).toBe(false);
    expect("domains" in foldMemoryEvents(store.events, "c2")[0]).toBe(false);
    expect(memoryDomainsFrom(["sensory_motor_patterns", "made_up", "attachment_regulation"])).toEqual(["moving", "hands", "feelings"]);
    expect(memoryDomainsFrom(["made_up"])).toBeUndefined();
    expect(memoryDomainsFrom(undefined)).toBeUndefined();
  });
});
