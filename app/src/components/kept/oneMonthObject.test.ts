import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..", "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const files = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap(file => file.isDirectory() ? files(path.join(dir, file.name)) : /\.tsx?$/.test(file.name) && !/\.test\./.test(file.name) ? [path.join(dir, file.name)] : []);
const retiredImport = /import\s[^;]*\b(?:MonthInReview|MonthKeepsake|FirstMonthKeepsakeRow|buildFirstMonthKeepsake)\b[^;]*;/g;

describe("one active month object", () => {
  it("has no retired month importer in components", () => {
    const sourceFiles = files(path.join(root, "components"));
    expect(sourceFiles.length).toBeGreaterThan(50);
    expect(sourceFiles.filter(file => fs.readFileSync(file, "utf8").match(retiredImport))).toEqual([]);
  });
  it("catches the exact pre-retirement imports (non-vacuous guard)", () => {
    for (const source of ['import MonthInReview from "../growth/MonthInReview";', 'import MonthKeepsake from "../weekly/MonthKeepsake";', 'import { buildFirstMonthKeepsake } from "../../lib/firstMonthKeepsake";']) expect(source.match(retiredImport)).toHaveLength(1);
  });
  it("preserves Timeline's MonthsSpine and the current My child disclosure", () => {
    expect(read("components/tabs/StoryTimelineTab.tsx")).toContain("<MonthsSpine");
    expect(read("components/companion/ChildPortrait.tsx")).toContain("<PortraitKeepsakes />");
    expect(read("components/companion/PortraitKeepsakes.tsx")).toContain("<KeptThingsPage key={childProfile.id} />");
  });
  it("uses read-only history, explicit pagination, and no write/migration/provider calls", () => {
    const reader = read("components/kept/KeptThingsPage.tsx");
    expect(reader.match(/useChildHistory</g)).toHaveLength(4);
    expect(reader).toContain("loading || error || !confirmed || more");
    expect(reader).toContain("source.loadMore()");
    expect(reader).not.toMatch(/useChildCollection|\.upsert\(|\.remove\(|\.replaceAll\(|localStorage\.set|migrate|fetch\(/);
    // That editor's collection reader has no confirmed-snapshot metadata.
    // Do not add a new Send action there until it shares this guarded path.
    expect(read("components/tabs/MilestonesTab.tsx")).not.toContain("<KeptItem");
  });
});
