/**
 * `withChildSignals` resolves in the PARENT's UI language, everywhere.
 *
 * The wrapper takes a boolean `heMode` and returns Hebrew or English copy for
 * the childsignals keys, falling through to `t()` for everything else. `t()`
 * already follows `uiLang`. So passing `aiLang === "he"` does not merely pick
 * "the wrong language" — it picks a DIFFERENT language from the one the same
 * sentence's other half resolves in, and a parent on a Hebrew UI with the AI
 * language left on English gets one mixed-language line. `getAiLanguage()` is
 * stored independently of `uiLang`, so that combination is a setting away, not
 * an edge case. KidExitRecap shipped it until 2026-09-04.
 *
 * `aiLang` is the language MODEL OUTPUT comes back in. No childsignals string
 * is model output, so no call site may read it.
 *
 * Scan discipline: \r\n normalised first; the harvest is asserted non-empty and
 * asserted to contain the known real call sites, so a walk that reads nothing
 * cannot pass; the matcher is negative-controlled against the pre-change line.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(here, "..", "..");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Every `withChildSignals(t, <expr>)` call site: the file and the 2nd arg. */
const CALL = /withChildSignals\(\s*([^,()]+),\s*([^)]*)\)/g;

/** Drop comments before matching — several modules DESCRIBE the call in prose
 *  ("pass `withChildSignals(t, he)`") and a doc line is not a call site. */
const stripComments = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join("\n");

interface Site {
  file: string;
  arg: string;
  line: string;
}

const FILES = sourceFiles(SRC_ROOT);
const sites: Site[] = [];
/** The one match that is the DECLARATION, not a call. Counted, not ignored:
 *  if the wrapper is ever renamed or re-declared, this number moves. */
let declarations = 0;
let scannedChars = 0;
for (const file of FILES) {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  scannedChars += raw.length;
  if (!raw.includes("withChildSignals(")) continue;
  const src = stripComments(raw);
  for (const m of src.matchAll(CALL)) {
    if (src.slice(Math.max(0, m.index - 9), m.index) === "function ") {
      declarations += 1;
      continue;
    }
    sites.push({
      file: path.relative(SRC_ROOT, file),
      arg: m[2].trim(),
      line: m[0],
    });
  }
}

/** The pre-change KidExitRecap line, verbatim — the negative control. */
const PRE_CHANGE = `      withChildSignals(t, aiLang === "he"),`;

describe("the call-site scan is real, not vacuous", () => {
  it("walked the tree and read actual bytes", () => {
    expect(FILES.length).toBeGreaterThan(100);
    expect(scannedChars).toBeGreaterThan(500_000);
  });

  it("found the known call sites in every module that has one", () => {
    expect(declarations, "withChildSignals should be declared exactly once").toBe(1);
    expect(sites.length).toBeGreaterThanOrEqual(4);
    const files = new Set(sites.map((s) => s.file.replace(/\\/g, "/")));
    expect(files).toContain("components/kidmode/KidExitRecap.tsx");
    expect(files).toContain("components/tabs/JournalTab.tsx");
    expect(files).toContain("components/tabs/StoryTimelineTab.tsx");
  });

  it("the matcher would catch the pre-change line (so it can fail)", () => {
    const m = CALL.exec(PRE_CHANGE);
    CALL.lastIndex = 0;
    expect(m).toBeTruthy();
    expect(m![2].trim()).toBe('aiLang === "he"');
    expect(/\baiLang\b/.test(m![2])).toBe(true);
  });
});

describe("no withChildSignals call site reads the AI language", () => {
  it.each(sites.map((s) => [`${s.file} :: ${s.line}`, s.arg]))("%s", (_label, arg) => {
    expect(
      /\baiLang\b|getAiLanguage/.test(arg as string),
      "withChildSignals renders PARENT copy: pass uiLang, never the AI language — " +
        "the count phrases inside the same sentence resolve through t(), which follows uiLang.",
    ).toBe(false);
  });

  it("and every call site positively passes the UI language", () => {
    for (const s of sites) {
      expect(/\buiLang\b/.test(s.arg), `${s.file} :: ${s.line}`).toBe(true);
    }
  });
});
