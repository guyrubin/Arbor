/**
 * B-INF-10 grep-pin — no chooser does its own age arithmetic.
 *
 * The child's age is read ONCE, in lib/age/* (bandFor · ageMonthsOf ·
 * ageYearsOf · fits) on top of lib/domains/ageBands (the canonical registry).
 * Outside those two folders no source file may:
 *   A. compare `ageInMonths` / `ageYears` against a number or another bound;
 *   B. rebuild months from the legacy whole-years field
 *      (`(profile.age || 0) * 12`, `Math.max(0, profile.age) * 12`);
 *   C. read the legacy whole-years `childProfile.age` in a content chooser
 *      (Today, Daily Play, Journal prompts, Learn, Milestones, Development
 *      Check, Routines, Tonight, the practice parent side).
 *
 * Shrink-only allow-list: each entry names a file this item may not or need
 * not change and why. An entry whose file no longer offends fails the test.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__snapshots__") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !/\.d\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/** A. a comparison on either side of ageInMonths / ageYears. */
export const COMPARE_AFTER = /\b(?:ageInMonths|ageYears)\b\s*(?:<=|>=|<(?![<=])|>(?![>=]))/;
export const COMPARE_BEFORE = /(?:<=|>=|(?<![=<])<|(?<![=>-])>)\s*(?:[\w$]+\.)*(?:ageInMonths|ageYears)\b/;
/** B. months rebuilt from the whole-years field. */
export const YEARS_TO_MONTHS = /(?:\(\s*[\w$.]+\.age\s*(?:\|\||\?\?)\s*0\s*\)|Math\.max\(\s*0\s*,\s*[\w$.]+\.age\s*\))\s*\*\s*12/;
/** C. the legacy whole-years field read by a chooser. */
export const LEGACY_YEARS_READ = /\b(?:childProfile|activeChild)\.age\b(?![\w$])/;

/** Folders that own age arithmetic. */
const OWNERS = ["lib/age/", "lib/domains/", "lib/childAge.ts"];

/** Kids sessions own the kid register (components/kidmode/*); this item does not touch it. */
const FOREIGN = ["components/kidmode/"];

/** The content choosers (the item's list) — rule C applies here. */
export const CHOOSERS = [
  "components/tabs/OverviewTab.tsx",
  "components/overview/useCompanionOffer.ts",
  "components/tabs/DailyPlayTab.tsx",
  "components/tabs/JournalTab.tsx",
  "components/tabs/MilestonesTab.tsx",
  "components/tabs/DevelopmentTab.tsx",
  "components/sections/Screening.tsx",
  "components/sections/DayWindowsPanel.tsx",
  "components/sections/SmartRemindersPanel.tsx",
  "components/tabs/StoryTimelineTab.tsx",
  "components/practice/AdventuresTab.tsx",
  "components/practice/WordWorldTab.tsx",
  "components/practice/SpeechCoachTab.tsx",
  "components/practice/MindVaultWorld.tsx",
  "components/practice/SpellForgeWorld.tsx",
  "components/practice/JourneyTab.tsx",
  "components/practice/DevelopmentCopilot.tsx",
  "lib/pulse.ts",
];

/**
 * Shrink-only: the two scheme selectors lib/domains/ageBands mirrors month by
 * month (ageBands.test.ts fails the moment they disagree with the registry) —
 * they ARE the legacy schemes the registry looks up, not choosers.
 */
const ALLOWED: ReadonlyArray<{ file: string; why: string }> = [
  { file: "playbank/content.ts", why: "play scheme selector (bandForAge) mirrored by lib/domains/ageBands.test.ts" },
  { file: "practice/wordWorld.ts", why: "language scheme selector (ageBandForAge) mirrored by lib/domains/ageBands.test.ts" },
];

function offenders(): { file: string; line: string; rule: string }[] {
  const out: { file: string; line: string; rule: string }[] = [];
  for (const full of walk(SRC)) {
    const rel = path.relative(SRC, full).replace(/\\/g, "/");
    if (OWNERS.some((o) => rel.startsWith(o)) || FOREIGN.some((f) => rel.startsWith(f))) continue;
    const code = stripComments(readFileSync(full, "utf8"));
    for (const line of code.split(/\r?\n/)) {
      if (COMPARE_AFTER.test(line) || COMPARE_BEFORE.test(line)) out.push({ file: rel, line: line.trim(), rule: "A" });
      else if (YEARS_TO_MONTHS.test(line)) out.push({ file: rel, line: line.trim(), rule: "B" });
      else if (CHOOSERS.includes(rel) && LEGACY_YEARS_READ.test(line)) out.push({ file: rel, line: line.trim(), rule: "C" });
    }
  }
  return out;
}

describe("B-INF-10 · no local age math outside lib/age and lib/domains", () => {
  it("negative controls: the shapes this guard exists for are caught", () => {
    expect(COMPARE_AFTER.test("const isUnder3 = ageYears < 3;")).toBe(true);
    expect(COMPARE_AFTER.test("if (ctx.ageYears >= card.ageMin) {")).toBe(true);
    expect(COMPARE_BEFORE.test("ctx.ageYears >= 1 && 2 <= ctx.ageYears")).toBe(true);
    expect(COMPARE_BEFORE.test("if (3 > args.ageInMonths) return")).toBe(true);
    expect(YEARS_TO_MONTHS.test("ageMonthsFromProfile(p) ?? Math.round((childProfile.age || 0) * 12)")).toBe(true);
    expect(YEARS_TO_MONTHS.test("?? Math.max(0, profile.age) * 12;")).toBe(true);
    expect(LEGACY_YEARS_READ.test("selectDailyPlay({ ageYears: childProfile.age })")).toBe(true);
    // not age math: an arrow, a type, a months field, a destructure
    expect(COMPARE_BEFORE.test("(p) => ageYears")).toBe(false);
    expect(COMPARE_AFTER.test("ageYears: number;")).toBe(false);
    expect(LEGACY_YEARS_READ.test("childProfile.ageMonths")).toBe(false);
  });

  it("every chooser named by the item exists (the list is real)", () => {
    for (const rel of CHOOSERS) expect(() => statSync(path.join(SRC, rel)), rel).not.toThrow();
  });

  it("no offender outside the owners and the shrink-only allow-list", () => {
    const found = offenders().filter((o) => !ALLOWED.some((a) => a.file === o.file));
    expect(found.map((o) => `${o.rule} ${o.file}: ${o.line}`), "local age math — read the age through lib/age/forChild").toEqual([]);
  });

  it("the allow-list only shrinks: every entry still offends", () => {
    const files = new Set(offenders().map((o) => o.file));
    for (const a of ALLOWED) expect(files.has(a.file), `${a.file} no longer offends — delete its entry`).toBe(true);
    expect(ALLOWED.length).toBeLessThanOrEqual(2);
  });
});
