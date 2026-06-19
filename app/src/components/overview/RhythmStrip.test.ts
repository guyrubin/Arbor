import { describe, it, expect } from "vitest";
import { shouldShowRememberRow } from "./RhythmStrip";
import { appendMemoryProposals, foldMemoryEvents } from "../../memory/memoryService";
import type { MemoryLedgerEvent, MemoryStore } from "../../memory/types";

/* c1-rhythm — the Rhythm strip's two new behaviours that are unit-testable in
   the node harness:
   1. the moat-write confirm row gating (shouldShowRememberRow), and
   2. the write-back the [Remember] button performs (appendMemoryProposals, the
      exact helper the new POST /memory/:childId/propose route calls).
   The visual/DOM assertions (chips are <button>s, RTL, 44px) are covered by the
   live dev-server check in the spec; this repo's vitest env is node-only. */

describe("shouldShowRememberRow (Rhythm moat-write gating)", () => {
  const base = {
    confidence: "high" as const,
    hasFrictionPeak: true,
    canRemember: true,
    alreadyRemembered: false,
    dismissed: false,
  };

  it("shows the confirm row at high confidence with a friction peak", () => {
    expect(shouldShowRememberRow(base)).toBe(true);
  });

  it("hides it in the learning branch (confidence none/low)", () => {
    expect(shouldShowRememberRow({ ...base, confidence: "none" })).toBe(false);
    expect(shouldShowRememberRow({ ...base, confidence: "low" })).toBe(false);
  });

  it("hides it at medium confidence (only high earns the write-back)", () => {
    expect(shouldShowRememberRow({ ...base, confidence: "medium" })).toBe(false);
  });

  it("hides it when there is no friction peak", () => {
    expect(shouldShowRememberRow({ ...base, hasFrictionPeak: false })).toBe(false);
  });

  it("hides it once already remembered (no nagging)", () => {
    expect(shouldShowRememberRow({ ...base, alreadyRemembered: true })).toBe(false);
  });

  it("hides it once dismissed for this child+hour", () => {
    expect(shouldShowRememberRow({ ...base, dismissed: true })).toBe(false);
  });

  it("hides it when no remember handler is wired", () => {
    expect(shouldShowRememberRow({ ...base, canRemember: false })).toBe(false);
  });
});

// In-memory store mirroring MemoryStore so the write-back is tested without disk.
class FakeStore implements MemoryStore {
  events: MemoryLedgerEvent[] = [];
  async listEvents(childId?: string) {
    return childId ? this.events.filter((e) => e.childId === childId) : this.events;
  }
  async appendEvent(event: MemoryLedgerEvent) {
    this.events.push(event);
  }
  async eraseChild() {
    return 0;
  }
}

describe("Rhythm write-back (propose route helper)", () => {
  const fact = "Maya often has a harder time around 5 PM.";

  it("proposes a PENDING, parent-owned memory with rhythm source + 3-month retention", async () => {
    const store = new FakeStore();
    const items = await appendMemoryProposals(
      store,
      "child-1",
      [{ fact, source: "rhythm", retention: "3 months" }],
      { familyId: "fam-1", prompt: "rhythm:pattern", frameRouting: null }
    );
    const proposed = items.find((i) => i.fact === fact);
    expect(proposed).toBeTruthy();
    expect(proposed!.status).toBe("pending");
    expect(proposed!.source).toBe("rhythm");
    expect(proposed!.retention).toBe("3 months");
  });

  it("dedupes a repeated pattern so Remember never double-writes", async () => {
    const store = new FakeStore();
    const opts = { familyId: "fam-1", prompt: "rhythm:pattern", frameRouting: null };
    await appendMemoryProposals(store, "child-1", [{ fact, source: "rhythm", retention: "3 months" }], opts);
    await appendMemoryProposals(store, "child-1", [{ fact, source: "rhythm", retention: "3 months" }], opts);
    const matches = foldMemoryEvents(await store.listEvents("child-1"), "child-1").filter((i) => i.fact === fact);
    expect(matches.length).toBe(1);
  });
});
