import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Milestone } from "../../types";
import { translate } from "../i18n";
import { ALL_MILESTONES, bandForAgeMonths, milestoneText } from "../milestoneData";
import { SHELF_IDS } from "../shelves/registry";
import { contractFor } from "../surfaceContract";
import { noticedMilestoneCounts } from "../pulse";
import { groupMilestonesByShelf, matchesMilestoneQuery, noticedByShelf, shelfBands } from "./shelfMap";

/* B-LOOP-05 — #/milestones is the shelf map: nine shelves in registry order,
   ≤1 Notice card above each shelf's door, the door opens the shelf's bands
   (earlier first, later titles only, no answers), the only number is
   "{n} noticed", and a word search narrows across shelves (EN + HE). */

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const MS = strip(readFileSync(path.join(here, "..", "..", "components", "tabs", "MilestonesTab.tsx"), "utf8").replace(/\r\n/g, "\n"));
const catalogue = (): Milestone[] => ALL_MILESTONES.map((m) => ({ ...m }));

describe("shelf grouping and the one count", () => {
  it("every catalogue row lands on exactly one of the nine shelves", () => {
    const by = groupMilestonesByShelf(catalogue());
    expect(Object.keys(by)).toEqual([...SHELF_IDS]);
    expect(Object.values(by).reduce((n, l) => n + l.length, 0)).toBe(ALL_MILESTONES.length);
  });

  it("'{n} noticed' counts only what the parent marked Seen it", () => {
    const ms = catalogue().map((m, i) => (i < 3 ? { ...m, checked: true, observationStatus: "yes" as const } : i < 6 ? { ...m, observationStatus: "not_yet" as const } : m));
    const counts = noticedByShelf(ms);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("the shelves add up to the one noticed count Care and Growth read (one number)", () => {
    const ms = catalogue().map((m, i) => (i % 7 === 0 ? { ...m, checked: true, observationStatus: "yes" as const } : m));
    const sum = Object.values(noticedByShelf(ms)).reduce((a, b) => a + b, 0);
    expect(sum).toBe(noticedMilestoneCounts(ms).noticed);
    expect(MS).toContain("{recordCounts.noticed} {t(\"ms.domainOf\")}");
  });

  it("bands run earlier → later; above the current band is 'later' (read, never tick)", () => {
    const words = groupMilestonesByShelf(catalogue()).words;
    const bands = shelfBands(words, bandForAgeMonths(26).months);
    const months = bands.map((b) => b.months).filter((m) => m !== -1);
    expect(months).toEqual([...months].sort((a, b) => a - b));
    for (const b of bands) expect(b.later).toBe(b.months > 24);
    expect(bands.some((b) => b.later)).toBe(true);
    expect(bands.filter((b) => b.current).map((b) => b.months)).toEqual([24]);
  });
});

describe("word search across shelves (EN + HE)", () => {
  const textsOf = (m: Milestone, lang: "en" | "he") => {
    const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
    return [milestoneText(m, "title", t), milestoneText(m, "looks", t)];
  };
  it('"ball" (EN) and "כדור" (HE) narrow to the same rows, across more than one shelf', () => {
    const en = catalogue().filter((m) => matchesMilestoneQuery(textsOf(m, "en"), "ball")).map((m) => m.id);
    const he = catalogue().filter((m) => matchesMilestoneQuery(textsOf(m, "he"), "כדור")).map((m) => m.id);
    expect(en).toContain("cdc-24m-9");
    expect(en).toContain("cdc-48m-13");
    expect(he).toContain("cdc-24m-9");
    expect(he).toContain("cdc-48m-13");
    expect(en.length).toBeLessThan(ALL_MILESTONES.length / 4);
  });
  it("an empty query matches nothing (the map shows instead)", () => {
    expect(matchesMilestoneQuery(["Kicks a ball"], "   ")).toBe(false);
  });
});

describe("MilestonesTab renders the shelf map (source pins)", () => {
  it("the shelf sections run in ACTION order (critic r1): Notice-card shelves, then door-only shelves; quiet shelves close the map", () => {
    expect(MS).toContain("mapShelves.map((shelf, i) => {");
    expect(MS).toContain("...SHELF_IDS.filter((id) => noticeFor(id)),");
    expect(MS).toContain("...SHELF_IDS.filter((id) => !noticeFor(id) && shelfItems[id].length > 0),");
    expect(MS).toContain('data-testid="ms-quiet-shelves"');
    expect(MS).toContain('data-testid="ms-shelf"');
    expect(MS).toContain("selectNextMilestonesByShelf(milestones, comparisonMonths, { perShelf: 1, total: SHELF_IDS.length, now: noticeNow })");
    expect(MS.match(/<NoticeCard\b/g)?.length).toBe(1);
    expect(MS.indexOf("<NoticeCard")).toBeLessThan(MS.indexOf('data-testid="ms-shelf-door"'));
  });

  it("the door opens the shelf's bands; later bands render titles only, never answers", () => {
    expect(MS).toContain("shelfBands(shelfItems[shelf], currentBand.months)");
    const later = MS.slice(MS.indexOf("band.later ? ("), MS.indexOf(") : (", MS.indexOf("band.later ? (")));
    expect(later).toContain('data-testid="ms-later-item"');
    expect(later).not.toMatch(/<button|observeMilestone|renderItem/);
  });

  it("no denominator anywhere on the route: no x/y band fraction, no 'of {total}'", () => {
    expect(MS).not.toMatch(/\{checkedInBand\}\/\{band\.items\.length\}/);
    expect(MS).not.toMatch(/\}\/\{[a-zA-Z.]+\.length\}/);
    expect(MS).toContain('t(n === 1 ? "elev.loop.shelf.noticed.one" : "elev.loop.shelf.noticed", { n })');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.loop.shelf.noticed", { n: 4 })).toContain("4");
      expect(translate(lang, "elev.loop.shelf.noticed", { n: 4 })).not.toMatch(/ of |מתוך|\//);
    }
  });

  it("the word search filters through matchesMilestoneQuery over the page-language text", () => {
    expect(MS).toContain('data-testid="ms-search"');
    expect(MS).toContain("matchesMilestoneQuery(");
  });

  it("Law 7: the stamp and the contract move together (notice-milestone, budget 3)", () => {
    // one stamp in the source, on the first shelf's Notice card (a control-sized wrapper)
    expect(MS.match(/data-primary-move/g)?.length).toBe(1);
    // critic r1 P2-3: the stamp sits on the ANSWERS of the first Notice card, never a wrapper
    expect(MS).toContain('answersAttrs={shelf === firstNoticeShelf ? { "data-primary-move": "notice-milestone" } : undefined}');
    expect(MS).not.toContain('data-primary-move="mark-milestone"');
    const c = contractFor("milestones");
    expect(c?.primaryMove).toBe("notice-milestone");
    expect(c?.moduleBudget).toBe(3);
    expect(c?.job).toBe("See what to notice next, shelf by shelf.");
  });
});
