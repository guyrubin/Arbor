import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { translate } from "./i18n";
import { ALL_MILESTONES, ASHA_MILESTONES, CDC_MILESTONES, CDC_2022_SOURCE, RETIRED_MILESTONE_IDS, milestoneBandLabel } from "./milestoneData";
import { milestoneAgeLine, milestoneSource } from "./milestoneAgeLine";
import { contentCitedSourceUrls, citedSourceUrls } from "./citedSources";
import type { Milestone } from "../types";

/**
 * B-LOOP-01 — the one parent-facing age sentence (lib/milestoneAgeLine.ts).
 *  1) CDC rows → "most children by" with the band label, EN + HE.
 *  2) "range" renders "between {from} and {to}" ONLY with a cited page and
 *     the bracket the page prints (ruling 6 Oct); the six ASHA rows are
 *     "unstated" (no printed range citable offline) → no line.
 *  3) average_onset / unstated → null; parent-added / retired rows → null.
 *  4) FIREWALL: the sentence is identical for yes / not_sure / not_yet, and
 *     no rendered sentence (every row, both locales) carries a verdict word.
 *  5) The sources reach the cited-sources list the Trust/Science page counts.
 */

const tEn = (key: string, vars?: Record<string, string | number>) => translate("en", key, vars);
const tHe = (key: string, vars?: Record<string, string | number>) => translate("he", key, vars);
const FORBIDDEN = ["late", "delay", "behind", "should", "מאחר", "עיכוב", "צריך"];

const byId = (id: string): Milestone => {
  const m = ALL_MILESTONES.find((x) => x.id === id);
  if (!m) throw new Error(`no catalogue row ${id}`);
  return m;
};

describe("B-LOOP-01 — CDC rows: 'most children do this by {band}'", () => {
  it("EN + HE for a 2-year row print the band label", () => {
    const m = byId("cdc-24m-3");
    expect(milestoneAgeLine(m, tEn)).toBe("Most children do this by 2 years");
    expect(milestoneAgeLine(m, tHe)).toBe("רוב הילדים עושים זאת עד גיל שנתיים");
  });

  it("an infant row prints months; a 30-month row prints the band's own label", () => {
    expect(milestoneAgeLine(byId("cdc-9m-1"), tEn)).toBe("Most children do this by 9 months");
    expect(milestoneAgeLine(byId("cdc-9m-1"), tHe)).toBe("רוב הילדים עושים זאת עד גיל 9 חודשים");
    expect(milestoneAgeLine(byId("cdc-30m-1"), tHe)).toBe("רוב הילדים עושים זאת עד גיל שנתיים וחצי");
    expect(milestoneAgeLine(byId("cdc-60m-8"), tEn)).toBe("Most children do this by 5 years");
  });

  it("every CDC row's {age} is exactly its band label (never raw months)", () => {
    for (const m of CDC_MILESTONES) {
      for (const [t, lang] of [[tEn, "en"], [tHe, "he"]] as const) {
        const line = milestoneAgeLine(m, t);
        expect(line, `${m.id} ${lang}`).toBe(t("ms.age.mostBy", { age: milestoneBandLabel(m.ageMonths as number, t) }));
      }
    }
  });
});

/** Run `fn` with a catalogue row's source swapped (the builder resolves by id). */
const withSource = (id: string, source: Milestone["source"], fn: (m: Milestone) => void) => {
  const real = byId(id);
  const saved = real.source;
  try {
    real.source = source;
    fn(real);
  } finally {
    real.source = saved;
  }
};

