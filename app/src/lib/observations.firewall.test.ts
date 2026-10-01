import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/* B-GROWTH-28 — firewall guard on the Observation read model: no exported
   type of lib/observations.ts may carry a field that grades the child —
   nothing named score / rate / trend / delta / percent (any casing, any
   suffix). Counts and dates are the whole vocabulary. */

const SRC = readFileSync(path.join(__dirname, "observations.ts"), "utf8");
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const BANNED = /\b\w*(score|rate|trend|delta|percent)\w*\s*\??\s*:/i;

function fieldNames(src: string): string[] {
  // property declarations inside exported interfaces / type literals
  const out: string[] = [];
  for (const block of src.matchAll(/export (?:interface|type) \w+[^{=]*[{=]([\s\S]*?)(?=\nexport |\n\/\*\*|$)/g)) {
    for (const m of block[1].matchAll(/(\w+)\s*\??\s*:/g)) out.push(m[1]);
  }
  return out;
}

describe("B-GROWTH-28 — observations.ts exports no grading field", () => {
  it("finds the exported field names (the scan is not vacuous)", () => {
    const names = fieldNames(code);
    for (const n of ["count4w", "count12w", "latestAt", "domains", "ageAtObservationMonths"]) expect(names).toContain(n);
  });

  it("no exported field is named score|rate|trend|delta|percent", () => {
    const hits = fieldNames(code).filter((n) => BANNED.test(`${n}:`));
    expect(hits).toEqual([]);
  });

  it("POSITIVE CONTROL — a graded field trips the scan", () => {
    const bad = "export interface X {\n  count4w: number;\n  trend4w: number;\n  overallScore?: number;\n}\n";
    expect(fieldNames(bad).filter((n) => BANNED.test(`${n}:`))).toEqual(["trend4w", "overallScore"]);
  });
});
