/**
 * B-AI-07 — near-duplicate memory merge before proposal, with a topic key.
 *  - "Dylan refuses shoes in the morning" vs "refuses shoes every morning":
 *    the second is not appended; the Hebrew pair likewise (niqqud-insensitive);
 *  - a DISMISSED (rejected) fact blocks the identical and a paraphrased
 *    proposal from the next /chat (B-CAREPRO-18 rule (a)); the ledger stays
 *    append-only (F8);
 *  - each appended proposal carries `topicKey` from the coach's keyword table,
 *    and the tag survives approve / reject;
 *  - the one-off report groups the pending queue and writes nothing without --apply.
 */
import { describe, expect, it } from "vitest";
import type { MemoryLedgerEvent, MemoryStore } from "./types";
import {
  appendMemoryProposals,
  dedupeTokens,
  foldMemoryEvents,
  groupNearDuplicates,
  isNearDuplicateFact,
  jaccard,
  memoryTopicKey,
  transitionMemory,
} from "./memoryService";
import * as report from "../../scripts/memory-dedupe-report.mjs";

class MemStore implements MemoryStore {
  events: MemoryLedgerEvent[] = [];
  async listEvents(childId?: string) {
    return this.events.filter((e) => !childId || e.childId === childId);
  }
  async appendEvent(event: MemoryLedgerEvent) {
    this.events.push(event);
  }
  async eraseChild(childId: string) {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.childId !== childId);
    return before - this.events.length;
  }
}

const CTX = { familyId: "fam-1", prompt: "q", frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" }, childName: "Dylan" };
const P = (fact: string) => ({ fact, source: "coach", retention: "3 months" });

describe("B-AI-07 · near-duplicates are not appended", () => {
  it("EN: 'Dylan refuses shoes in the morning' then 'refuses shoes every morning' → one fact", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("Dylan refuses shoes in the morning")], CTX);
    const items = await appendMemoryProposals(store, "c1", [P("refuses shoes every morning")], CTX);
    expect(items.map((i) => i.fact)).toEqual(["Dylan refuses shoes in the morning"]);
    expect(store.events).toHaveLength(1);
  });

  it("HE: the same pair in Hebrew (with and without niqqud) → one fact", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("דילן מסרב לנעול נעליים בבוקר")], { ...CTX, childName: "דילן" });
    await appendMemoryProposals(store, "c1", [P("מסרב לנעול נעליים כל בוקר")], { ...CTX, childName: "דילן" });
    await appendMemoryProposals(store, "c1", [P("מְסָרֵב לִנְעוֹל נַעֲלַיִים בַּבֹּקֶר")], { ...CTX, childName: "דילן" });
    expect(store.events).toHaveLength(1);
  });

  it("two paraphrases inside ONE answer append once", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("Loves trains and buses"), P("Dylan loves trains and buses!")], CTX);
    expect(store.events).toHaveLength(1);
  });

  it("a genuinely different fact is still proposed", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("Dylan refuses shoes in the morning")], CTX);
    await appendMemoryProposals(store, "c1", [P("Falls asleep faster with the night light on")], CTX);
    expect(store.events).toHaveLength(2);
  });

  it("dismissed means dismissed: the identical AND a paraphrase are not re-proposed; the ledger only grew by the reject", async () => {
    const store = new MemStore();
    const [item] = await appendMemoryProposals(store, "c1", [P("Dylan refuses shoes in the morning")], CTX);
    await transitionMemory(store, item.memoryId, "rejected");
    const before = store.events.length;
    await appendMemoryProposals(store, "c1", [P("Dylan refuses shoes in the morning")], CTX);
    await appendMemoryProposals(store, "c1", [P("He refuses his shoes every morning")], CTX);
    expect(store.events.length).toBe(before);
    expect(store.events.map((e) => e.eventType)).toEqual(["proposed", "rejected"]);
  });

  it("another child's facts never block this child's", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("refuses shoes in the morning")], CTX);
    await appendMemoryProposals(store, "c2", [P("refuses shoes in the morning")], CTX);
    expect(store.events).toHaveLength(2);
  });
});

