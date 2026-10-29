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
   surfaces' SOURCE (comments stripped) and fails on any “ ” „ in code.

   B-INF-13 (29 Oct): widened to components/ui (the shared Say-this primitive
   wrapped every script in &ldquo;…&rdquo; — backwards in Hebrew one tap before
   the capture sheet's ״…״) and to the HTML entities that spell the same pair
   (&ldquo; &rdquo; &bdquo; and their numeric forms), which the glyph scan missed. */

const here = path.dirname(fileURLToPath(import.meta.url));
const components = path.join(here, "..");
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const FILES = [
  ...["loop", "journal", "overview", "ui"].flatMap((dir) =>
    readdirSync(path.join(components, dir)).filter((f) => f.endsWith(".tsx") && !/\.test\./.test(f)).map((f) => path.join(dir, f)),
  ),
  // Parity 9 Oct: Today is NowView and the loop it runs.
  ...["NowView.tsx", "useNowLoop.ts", "NowLoopBlocks.tsx", "NowTodayLines.tsx", "NowRecommendation.tsx"].map((f) => path.join("companion", f)),
  path.join("tabs", "MilestonesTab.tsx"),
];
const LATIN_QUOTES = /[\u201C\u201D\u201E]/;
/** The same pair spelled as HTML entities (named, decimal, hex): JSX renders them as “ ” „. */
const LATIN_QUOTE_ENTITIES = /&(?:ldquo|rdquo|bdquo);|&#(?:8220|8221|8222);|&#x201[CDE];/i;
export function hardCodedQuotes(src: string): string[] {
  return strip(src).split("\n").filter((l) => LATIN_QUOTES.test(l) || LATIN_QUOTE_ENTITIES.test(l)).map((l) => l.trim());
}

describe("R2 · one quote pair per locale on the parent loop surfaces", () => {
  it("the key: EN “…”, HE ״…״", () => {
    expect(translate("en", "elev.loop.ms.quoted", { text: "x" }).replace(/[\u2068\u2069]/g, "")).toBe("\u201Cx\u201D");
    expect(translate("he", "elev.loop.ms.quoted", { text: "x" }).replace(/[\u2068\u2069]/g, "")).toBe("\u05F4x\u05F4");
  });

  it("no parent loop component hard-codes “ ” „ (Today, Tonight, the Notice card, Journal grid + shelf page, Milestones, the ui primitives)", () => {
    expect(FILES.length).toBeGreaterThan(15);
    expect(FILES).toContain(path.join("ui", "AiBlock.tsx"));
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
    // B-INF-13 r2: + the remembered-fact step ("כבר גיליתם: ״…״"), the parent's own words on Now.
    for (const key of ["elev.loop.ms.firstCard", "elev.loop.practice.why", "elev.loop.tonight.day.fromMoment", "coach.memory.factStep"]) {
      expect(translate("he", key, { name: "D", title: "x", shelf: "s", moment: "m" }), key).not.toMatch(LATIN_QUOTES);
    }
  });

  it("the remembered fact is quoted ״…״ in Hebrew (the 28 Oct „…” pair fails here)", () => {
    const he = translate("he", "coach.memory.factStep", { fact: "x" }).replace(/[\u2068\u2069]/g, "");
    expect(he).toContain("\u05F4x\u05F4");
    expect(he).not.toMatch(LATIN_QUOTES);
  });

  it("NEGATIVE CONTROL: the shipped PracticeCard say line trips the guard; a comment does not", () => {
    expect(hardCodedQuotes("          <FreeText text={`\u201C${sayText}\u201D`} />")).toHaveLength(1);
    expect(hardCodedQuotes("// the say in \u201C\u2026\u201D was the old shape")).toEqual([]);
  });

  it("NEGATIVE CONTROL (B-INF-13): the shipped Say-this line, spelled in entities, trips the widened guard", () => {
    const say = readFileSync(path.join(components, "ui", "AiBlock.tsx"), "utf8");
    expect(hardCodedQuotes(say)).toEqual([]);
    // Put the 28 Oct shape back into the real source: the guard must see it.
    const shipped = say.replace(">{quoted}</p>", ">&ldquo;{text}&rdquo;</p>");
    expect(shipped).not.toBe(say);
    expect(hardCodedQuotes(shipped)).toHaveLength(1);
    for (const spelled of ["&#8220;{text}&#8221;", "&#x201C;{text}&#x201D;", "&bdquo;{text}&ldquo;"]) {
      expect(hardCodedQuotes(say.replace(">{quoted}</p>", `>${spelled}</p>`)), spelled).toHaveLength(1);
    }
  });

  it("Say this wraps the words in the locale's one pair: ״…״ in Hebrew, “…” in English", async () => {
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { SayThis } = await import("../ui/AiBlock");
    const render = (lang: "en" | "he") => renderToStaticMarkup(React.createElement(SayThis, { text: "x", title: "t", lang, copyLabel: "c", copiedLabel: "d" })).replace(/[\u2068\u2069]/g, "");
    expect(render("he")).toContain("\u05F4x\u05F4");
    expect(render("he")).not.toMatch(LATIN_QUOTES);
    expect(render("en")).toContain("\u201Cx\u201D");
  });
});
