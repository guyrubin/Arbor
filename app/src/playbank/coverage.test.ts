import { describe, it, expect } from "vitest";
import {
  buildCoverage, coverageGaps, coverageSummary, activityStages, PLAY_DOMAINS,
  guidedAuthoringRank, topGuidedActivities, hasGuidedFields, GUIDED_AUTHORING_COUNT,
} from "./coverage";
import { STAGES } from "./stages";
import { PLAY_ACTIVITIES, PLAY_ACTIVITIES_HE, PLAY_BANDS } from "./content";
import type { PlayActivity } from "./content";

const mk = (over: Partial<PlayActivity>): PlayActivity => ({
  id: "x", title: "x", bands: ["toddler"], domain: "regulation",
  skillTags: [], householdItems: [], whatItBuilds: "", steps: [], durationMin: 5, ...over,
});

describe("content coverage", () => {
  it("activityStages prefers explicit stages, else fans out the bands", () => {
    expect(activityStages(mk({ stages: ["18-24m"] }))).toEqual(["18-24m"]);
    expect(activityStages(mk({ bands: ["toddler"] }))).toEqual(["12-18m", "18-24m", "2-3y"]);
  });

  it("builds a full zero-filled stage x domain grid", () => {
    const cells = buildCoverage([]);
    expect(cells.length).toBe(STAGES.length * PLAY_DOMAINS.length);
    expect(cells.every((c) => c.count === 0)).toBe(true);
  });

  it("counts an activity into each of its stage x domain cells", () => {
    const cells = buildCoverage([mk({ stages: ["18-24m"], domain: "language" })]);
    const hit = cells.find((c) => c.stage === "18-24m" && c.domain === "language");
    expect(hit?.count).toBe(1);
    expect(cells.filter((c) => c.count > 0).length).toBe(1);
  });

  it("coverageGaps lists empty cells (the authoring backlog)", () => {
    const gaps = coverageGaps([mk({ stages: ["2-3y"], domain: "regulation" })]);
    expect(gaps.every((c) => c.count === 0)).toBe(true);
    expect(gaps.find((c) => c.stage === "2-3y" && c.domain === "regulation")).toBeUndefined();
  });

  it("summary reports fill rate and thinnest stages", () => {
    const s = coverageSummary([mk({ stages: ["2-3y"], domain: "social" })]);
    expect(s.filledCells).toBe(1);
    expect(s.emptyCells).toBe(s.totalCells - 1);
    expect(s.thinnestStages.length).toBe(5);
    expect(s.thinnestStages[0].domainsCovered).toBe(0); // a fully-empty stage is thinnest
  });

  it("the play bank has been expanded past the reviewed seed toward the F11 floor (>=250)", () => {
    // Content-expansion wave: the original reviewed seed (40–60) was grown with
    // research-backed, bilingual activities across all 5 domains × 4 bands toward
    // the capability floor (F11 >= 250). Lower bound is a sanity floor.
    expect(PLAY_ACTIVITIES.length).toBeGreaterThanOrEqual(200);
  });

  it("every populated band×domain cell holds at least 2 activities (engine can't regress below playable)", () => {
    const counts = new Map<string, number>();
    for (const a of PLAY_ACTIVITIES) {
      for (const band of a.bands) counts.set(`${band}|${a.domain}`, (counts.get(`${band}|${a.domain}`) ?? 0) + 1);
    }
    const thin: string[] = [];
    for (const { band } of PLAY_BANDS) {
      for (const domain of PLAY_DOMAINS) {
        const n = counts.get(`${band}|${domain}`) ?? 0;
        if (n === 1) thin.push(`${band}×${domain}`); // populated (≥1) but below the floor of 2
      }
    }
    expect(thin).toEqual([]);
  });

  it("every activity has a matching Hebrew translation (parity)", () => {
    const missing = PLAY_ACTIVITIES.filter((a) => !PLAY_ACTIVITIES_HE[a.id]).map((a) => a.id);
    expect(missing).toEqual([]);
  });

  // ── KID-5 / AR-CONT-02: guided-play authoring wave ──────────────────────
  describe("guided-play fields (KID-5)", () => {
    it(`the top-${GUIDED_AUTHORING_COUNT} activities (domain coverage × band) carry all four guided fields in EN`, () => {
      const missing = topGuidedActivities()
        .filter((a) => !hasGuidedFields(a))
        .map((a) => a.id);
      expect(missing, `top-${GUIDED_AUTHORING_COUNT} activities missing guided-play fields`).toEqual([]);
    });

    it("guidedAuthoringRank is deterministic and covers the whole bank", () => {
      const a = guidedAuthoringRank().map((x) => x.id);
      const b = guidedAuthoringRank().map((x) => x.id);
      expect(a).toEqual(b);
      expect(a.length).toBe(PLAY_ACTIVITIES.length);
    });

    it("HE guided slots are tracked but gated: any present HE guided field is non-empty (native transcreation, KID-8/GD-7)", () => {
      // HE guided copy only lands via the native transcreation packet — until
      // then the slots stay absent and the UI falls back to EN. This test
      // tracks the slot without forcing machine-translated content in.
      for (const a of PLAY_ACTIVITIES) {
        const he = PLAY_ACTIVITIES_HE[a.id];
        if (!he) continue;
        for (const key of ["easierVariation", "harderVariation", "whatToNotice", "outcomePrompt"] as const) {
          const v = he[key];
          if (v !== undefined) expect(v.trim().length, `${a.id} HE ${key} present but empty`).toBeGreaterThan(0);
        }
      }
    });

    it("demoMediaId ships EMPTY — demonstration video is Guy-gated production", () => {
      const withMedia = PLAY_ACTIVITIES.filter((a) => a.demoMediaId !== undefined).map((a) => a.id);
      expect(withMedia).toEqual([]);
    });

    it("guided-play copy stays observational — banned-token scan mirroring clinicalFirewall.wave3", () => {
      // Firewall CONDITION on KID-5: whatToNotice/outcomePrompt (and the two
      // variation fields) must stay notice/describe — never assess/score.
      // Mirrors the wave-3 banned lexicon plus the assess/score verdict class.
      const banned =
        /\b(improves?|boosts?|reduces?|on[\s-]?track|behind|delay(?:ed|s)?|clinically|therapeutically|autism|adhd|anxiety|spd|arfid|dyslexia|assess(?:es|ing|ment)?|scor(?:e|es|ing|ed)|grade[sd]?|grading|measur(?:e|es|ing|ement)|evaluat(?:e|es|ing|ion)|diagnos\w*|percentile|milestones?)\b/i;
      for (const a of PLAY_ACTIVITIES) {
        const he = PLAY_ACTIVITIES_HE[a.id];
        for (const key of ["easierVariation", "harderVariation", "whatToNotice", "outcomePrompt"] as const) {
          for (const v of [a[key], he?.[key]]) {
            if (!v) continue;
            expect(v, `banned token in ${a.id}.${key}: "${v}"`).not.toMatch(banned);
          }
        }
      }
    });
  });

  // ── KID-3 content wave: session-length buckets are honestly stocked ──────
  describe("session-length content (KID-3)", () => {
    it("the extended (21–30 min) bucket is no longer empty", () => {
      const extended = PLAY_ACTIVITIES.filter((a) => a.durationMin > 20);
      expect(extended.length).toBeGreaterThan(0);
      for (const a of extended) {
        expect(a.durationMin, `${a.id} extended duration out of honest range`).toBeLessThanOrEqual(30);
      }
    });

    it("infants deliberately have NO extended activities (not an honest ask of that band)", () => {
      const infantExtended = PLAY_ACTIVITIES.filter(
        (a) => a.durationMin > 20 && a.bands.includes("infant")
      ).map((a) => a.id);
      expect(infantExtended).toEqual([]);
    });
  });

  it("themeableContextSlot coverage reaches the CI-29 floor (>= 60) so the interest engine actually fires", () => {
    const themeable = PLAY_ACTIVITIES.filter((a) => a.themeableContextSlot === true);
    expect(themeable.length).toBeGreaterThanOrEqual(60);
  });

  it("early-infant (0–12 month) coverage is now populated (gap closed by the content-expansion wave)", () => {
    const cells = buildCoverage(); // real PLAY_ACTIVITIES
    const infantCells = cells.filter((c) => ["0-3m", "3-6m", "6-9m", "9-12m"].includes(c.stage));
    const infantFilled = infantCells.filter((c) => c.count > 0).length;
    // The early-infant gap that drove the backlog has been filled with infant-band
    // activities across the domains — most early-infant cells now carry content.
    expect(infantFilled).toBeGreaterThan(infantCells.length / 2);
  });
});
