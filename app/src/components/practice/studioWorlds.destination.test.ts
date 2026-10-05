/**
 * B-PLAY-03 guard (K0-5 acceptance) — every Practice Studio tile has a real
 * destination: either a parent-shell route (`tab`) or a world the CHILD can
 * reach in Kid Mode (an id in HeroArcade's KID_WORLDS). A tile that promises
 * "In Kid Mode as …" for a world the arcade hides (Word World is
 * `parentOnly: true`) lands the parent on the kid home with nothing there.
 *
 * HeroArcade.tsx imports every world component, so the KID_WORLDS ids are
 * read from its source (the `WORLDS` table + the `parentOnly` filter) rather
 * than by importing the React module into a node test.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STUDIO_WORLDS, opensInKidMode } from "./studioWorlds";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const arcade = readFileSync(path.join(__dirname, "HeroArcade.tsx"), "utf8").replace(/\r\n/g, "\n");

// B-KID-68 re-pin: the arcade's kid worlds are the registry's (one play row per
// world id under PLAY); the parent-only rows stay literal in WORLDS.
const playTable = arcade.slice(arcade.indexOf("const PLAY: Record<string, WorldPlay> = {"), arcade.indexOf("const WORLDS: World[] = ["));
const table = arcade.slice(arcade.indexOf("const WORLDS: World[] = ["), arcade.indexOf("export const KID_WORLDS"));
const registry = readFileSync(path.join(__dirname, "..", "kidmode", "kidWorlds.ts"), "utf8");
const REGISTRY_IDS = [...registry.matchAll(/\{ id: "[a-z-]+", worldId: "([a-z-]+)"/g)].map((m) => m[1]);
const playIds = new Set([...playTable.matchAll(/\n\s*([a-z-]+): \{ tag: /g)].map((m) => m[1]));
const rows = table.split("\n").filter((l) => /^\s*\{ id: "/.test(l));
const ALL_ARCADE_IDS = [...REGISTRY_IDS.filter((id) => playIds.has(id)), ...rows.map((l) => /id: "([^"]+)"/.exec(l)![1])];
const KID_WORLD_IDS = new Set([...REGISTRY_IDS.filter((id) => playIds.has(id)), ...rows.filter((l) => !/parentOnly: true/.test(l)).map((l) => /id: "([^"]+)"/.exec(l)![1])]);

describe("B-PLAY-03 · every STUDIO_WORLDS tile has a tab or a KID_WORLDS id", () => {
  it("the arcade table was really parsed (a vacuous scan is not a pass)", () => {
    expect(arcade).toContain("export const KID_WORLDS: World[] = WORLDS.filter((w) => !w.parentOnly);");
    expect(arcade).toContain("...KID_WORLD_REGISTRY.map((w): World => ({ id: w.worldId,");
    expect(REGISTRY_IDS.length).toBe(9);
    expect(playIds.size).toBe(9);
    expect(ALL_ARCADE_IDS.length).toBeGreaterThanOrEqual(10);
    expect(KID_WORLD_IDS.has("memory")).toBe(true);
    expect(KID_WORLD_IDS.has("word-world")).toBe(false); // parentOnly
  });

  for (const world of STUDIO_WORLDS) {
    it(`${world.id}: opens a parent route or a world the child can reach`, () => {
      expect(Boolean(world.tab) || KID_WORLD_IDS.has(world.id), `${world.id} has neither a tab nor a KID_WORLDS seat`).toBe(true);
    });
  }

  it("a world without a Kid Mode seat names the parent tab it opens (Word World → Language)", () => {
    for (const world of STUDIO_WORLDS.filter((w) => !KID_WORLD_IDS.has(w.id))) {
      expect(world.tab, world.id).toBeTruthy();
      expect(world.tabNameKey, `${world.id} must say where it opens, never "In Kid Mode as …"`).toBeTruthy();
    }
    const words = STUDIO_WORLDS.find((w) => w.id === "word-world")!;
    expect(words.tab).toBe("language");
    expect(words.tabNameKey).toBe("nav.tab.language");
  });

  // W2-SHELLPLAY critic r2 (B-KID-11): tightened from "a tab OR a kid world" to
  // "a kid world unless word-world" — a kid-capable tile never opens a parent drill.
  it("every tile except Word World opens its OWN Kid Mode world through the seam", () => {
    for (const world of STUDIO_WORLDS) {
      if (world.id === "word-world") {
        expect(opensInKidMode(world)).toBe(false);
        continue;
      }
      expect(opensInKidMode(world), `${world.id} must open in Kid Mode`).toBe(true);
      expect(KID_WORLD_IDS.has(world.id), `${world.id} has no Kid Mode seat`).toBe(true);
    }
    // NEGATIVE CONTROL: a kid-capable world given a parent tab name is caught
    expect(opensInKidMode({ ...STUDIO_WORLDS[0], tabNameKey: "nav.tab.speech" })).toBe(false);
  });

  it("NEGATIVE CONTROL: an arcade-only tile for a parentOnly world is caught", () => {
    const bad = { id: "word-world", tab: undefined };
    expect(Boolean(bad.tab) || KID_WORLD_IDS.has(bad.id)).toBe(false);
  });
});
