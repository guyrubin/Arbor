/**
 * W5 — Wow → Story seed. The onboarding comic must become a durable artifact
 * through the EXISTING savedComics shelf path (Masterplan Wave 5), never a new
 * collection or write pipeline. Source-based guards (vitest in node, no jsdom)
 * + a hard pin on the CHILD_SUBCOLLECTIONS GDPR registry staying unchanged.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { CHILD_SUBCOLLECTIONS } from "../../lib/childData";

const SRC_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");

const wow = read("components/onboarding/WowOnboarding.tsx");

describe("Wow → Story seed reuses the existing savedComics path exactly", () => {
  it("writes through useChildCollection(savedComics) — the ComicsTab save path", () => {
    expect(wow).toMatch(/useChildCollection<SavedComicMeta>\([^)]*"savedComics"\)/);
    expect(wow).toContain("toSavedComicMeta(");
    expect(wow).toContain(".upsert(");
  });

  it("savedComics is the ONLY collection WowOnboarding touches (no new collection names)", () => {
    const collections = [...wow.matchAll(/useChildCollection[^(]*\(([^)]*)\)/g)]
      .map((m) => m[1])
      .flatMap((args) => [...args.matchAll(/"([^"]+)"/g)].map((q) => q[1]));
    expect(collections).toEqual(["savedComics"]);
  });

  it("seeds metadata only — no page-art persistence into Firestore/localStorage (W5.4 doctrine)", () => {
    // The seeded HeroComic carries no page art.
    expect(wow).toContain("pageUrls: []");
    // No art-persistence calls sneak in through the seed.
    expect(wow).not.toContain("putComicPage");
    expect(wow).not.toContain("setScene(");
  });

  it("dedupes once per child via arbor.wow.seeded.{childId} + stable doc id", () => {
    expect(wow).toContain("`arbor.wow.seeded.${activeChild.id}`");
    // The doc id is the adventureId (one shelf slot per adventure — upsert, never duplicate).
    expect(wow).toMatch(/id:\s*firstStory\.id/);
    expect(wow).toMatch(/adventureId:\s*firstStory\.id/);
  });

  it("the fallback pre-composed page seeds too — the gate is a RENDERED page (result.url), not fallback:false", () => {
    expect(wow).toMatch(/if \(result\.url\) \{/);
    expect(wow).not.toMatch(/!result\.fallback[\s\S]{0,200}upsert/);
  });

  it("documents the known timeline gap (savedComics is not a buildTimeline source)", () => {
    expect(wow).toContain("timeline gap");
  });
});

describe("CHILD_SUBCOLLECTIONS registry pin — the seed invented NO new sink", () => {
  it("savedComics is already registered for GDPR export/erasure", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("savedComics");
  });

  it("the registry is byte-for-byte the pre-W5 list (no additions, no removals, no reorders)", () => {
    expect(CHILD_SUBCOLLECTIONS).toEqual([
      "behaviorLogs",
      "milestones",
      "actionPlans",
      "savedStories",
      "contacts",
      "weeklyReports",
      "briefs",
      "insights",
      "growthEntries",
      "conversations",
      "conversationChanges",
      "playLogs",
      "actionLoops",
      "savedLearn",
      "screenings",
      "devScoreSnapshots",
      "routines",
      "goalObservations",
      "goals",
      "practiceEvents",
      "speechAttempts",
      "langObs",
      "mimicSessions",
      "missionRecords",
      "heroRuns",
      "journeyObjectives",
      "adventureResults",
      "bandSnapshots",
      "appointments",
      "apptQuestions",
      "wellness",
      "savedComics",
    ]);
  });
});
