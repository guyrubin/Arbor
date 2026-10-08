import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";
import { loopFirewallHits } from "../../lib/loop/firewall";

/* P5 critic round 1 on #/milestones (product G0 P0 · design P0 · P1s) and
   the clinical pre-review's Notice-card line. Source pins on the route. */

const here = path.dirname(fileURLToPath(import.meta.url));
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "");
const MS = strip(readFileSync(path.join(here, "MilestonesTab.tsx"), "utf8").replace(/\r\n/g, "\n"));
const CARD = strip(readFileSync(path.join(here, "..", "loop", "NoticeCard.tsx"), "utf8").replace(/\r\n/g, "\n"));

describe("P0 — the ONLY age text on #/milestones is milestoneAgeLine's sourced sentence", () => {
  it("no 'Age:' chip, no age-group suffix on search rows; milestoneAgeGroupText only feeds the Ask seed (never rendered)", () => {
    expect(MS).not.toContain('t("ms.age")');
    expect(MS).not.toMatch(/·\s*\{milestoneAgeGroupText\(/);
    const uses = MS.split("milestoneAgeGroupText(").length - 1;
    expect(uses).toBe(1);
    const at = MS.indexOf("milestoneAgeGroupText(item, t)");
    expect(MS.lastIndexOf("seedCoach({", at)).toBeGreaterThan(MS.lastIndexOf("});", at));
    // the Notice card prints the sourced line and nothing else about age
    expect(CARD).toContain("const ageLine = milestoneAgeLine(milestone, t);");
    expect(CARD).not.toMatch(/ageGroup|ageMonths|milestoneBandLabel/);
  });
});

describe("P1 — one answer grammar on the route", () => {
  it("every answer group is the ONE segmented control (yes · not_yet · not_sure); the old 11 px trio is gone", () => {
    expect(MS).not.toMatch(/grid grid-cols-3 gap-1\.5 pt-2/);
    expect(MS).not.toContain('["not_sure", t("ms.observe.notSure")]');
    // B-DESIGN-03: the custom rows and the latest's Change answer through
    // SegmentedAnswers; every NoticeCard on the route passes answers="segmented".
    expect(MS.match(/<SegmentedAnswers\b/g)?.length).toBe(2);
    expect(MS).not.toMatch(/<NoticeAnswers\b/);
    expect(MS.match(/<NoticeCard\b/g)?.length).toBe(MS.match(/answers="segmented"/g)?.length);
    expect(CARD).toContain('export const NOTICE_ANSWER_ORDER: readonly ObserveStatus[] = ["yes", "not_yet", "not_sure"];');
  });
  it("the Notice card mounts as a ROW inside the map, the shelf named once, the stamp on the answers", () => {
    expect(MS).toMatch(/<NoticeCard[\s\S]{0,300}variant="row"\s*hideShelf/);
    expect(MS).not.toMatch(/<div[^>]*"data-primary-move"/);
    expect(CARD).toContain('{...(attrs ?? {})}');
  });
  it("NoticeCard sits on the --t-* scale and the radius tokens (no 12.5/13/14 px, no rounded-[18px])", () => {
    expect(CARD).not.toMatch(/text-\[(?:12\.5|13|14)px\]|rounded-\[18px\]/);
    expect(MS).not.toContain("rounded-[13px]");
  });
});

describe("P0 (design) — the move first at 375", () => {
  it("the latest sentence is the lede; the disclaimer is one line under the map; Born early follows the map; search is an icon", () => {
    expect(MS).not.toContain('t("ms.subtitle")');
    expect(MS.indexOf('data-testid="ms-latest"')).toBeLessThan(MS.indexOf('data-module="milestones-spine"'));
    expect(MS).toContain('data-testid="ms-footer"');
    expect(MS.indexOf("<BornEarlyFrame")).toBeGreaterThan(MS.indexOf('data-testid="ms-shelf-map"'));
    expect(MS).toContain('data-testid="ms-search-open"');
    expect(MS).toMatch(/\{\(searchOpen \|\| !!query\) && \(/);
    expect(MS).toContain('className="field-bare');
  });
  it("a shelf with no catalogue row never says 'No milestones on this shelf': its shelf-level practice, no door (framer ruling 2)", () => {
    expect(MS).not.toContain('t("elev.loop.shelf.none")');
    expect(MS).toContain('data-testid="ms-shelf-try"');
    expect(MS).toContain("p.milestoneId !== null || p.shelf !== shelf");
  });
});

describe("clinical pre-review (HIGH) — the Not-yet line never reassures against act-early", () => {
  it("the old sentence is gone in both languages; the new one points to the next check-up, EN exact", () => {
    expect(translate("en", "elev.loop.notice.thanks")).toBe("Noted. If it's still not there by the next check-up, it's worth mentioning there.");
    for (const lang of ["en", "he"] as const) {
      const v = translate(lang, "elev.loop.notice.thanks");
      expect(v).not.toMatch(/no need|everyday play is enough|אין צורך|מספיק/i);
      expect(loopFirewallHits(v)).toEqual([]);
    }
  });
});
