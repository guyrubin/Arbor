/**
 * B-MEAS-07 — the one-time internal-account tag script: matcher + plan over a
 * fixture of three uids. Dry run is the default and the plan is pure (a second
 * dry run prints the identical table); --apply writes `cohort` only and a
 * re-run finds nothing to change.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
// A plain .mjs script with no type declarations; `allowJs` resolves it.
import * as tagScript from "../../scripts/tag-internal-accounts.mjs";

const rollups = {
  "uid-founder": { firstSeen: "2026-09-01", activeDays: ["2026-09-01", "2026-09-20"], source: "organic", market: "il" },
  "uid-smoke": { firstSeen: "2026-09-07", activeDays: ["2026-09-07"], cohort: "internal" },
  "uid-family": { firstSeen: "2026-09-10", activeDays: ["2026-09-10", "2026-09-12"] },
};

describe("B-MEAS-07 — matcher", () => {
  it("internal = --uids ∪ uids behind ARBOR_ADMIN_EMAILS; never an unlisted family", () => {
    const m = tagScript.matchInternalUids({
      adminEmails: tagScript.envList(" Guy@Arbor.app , nobody@arbor.app"),
      emailToUid: { "guy@arbor.app": "uid-founder" },
      uids: ["uid-smoke", "uid-founder"],
    });
    expect(m.uids).toEqual(["uid-founder", "uid-smoke"]);
    expect(m.uids).not.toContain("uid-family");
    expect(m.unresolved).toEqual(["nobody@arbor.app"]);
  });
});

describe("B-MEAS-07 — the plan (dry run)", () => {
  const matched = ["uid-founder", "uid-smoke", "uid-ghost"];
  const plan = tagScript.planTagChanges(matched, rollups, { "uid-founder": 42, "uid-smoke": 3 });

  it("prints uid, rollup count, first/last seen and event count; only untagged rollups change", () => {
    expect(plan).toEqual([
      { uid: "uid-founder", rollups: 1, cohort: "untagged", firstSeen: "2026-09-01", lastSeen: "2026-09-20", events: 42, change: true },
      { uid: "uid-smoke", rollups: 1, cohort: "internal", firstSeen: "2026-09-07", lastSeen: "2026-09-07", events: 3, change: false },
      { uid: "uid-ghost", rollups: 0, cohort: "none", firstSeen: null, lastSeen: null, events: 0, change: false },
    ]);
  });

  it("a second dry run prints the identical table, and the input is not mutated", () => {
    const before = JSON.stringify(rollups);
    const a = tagScript.printPlan(tagScript.planTagChanges(matched, rollups, {}), { since: "2026-09-01", apply: false, unresolved: [] });
    const b = tagScript.printPlan(tagScript.planTagChanges(matched, rollups, {}), { since: "2026-09-01", apply: false, unresolved: [] });
    expect(a).toBe(b);
    expect(a).toContain("dry run (writes nothing)");
    expect(a).toContain('would tag cohort:"internal" on 1 rollup(s); 2 unchanged');
    expect(JSON.stringify(rollups)).toBe(before);
  });

  it("after --apply the re-run is idempotent (nothing left to change)", () => {
    const applied = { ...rollups, "uid-founder": { ...rollups["uid-founder"], cohort: "internal" } };
    expect(tagScript.planTagChanges(matched, applied, {}).filter((r: { change: boolean }) => r.change)).toEqual([]);
  });
});

describe("B-MEAS-07 — flags and the write", () => {
  it("dry run is the default; --apply must be explicit", () => {
    expect(tagScript.parseArgs(["--since", "2026-09-01"]).apply).toBe(false);
    expect(tagScript.parseArgs(["--since", "2026-09-01", "--apply", "--uids", "a, b"])).toMatchObject({ apply: true, uids: ["a", "b"] });
  });

  it("--apply writes the cohort field ONLY, merged, and never deletes or creates", () => {
    const src = readFileSync(path.join(__dirname, "..", "..", "scripts", "tag-internal-accounts.mjs"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect((src.match(/\.set\(/g) ?? []).length).toBe(1);
    expect(src).toContain('.set({ cohort: "internal" }, { merge: true })');
    expect(src).not.toMatch(/\.delete\(|\.update\(|\.create\(|\.(?:collection|doc)\([^)]*\)\.add\(/);
    expect(src).toMatch(/if \(args\.apply\) \{\s*for \(const r of rows\) \{\s*if \(!r\.change\) continue;/);
  });
});
