/**
 * F-09 guard — dates render through the app-locale seam, never the browser's.
 *
 * A bare zero-arg `toLocaleDateString()` renders in the BROWSER locale: the
 * same screen showed "7/9/2026", "09/07/2026" and "9.7.2026" depending on the
 * machine — including the ambiguous DD/MM vs MM/DD numeric form. Every parent
 * surface must go through lib/formatDate (fmtDay/fmtDayLong/fmtMonthYear),
 * which is driven by uiLang and always spells the month.
 *
 * Locale-EXPLICIT calls (toLocaleDateString(locale, options)) remain allowed —
 * e.g. groupByDay's weekday labels — because they already pin the locale.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const componentsDir = path.dirname(fileURLToPath(import.meta.url));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [full] : [];
  });

describe("F-09 — no zero-arg toLocaleDateString in src/components", () => {
  it("every component date goes through lib/formatDate (or an explicit locale)", () => {
    const offenders: string[] = [];
    for (const file of walk(componentsDir)) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (/\.toLocaleDateString\(\s*\)/.test(line)) {
          offenders.push(`${path.relative(componentsDir, file)}:${i + 1}`);
        }
      });
    }
    expect(
      offenders,
      `browser-locale date rendering found — use fmtDay/fmtDayLong/fmtMonthYear from lib/formatDate:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("JournalTab derives BOTH the week stat and the story slice from weekWindow", () => {
    const journal = readFileSync(path.join(componentsDir, "tabs", "JournalTab.tsx"), "utf8");
    // One shared list…
    expect(journal).toMatch(/const weekSignals = useMemo\(\(\) => weekWindow\(signals/);
    // …feeds the stat…
    expect(journal).toContain("const weekCount = weekSignals.length");
    // …and the story copy's slice — never the all-time stream.
    expect(journal).toContain("const recentSignals = weekSignals.slice(0, 3)");
    expect(journal).not.toContain("signals.slice(0, 3)");
  });
});
