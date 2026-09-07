import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { recommend } from "../practice/signals";
import { composeWeek } from "../practice/journey";
import type { DomainBand } from "../practice/signals";
import type { MissionRecord, PracticeDomain } from "../types";

/* OBJ-GROWTH-05 — law 1 bans weakest-domain pointers, and three surfaces
   printed one anyway at 7208d0db:
     · #/copilot   "This is currently the area with the least practice signal"
                   (signals.ts:633) — identical at day-0, where there was no
                   signal for anything to be least of.
     · #/journey   "Focus: Language" from recommend()'s lowest-band-wins, and
                   the aimed extras laid out weakest-first (journey.ts:57-58).
     · #/masterclasses  "A good place to explore next" / "A great area to
                   nurture this week: <lowest-share domain>", rendered against
                   0 noticed milestones and 0 logs.

   The ranking may still ORDER things internally. It may never be named, and it
   may no longer decide the pick. Guarded in two ways: a dictionary/source scan
   over the files this branch owns, and behaviour — recommend() and composeWeek()
   must return the same thing whatever the bands say. */

const SRC = path.resolve(__dirname, "..");
const POINTER = /least practice|weakest|lowest[ -](band|share|scoring)|explore next/i;

/** Files this item owns. lib/i18n.ts still carries the retired `foryou.header`
 *  / `hub.scholar.domainLabel` VALUES; nothing renders them any more, and their
 *  deletion is filed in FOLLOW-UPS.md (that file belongs to another builder). */
function scanTargets(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const elevDir = path.join(SRC, "lib", "i18nElevation");
  for (const f of readdirSync(elevDir)) {
    if (f.endsWith(".ts") && !f.endsWith(".test.ts")) {
      out.push({ name: `i18nElevation/${f}`, text: readFileSync(path.join(elevDir, f), "utf8") });
    }
  }
  const practiceDir = path.join(SRC, "practice");
  for (const f of readdirSync(practiceDir)) {
    if (f.endsWith(".ts") && !f.endsWith(".test.ts")) {
      out.push({ name: `practice/${f}`, text: readFileSync(path.join(practiceDir, f), "utf8") });
    }
  }
  for (const rel of [
    ["components", "sections", "AcademyForYou.tsx"],
    ["components", "sections", "ScholarHubCard.tsx"],
    ["components", "practice", "DevelopmentCopilot.tsx"],
  ]) {
    out.push({ name: rel.join("/"), text: readFileSync(path.join(SRC, ...rel), "utf8") });
  }
  return out;
}

/** Comments explain the retired defect by name; only what ships counts. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const band = (domain: PracticeDomain, signal: number): DomainBand => ({
  domain,
  signal,
  band: signal < 40 ? "emerging" : "strong",
  basis: [],
});
const ALL_BANDS = (weakest: PracticeDomain): DomainBand[] =>
  (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[]).map((d) =>
    band(d, d === weakest ? 1 : 90),
  );
const mission = (domain: PracticeDomain, n: number): MissionRecord[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `m-${domain}-${i}`,
    missionId: "x",
    domain,
    date: "2026-09-01",
    timestamp: "2026-09-01T10:00:00.000Z",
    completed: true,
  })) as unknown as MissionRecord[];

describe("OBJ-GROWTH-05 (a) — no pointer word ships", () => {
  it("no owned source file names a ranking of the child's areas", () => {
    const offenders = scanTargets()
      .map(({ name, text }) => ({ name, hits: stripComments(text).match(new RegExp(POINTER, "gi")) ?? [] }))
      .filter((f) => f.hits.length > 0);
    expect(offenders).toEqual([]);
  });

  it("NEGATIVE CONTROL — the pre-fix strings all trip the same scan", () => {
    const preFix = [
      "This is currently the area with the least practice signal. Small daily reps move it fastest.",
      '"foryou.header": "A good place to explore next",',
      "// Day-domain layout: focus on Mon/Wed/Sat; others fill the rest, weakest first.",
      "picks the lowest-scoring domain via focusDomain",
    ];
    for (const line of preFix) expect(POINTER.test(line)).toBe(true);
  });
});

describe("OBJ-GROWTH-05 (b) — the pick no longer follows the band", () => {
  it("recommend() returns the same domain whichever domain is weakest", () => {
    const picks = (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[]).map(
      (weakest) => recommend(ALL_BANDS(weakest), []).domain,
    );
    expect(new Set(picks).size).toBe(1);
  });

  it("the charter aim the caller passes wins, and practice breaks the tie", () => {
    expect(recommend(ALL_BANDS("language"), [], ["social"]).domain).toBe("social");
    expect(recommend(ALL_BANDS("language"), mission("emotional", 3)).domain).toBe("emotional");
  });

  it("the why-line is an i18n key, and day-0 gets its own", () => {
    expect(recommend(ALL_BANDS("language"), []).whyKey).toBe("elev.growthTruth.focus.why.day0");
    expect(recommend(ALL_BANDS("language"), mission("social", 1)).whyKey).toBe(
      "elev.growthTruth.focus.why.practised",
    );
  });

  it("composeWeek lays the aimed extras out identically whatever the bands say", () => {
    const rec = recommend(ALL_BANDS("language"), []);
    const a = composeWeek(ALL_BANDS("social"), rec, "2026-09-07");
    const b = composeWeek(ALL_BANDS("emotional"), rec, "2026-09-07");
    expect(a.map((d) => d.extra.title)).toEqual(b.map((d) => d.extra.title));
  });

  it("NEGATIVE CONTROL — the pre-fix selectors are band-driven", () => {
    const preFixRecommend = (bands: DomainBand[]) => [...bands].sort((x, y) => x.signal - y.signal)[0].domain;
    expect(preFixRecommend(ALL_BANDS("social"))).toBe("social");
    expect(preFixRecommend(ALL_BANDS("emotional"))).toBe("emotional");
    const preFixOthers = (bands: DomainBand[], focus: PracticeDomain) =>
      (["language", "speech", "cognition", "social", "emotional"] as PracticeDomain[])
        .filter((d) => d !== focus)
        .sort((x, y) => (bands.find((b) => b.domain === x)?.signal ?? 50) - (bands.find((b) => b.domain === y)?.signal ?? 50));
    expect(preFixOthers(ALL_BANDS("social"), "language")[0]).toBe("social");
  });
});