describe("B-LOOP-01 — 'usually between {from} and {to}' only over a range the source PRINTS", () => {
  const PRINTED = { org: "ASHA" as const, title: "Communication Milestones (2023)", url: "https://www.asha.org/public/developmental-milestones/", year: 2023, ageSemantics: "range" as const };

  it("a cited printed bracket renders in both languages (native Hebrew prefix join)", () => {
    withSource("asha-comm-48m", { ...PRINTED, rangeMonths: [36, 48], printedRange: "3 to 4 years" }, (m) => {
      expect(milestoneAgeLine(m, tEn)).toBe("Usually between 3 years and 4 years");
      expect(milestoneAgeLine(m, tHe)).toBe("בדרך כלל בין 3 שנים ל-4 שנים");
    });
    withSource("asha-feed-9m", { ...PRINTED, rangeMonths: [9, 12], printedRange: "7 to 12 months" }, (m) => {
      expect(milestoneAgeLine(m, tHe)).toBe("בדרך כלל בין 9 חודשים לשנה");
    });
    withSource("asha-comm-24m", { ...PRINTED, rangeMonths: [24, 30], printedRange: "x" }, (m) => {
      expect(milestoneAgeLine(m, tHe)).toBe("בדרך כלל בין שנתיים לשנתיים וחצי");
    });
  });

  it("GUARD: a range without the printed bracket or without the cited page renders nothing", () => {
    withSource("asha-comm-48m", { ...PRINTED, rangeMonths: [36, 48] }, (m) => {
      expect(milestoneAgeLine(m, tEn)).toBeNull();
    });
    withSource("asha-comm-48m", { ...PRINTED, url: undefined, rangeMonths: [36, 48], printedRange: "3 to 4 years" }, (m) => {
      expect(milestoneAgeLine(m, tEn)).toBeNull();
    });
  });

  it("GUARD: every catalogue range row carries its cited page and printed bracket", () => {
    for (const m of ALL_MILESTONES) {
      if (m.source?.ageSemantics !== "range") continue;
      expect(m.source.url, m.id).toMatch(/^https:\/\//);
      expect(m.source.printedRange?.trim(), m.id).toBeTruthy();
    }
  });

  it("the six ASHA rows are 'unstated' today: no age line, both languages", () => {
    for (const m of ASHA_MILESTONES) {
      expect(m.source?.ageSemantics, m.id).toBe("unstated");
      expect(milestoneAgeLine(m, tEn), m.id).toBeNull();
      expect(milestoneAgeLine(m, tHe), m.id).toBeNull();
    }
  });
});

describe("B-LOOP-01 — what is never said", () => {
  it("average_onset → null (an average invites comparison)", () => {
    withSource("cdc-24m-3", { ...CDC_2022_SOURCE, ageSemantics: "average_onset" }, (m) => {
      expect(milestoneAgeLine(m, tEn)).toBeNull();
      expect(milestoneAgeLine(m, tHe)).toBeNull();
    });
  });

  it("a parent-added row and a retired Arbor row have no age line", () => {
    const custom: Milestone = { id: "ms-1700000000000", domain: "social_development", ageGroup: "Custom", ageMonths: 24, title: "Says savta", description: "x", checked: false, custom: true };
    expect(milestoneAgeLine(custom, tEn)).toBeNull();
    expect(milestoneSource(custom)).toBeNull();
    for (const id of RETIRED_MILESTONE_IDS) expect(milestoneAgeLine({ id }, tEn), id).toBeNull();
  });

  it("a stored doc without a source still resolves from the catalogue by id", () => {
    const { source: _drop, ...stored } = byId("cdc-12m-3");
    expect(milestoneAgeLine(stored as Milestone, tEn)).toBe("Most children do this by 12 months");
  });

  it("FIREWALL: identical sentence for yes / not_sure / not_yet, every row, both locales", () => {
    for (const m of ALL_MILESTONES) {
      for (const t of [tEn, tHe]) {
        const lines = (["yes", "not_sure", "not_yet"] as const).map((status) =>
          milestoneAgeLine({ ...m, observationStatus: status, checked: status === "yes" } as Milestone, t),
        );
        expect(new Set(lines).size, m.id).toBe(1);
        if (m.source?.org === "CDC") expect(lines[0], `${m.id} has a line`).not.toBeNull();
      }
    }
  });

  it("FIREWALL: no rendered sentence carries a verdict word (every row, both locales)", () => {
    const hits: string[] = [];
    for (const m of ALL_MILESTONES) {
      for (const t of [tEn, tHe]) {
        const line = (milestoneAgeLine(m, t) ?? "").toLowerCase();
        for (const w of FORBIDDEN) if (line.includes(w)) hits.push(`${m.id}: "${w}" in ${line}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the builder never reads observation state (source scan)", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "milestoneAgeLine.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/observationStatus|\.checked\b/);
  });
});

describe("B-LOOP-01 — the sources reach the cited-sources list (Science / Trust page count)", () => {
  it("contentCitedSourceUrls carries the CDC 2022 and ASHA 2023 documents", () => {
    const urls = contentCitedSourceUrls();
    expect(urls).toContain("https://www.cdc.gov/act-early/milestones/index.html");
    expect(urls).toContain("https://www.asha.org/public/developmental-milestones/");
    expect(citedSourceUrls()).toContain("https://www.asha.org/public/developmental-milestones/");
  });

  it("grep pin: citedSources.ts reads each catalogue row's source", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "citedSources.ts"), "utf8");
    expect(src).toMatch(/milestone\.source\?\.url/);
  });
});
