/**
 * B-KID-35 (KC-20, law 3) — Letter Trace graded stars and the coverage bar
 * leave the kid register. A 60 %-coverage trace showed 1 lit star of 3 (two
 * greyed) and a live percentage bar; in Kid Mode a traced letter is now the
 * same win as a perfect one. The parent door keeps both.
 * Scan rule: in a kid-surface file, a GREYED star (⭐ with grayscale(1)) may
 * only render behind a `!kidMode` gate. playkit's Celebrate is exempt: B-KID-04
 * passes it stars === starsTotal everywhere (pinned by patternPower.test).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const trace = readFileSync(path.join(__dirname, "EarlyReadingTrack.tsx"), "utf8");

/** Greyed-star sites in a source text that are NOT inside a `{!kidMode && (` gate. */
export function ungatedGreyStars(src: string): number {
  let n = 0;
  for (const m of src.matchAll(/grayscale\(1\)/g)) {
    const at = m.index ?? 0;
    const near = src.slice(Math.max(0, at - 300), at + 120);
    if (!near.includes("⭐")) continue;
    const before = src.slice(Math.max(0, at - 700), at);
    const gate = before.lastIndexOf("{!kidMode && (");
    // the gate is still open when no line that only closes a JSX expression (`)}`) follows it
    const closedAfter = gate === -1 ? true : /\n\s*\)\}\s*(\n|$)/.test(before.slice(gate));
    if (gate === -1 || closedAfter) n++;
  }
  return n;
}

describe("B-KID-35: Letter Trace in Kid Mode", () => {
  it("reads Kid Mode and gates the star row and the coverage bar behind !kidMode", () => {
    const fn = trace.slice(trace.indexOf("function LetterTrace("), trace.indexOf("export default function EarlyReadingTrack"));
    expect(fn).toContain("const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive);");
    expect(fn).toMatch(/\{!kidMode && \(\s*<div className="flex justify-center sm:justify-start gap-1 mb-2" aria-label=\{t\("prac\.read\.trace\.stars"/);
    expect(fn).toMatch(/\{!kidMode && \(\s*<div className="h-2\.5 rounded-full overflow-hidden mb-3"/);
  });
});

describe("B-KID-35: scan rule — no greyed star in a kid file outside a parent gate", () => {
  const dirs = ["components/practice", "components/kidmode"];
  const files = dirs.flatMap((d) =>
    readdirSync(path.join(SRC, d)).filter((f) => f.endsWith(".tsx") && !/\.test\./.test(f)).map((f) => `${d}/${f}`),
  );
  it("the walk is real", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain("components/practice/EarlyReadingTrack.tsx");
  });
  it.each(files)("%s", (rel) => {
    expect(ungatedGreyStars(readFileSync(path.join(SRC, rel), "utf8"))).toBe(0);
  });
  it("NEGATIVE CONTROL: a synthetic greyed star outside the gate fails the rule", () => {
    const synthetic = '<span style={{ filter: i < n ? "none" : "grayscale(1)" }}>⭐</span>';
    expect(ungatedGreyStars(synthetic)).toBe(1);
    expect(ungatedGreyStars(`{!kidMode && (\n${synthetic}\n)}`)).toBe(0);
  });
});
