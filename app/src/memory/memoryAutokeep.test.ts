/**
 * B-SHELL-26 — end the review queue: a fact that restates what the parent
 * wrote is kept on creation; a model inference stays pending (asked inline,
 * B-AI-07). The one-off script lists the pending queue by class and writes
 * nothing without --apply.
 */
import { describe, expect, it } from "vitest";
import type { MemoryLedgerEvent, MemoryStore } from "./types";
import { appendMemoryProposals, memoryProvenanceClass } from "./memoryService";
import * as autokeep from "../../scripts/memory-autokeep.mjs";

class MemStore implements MemoryStore {
  events: MemoryLedgerEvent[] = [];
  async listEvents(childId?: string) { return this.events.filter((e) => !childId || e.childId === childId); }
  async appendEvent(event: MemoryLedgerEvent) { this.events.push(event); }
  async eraseChild(childId: string) { const n = this.events.length; this.events = this.events.filter((e) => e.childId !== childId); return n - this.events.length; }
}

const FR = { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" };
const PARENT_EN = "Dylan just started a bilingual kindergarten and he answers only in English at home now";
const PARENT_HE = "דילן התחיל גן דו לשוני והוא עונה רק באנגלית בבית";
const P = (fact: string) => ({ fact, source: "chat", retention: "3 months" });

describe("B-SHELL-26 — provenance → state", () => {
  it("EN: a fact in the parent's own words is parent-written; an inference is not", () => {
    expect(memoryProvenanceClass("Dylan started a bilingual kindergarten", PARENT_EN, "Dylan")).toBe("parent_written");
    expect(memoryProvenanceClass("Dylan may be anxious about the language switch", PARENT_EN, "Dylan")).toBe("inference");
  });

  it("HE: the same rule in Hebrew", () => {
    expect(memoryProvenanceClass("דילן התחיל גן דו לשוני", PARENT_HE, "דילן")).toBe("parent_written");
    expect(memoryProvenanceClass("דילן חווה קושי רגשי במעבר", PARENT_HE, "דילן")).toBe("inference");
  });

  it("a system-made prompt (rhythm:pattern) or no prompt is never 'parent-written'", () => {
    expect(memoryProvenanceClass("Mornings are harder", "rhythm:pattern", null)).toBe("inference");
    expect(memoryProvenanceClass("Mornings are harder", "", null)).toBe("inference");
    expect(memoryProvenanceClass("Mornings are harder", undefined, null)).toBe("inference");
  });

  it("a parent-written proposal is CREATED approved (one event); an inference is created pending", async () => {
    const store = new MemStore();
    const items = await appendMemoryProposals(store, "c1", [P("Dylan started a bilingual kindergarten"), P("Dylan may be anxious about the language switch")], {
      familyId: "fam-1", prompt: PARENT_EN, frameRouting: FR, childName: "Dylan",
    });
    expect(store.events).toHaveLength(2);
    const byFact = new Map(items.map((i) => [i.fact, i.status]));
    expect(byFact.get("Dylan started a bilingual kindergarten")).toBe("approved");
    expect(byFact.get("Dylan may be anxious about the language switch")).toBe("pending");
    expect(store.events.every((e) => e.eventType === "proposed" && e.actor === "system")).toBe(true);
  });
});

describe("B-SHELL-26 — memory-autokeep script (dry run default)", () => {
  const ev = (memoryId: string, fact: string, prompt: string, status: "pending" | "approved" = "pending"): MemoryLedgerEvent => ({
    eventId: `e-${memoryId}`, memoryId, familyId: "fam-1", childId: "c1", eventType: "proposed", status, fact,
    source: "chat", retention: "3 months", createdAt: "2026-08-24T10:00:00.000Z", actor: "system", prompt, frameRouting: null,
  } as MemoryLedgerEvent);
  const events = [
    ev("m1", "Dylan started a bilingual kindergarten", PARENT_EN),
    ev("m2", "Dylan may be anxious about the language switch", PARENT_EN),
    ev("m3", "Mornings are harder", "rhythm:pattern"),
    ev("m4", "Dylan answers only in English at home", PARENT_EN, "approved"),
  ];

  it("lists pending by class per family/child and plans one approved event per parent-written fact", async () => {
    const plan = await autokeep.planAutokeep(events, { childNames: { c1: "Dylan" } });
    expect({ pending: plan.pending, parentWritten: plan.parentWritten, inference: plan.inference }).toEqual({ pending: 3, parentWritten: 1, inference: 2 });
    const out = autokeep.approvalEvents(plan, "2026-10-06T00:00:00.000Z");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ memoryId: "m1", eventType: "approved", status: "approved", actor: "system", reason: "parent-written" });
    expect(autokeep.renderPlan(plan, { apply: false })).toContain("DRY RUN — writes nothing");
  });

  it("--apply is opt-in; the default writes nothing", () => {
    expect(autokeep.parseArgs([]).apply).toBe(false);
    expect(autokeep.parseArgs(["--apply"]).apply).toBe(true);
  });
});
