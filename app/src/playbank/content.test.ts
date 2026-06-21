import { describe, it, expect } from "vitest";
import { PLAY_ACTIVITIES, PLAY_ACTIVITIES_HE, localizeActivity } from "./content";
import type { ActivitySource } from "./content";

describe("Daily Play content", () => {
  it("every activity has a Hebrew translation", () => {
    for (const a of PLAY_ACTIVITIES) {
      expect(PLAY_ACTIVITIES_HE[a.id], `missing he for ${a.id}`).toBeDefined();
    }
  });

  it("Hebrew translations keep the same number of steps", () => {
    for (const a of PLAY_ACTIVITIES) {
      const he = PLAY_ACTIVITIES_HE[a.id];
      expect(he.steps.length, `steps mismatch for ${a.id}`).toBe(a.steps.length);
      expect(he.title.trim().length).toBeGreaterThan(0);
      expect(he.whatItBuilds.trim().length).toBeGreaterThan(0);
    }
  });

  it("localizeActivity swaps prose for he but keeps language-neutral fields", () => {
    const a = PLAY_ACTIVITIES[0];
    const he = localizeActivity(a, "he");
    expect(he.title).toBe(PLAY_ACTIVITIES_HE[a.id].title);
    expect(he.steps).toEqual(PLAY_ACTIVITIES_HE[a.id].steps);
    // selector-relevant fields are untouched so ranking stays language-neutral
    expect(he.id).toBe(a.id);
    expect(he.bands).toEqual(a.bands);
    expect(he.domain).toBe(a.domain);
    expect(he.skillTags).toEqual(a.skillTags);
    expect(he.durationMin).toBe(a.durationMin);
  });

  it("localizeActivity passes through unchanged for en", () => {
    const a = PLAY_ACTIVITIES[0];
    expect(localizeActivity(a, "en")).toBe(a);
  });

  it("every present source has non-empty name, org, and url", () => {
    const activitiesWithSource = PLAY_ACTIVITIES.filter((a) => a.source !== undefined);
    expect(activitiesWithSource.length).toBeGreaterThan(0);
    for (const a of activitiesWithSource) {
      const src = a.source as ActivitySource;
      expect(src.name.trim().length, `source.name empty on ${a.id}`).toBeGreaterThan(0);
      expect(src.org.trim().length, `source.org empty on ${a.id}`).toBeGreaterThan(0);
      expect(src.url.trim().length, `source.url empty on ${a.id}`).toBeGreaterThan(0);
      expect(src.url, `source.url not https on ${a.id}`).toMatch(/^https:\/\//);
      expect(["guideline", "framework", "research"], `source.kind invalid on ${a.id}`).toContain(src.kind);
    }
  });

  it("source field is optional — activities without it are valid", () => {
    const uncited = PLAY_ACTIVITIES.filter((a) => a.source === undefined);
    expect(uncited.length).toBeGreaterThan(0);
  });
});
