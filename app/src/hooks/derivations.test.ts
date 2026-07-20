import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Single-derivation guard (IA Wave 3).
 *
 * The app used to answer the same question in several places at once: six
 * surfaces each ran `computeDevScore(...)` over the same milestones, and three
 * ran `deriveMonitoring(...)` over the same milestones + logs — two of those
 * re-implementing the months-precise age conversion, so the SAME child could
 * get different answers depending on which surface asked.
 *
 * Each question now has exactly one derivation seam:
 *   • the development picture → hooks/useDevScore.ts
 *   • the watch/monitoring signal → hooks/useMonitoring.ts
 *
 * This test is SOURCE-BASED (like clinicalFirewall.wave3.test.ts) so that a
 * future component re-deriving either answer locally is caught at CI time
 * rather than shipping a second, silently-diverging picture.
 */

const SRC_ROOT = path.resolve(__dirname, "..");

/** Every .ts/.tsx file under src, excluding tests. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(path.relative(SRC_ROOT, full).replace(/\\/g, "/"));
    }
  }
  return out;
}

/** Files allowed to CALL the raw derivation: its own module + its one hook. */
const DERIVATIONS: { fn: string; allowed: string[] }[] = [
  { fn: "computeDevScore", allowed: ["growth/devScore.ts", "hooks/useDevScore.ts"] },
  { fn: "deriveMonitoring", allowed: ["lib/monitoring.ts", "hooks/useMonitoring.ts"] },
];

describe("single-derivation seams", () => {
  const files = sourceFiles(SRC_ROOT);

  for (const { fn, allowed } of DERIVATIONS) {
    it(`${fn}() is called only by its module and its hook`, () => {
      const callers = files.filter((rel) => {
        if (allowed.includes(rel)) return false;
        const text = fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
        // A call, not a mention in prose/comments or a type-only import.
        return new RegExp(`(?<!\\*\\s|//\\s)\\b${fn}\\s*\\(`).test(
          text
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, ""),
        );
      });
      expect(
        callers,
        `${fn}() must be derived once (via its hook). Re-deriving it locally is how surfaces silently disagree.`,
      ).toEqual([]);
    });
  }
});
