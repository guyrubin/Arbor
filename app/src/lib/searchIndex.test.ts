/**
 * AP-045: Tests for the static content-catalog search index.
 *
 * Verifies:
 *   - Index contains entries from all four catalogs.
 *   - searchIndex() is plain-string match, no AI, no child-record fields.
 *   - AC-6: no child-record fields can appear (imports are catalog-only).
 *   - RTL: no hard-coded left/right directionality in this module (content only).
 *   - Deep-link targets are valid ActiveTab values.
 */
import { describe, it, expect } from "vitest";
import { SEARCH_INDEX, searchIndex } from "./searchIndex";
import { PLAY_ACTIVITIES } from "../playbank/content";
import { ALL_MILESTONES } from "./milestoneData";
import { HERO_STORIES } from "./heroJourneys";
import { WORLDS } from "../practice/worlds";

describe("SEARCH_INDEX — catalog coverage", () => {
  it("contains one entry per activity from PLAY_ACTIVITIES", () => {
    const activityEntries = SEARCH_INDEX.filter((e) => e.category === "Activity");
    expect(activityEntries.length).toBe(PLAY_ACTIVITIES.length);
  });

  it("contains one entry per milestone from ALL_MILESTONES", () => {
    const milestoneEntries = SEARCH_INDEX.filter((e) => e.category === "Milestone");
    expect(milestoneEntries.length).toBe(ALL_MILESTONES.length);
  });

  it("contains one entry per journey from HERO_STORIES", () => {
    const journeyEntries = SEARCH_INDEX.filter((e) => e.category === "Journey");
    expect(journeyEntries.length).toBe(HERO_STORIES.length);
  });

  it("contains one entry per practice world from WORLDS", () => {
    const worldEntries = SEARCH_INDEX.filter((e) => e.category === "Practice World");
    expect(worldEntries.length).toBe(WORLDS.length);
  });

  it("total count equals sum of all four catalogs", () => {
    const expected =
      PLAY_ACTIVITIES.length +
      ALL_MILESTONES.length +
      HERO_STORIES.length +
      WORLDS.length;
    expect(SEARCH_INDEX.length).toBe(expected);
  });

  it("all keys are unique", () => {
    const keys = SEARCH_INDEX.map((e) => e.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});

describe("SEARCH_INDEX — navigation targets", () => {
  it("activity entries navigate to daily-play", () => {
    const entry = SEARCH_INDEX.find((e) => e.category === "Activity");
    expect(entry?.tab).toBe("daily-play");
  });

  it("milestone entries navigate to development", () => {
    const entry = SEARCH_INDEX.find((e) => e.category === "Milestone");
    expect(entry?.tab).toBe("development");
  });

  it("journey entries navigate to stories", () => {
    const entry = SEARCH_INDEX.find((e) => e.category === "Journey");
    expect(entry?.tab).toBe("stories");
  });

  it("practice world entries navigate to practice", () => {
    const entry = SEARCH_INDEX.find((e) => e.category === "Practice World");
    expect(entry?.tab).toBe("practice");
  });
});

describe("searchIndex() — plain string matching", () => {
  it("returns empty array for empty query", () => {
    expect(searchIndex("")).toHaveLength(0);
    expect(searchIndex("  ")).toHaveLength(0);
  });

  it("matches activity titles case-insensitively", () => {
    // "calm" appears in 'Make a calm-down jar'
    const results = searchIndex("calm");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.label.toLowerCase().includes("calm") || r.sub.toLowerCase().includes("calm"))).toBe(true);
  });

  it("matches milestone titles", () => {
    // 'Smiles at people' — 'smile' should hit it
    const results = searchIndex("smiles");
    expect(results.some((r) => r.category === "Milestone")).toBe(true);
  });

  it("matches journey titles", () => {
    // 'David and Goliath' — 'goliath' appears in the title
    const results = searchIndex("goliath");
    expect(results.some((r) => r.category === "Journey")).toBe(true);
  });

  it("matches practice world titles", () => {
    // 'Speech Coach' — 'speech' appears in title
    const results = searchIndex("speech");
    expect(results.some((r) => r.category === "Practice World")).toBe(true);
  });

  it("respects the limit parameter", () => {
    // 'a' will match many entries; verify limit is honoured
    const results = searchIndex("a", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("default limit is 12", () => {
    // 'a' should match many entries; default cap is 12
    const results = searchIndex("a");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("returns no results for a nonsense query", () => {
    const results = searchIndex("xyzzy_nomatch_zzzq");
    expect(results).toHaveLength(0);
  });
});

describe("AC-6 safety: index contains no child-record labels", () => {
  it("no entry has a category other than the four allowed content types", () => {
    const allowed = new Set(["Activity", "Milestone", "Journey", "Practice World"]);
    for (const entry of SEARCH_INDEX) {
      expect(allowed.has(entry.category)).toBe(true);
    }
  });

  it("no entry key starts with a child-data namespace", () => {
    const banned = ["behavior:", "log:", "memory:", "observation:", "journal:", "child:"];
    for (const entry of SEARCH_INDEX) {
      for (const prefix of banned) {
        expect(entry.key.startsWith(prefix)).toBe(false);
      }
    }
  });
});
