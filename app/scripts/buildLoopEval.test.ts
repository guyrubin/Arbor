/**
 * B-LOOP-14 — the generator of evals/milestone-loop-v1.eval.json
 * (scripts/build-loop-eval.mts), offline: always into TEMP paths, never the
 * committed suite file.
 *  - (live catalogue rows + practices) × 2 scenarios, unique ids, no retired id;
 *  - every scenario carries both locales' content and its source record, and
 *    the live runner can drive it (static tier);
 *  - the age line is the catalogue's own sentence (CDC "most children by";
 *    unstated rows → none);
 *  - `--ids` subsets (and refuses to overwrite the canonical file);
 *  - contentHashes = sha256 of the two source files; regenerating is byte-stable;
 *  - the suite passes the check:acceptance schema with the pinned judge read
 *    from coach-core-v1.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RETIRED_MILESTONE_IDS } from "../src/lib/milestoneData";
import { PRACTICES } from "../src/content/practices";
import { sourceTextHash, CONTENT_HASH_FILES } from "../src/eval/contentHashes";
import { isSafetyTripScenario, validateSuite, type EvalSuite, type PinnedModels } from "../src/eval/acceptance";
import { runnerInputError } from "../src/eval/runnerInput";
import { DEFAULT_OUT, JUDGE_SOURCE_SUITE, REPO_ROOT, SUITE_NAME, buildSuite, liveCatalogueRows, main, serializeSuite, writeSuite } from "./build-loop-eval.mts";

let tmp: string;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loop-eval-")); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const rows = liveCatalogueRows();
const full = buildSuite({ now: new Date("2026-10-06T00:00:00.000Z") });

describe("B-LOOP-14 — milestone-loop-v1.eval.json is generated from the content files", () => {
  it("exactly (live rows + practices) × 2 scenarios, unique ids, in both languages", () => {
    expect(rows.length).toBeGreaterThan(100);
    expect(full.scenarios.length).toBe((rows.length + PRACTICES.length) * 2);
    expect(full.counts).toEqual({ catalogueRows: rows.length, practices: PRACTICES.length, languages: 2, scenarios: full.scenarios.length });
    expect(new Set(full.scenarios.map((s) => s.id)).size).toBe(full.scenarios.length);
    for (const m of rows) for (const lang of ["en", "he"]) expect(full.scenarios.some((s) => s.id === `cat-${m.id}-${lang}`)).toBe(true);
    for (const p of PRACTICES) for (const lang of ["en", "he"]) expect(full.scenarios.some((s) => s.id === `${p.id}-${lang}`)).toBe(true);
  });

  it("no retired id reaches the suite", () => {
    for (const s of full.scenarios) {
      expect(RETIRED_MILESTONE_IDS).not.toContain(s.input.milestoneId);
      expect(s.id).not.toMatch(/^cat-m-\d+-/);
    }
  });

  it("every scenario carries both locales' content and its source, and the live runner can drive it", () => {
    for (const s of full.scenarios) {
      expect(s.tier).toBe("static");
      expect(s.safetyMustHold).toBe(true);
      const head = s.input.kind === "catalogue" ? "title" : "do";
      expect(String(s.input.content.en[head] ?? "").trim(), s.id).not.toBe("");
      expect(String(s.input.content.he[head] ?? "").trim(), s.id).not.toBe("");
      expect(s.input.content.he[head], s.id).toMatch(/[א-ת]/);
      expect(s.input.source, s.id).toMatchObject({ org: expect.any(String), title: expect.any(String), year: expect.any(Number) });
      expect(runnerInputError(s), s.id).toBeNull();
      expect(JSON.stringify(s.input.content), s.id).not.toMatch(/[⁦-⁩]/);
    }
  });

  it("the age line is the catalogue's own sentence: CDC 'most children by'; an unstated source renders none", () => {
    const cat = full.scenarios.filter((s) => s.input.kind === "catalogue");
    const cdc = cat.find((s) => s.id === "cat-cdc-24m-3-en")!;
    expect(cdc.input.content.en.ageLine).toBe("Most children do this by 2 years");
    expect(cdc.input.content.he.ageLine).toBe("רוב הילדים עושים זאת עד גיל שנתיים");
    for (const s of cat) {
      if (s.input.ageSemantics === "unstated" || s.input.ageSemantics === "average_onset") {
        expect(s.input.content.en.ageLine, s.id).toBeNull();
        expect(s.input.content.he.ageLine, s.id).toBeNull();
      }
      expect(s.expected_behavior, s.id).toContain(`ageSemantics=${s.input.ageSemantics}`);
    }
    expect(cat.some((s) => s.input.ageSemantics === "unstated")).toBe(true);
    // practices never carry an age line field
    for (const s of full.scenarios.filter((x) => x.input.kind === "practice")) expect(s.input.content.en).not.toHaveProperty("ageLine");
  });

  it("food/sleep practices are the SAFETY-TRIP scenarios (methodSafety hard gate)", () => {
    const trips = full.scenarios.filter((s) => isSafetyTripScenario(s as never));
    expect(trips.length).toBeGreaterThan(0);
    for (const s of trips) expect(["food", "sleep"]).toContain(s.input.shelf);
  });

  it("the suite passes the check:acceptance schema with the judge pinned in coach-core-v1", () => {
    const coach = JSON.parse(fs.readFileSync(JUDGE_SOURCE_SUITE, "utf8")) as { judgeModel: string };
    const pinned = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "evals", "pinned-models.json"), "utf8")) as PinnedModels;
    expect(full.judgeModel).toBe(coach.judgeModel);
    expect(validateSuite(full as unknown as EvalSuite, pinned.judgeModels, pinned.deadJudgeModels)).toEqual([]);
    expect(full.suite).toBe(SUITE_NAME);
    expect(full.runner.mode).toBe("static");
    expect(Object.keys(full.rubric.dimensions)).toEqual(["sourceFidelity", "ageSemantics", "practiceFit", "noVerdict", "heNaturalness", "methodSafety"]);
    expect(full.rubric.passBar).toMatchObject({ noVerdict: 1, methodSafety: 1 });
    expect(full.rubric.suiteMeanBar).toBe(0.95);
    expect(full.$comment).toMatch(/GENERATED/);
  });

  it("contentHashes are the sha256 of the two source files", () => {
    for (const key of ["milestoneData", "practices"] as const) {
      const text = fs.readFileSync(path.join(REPO_ROOT, CONTENT_HASH_FILES[key]), "utf8");
      expect(full.contentHashes[key]).toBe(sourceTextHash(text));
      expect(full.contentHashes[key]).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("B-LOOP-14 — the CLI: --ids subsets, --out, byte-stable regeneration", () => {
  it("--ids <catalogue id> keeps the row and its practice in both languages; a practice id keeps that practice", () => {
    const out = path.join(tmp, "subset.eval.json");
    const lines: string[] = [];
    expect(main(["--ids", "cdc-2m-3,pr-cdc-2m-4", "--out", out], (l) => lines.push(l))).toBe(0);
    const suite = JSON.parse(fs.readFileSync(out, "utf8")) as ReturnType<typeof buildSuite>;
    expect(suite.scenarios.map((s) => s.id).sort()).toEqual(["cat-cdc-2m-3-en", "cat-cdc-2m-3-he", "pr-cdc-2m-3-en", "pr-cdc-2m-3-he", "pr-cdc-2m-4-en", "pr-cdc-2m-4-he"]);
    expect(lines.join("\n")).toContain("6 scenarios = (1 catalogue rows + 2 practices) × 2 languages");
  });

  it("an unknown id throws; --ids without --out refuses to touch the canonical file", () => {
    expect(() => buildSuite({ ids: ["no-such-id"] })).toThrow(/not a live catalogue or practice id/);
    expect(() => buildSuite({ ids: ["m-1"] })).toThrow(/not a live catalogue or practice id/);
    const before = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, "utf8") : null;
    const lines: string[] = [];
    expect(main(["--ids", "cdc-2m-3"], (l) => lines.push(l))).toBe(2);
    expect(lines.join("\n")).toContain("--out");
    expect(fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, "utf8") : null).toBe(before);
  });

  it("regenerating is byte-stable (the previous generatedAt is kept when nothing else changed)", () => {
    const out = path.join(tmp, "full.eval.json");
    writeSuite(out, { now: new Date("2026-10-06T08:00:00.000Z") });
    const first = fs.readFileSync(out, "utf8");
    writeSuite(out, { now: new Date("2026-10-07T09:00:00.000Z") });
    expect(fs.readFileSync(out, "utf8")).toBe(first);
    expect(JSON.parse(first).generatedAt).toBe("2026-10-06T08:00:00.000Z");
    // the full generation prints the formula count
    const lines: string[] = [];
    expect(main(["--out", out], (l) => lines.push(l))).toBe(0);
    expect(lines.join("\n")).toContain(`${(rows.length + PRACTICES.length) * 2} scenarios = (${rows.length} catalogue rows + ${PRACTICES.length} practices) × 2 languages`);
    expect(fs.readFileSync(out, "utf8")).toBe(first);
  });

  it("a content change is NOT byte-stable: the new text and a new generatedAt are written", () => {
    const suite = buildSuite({ ids: ["cdc-2m-3"], now: new Date("2026-10-06T08:00:00.000Z") });
    const previous = serializeSuite(suite);
    const changed = { ...suite, generatedAt: "2026-10-08T00:00:00.000Z", scenarios: suite.scenarios.map((s) => ({ ...s, expected_behavior: `${s.expected_behavior} (edited)` })) };
    expect(JSON.parse(serializeSuite(changed, previous)).generatedAt).toBe("2026-10-08T00:00:00.000Z");
  });
});
