/**
 * B-KID-52 (KB-13) — the catalogue metadata tells the truth.
 * Before: the-found-acorn-crown (a fox-cub fable) was labelled "biblical", and
 * every story was ageRange [4, 8] although the lane-B section 1.K review gave
 * bands from 3-5 to 6-8 (and the kid card printed that age chip to the child).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HERO_STORIES, getStorySpec } from "./heroJourneys";

/** origin per id — biblical only where the story retells a biblical narrative. */
const ORIGIN: Record<string, "biblical" | "original"> = {
  "david-and-goliath": "biblical", "moses-and-pharaoh": "biblical", "the-lion-who-was-afraid": "original",
  "noahs-ark": "biblical", "jonah-and-the-great-fish": "biblical", "the-dragon-of-responsibility": "original",
  "joseph-and-his-brothers": "biblical", "jacob-wrestling-the-angel": "biblical", "the-garden-of-forgotten-seeds": "original",
  "king-solomons-choice": "biblical", "the-broken-music-box": "original", "the-found-acorn-crown": "original",
  "the-two-gifts": "biblical", "leave-the-tent": "biblical", "the-two-paths-through-the-meadow": "original",
  "the-two-mothers-and-the-quiet-judge": "biblical", "the-tyrant-and-the-town": "original", "the-friendly-monster": "original",
  "the-lantern-path": "original", "the-cloud-orchestra": "original", "the-little-bridge-builders": "original",
};
/** The bands section 1.K names (the rest keep [4, 8] until their rewrite). */
const AGES: Record<string, [number, number]> = {
  "moses-and-pharaoh": [6, 8], "joseph-and-his-brothers": [6, 8], "jacob-wrestling-the-angel": [6, 8],
  "the-two-gifts": [6, 8], "the-tyrant-and-the-town": [6, 8], "noahs-ark": [3, 5], "the-garden-of-forgotten-seeds": [3, 5],
  "jonah-and-the-great-fish": [4, 7], "leave-the-tent": [4, 7], "david-and-goliath": [3, 7], "the-broken-music-box": [3, 7],
  "the-two-paths-through-the-meadow": [3, 7], "the-lantern-path": [3, 7], "the-cloud-orchestra": [3, 7], "the-little-bridge-builders": [3, 7],
};

describe("B-KID-52: origin and ages per story", () => {
  it("every catalogue story has a reviewed origin, and it matches", () => {
    expect(Object.keys(ORIGIN).sort()).toEqual(HERO_STORIES.map((s) => s.id).sort());
    for (const s of HERO_STORIES) expect(s.origin, s.id).toBe(ORIGIN[s.id]);
  });
  it.each(Object.entries(AGES))("%s is aged %j", (id, band) => {
    expect(getStorySpec(id)!.ageRange).toEqual(band);
  });
  it("the kid catalogue card prints no age chip (the age view already chose the list)", () => {
    const tab = readFileSync(path.resolve(__dirname, "..", "components", "tabs", "HeroJourneyTab.tsx"), "utf8");
    const kid = tab.slice(tab.indexOf("return kidMode ? ("), tab.indexOf("{/* JOURNEY LIBRARY */}"));
    expect(kid).not.toContain("{story.ageRange[0]}–{story.ageRange[1]}");
  });
  it("NEGATIVE CONTROL: the fox-cub fable is not biblical", () => {
    expect(getStorySpec("the-found-acorn-crown")!.beats[0].spine).toMatch(/fox cub/);
    expect(getStorySpec("the-found-acorn-crown")!.origin).not.toBe("biblical");
  });
});
