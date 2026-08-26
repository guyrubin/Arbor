import { describe, expect, it } from "vitest";
import { LEARN_CARDS } from "./learnCards";
import { LEARN_CARDS_BATCH4A } from "./learnCardsBatch4a";
import { LEARN_CARDS_BATCH4B } from "./learnCardsBatch4b";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// GD-10 guard: batch4 cards are salvaged into the tree DARK. Wiring them into
// the live registry is a separate reviewed commit that lands only after the
// clinical review passes (see LL-B4 salvage triage 2026-08-20). This test
// fails if anyone wires batch4 — or any card it contains — before that gate.
describe("LL-B4 dark-salvage guard (pre-GD-10)", () => {
  it("the live registry source does not import or spread any batch4 module", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, "learnCards.ts"), "utf8")
      .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/learnCardsBatch4/i);
    expect(src).not.toMatch(/BATCH4/);
  });

  it("no batch4 card id is reachable through LEARN_CARDS (catches indirect wiring)", () => {
    const liveIds = new Set(LEARN_CARDS.map((c) => c.id));
    for (const card of [...LEARN_CARDS_BATCH4A, ...LEARN_CARDS_BATCH4B]) {
      expect(liveIds.has(card.id), `${card.id} must stay dark until GD-10 clears`).toBe(false);
    }
  });

  it("batch4 holds the 18 salvaged cards, no more no less (drift detector)", () => {
    expect(LEARN_CARDS_BATCH4A).toHaveLength(9);
    expect(LEARN_CARDS_BATCH4B).toHaveLength(9);
  });
});
