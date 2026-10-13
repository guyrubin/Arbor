import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { CORNER_OBJECTS, emptyCorner, EXPLORER_CLIPS, placeCornerObject, placePuzzlePiece, shuffledPieces } from "./gameRules";
import { GAME_COPY } from "./gameCopy";

describe("Calm Builder placement", () => {
  it("moves an object once and returns the replaced object to the tray", () => {
    let layout = placeCornerObject(emptyCorner(), "cushion", 0);
    layout = placeCornerObject(layout, "books", 1);
    layout = placeCornerObject(layout, "cushion", 1);
    expect(layout).toEqual([null, "cushion", null, null, null, null]);
    expect(layout.includes("books")).toBe(false);
    expect(placeCornerObject(layout, "plant", 4).filter(Boolean)).toEqual(["cushion", "plant"]);
  });
  it("preserves undo history and rejects malformed drag placements", () => {
    const before = emptyCorner();
    expect(placeCornerObject(before, "lamp", 2)).not.toBe(before);
    expect(before).toEqual(emptyCorner());
    for (const target of [-1, 6, 2.3]) expect(placeCornerObject(before, "lamp", target)).toBe(before);
    expect(placeCornerObject(before, "not-a-piece" as never, 0)).toBe(before);
  });
});

describe("Puzzle Planet assembly", () => {
  it.each([2, 3] as const)("keeps every fragment in the shuffled %i-wide puzzle", size => {
    const order = Array.from({ length: size * size }, (_, index) => index);
    for (const random of [() => 0, () => 0.99999, () => 0.5]) {
      const tray = shuffledPieces(size, random);
      expect([...tray].sort((a, b) => a - b)).toEqual(order);
      expect(tray).not.toEqual(order);
    }
  });
  it("rejects wrong targets and repeated pieces; complete means every piece fits", () => {
    let placed: readonly number[] = [];
    expect(placePuzzlePiece(placed, null, 0, 2)).toBe(placed);
    expect(placePuzzlePiece(placed, 3, 0, 2)).toBe(placed);
    expect(placePuzzlePiece(placed, 8, 8, 2)).toBe(placed);
    expect(placePuzzlePiece(placed, 0.5, 0.5, 2)).toBe(placed);
    placed = placePuzzlePiece(placed, 3, 3, 2);
    expect(placePuzzlePiece(placed, 3, 3, 2)).toBe(placed);
    for (const piece of [2, 0, 1]) placed = placePuzzlePiece(placed, piece, piece, 2);
    expect(placed).toHaveLength(4);
  });
});

describe("existing audio and bilingual content", () => {
  it("uses three existing authored foley files with honest source names", () => {
    expect(EXPLORER_CLIPS).toEqual({ steps: "/audio/kid/sneak/foley/step1.m4a", bell: "/audio/kid/sneak/foley/prize.m4a", landing: "/audio/kid/sneak/foley/plop.m4a" });
    for (const path of Object.values(EXPLORER_CLIPS)) expect(existsSync(resolve(process.cwd(), `public${path}`))).toBe(true);
  });
  it("covers every object, location, clue and action in both languages", () => {
    expect(Object.keys(GAME_COPY.he).sort()).toEqual(Object.keys(GAME_COPY.en).sort());
    for (const object of CORNER_OBJECTS) expect(GAME_COPY.he[object]).toMatch(/[\u0590-\u05ff]/);
    for (const value of Object.values(GAME_COPY.he).flat()) expect(value).toMatch(/[\u0590-\u05ff]/);
    expect(GAME_COPY.he.position).toHaveLength(9);
  });
});
