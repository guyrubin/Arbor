/**
 * kidDashboard.destinations.test.ts — OBJ-KID-05 guard.
 *
 * Three redundancies were measured on the kid home:
 *   - the "Feelings" adventure tile and the "Mood Mountain" game tile both
 *     opened FeelingsLabTab (the arcade world `feelings` is that component);
 *   - MemoryMatch was mounted inside Story Quest as well as Mind Vault;
 *   - the quest banner promised "Today's adventure" and opened the full
 *     18-story catalogue (5,287 px).
 *
 * A child choosing between two doors to the same room pays twice: once to
 * choose, once to discover. The map below must therefore be INJECTIVE — one
 * tile, one place — and the banner must resolve to exactly one story.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { kidDestinations, kidHomeBookRow, KID_HOME_BOOK_ROW_MAX, KID_HOME_GAMES } from "./KidDashboard";
import { kidBooks } from "./kidBooks";
import { chooseTonightsStory } from "./tonightsStory";
import { HERO_STORIES } from "../../lib/heroJourneys";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(path.join(__dirname, ...p), "utf8");

const STORY = chooseTonightsStory("2026-09-07", "dylan-demo");
// B-KID-88: the "My books" row is part of the home — the real list a 5-year-old
// English child with one finished book sees (tonight's book excluded).
const ROW = kidHomeBookRow(kidBooks({ lang: "en", ageMonths: 60, showAllAges: false, hasCover: () => false, runs: [{ storyId: "noahs-ark", completedAt: "2026-09-01T18:00:00Z" }] }), STORY);
const destinations = kidDestinations(STORY, ROW.map((b) => b.story.id));
const key = (d: { surface: string; arg: string | null }) => `${d.surface}:${d.arg ?? ""}`;

describe("OBJ-KID-05 — one tile, one destination", () => {
  it("every tile on the kid home resolves to a different place", () => {
    const keys = destinations.map(key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes, `tiles sharing a destination: ${dupes.join(", ")}`).toEqual([]);
    expect(new Set(keys).size).toBe(destinations.length);
  });

  it("B-KID-88: the home is Tonight's book, My books (+ See all) and nine games — no adventure or comics doors", () => {
    expect(ROW.length).toBeGreaterThan(0);
    expect(ROW.length).toBeLessThanOrEqual(KID_HOME_BOOK_ROW_MAX);
    // B-KID-85: the comics door went into the library (See all → Made before).
    expect(destinations).toHaveLength(1 + ROW.length + 1 + 9);
    expect(destinations.some((d) => d.surface === "comics")).toBe(false);
    expect(destinations.filter((d) => d.tile.startsWith("game:"))).toHaveLength(9);
    expect(destinations.filter((d) => d.tile.startsWith("adv:"))).toHaveLength(0);
    expect(destinations.filter((d) => d.tile.startsWith("book:"))).toHaveLength(ROW.length);
    expect(destinations[0].tile).toBe("quest-banner");
    expect(destinations[1].tile).toBe(`book:${ROW[0].story.id}`);
    // the finished book leads the row
    expect(ROW[0].story.id).toBe("noahs-ark");
    expect(destinations.at(-1)!.tile).toBe("game:spell-forge");
  });

  it("B-KID-88: tonight's book is never a second door in the row", () => {
    expect(ROW.some((b) => b.story.id === STORY)).toBe(false);
    const withTonight = kidHomeBookRow(kidBooks({ lang: "en", ageMonths: 60, showAllAges: true, hasCover: () => false, runs: [{ storyId: STORY, completedAt: "2026-09-01T18:00:00Z" }] }), STORY);
    expect(withTonight.some((b) => b.story.id === STORY)).toBe(false);
  });

  it("B-KID-88: every kid world stays one tap from the home (no picker needed)", async () => {
    const { KID_WORLDS } = await import("../practice/HeroArcade");
    const tileWorlds = new Set(KID_HOME_GAMES.map((g) => g.worldId));
    for (const w of KID_WORLDS) expect(tileWorlds.has(w.id), `world ${w.id} has no home tile`).toBe(true);
    // the arcade picker door is gone from the home
    expect(destinations.some((d) => d.surface === "arcade" && d.arg === null)).toBe(false);
  });

  it("negative control — restoring the Feelings adventure tile collides with Mood Mountain", () => {
    // The removed tile, re-added by hand: surface "feelings", no arg. The Mood
    // Mountain game tile opens arcade:feelings — a DIFFERENT key, so the
    // collision the ledger measured is a collision of COMPONENTS, not of keys.
    // Prove it at the component level, which is where the child feels it.
    const dash = read("KidDashboard.tsx");
    const overlay = read("KidModeOverlay.tsx");
    const arcade = read("..", "practice", "HeroArcade.tsx");
    // The "feelings" KidSurface renders FeelingsLabTab…
    expect(overlay).toContain('feelings: { labelKey: "kid.surface.feelings", Comp: FeelingsLabTab }');
    // …and so does the arcade world with id "feelings".
    // (B-KID-68: the arcade's per-world play row is keyed by world id.)
    expect(arcade).toMatch(/\n\s*feelings: \{[^\n]*Comp: FeelingsLabTab/);
    // So no adventure tile may claim the "feelings" surface any more.
    const adventuresBlock = dash.slice(dash.indexOf("const ADVENTURES"), dash.indexOf("// Games grid"));
    expect(adventuresBlock).not.toContain('surface: "feelings"');
    expect(adventuresBlock).not.toContain("game-feelings.webp");
  });
});

describe("OBJ-KID-05 — Story Quest is stories only", () => {
  it("AdventuresTab no longer mounts a second memory game", () => {
    const adventures = read("..", "practice", "AdventuresTab.tsx");
    expect(adventures).not.toContain("<MemoryMatch");
    expect(adventures).not.toContain('from "./MemoryMatch"');
  });

  it("negative control — Mind Vault still owns the memory board", () => {
    const vault = read("..", "practice", "MindVaultWorld.tsx");
    expect(vault).toContain("MemoryMatch");
  });
});

describe("OBJ-KID-05 / KID-25 — the banner opens exactly one story", () => {
  it("tonight's story is a real catalogue story", () => {
    expect(HERO_STORIES.some((s) => s.id === STORY)).toBe(true);
  });

  it("it is stable within a day and rotates across days", () => {
    expect(chooseTonightsStory("2026-09-07", "dylan-demo")).toBe(STORY);
    const week = new Set(
      ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"].map((d) =>
        chooseTonightsStory(d, "dylan-demo"),
      ),
    );
    expect(week.size, "a week of banners must not be the same story every night").toBeGreaterThan(3);
  });

  it("two children do not share one rotation", () => {
    const a = chooseTonightsStory("2026-09-07", "child-a");
    const b = chooseTonightsStory("2026-09-07", "child-b");
    expect(typeof a).toBe("string");
    expect(a === b && a === chooseTonightsStory("2026-09-07", "child-c")).toBe(false);
  });

  it("the banner passes that id through the overlay into the journeys surface", () => {
    const dash = read("KidDashboard.tsx");
    const overlay = read("KidModeOverlay.tsx");
    const hero = read("..", "tabs", "HeroJourneyTab.tsx");
    expect(dash).toContain('onOpenSurface("journeys", tonightsStoryId)');
    expect(overlay).toContain("<HeroJourneyTab initialStoryId={arcadeWorldId ?? undefined} />");
    expect(hero).toContain("const displayStories = pinned ? [pinned] : ageCandidates;");
  });

  it("the pin never bypasses the age view (W0.7 stays in force)", () => {
    const hero = read("..", "tabs", "HeroJourneyTab.tsx");
    // `pinned` is searched inside the ALREADY age-filtered list, so a story the
    // child's age view hides cannot be forced in by a banner tap.
    expect(hero).toContain("const pinned = initialStoryId ? ageCandidates.find((s) => s.id === initialStoryId) : undefined;");
  });

  it("negative control — with no story id the full catalogue is still reachable", () => {
    const hero = read("..", "tabs", "HeroJourneyTab.tsx");
    // B-KID-70 (R-4b): the age rule is unchanged — show-all-ages lifts it, else
    // the age-visible list — and illustrated stories only LEAD (a partition:
    // same members, reordered), so no story is added or dropped.
    expect(hero).toContain("const ageCandidates = illustratedFirst(showAllAges ? orderedStories : ageVisibleStories);");
    expect(hero).toContain("const illustratedFirst = (list: HeroStorySpec[]) => [...list.filter((s) => storyCover(s.id)), ...list.filter((s) => !storyCover(s.id))];");
    // B-KID-88: the "My books" See all opens journeys with no arg — the library door.
    expect(destinations.find((d) => d.tile === "books-see-all")).toEqual({
      tile: "books-see-all",
      surface: "journeys",
      arg: null,
    });
  });
});
