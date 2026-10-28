/**
 * B-ASKJB-44 acceptance (round 8): one table, every row the critic has used in
 * rounds 1–7, with main's (5fb5666f) verdict and the verdict the floor must
 * give. The same rows run through the three note routes in
 * src/routes/handoffFloorAcceptance.test.ts. See the fixture's "about".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { withoutHandoffFindings } from "./clinicalScan";

type Row = { id: string; source: string; label: string; note: string; parent: string; main: string; required: string };
const here = path.dirname(fileURLToPath(import.meta.url));
export const ACCEPTANCE_ROWS: Row[] = JSON.parse(readFileSync(path.join(here, "__fixtures__", "handoffFloorAcceptance.json"), "utf8")).rows;

/** True when the floor's output satisfies the row's required verdict. */
export const meetsRequired = (row: Row, out: string): boolean => {
  if (row.required === "keep") return out === row.note;
  if (row.required === "drop") return out === "";
  if (row.required === "keep|fn") return out === row.note || out === "";
  return out === row.required.slice("part:".length);
};

describe("B-ASKJB-44 acceptance table — the floor (every critic row, EN + HE)", () => {
  it("holds every row the critic has used, each with main's verdict and a required verdict", () => {
    expect(ACCEPTANCE_ROWS.length).toBeGreaterThanOrEqual(240);
    for (const row of ACCEPTANCE_ROWS) {
      expect(["keep", "drop", "part"]).toContain(row.main.split(":")[0]);
      expect(row.required).toMatch(/^(?:keep|drop|keep\|fn|part:.+)$/);
    }
    expect(ACCEPTANCE_ROWS.some((row) => /[א-ת]/.test(row.note))).toBe(true);
  });
  it.each(ACCEPTANCE_ROWS.map((row) => [`${row.id} ${row.label}`, row] as const))("%s", (_name, row) => {
    const out = withoutHandoffFindings(row.note, row.parent ? { parentText: row.parent, childNames: ["Noa"] } : { childNames: ["Noa"] });
    expect(meetsRequired(row, out), `required ${row.required} (main ${row.main}), got ${JSON.stringify(out)}`).toBe(true);
  });
});
