/**
 * OBJ-GUARD-01 — no raw C0 control bytes in source.
 *
 * A heredoc written through a shell ate the backslashes in two guard regexes:
 * `/\btitle=\{s\./` reached disk as a literal U+0008 (BACKSPACE) followed by
 * `title=...`, and `/<Icon\b/` as `<Icon` + U+0008. Both compiled, both ran,
 * and neither could ever match — the assertions were vacuous while the suite
 * stayed green. That is the worst failure mode a guard has: it reports PASS
 * on the shape it was written to forbid.
 *
 * The class of defect is wider than those two files. Any C0 control byte in a
 * .ts/.tsx source is either corruption of an escape sequence (`\b`, `\f`,
 * `\v`, `\0`, `\x1b`) or a paste accident; none of them are ever intended in
 * this codebase. Tab (U+0009), LF (U+000A) and CR (U+000D) are legitimate and
 * excluded. So the guard is a whole-tree byte scan, not a per-file pin: a
 * named-file list would have the same blind spot that let this ship.
 *
 * Intended escapes must be written as the two characters `\` + `b`. If a
 * genuine control character is ever needed in a string, spell it as a
 * hex escape (\x08), never as the byte itself.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");

/** Every .ts/.tsx under src/, tests INCLUDED — the corruption lived in tests. */
function sourceFiles(dir = SRC, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** U+0000–U+0008 and U+000E–U+001F. Tab/LF/CR (09/0A/0D) are legitimate. */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\x00-\x08\x0E-\x1F]/g;

/** file → the offending code points, as `U+00XX@<offset>`, for a usable message.
 *  CONTROL carries /g, so it is re-created per call rather than shared with a
 *  stateful `.test()` — a lastIndex left behind would make every second file
 *  scan come back clean, which is the vacuous-guard defect all over again. */
function offences(text: string): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(new RegExp(CONTROL.source, "g"))) {
    hits.push(`U+${m[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}@${m.index}`);
  }
  return hits;
}

const FILES = sourceFiles();

describe("no source file carries a raw C0 control byte", () => {
  it("scans a real, non-trivial tree", () => {
    expect(FILES.length).toBeGreaterThan(200);
    // tests are in scope: they are where the corruption landed
    expect(FILES.some((f) => f.endsWith(".test.ts"))).toBe(true);
  });

  it("src/**/*.ts(x) is free of U+0000-U+0008 and U+000E-U+001F", () => {
    const offenders = FILES.map((f) => ({ f, hits: offences(readFileSync(f, "utf8")) }))
      .filter(({ hits }) => hits.length > 0)
      .map(({ f, hits }) => `${path.relative(SRC, f).replace(/\\/g, "/")} [${hits.join(" ")}]`);
    expect(
      offenders,
      "a control byte here is a swallowed escape (\\b, \\f, \\v, \\0) — the regex still compiles but can never match",
    ).toEqual([]);
  });

  it("NEGATIVE CONTROL: the exact corrupted shapes are detected", () => {
    // What actually reached disk in filtersAndWhyLine.test.ts and
    // iconFontSubset.test.ts. Built from char codes so this fixture can never
    // itself be "repaired" by an editor and quietly stop being a control.
    const BS = String.fromCharCode(8);
    expect(offences(`expect(PLANS).not.toMatch(/${BS}title=\\{s\\./);`)).toEqual(["U+0008@27"]);
    expect(offences(`return /<Icon${BS}/.test(src);`)).toEqual(["U+0008@13"]);
    // ESC and NUL are caught too; tab/LF/CR are not.
    expect(offences(`a${String.fromCharCode(27)}b${String.fromCharCode(0)}`)).toHaveLength(2);
    expect(offences("a\tb\r\nc")).toEqual([]);
  });

  it("NEGATIVE CONTROL: the repaired regexes match the shapes they forbid", () => {
    // The point of the repair: these assertions now bite. `\b` is a word
    // boundary again, so the shipped defect is caught.
    expect('<span title={s.reason}>').toMatch(/\btitle=\{s\./);
    expect('{isDoc ? <Icon name="upload" />').toMatch(/<Icon\b/);
    // and the corrupted forms do not
    const BS = String.fromCharCode(8);
    expect('<span title={s.reason}>').not.toMatch(new RegExp(`${BS}title=\\{s\\.`));
    expect('<Icon name="upload" />').not.toMatch(new RegExp(`<Icon${BS}`));
  });
});
