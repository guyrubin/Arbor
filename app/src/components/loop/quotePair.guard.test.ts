import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";

/* P7-DESIGN fix r1 (framer ruling R2; overview product P1-1, overview design
   P1-2, journal P2-I/P2-20, milestones P2-d): the family's words and the say
   carry ONE quote pair per locale — the i18n key `elev.loop.ms.quoted`
   (״…״ in Hebrew, “…” in English), as Milestones already ships. A Latin pair
   hard-coded in a parent component wraps a Hebrew sentence the wrong way round
   (the opener lands at the visual end). This guard reads the parent loop
   surfaces' SOURCE (comments stripped) and fails on any “ ” „ in code. */

const here = path.dirname(fileURLToPath(import.meta.url));
const components = path.join(here, "..");
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const FILES = [
  ...["loop", "journal", "overview"].flatMap((dir) =>
    readdirSync(path.join(components, dir)).filter((f) => f.endsWith(".tsx") && !/\.test\./.test(f)).map((f) => path.join(dir, f)),
  ),
  path.join("tabs", "OverviewTab.tsx"),
  path.join("tabs", "MilestonesTab.tsx"),
];
const LATIN_QUOTES = /[\u201C\u201D\u201E]/;
export function hardCodedQuotes(src: string): string[] {
  return strip(src).split("\n").filter((l) => LATIN_QUOTES.test(l)).map((l) => l.trim());
}

describe("R2 · one quote pair per locale on the parent loop surfaces", () => {
  it("the key: EN “…”, HE ״…״", () => {
    expect(translate("en", "elev.loop.ms.quoted", { text: "x" }).replace(/[\u2068\u2069]/g, "")).toBe("\u201Cx\u201D");
    expect(translate("he", "elev.loop.ms.quoted", { text: "x" }).replace(/[\u2068\u2069]/g, "")).toBe("\u05F4x\u05F4");
  });

  it("no parent loop component hard-codes “ ” „ (Today, Tonight, the Notice card, Journal grid + shelf page, Milestones)", () => {
    expect(FILES.length).toBeGreaterThan(15);
    const hits = FILES.flatMap((f) => hardCodedQuotes(readFileSync(path.join(components, f), "utf8")).map((l) => `${f}: ${l}`));
    expect(hits).toEqual([]);
  });

  it("every named quote site renders through the key", () => {
    const src = (f: string) => readFileSync(path.join(components, f), "utf8");
    const KEY = 't("elev.loop.ms.quoted", { text: ';
    expect(src("loop/PracticeCard.tsx").split(KEY).length - 1).toBe(2); // the parent's words + the say
    expect(src("loop/TonightFlow.tsx").split(KEY).length - 1).toBe(1);
    expect(src("loop/NoticeCard.tsx").split(KEY).length - 1).toBe(2); // the receipt beside the words + the kept line
    expect(src("journal/ShelfGrid.tsx").split(KEY).length - 1).toBe(2); // the header line + the tile quote
    expect(src("journal/ShelfPage.tsx").split(KEY).length - 1).toBe(2); // the say + the entry rows' words
  });

  it("the Hebrew loop strings shown on Today / Milestones use ״…״ too (no „…”)", () => {
    for (const key of ["elev.loop.ms.firstCard", "elev.loop.practice.why", "elev.loop.tonight.day.fromMoment"]) {
      expect(translate("he", key, { name: "D", title: "x", shelf: "s", moment: "m" }), key).not.toMatch(LATIN_QUOTES);
    }
  });

  it("NEGATIVE CONTROL: the shipped PracticeCard say line trips the guard; a comment does not", () => {
    expect(hardCodedQuotes("          <FreeText text={`\u201C${sayText}\u201D`} />")).toHaveLength(1);
    expect(hardCodedQuotes("// the say in \u201C\u2026\u201D was the old shape")).toEqual([]);
  });
});
