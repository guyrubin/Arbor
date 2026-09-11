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

  it("JournalTab derives BOTH the week stat and the story copy from ONE selector", () => {
    const journal = readFileSync(path.join(componentsDir, "tabs", "JournalTab.tsx"), "utf8");
    // RUN-08/TJB-27: the shared week definition is the `weekMomentCount`
    // selector in lib/signalTimeline — imported, not re-derived here.
    expect(journal).toContain("weekMomentCount");
    expect(journal).toContain('from "../../lib/signalTimeline"');
    expect(journal).toMatch(/const weekCount = useMemo\(\(\) => weekMomentCount\(signals/);
    // …feeds the header stat AND the story copy — one number per screen.
    expect(journal).toMatch(
      /const storyCopy = weekCount\s+\? t\("journal\.story\.body", \{ count: weekCount \}\)/,
    );
    // Negative control — the pre-fix shape: a second, capped week list feeding
    // the story copy ("0 · 3 · 5 · 10" on one screen) must not come back.
    expect(journal).not.toContain("slice(0, 3)");
    expect(journal).not.toMatch(/const weekSignals\b/);
    expect(journal).not.toMatch(/const recentSignals\b/);
  });
});
