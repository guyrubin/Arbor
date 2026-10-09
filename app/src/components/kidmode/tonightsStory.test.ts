/**
 * B-PLAY-16 — Tonight's pick comes from the family, not a hash.
 *
 * Before: chooseTonightsStory(dayKey, childId) hashed the day over the whole
 * catalogue — a story read last night could be picked again tonight, the
 * family's charter played no part, and the cover could not say why.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pickTonightsStory, chooseTonightsStory, TONIGHT_AIM_REASON_KEY } from "./tonightsStory";
import { HERO_STORIES } from "../../lib/heroJourneys";
import { en, he } from "../../lib/i18nElevation/celebrate";

const here = path.dirname(fileURLToPath(import.meta.url));
const SIX_YEARS = 72;
const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);

describe("B-PLAY-16 · deterministic, family-shaped pick", () => {
  it("same child, same day, same inputs → same story (banner and cover agree)", () => {
    const ctx = { readIds: [HERO_STORIES[0].id], aims: ["courage"] as const, ageMonths: SIX_YEARS };
    const a = pickTonightsStory("2026-10-05", "child-a", { ...ctx, aims: [...ctx.aims] });
    const b = pickTonightsStory("2026-10-05", "child-a", { ...ctx, aims: [...ctx.aims] });
    expect(a.story?.id).toBeTruthy();
    expect(a.story?.id).toBe(b.story?.id);
    expect(chooseTonightsStory("2026-10-05", "child-a", { ...ctx, aims: [...ctx.aims] })).toBe(a.story?.id);
  });

  it("a read story is never re-picked while unread ones exist (30 nights)", () => {
    // B-BOOK-29 re-pin: proven over the full catalogue (injected), as before.
    const read = HERO_STORIES.slice(0, HERO_STORIES.length - 2).map((s) => s.id);
    for (const d of days) {
      const { story, reason } = pickTonightsStory(d, "child-a", { readIds: read, ageMonths: SIX_YEARS, stories: HERO_STORIES });
      expect(read).not.toContain(story!.id);
      expect(reason.kind).toBe("unread");
    }
  });

  it("when every story is read, the pick still lands (no empty night) and says nothing false", () => {
    const all = HERO_STORIES.map((s) => s.id);
    const { story, reason } = pickTonightsStory("2026-10-05", "child-a", { readIds: all, ageMonths: SIX_YEARS });
    expect(story).not.toBeNull();
    expect(reason.kind).toBe("day");
  });

  it("the charter's aim wins among unread stories and names the virtue", () => {
    const aimed = HERO_STORIES.filter((s) => s.primaryMetric === "courage");
    expect(aimed.length).toBeGreaterThan(0);
    for (const d of days) {
      const { story, reason } = pickTonightsStory(d, "child-a", { aims: ["courage"], ageMonths: SIX_YEARS });
      expect(story!.primaryMetric).toBe("courage");
      expect(reason).toEqual({ kind: "aim", metric: "courage" });
    }
  });

  it("unread beats aim: an aimed story that was read gives way to an unread one", () => {
    const courageIds = HERO_STORIES.filter((s) => s.primaryMetric === "courage").map((s) => s.id);
    const { story } = pickTonightsStory("2026-10-05", "child-a", { aims: ["courage"], readIds: courageIds, ageMonths: SIX_YEARS });
    expect(courageIds).not.toContain(story!.id);
  });

  // B-KID-52: the youngest bands are now 3-5 / 3-7, which the near-band rule
  // shows to a 2-year-old; a 1-year-old is still outside every story.
  it("the age view applies: a 1-year-old gets no story unless 'Show all ages' is on", () => {
    expect(pickTonightsStory("2026-10-05", "baby", { ageMonths: 12 }).story).toBeNull();
    expect(pickTonightsStory("2026-10-05", "baby", { ageMonths: 12 }).reason.kind).toBe("none");
    expect(pickTonightsStory("2026-10-05", "baby", { ageMonths: 12, showAllAges: true }).story).not.toBeNull();
  });

  it("NEGATIVE CONTROL: the pre-change pick (day hash over the whole catalogue) re-picks a read story", () => {
    // chooseTonightsStory with no context is the old behaviour, kept for old callers.
    const hits = days.map((d) => chooseTonightsStory(d, "child-a"));
    const read = new Set(hits.slice(0, 1));
    expect(hits.slice(1).some((id) => read.has(id))).toBe(true);
  });
});

describe("B-PLAY-16 · both call sites pass the same inputs; the cover shows the reason", () => {
  const kid = readFileSync(path.join(here, "KidDashboard.tsx"), "utf8");
  const stories = readFileSync(path.join(here, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");

  it("the kid home passes read ids, aims, age and the Show-all-ages preference (reason ignored)", () => {
    const site = kid.slice(kid.indexOf("chooseTonightsStory(data.today, childProfile.id, {"), kid.indexOf("chooseTonightsStory(data.today, childProfile.id, {") + 400);
    for (const needle of ["readIds: heroReadIds", "aims: aimVirtues(loadCharter())", "ageMonths: ageMonthsFromProfile(childProfile)", 'showAllAges: loadShowAllAges("hero-journeys")']) {
      expect(site, needle).toContain(needle);
    }
    expect(kid).toContain('useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns")');
    // the kid home takes the id only — it never renders the parent's reason line
    expect(kid).not.toMatch(/pickTonightsStory|\.reason\b|TONIGHT_AIM_REASON_KEY/);
  });

  it("the cover passes the same inputs and renders the reason line", () => {
    expect(stories).toMatch(/pickTonightsStory\(dayKey\(new Date\(\)\), childProfile\.id, \{\s*readIds: runs\.map\(\(r\) => r\.storyId\), aims, ageMonths: childMonths, showAllAges,\s*prefer: \(s\) => storyCover\(s\.id\) !== null,\s*lang: storyLang,\s*\}\)/);
    expect(stories).toContain('data-testid="stories-tonight-reason"');
    expect(stories).toContain("t(TONIGHT_AIM_REASON_KEY[tonightReason.metric])");
    expect(stories).not.toContain("chooseTonightsStory(dayKey");
  });

  it("every reason line exists in EN and HE; the aim line names the family's choice", () => {
    for (const key of [...Object.values(TONIGHT_AIM_REASON_KEY), "elev.stories.tonight.reason.unread"]) {
      expect(en[key], key).toBeTruthy();
      expect(/[֐-׿]/.test(he[key] ?? ""), key).toBe(true);
    }
    expect(en[TONIGHT_AIM_REASON_KEY.courage]).toBe("A courage story — your family chose courage");
    expect(en["elev.stories.tonight.reason.unread"]).toContain("{name}");
    expect(he["elev.stories.tonight.reason.unread"]).toContain("{name}");
  });
});

describe("B-BOOK-29: Tonight picks from the kid shelf", () => {
  it("over 30 nights the default pick is always a canonical-text book", async () => {
    const { KID_SHELF_STORY_IDS } = await import("../../lib/heroJourneys");
    for (const d of days) {
      const { story } = pickTonightsStory(d, "child-a", { ageMonths: SIX_YEARS });
      expect(KID_SHELF_STORY_IDS.has(story!.id), story!.id).toBe(true);
    }
  });
});
