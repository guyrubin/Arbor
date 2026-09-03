/**
 * KID-01 guard — Pattern Power plays every puzzle to completion and the win
 * screen renders; nothing throws after the last answer.
 *
 * Node harness (no jsdom in this repo): the round is walked through the pure
 * `patternRound()` clamp, and every round view + the win view is rendered with
 * react-dom/server, which throws on any render error exactly like the client
 * commit would. Hooks that need providers (Arbor context, practice data,
 * language) are stubbed; PlayKit renders for real.
 *
 * Negative control: the pre-fix pattern — a bare `PATTERN_PUZZLES[idx]` read
 * BEFORE the done-check — is shown to yield `undefined` at the index the 6th
 * answer produces, and the component source is pinned to never index the
 * table directly.
 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

vi.mock("../../practice/useArcadeLogger", () => ({
  useArcadeLogger: () => ({ first: "Mia", childProfile: { id: "c1", name: "Mia Test", age: 5 }, log: () => undefined }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, uiLang: "en", aiLang: "en" }),
}));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: { id: "c1", name: "Mia Test", age: 5 } }),
}));
vi.mock("../ui/HeroAvatar", () => ({
  HeroAvatar: () => React.createElement("span", { "data-hero": "1" }),
  useHeroAvatar: () => ({ name: "Mia", url: null, hasHero: false }),
}));
vi.mock("../ui/ArborMascot", () => ({
  ArborMascot: () => React.createElement("span", { "data-mascot": "1" }),
}));
vi.mock("../../lib/celebrate", () => ({ celebrate: () => undefined }));

import { PATTERN_PUZZLES, patternRound } from "../../practice/newGames";
import PatternPowerWorld, { PatternDoneView, PatternRoundView } from "./PatternPowerWorld";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("KID-01: patternRound never dereferences past the table", () => {
  it("returns a real puzzle for every index the game can reach, including the one past the end", () => {
    for (let idx = 0; idx <= PATTERN_PUZZLES.length; idx++) {
      const r = patternRound(idx);
      expect(r.puzzle, `idx ${idx} must resolve to a puzzle`).toBeDefined();
      expect(Array.isArray(r.puzzle.options)).toBe(true);
      expect(r.done).toBe(idx >= PATTERN_PUZZLES.length);
    }
  });

  it("negative control — the pre-fix bare index is undefined after the last answer", () => {
    // The 6th choose() sets idx = PATTERN_PUZZLES.length; the old code read
    // `PATTERN_PUZZLES[idx].options` on the very next render.
    const afterLast = PATTERN_PUZZLES[PATTERN_PUZZLES.length];
    expect(afterLast).toBeUndefined();
    expect(() => (afterLast as unknown as { options: string[] }).options).toThrow();
    // …and the clamped read at the same index is safe.
    expect(() => patternRound(PATTERN_PUZZLES.length).puzzle.options).not.toThrow();
  });

  it("the component reads rounds ONLY through patternRound (source pin)", () => {
    const src = readFileSync(path.join(__dirname, "PatternPowerWorld.tsx"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(src).toContain("patternRound(idx)");
    expect(src, "a bare PATTERN_PUZZLES[...] read is the KID-01 crash").not.toMatch(/PATTERN_PUZZLES\s*\[/);
  });
});

describe("KID-01: every round and the win screen render without throwing", () => {
  it("renders each puzzle round (idle and after a pick)", () => {
    for (let idx = 0; idx < PATTERN_PUZZLES.length; idx++) {
      const { puzzle } = patternRound(idx);
      for (const picked of [null, puzzle.answer, puzzle.options.find((o) => o !== puzzle.answer) ?? null]) {
        const html = renderToString(
          React.createElement(PatternRoundView, {
            puzzle,
            idx,
            options: puzzle.options,
            picked,
            onChoose: () => undefined,
            patternAria: "pattern",
          }),
        );
        expect(html).toContain("Pattern Power");
        for (const g of puzzle.shown) expect(html).toContain(g);
      }
    }
  });

  it("the win screen (Celebrate) renders after the last puzzle", () => {
    const { done } = patternRound(PATTERN_PUZZLES.length);
    expect(done).toBe(true);
    const html = renderToString(React.createElement(PatternDoneView, { first: "Mia", stars: 3, onReplay: () => undefined }));
    expect(html).toContain("Pattern master, Mia!");
    expect(html).toContain("Play again");
    expect(html).toContain("⭐");
  });

  it("the default export mounts on round 1 (wiring smoke)", () => {
    const html = renderToString(React.createElement(PatternPowerWorld));
    expect(html).toContain("Pattern Power");
    for (const g of PATTERN_PUZZLES[0].shown) expect(html).toContain(g);
  });
});
