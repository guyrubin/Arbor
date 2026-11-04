/**
 * B-GAME-37 — the curated eight, as ONE acceptance matrix (the synthetic half;
 * real-device audio timing, rotation and save/reopen are Guy's half). For
 * every tile of the child menu (STUDIO_GAME_SELECTION):
 *   - it is a real, eligible, lazily loaded mechanic with an EN and a HE
 *     title, opened under that title (StudioGame.integration, EN + HE);
 *   - actual play reaches its result in a NAMED test that drives the game's
 *     own handlers (no shortcut to the finish), in EN and HE where the test
 *     is per language;
 *   - the result offers Play again and Home (GameFinish, or Sneak & Freeze's
 *     own ending), never an automatic next game.
 * A ninth tile, or a finish test renamed away, fails here first.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STUDIO_ACTIVITY_LOADERS } from "../kidPrefetch";
import { STUDIO_GAME_SELECTION, studioActivity, type StudioActivityId } from "./studioCatalog";
import { studioCopy } from "./studioCopy";

const here = path.dirname(fileURLToPath(import.meta.url));
const KIDMODE = path.resolve(here, "..");
const SRC = path.resolve(KIDMODE, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Where each tile is played to its result through its own handlers. */
const FINISH: Record<string, { file: string; test: string; perLanguage: boolean; result: string }> = {
  "river-rescue": { file: "components/kidmode/studioV2/games/adventures/adventureFlows.test.tsx", test: "River: cannot sail early; solves three routes, sails, then completes and replays", perLanguage: true, result: "components/kidmode/studioV2/games/adventures/RiverRescue.tsx" },
  "feelings-forest": { file: "components/kidmode/studioV2/games/adventures/adventureFlows.test.tsx", test: "Forest: a retry does not complete; each chosen support leads to a different authored response", perLanguage: true, result: "components/kidmode/studioV2/games/adventures/FeelingsForest.tsx" },
  "rhythm-garden": { file: "components/kidmode/studioV2/games/adventures/adventureFlows.test.tsx", test: "Rhythm: visual clues, gentle retry, three patterns, bounded composition, pause, and finish", perLanguage: true, result: "components/kidmode/studioV2/games/adventures/RhythmGarden.tsx" },
  memory: { file: "components/kidmode/studioV2/StudioGame.integration.test.tsx", test: "Memory solves actual pairs; playOnly=%s retains legacy recording defaults", perLanguage: false, result: "components/practice/MemoryMatch.tsx" },
  pattern: { file: "components/kidmode/studioV2/StudioGame.integration.test.tsx", test: "Pattern answers its real six-puzzle session; playOnly=%s", perLanguage: false, result: "components/practice/PatternPowerWorld.tsx" },
  puzzle: { file: "components/kidmode/studioV2/games/newGames.flow.test.tsx", test: "wrong placement cannot progress; all four correct fragments complete it", perLanguage: false, result: "components/kidmode/studioV2/games/PuzzlePlanet.tsx" },
  "calm-builder": { file: "components/kidmode/studioV2/games/newGames.flow.test.tsx", test: "requires placement, permits moving/removing/undo, then finishes by choice", perLanguage: false, result: "components/kidmode/studioV2/games/CalmBuilder.tsx" },
  sneak: { file: "components/kidmode/games/sneakFreeze/rules.test.ts", test: "a sitting ends after exactly three tags, with three prizes", perLanguage: false, result: "components/kidmode/games/sneakFreeze/Ending.tsx" },
};

describe("B-GAME-37: the curated eight, end to end", () => {
  it("the child menu is exactly the eight curated tiles, each with its finish evidence", () => {
    expect(STUDIO_GAME_SELECTION).toHaveLength(8);
    expect(new Set(STUDIO_GAME_SELECTION).size).toBe(8);
    expect([...STUDIO_GAME_SELECTION].sort()).toEqual(Object.keys(FINISH).sort());
  });

  it.each([...STUDIO_GAME_SELECTION])("%s: a real lazily loaded mechanic, EN and HE titles, both languages", (id) => {
    expect(Object.prototype.hasOwnProperty.call(STUDIO_ACTIVITY_LOADERS, id), `${id} loader`).toBe(true);
    expect(studioActivity(id)?.languages).toEqual(["en", "he"]);
    const en = studioCopy("en").activities[id as StudioActivityId], he = studioCopy("he").activities[id as StudioActivityId];
    expect(en.title.trim()).not.toBe("");
    expect(he.title).toMatch(/[א-ת]/);
    expect(he.title).not.toMatch(/[A-Za-z]/);
  });

  it("every tile opens under its canonical EN/HE title through StudioGame (the integration matrix lists all eight)", () => {
    const src = read("components/kidmode/studioV2/StudioGame.integration.test.tsx");
    const ids = /const ids = \[([^\]]+)\] as const;/.exec(src)![1];
    for (const id of STUDIO_GAME_SELECTION) expect(ids, id).toContain(`"${id}"`);
    expect(src).toContain('it.each(ids)("%s starts its real registered mechanic under the canonical EN/HE title"');
  });

  it.each(Object.entries(FINISH))("%s: actual play reaches its result in a named test", (_id, f) => {
    const src = read(f.file);
    expect(src.includes(`it('${f.test}'`) || src.includes(`it("${f.test}"`) || src.includes(`("${f.test}"`), `${f.file} › ${f.test}`).toBe(true);
    if (f.perLanguage) expect(src).toMatch(/describe\.each\(\['en','he'\] as const\)/);
  });

  it.each(Object.entries(FINISH))("%s: the result offers Play again and Home, never an automatic next game", (id, f) => {
    const src = read(f.result);
    if (id === "sneak") {
      expect(src).toMatch(/playAgain|Play again|onAgain/i);
      expect(src).toMatch(/home/i);
    } else {
      expect(src, f.result).toMatch(/<GameFinish\b[\s\S]*?onPlayAgain=/);
    }
    expect(src).not.toMatch(/autoAdvance|nextGame\(|openNextGame/);
  });

  it("GameFinish itself carries Play again and Home", () => {
    const shell = read("components/kidmode/game/GameShell.tsx");
    expect(shell).toMatch(/export function GameFinish\(\{ title, subtitle, onPlayAgain, playAgainLabel, homeLabel/);
  });
});