describe("B-AI-07 · normalisation", () => {
  it("strips punctuation, niqqud, the child's name and stopwords; stems lightly", () => {
    expect([...dedupeTokens("Dylan refuses shoes, in the MORNING!", "Dylan")].sort()).toEqual(["morn", "refus", "shoe"]);
    expect(dedupeTokens("mornings")).toEqual(dedupeTokens("morning"));
    expect(jaccard(dedupeTokens("שָׁלוֹם"), dedupeTokens("שלום"))).toBe(1);
    expect(isNearDuplicateFact("x y z", [{ fact: "x y z", status: "deleted" }])).toBe(false);
    expect(isNearDuplicateFact("refuses shoes", [{ fact: "refuses shoes", status: "rejected" }])).toBe(true);
  });
});

describe("B-AI-07 · topicKey", () => {
  it("is set from the keyword table at proposal time and survives approve", async () => {
    expect(memoryTopicKey("Cries at bedtime when the light goes off")).toBe("attachment_regulation");
    expect(memoryTopicKey("בוכה לפני השינה")).toBe("attachment_regulation");
    expect(memoryTopicKey("Likes the colour blue")).toBeUndefined();
    const store = new MemStore();
    const [item] = await appendMemoryProposals(store, "c1", [P("Cries at bedtime when the light goes off")], CTX);
    expect(store.events[0].topicKey).toBe("attachment_regulation");
    expect(item.topicKey).toBe("attachment_regulation");
    await transitionMemory(store, item.memoryId, "approved");
    expect(store.events[1].topicKey).toBe("attachment_regulation");
    expect(foldMemoryEvents(store.events)[0].topicKey).toBe("attachment_regulation");
  });

  it("an untagged fact's events carry no topicKey key at all (byte-identical shape)", async () => {
    const store = new MemStore();
    await appendMemoryProposals(store, "c1", [P("Likes the colour blue")], CTX);
    expect(store.events[0]).not.toHaveProperty("topicKey");
  });
});

describe("B-AI-07 · the one-off queue report", () => {
  const ev = (memoryId: string, fact: string, createdAt: string, childId = "c1"): MemoryLedgerEvent => ({
    eventId: `e-${memoryId}`, memoryId, familyId: "fam-1", childId, eventType: "proposed", status: "pending",
    fact, source: "coach", retention: "3 months", createdAt, actor: "system",
  });
  const EVENTS = [
    ev("m1", "Refuses shoes in the morning", "2026-09-01T08:00:00Z"),
    ev("m2", "refuses shoes every morning", "2026-09-02T08:00:00Z"),
    ev("m3", "Refuses his shoes in the mornings", "2026-09-03T08:00:00Z"),
    ev("m4", "Falls asleep faster with the night light on", "2026-09-04T08:00:00Z"),
    ev("m5", "Falls asleep faster with a night light", "2026-09-05T08:00:00Z"),
    ev("m6", "Loves trains", "2026-09-06T08:00:00Z", "c2"),
  ];

  it("groups pending facts per child and keeps the oldest of each group", async () => {
    expect(groupNearDuplicates(foldMemoryEvents(EVENTS, "c1")).map((g) => [g.head.memoryId, g.duplicates.map((d) => d.memoryId)])).toEqual([
      ["m1", ["m2", "m3"]],
      ["m4", ["m5"]],
    ]);
    const plan = await report.planDedupe(EVENTS);
    expect(plan).toMatchObject({ pending: 6, groups: 3, duplicates: 3 });
    expect(report.renderPlan(plan, { apply: false })).toMatch(/DRY RUN — writes nothing/);
  });

  it("--apply appends one rejected(duplicate) event per duplicate and edits nothing", async () => {
    const plan = await report.planDedupe(EVENTS);
    const out = report.rejectionEvents(plan, "2026-10-04T00:00:00Z") as unknown as MemoryLedgerEvent[];
    expect(out.map((e) => [e.memoryId, e.eventType, e.reason])).toEqual([
      ["m2", "rejected", "duplicate"],
      ["m3", "rejected", "duplicate"],
      ["m5", "rejected", "duplicate"],
    ]);
    // After apply, a re-run finds nothing to do.
    const again = await report.planDedupe([...EVENTS, ...out]);
    expect(again.duplicates).toBe(0);
    expect(report.parseArgs([]).apply).toBe(false);
  });
});
