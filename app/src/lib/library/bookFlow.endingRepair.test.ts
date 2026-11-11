/**
 * B-BOOK-02 / B-BOOK-33 / KSV2-E3: a true story ending cannot skip a
 * meaningful repair on the final page. All fixtures are authored synthetic
 * variants; no child identity, progress or private book is used here.
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones } from "./books/fiveSmoothStones";
import {
  END,
  awaitingRepair,
  bookFlowReducer,
  canTurnForward,
  repairDone,
  type BookFlowState,
} from "./bookFlow";
import type { Book } from "./types";

function lastPageWithRepair(): { book: Book; state: BookFlowState } {
  const book = structuredClone(fiveSmoothStones);
  const repair = book.decision.choices
    .find((choice) => choice.type === "easy")!
    .branch.find((page) => page.repair)!.repair!;
  const last = book.pages[book.pages.length - 1];
  // Test the generic engine's final-page case without changing any approved
  // book text or its established branching/repair requirements.
  last.repair = structuredClone(repair);
  return {
    book,
    state: { at: last.id, choiceId: book.decision.choices[0].id, selected: null, repaired: [], dir: 0 },
  };
}

describe("Kids book ending requires its final meaningful action", () => {
  it("does not show END or permit a forward turn while a last-page repair is incomplete", () => {
    const { book, state } = lastPageWithRepair();
    expect(awaitingRepair(book, state)).toBe(true);
    expect(canTurnForward(book, state)).toBe(false);
    expect(bookFlowReducer(book, state, { type: "next" })).toEqual(state);
    expect(bookFlowReducer(book, state, { type: "repair", itemId: "nonexistent" })).toEqual(state);
  });

  it("enforces the ordered repair, then opens END only after every real tap", () => {
    const { book, state: initial } = lastPageWithRepair();
    const repair = book.pages[book.pages.length - 1].repair!;
    const ids = repair.items.map((item) => item.id);
    expect(ids.length).toBeGreaterThan(1);

    let state = initial;
    // An out-of-order tap and attempted Next must not falsely complete a book.
    expect(bookFlowReducer(book, state, { type: "repair", itemId: ids[1] })).toEqual(state);
    for (let i = 0; i < ids.length; i++) {
      state = bookFlowReducer(book, state, { type: "repair", itemId: ids[i] });
      if (i < ids.length - 1) {
        expect(awaitingRepair(book, state)).toBe(true);
        expect(bookFlowReducer(book, state, { type: "next" })).toEqual(state);
      }
    }
    expect(repairDone(book.pages[book.pages.length - 1], state)).toBe(true);
    expect(canTurnForward(book, state)).toBe(true);
    const finished = bookFlowReducer(book, state, { type: "next" });
    expect(finished.at).toBe(END);
    expect(bookFlowReducer(book, finished, { type: "next" })).toEqual(finished);
  });

  it("preserves a normal canonical ending and its back navigation", () => {
    const book = fiveSmoothStones;
    const state: BookFlowState = {
      at: book.pages[book.pages.length - 1].id,
      choiceId: book.decision.choices[0].id,
      selected: null,
      repaired: [],
      dir: 0,
    };
    expect(awaitingRepair(book, state)).toBe(false);
    expect(canTurnForward(book, state)).toBe(true);
    const end = bookFlowReducer(book, state, { type: "next" });
    expect(end.at).toBe(END);
    expect(bookFlowReducer(book, end, { type: "back" }).at).toBe(state.at);
  });
});
