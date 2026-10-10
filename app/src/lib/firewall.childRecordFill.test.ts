/**
 * B-GROWTH-07 — CLINICAL FIREWALL clause: "no proportional fill of a child
 * record" (PAI/projects/arbor/reference/ui-enforcement-and-audit.md).
 *
 * The Milestones Development Map drew the child's checked/total as a ring
 * (`RadialProgress`) and every domain as a fill bar (`ProgressBar`). A fill is
 * a proportion, and a proportion of a child's record reads as a grade however
 * the label is worded. The count stays; the fill goes.
 *
 * Source scan, because the shape is the defect: a render test passes as
 * happily against a second bar under a different name.
 *
 * Allow-list (not scanned): `RoutinesTab.tsx` step progress — a PARENT task,
 * not a child record.
 * Known violations (scanned, owned by other lanes, must STILL violate until
 * that lane clears them — then delete the entry so the guard tightens):
 *   - none. AcademyForYou's RadialProgress + ProgressBar were cleared by
 *     B-PLAY-01 (lane SHELLPLAY); the file is now scanned clean.
 * `components/sections/ChildProfile.tsx` (`width: ${windowRecord.share}%`) is
 * scanned CLEAN: the Profile lane removes that bar in its own commit.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** RadialProgress / ProgressBar as JSX or import, or an inline `width: `${…}%``. */
const FILL_PATTERNS: [string, RegExp][] = [
  ["RadialProgress", /\bRadialProgress\b/],
  ["ProgressBar", /\bProgressBar\b/],
  ["width %-template", /width:\s*`\$\{[^`]*\}%`/],
];

const growthDir = path.join(SRC, "components", "growth");
const GROWTH_FILES = fs.existsSync(growthDir)
  ? fs.readdirSync(growthDir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f)).map((f) => `components/growth/${f}`)
  : [];

const SCANNED = [
  "components/tabs/MilestonesTab.tsx",
  "components/companion/ChildPortrait.tsx",
  "components/companion/PortraitWatchRow.tsx",
  "components/companion/PortraitKeepsakes.tsx",
  ...GROWTH_FILES,
  "components/sections/ChildProfile.tsx",
  "components/consult/PracticeSummary.tsx",
  "components/sections/AcademyForYou.tsx",
];

const KNOWN_VIOLATIONS = new Set<string>([]);

const violationsIn = (rel: string) => {
  const src = stripComments(read(rel));
  return FILL_PATTERNS.filter(([, re]) => re.test(src)).map(([name]) => name);
};

describe("B-GROWTH-07 — no proportional fill of a child record", () => {
  it("scans a non-empty growth component set", () => {
    expect(GROWTH_FILES.length).toBeGreaterThan(0);
  });

  /* B-GROWTH-30 — the record by area is covered BEFORE it renders (spine §9
     verdict creep): no fill, no fraction of a total, no chart, and its strings
     carry counts of noticed things only. */
  it("covers the record by area (the child portrait's area lens, which replaced RecordByDomain)", () => {
    expect(SCANNED).toContain("components/companion/ChildPortrait.tsx");
    const src = stripComments(read("components/companion/ChildPortrait.tsx"));
    expect(src).not.toMatch(/\btotal\b|%|Chart|<svg/);
    expect(src).not.toMatch(/sort\([^)]*count/);
  });

  it("the Record-by-area strings name no total, share or trend (EN + HE)", () => {
    const growth = read("lib/i18nElevation/growth.ts");
    const lines = growth.split("\n").filter((l) => l.includes("elev.growth.record."));
    expect(lines.length).toBeGreaterThanOrEqual(26);
    for (const l of lines) {
      expect(l).not.toMatch(/\{total\}|%|\bof \{|מתוך|more than|less than|behind|ahead|trend/i);
    }
  });

  for (const rel of SCANNED.filter((f) => !KNOWN_VIOLATIONS.has(f))) {
    it(`${rel} draws no ring, bar or %-width fill`, () => {
      expect(violationsIn(rel)).toEqual([]);
    });
  }

  it("the known violations still violate (delete the entry when the owning lane clears it)", () => {
    for (const rel of KNOWN_VIOLATIONS) expect(violationsIn(rel).length, rel).toBeGreaterThan(0);
  });

  it("the Milestones map keeps the count as text, without a /total fraction", () => {
    const ms = stripComments(read("components/tabs/MilestonesTab.tsx"));
    expect(ms).toContain('data-testid="ms-map-count"');
    // NEXTLEVEL critic r1: the headline is the unwindowed noticed count (lib/pulse).
    expect(ms).toContain('{recordCounts.noticed} {t("ms.domainOf")}');
    expect(ms).not.toContain('{s.checked}/{s.total}');
    // B-LOOP-05: the shelf row carries the noticed count per shelf, as text — never a fraction.
    expect((ms.match(/t\(n === 1 \? "elev\.loop\.shelf\.noticed\.one" : "elev\.loop\.shelf\.noticed", \{ n \}\)/g) ?? []).length).toBe(1);
    expect(ms).not.toMatch(/\{n\}\s*\/\s*\{/);
    expect(ms).not.toMatch(/\}\/\{[a-zA-Z.]+\.length\}/);
  });

  it("NEGATIVE CONTROL — the pre-fix shapes trip every pattern", () => {
    const pre = [
      "<RadialProgress value={windowChecked} total={windowTotal} tone=\"mint\" size={92} thickness={10}>",
      "<ProgressBar value={s.checked} total={s.total} tone={dv.tone} height={9} />",
      "<div style={{ width: `${windowRecord.share}%` }} />",
    ].join("\n");
    expect(FILL_PATTERNS.every(([, re]) => re.test(pre))).toBe(true);
  });
});
