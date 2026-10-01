import { describe, it, expect } from "vitest";
import {
  CANONICAL_BANDS,
  SCHEME_RANGES,
  fromMonths,
  schemeBandForMonths,
  toAgeBand,
  type AgeScheme,
} from "./ageBands";
import { VISIT_SCHEDULES, nextVisitMonths, visitBands } from "./visitSchedule";
import { MILESTONE_AGE_BANDS, bandForAgeMonths as milestoneBand, milestoneBandToCanonical } from "../milestoneData";
import { AGE_BANDS, bandForAgeMonths as screeningBand, screeningBandToCanonical } from "../screening";
import { PLAY_BANDS, bandForAge as playBand, playBandToCanonical, stageToCanonical } from "../../playbank/content";
import { STAGES, ageToStage } from "../../playbank/stages";
import { KNOWLEDGE_AGE_BANDS, ageBandForMonths as knowledgeBand, knowledgeBandToCanonical } from "../../knowledge/retrievalKeys";
import { ageBandForAge as languageBand } from "../../practice/wordWorld";

/* B-GROWTH-27 — one age-band scheme with a lookup from the six existing ones.
   The table test: for EVERY month 0–144, each scheme's OWN selector and this
   module's mirror agree, and the canonical band of that month is one of the
   canonical bands the scheme band maps to. No rendered change. */

const OWN: Record<AgeScheme, (m: number) => string> = {
  milestone: (m) => String(milestoneBand(m).months),
  screening: (m) => screeningBand(m).id,
  play: (m) => playBand(m / 12),
  stage: (m) => ageToStage(m / 12),
  knowledge: (m) => knowledgeBand(m) as string,
  language: (m) => languageBand(m / 12),
};

describe("B-GROWTH-27 — canonical bands", () => {
  it("are the CDC checkpoints + two school bands, contiguous from 2 m to 156 m", () => {
    expect(CANONICAL_BANDS.map((b) => b.id)).toEqual([
      "2m", "4m", "6m", "9m", "12m", "15m", "18m", "24m", "30m", "36m", "48m", "60m", "6-8y", "9-12y",
    ]);
    for (let i = 1; i < CANONICAL_BANDS.length; i++) {
      expect(CANONICAL_BANDS[i].minMonths).toBe(CANONICAL_BANDS[i - 1].maxMonths);
    }
    expect(fromMonths(0).id).toBe("2m");
    expect(fromMonths(71).id).toBe("60m");
    expect(fromMonths(72).id).toBe("6-8y");
    expect(fromMonths(200).id).toBe("9-12y");
  });
});

describe("B-GROWTH-27 — table test, every month 0–144, all six schemes", () => {
  for (const scheme of Object.keys(OWN) as AgeScheme[]) {
    it(`${scheme}: own selector = mirror, and the canonical band is inside the lookup`, () => {
      for (let m = 0; m <= 144; m++) {
        const own = OWN[scheme](m);
        expect(schemeBandForMonths(scheme, m), `${scheme} @${m}m`).toBe(own);
        expect(toAgeBand(scheme, own), `${scheme} ${own} @${m}m`).toContain(fromMonths(m).id);
      }
    });
  }

  it("each scheme's table names exactly the ids the scheme declares", () => {
    expect(Object.keys(SCHEME_RANGES.milestone)).toEqual(MILESTONE_AGE_BANDS.map((b) => String(b.months)));
    expect(Object.keys(SCHEME_RANGES.screening)).toEqual(AGE_BANDS.map((b) => b.id));
    expect(Object.keys(SCHEME_RANGES.play)).toEqual(PLAY_BANDS.map((b) => b.band));
    expect(Object.keys(SCHEME_RANGES.stage)).toEqual(STAGES.map((s) => s.stage));
    expect(Object.keys(SCHEME_RANGES.knowledge)).toEqual([...KNOWLEDGE_AGE_BANDS]);
  });

  it("the re-exported lookups are the same function", () => {
    expect(milestoneBandToCanonical(24)).toEqual(["24m"]);
    expect(milestoneBandToCanonical(72)).toEqual(["6-8y", "9-12y"]);
    expect(screeningBandToCanonical("1-2")).toEqual(["12m", "15m", "18m"]);
    expect(playBandToCanonical("toddler")).toEqual(["12m", "15m", "18m", "24m", "30m"]);
    expect(stageToCanonical("0-3m")).toEqual(["2m"]);
    expect(knowledgeBandToCanonical("6-8y")).toEqual(["6-8y"]);
    expect(toAgeBand("milestone", "nope")).toEqual([]);
  });
});

describe("B-GROWTH-27 — visit schedules are data only, unreviewed", () => {
  it("IL Tipat Halav and NL JGZ ages ascend and join to canonical bands", () => {
    for (const s of Object.values(VISIT_SCHEDULES)) {
      expect(s.reviewed).toBe(false);
      const a = [...s.visitAgesMonths];
      expect(a).toEqual([...a].sort((x, y) => x - y));
    }
    expect(nextVisitMonths("il-tipat-halav", 5)).toBe(6);
    expect(nextVisitMonths("il-tipat-halav", 40)).toBeNull();
    expect(visitBands("nl-jgz").find((v) => v.months === 45)?.band).toBe("36m");
  });
});
