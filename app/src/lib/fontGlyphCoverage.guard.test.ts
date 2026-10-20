/**
 * B-INF-11 (Hebrew half) — rendered text stays inside the source web fonts.
 *
 * U+2011 NON-BREAKING HYPHEN is in none of the app's text fonts (Instrument Sans,
 * IBM Plex Sans Hebrew, Heebo, Fraunces, Nunito, Frank Ruhl Libre, Instrument
 * Serif). Chrome paints it from a system fallback, so a Hebrew label such as
 * "לשמור כ‑PDF" (#/school-brief) mixed a platform font into the line and the
 * Arbor capture's exact-font check failed with FONT_RENDERED_GLYPHS_UNPROVEN in
 * both Hebrew cells. Hebrew joins a prefix to a Latin word with the maqaf U+05BE
 * ("ל־Arbor"), which IBM Plex Sans Hebrew and Heebo carry. This walks every
 * non-test .ts/.tsx under src so the character cannot come back anywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const NOT_IN_SOURCE_FONTS = /‑/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !/\.test\./.test(f)) out.push(p);
  }
  return out;
}

describe("rendered strings use only glyphs the source web fonts carry", () => {
  it("no non-test source file under src contains U+2011 (use the maqaf U+05BE in Hebrew, '-' in Latin)", () => {
    const hits: string[] = [];
    const files = walk(SRC);
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      NOT_IN_SOURCE_FONTS.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = NOT_IN_SOURCE_FONTS.exec(src))) hits.push(`${path.relative(SRC, f)}:${src.slice(0, m.index).split("\n").length}`);
    }
    expect(files.length).toBeGreaterThan(200);
    expect(hits).toEqual([]);
  });

  it("negative control: the pre-fix school-brief label trips the rule", () => {
    expect("לשמור כ‑PDF").toMatch(new RegExp(NOT_IN_SOURCE_FONTS.source));
    expect("לשמור כ־PDF").not.toMatch(new RegExp(NOT_IN_SOURCE_FONTS.source));
  });
});
