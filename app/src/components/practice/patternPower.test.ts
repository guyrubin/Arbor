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
import { puzzleOrderForDay, PATTERN_ROUNDS_PER_DAY } from "../../practice/newGames";
import { dayKey } from "../../practice/signals";

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
    // KID-08: the round is read through the clamped helper, now against the
    // DAY's puzzle order rather than the module constant.
    expect(src).toContain("patternRound(idx, puzzles)");
    expect(src).toContain("puzzleOrderForDay(dayKey(new Date()))");
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
            title: "Pattern Power",
            say: "What comes next?",
            speakLabel: "Hear it",
            lang: "en",
            total: PATTERN_PUZZLES.length,
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
    const html = renderToString(
      React.createElement(PatternDoneView, {
        first: "Mia",
        stars: 3,
        onReplay: () => undefined,
        title: "You finished every pattern, Mia!",
        subtitle: "That is the whole set.",
        againLabel: "Play this set again",
      }),
    );
    // KID-07: an ENDING, not a loop. The old screen offered "Play again" and
    // restarted puzzle 1 of the same six.
    expect(html).toContain("You finished every pattern, Mia!");
    expect(html).toContain("Play this set again");
    expect(html).not.toContain("Pattern master");
    expect(html).toContain("⭐");
  });

  it("the default export mounts on round 1 (wiring smoke)", () => {
    const html = renderToString(React.createElement(PatternPowerWorld));
    // The title is keyed now (elev.play.pattern.title); outside a
    // LanguageProvider t() returns the key, so accept either rendering.
    expect(/Pattern Power|elev\.play\.pattern\.title/.test(html)).toBe(true);
    // KID-08: round 1 is the first puzzle of the DAY's order, not the module
    // constant's first entry — so assert it is one of the six, not a fixed one.
    const first = puzzleOrderForDay(dayKey(new Date()))[0];
    for (const g of first.shown) expect(html).toContain(g);
  });
});

/* ── KID-07 / KID-08: the set has an order, and it has an end ─────────────── */

describe("KID-08 — the puzzle order is seeded by the local day", () => {
  it("is stable for a given day", () => {
    const a = puzzleOrderForDay("2026-09-07").map((p) => p.id);
    expect(puzzleOrderForDay("2026-09-07").map((p) => p.id)).toEqual(a);
  });

  it("keeps every puzzle — an order, never a filter (law 6)", () => {
    const ids = puzzleOrderForDay("2026-09-07").map((p) => p.id).sort();
    expect(ids).toEqual(PATTERN_PUZZLES.map((p) => p.id).sort());
  });

  it("differs across days — the set is not memorised after one sitting", () => {
    const week = ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11"];
    const orders = new Set(week.map((d) => puzzleOrderForDay(d).map((p) => p.id).join("|")));
    expect(orders.size).toBeGreaterThan(1);
  });

  it("NEGATIVE CONTROL: the pre-fix order was the module constant, identical every day", () => {
    const preFix = () => PATTERN_PUZZLES.map((p) => p.id).join("|");
    expect(preFix()).toBe(preFix());
    expect(puzzleOrderForDay("2026-09-07").map((p) => p.id).join("|")).not.toBe(
      // at least one day in the week must differ from the frozen order
      ["2026-09-05", "2026-09-06", "2026-09-08"].map((d) => puzzleOrderForDay(d).map((p) => p.id).join("|")).find((o) => o !== preFix()) ?? preFix(),
    );
  });
});

describe("KID-07 — six rounds is the whole sitting", () => {
  it("the cap is declared and the world plays exactly that many", () => {
    expect(PATTERN_ROUNDS_PER_DAY).toBe(6);
    const dayOrder = puzzleOrderForDay(dayKey(new Date())).slice(0, PATTERN_ROUNDS_PER_DAY);
    expect(dayOrder).toHaveLength(6);
    expect(patternRound(PATTERN_ROUNDS_PER_DAY, dayOrder).done).toBe(true);
    expect(patternRound(PATTERN_ROUNDS_PER_DAY - 1, dayOrder).done).toBe(false);
  });
});
