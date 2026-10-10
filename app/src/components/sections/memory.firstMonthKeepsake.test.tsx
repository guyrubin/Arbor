import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { todayLiveSource } from "../../testTodaySource";
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
const retired = /FirstMonthKeepsakeRow|<MonthKeepsake\b|memory-first-month|l4-month-lines/;

describe("one month page replaces Memory's legacy count keepsakes", () => {
  it("Memory and Now no longer mount either old month object", () => {
    expect(read("components/sections/ChildMemory.tsx")).not.toMatch(retired);
    expect(todayLiveSource()).not.toMatch(retired);
  });
  it("preserves the unrelated quotes, firsts, and memory disclosures", () => {
    const source = read("components/sections/ChildMemory.tsx");
    for (const token of ["<ThingsSaid ", "<FirstsMoment />", "<ArborKnowsTile />", 'data-module-disclosure="memory-more"']) expect(source).toContain(token);
  });
  it("negative controls catch the exact former mounts", () => {
    expect("<FirstMonthKeepsakeRow />").toMatch(retired);
    expect("<MonthKeepsake />").toMatch(retired);
  });
});
