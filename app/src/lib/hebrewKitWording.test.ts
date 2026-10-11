import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** הערכה means both "kit/set" and "assessment"; parents read the second. On a
 *  child's screen, a shareable stamp or a parent practice page it must never
 *  appear — say סט / סבב / the pack's name instead. Negations ("לא הערכה",
 *  "אינו הערכה") are the one allowed use: they promise the opposite. */
const FILES = ["kidRegister.ts", "mimicContent.ts", "practiceDoors.ts", "yourData.ts"];
const ALLOWED = /(?:לא|אינו|אינה|ואינו)\s+הערכה/g;

function offending(source: string): string[] {
  return source.split(/\r?\n/).filter(line => /[א-ת]/.test(line) && line.replace(ALLOWED, "").includes("הערכה"));
}

describe("Hebrew copy never says הערכה where it means a kit or set", () => {
  it.each(FILES)("%s", file => {
    const source = readFileSync(new URL(`./i18nElevation/${file}`, import.meta.url), "utf8");
    expect(offending(source)).toEqual([]);
  });
  it("catches the wording that shipped, and allows a negation", () => {
    expect(offending('  "elev.mimic.stamp.headline": "הערכה {pack} הושלמה!",')).toHaveLength(1);
    expect(offending('  "elev.play.mimic.packComplete.title": "סיימתם את הערכה!",')).toHaveLength(1);
    expect(offending('  "practice.studio.note": "זה תרגול, לא הערכה.",')).toEqual([]);
  });
});
