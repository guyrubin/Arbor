/**
 * B-LOOP-14 — the content-hash staleness WARNING (check:acceptance), the
 * content equivalent of EVAL-6's prompt-version warning: a static suite that
 * declares the sha256 of its source files warns — never fails — when a file
 * changed after the last generation, or after the last judged run.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runOfflineAcceptance, staleContentWarnings, type EvalSuite } from "./acceptance.js";
import { CONTENT_HASH_FILES, changedContentKeys, liveContentHashes, sourceTextHash } from "./contentHashes.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, "..", "..", "..");

const suiteWith = (contentHashes: Record<string, string>, name = "content-staleness-fixture-v1"): EvalSuite => ({
  suite: name,
  version: "1.0.0",
  judgeModel: "gemini-2.5-pro",
  scenarios: [],
  contentHashes,
});

let tmpRoot: string;
beforeAll(() => {
  // A miniature repo: the two content files + an evals/ dir for a results row.
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "content-stale-"));
  for (const rel of Object.values(CONTENT_HASH_FILES)) {
    fs.mkdirSync(path.dirname(path.join(tmpRoot, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmpRoot, rel), fs.readFileSync(path.join(REPO_ROOT, rel), "utf8"), "utf8");
  }
  fs.mkdirSync(path.join(tmpRoot, "evals"));
});
afterAll(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

describe("B-LOOP-14 — content hashes", () => {
  it("sha256 hex over LF-normalised text (a CRLF checkout hashes the same)", () => {
    expect(sourceTextHash("a\r\nb\n")).toBe(sourceTextHash("a\nb\n"));
    expect(sourceTextHash("a\nb\n")).toMatch(/^[0-9a-f]{64}$/);
    expect(sourceTextHash("a\nb\n")).not.toBe(sourceTextHash("a\nc\n"));
  });

  it("the keys are milestoneData.ts and practices.ts", () => {
    expect(CONTENT_HASH_FILES).toEqual({ milestoneData: "app/src/lib/milestoneData.ts", practices: "app/src/content/practices.ts" });
    expect(() => liveContentHashes(REPO_ROOT, ["nope"])).toThrow(/unknown content key/);
  });
});

describe("B-LOOP-14 — staleContentWarnings (check:acceptance WARN, never a fail)", () => {
  it("the REAL live hashes warn nothing", () => {
    expect(staleContentWarnings(suiteWith(liveContentHashes(REPO_ROOT)), REPO_ROOT)).toEqual([]);
  });

  it("a FAKED changed hash warns: STALE, which file, regenerate and re-run", () => {
    const live = liveContentHashes(REPO_ROOT);
    const warnings = staleContentWarnings(suiteWith({ ...live, practices: "0".repeat(64) }), REPO_ROOT);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('STALE against content "practices" (app/src/content/practices.ts)');
    expect(warnings[0]).toContain("content changed after the last generation/run");
    expect(warnings[0]).toContain("regenerate (npm run eval:loop:build) and re-run content-staleness-fixture-v1");
  });

  it("an edited source file (same declared hash) warns — the file moved, not the suite", () => {
    const live = liveContentHashes(REPO_ROOT);
    const edited = (abs: string) => {
      const text = fs.readFileSync(abs, "utf8");
      return abs.replace(/\\/g, "/").endsWith(CONTENT_HASH_FILES.milestoneData) ? `${text}\n// edited` : text;
    };
    expect(changedContentKeys(live, REPO_ROOT, edited)).toEqual(["milestoneData"]);
    expect(staleContentWarnings(suiteWith(live), REPO_ROOT, edited).join("\n")).toContain('STALE against content "milestoneData"');
  });

  it("an unknown content key is surfaced; a suite without contentHashes warns nothing", () => {
    expect(staleContentWarnings(suiteWith({ somethingElse: "x" }), REPO_ROOT)).toEqual(['suite "content-staleness-fixture-v1" declares unknown content key "somethingElse"']);
    expect(staleContentWarnings({ ...suiteWith({}), contentHashes: undefined }, REPO_ROOT)).toEqual([]);
  });

  it("content changed after the LAST JUDGED RUN warns (the results row stamps the hashes it judged)", () => {
    const live = liveContentHashes(tmpRoot);
    const results = path.join(tmpRoot, "evals", "content-staleness-fixture-v1.results.jsonl");
    fs.writeFileSync(results, `${JSON.stringify({ ts: "2026-10-05T00:00:00.000Z", contentHashes: { ...live, practices: "f".repeat(64) } })}\n${JSON.stringify({ ts: "2026-10-06T00:00:00.000Z", contentHashes: { ...live, milestoneData: "e".repeat(64) } })}\n`, "utf8");
    const warnings = staleContentWarnings(suiteWith(live), tmpRoot);
    expect(warnings).toEqual([
      'suite "content-staleness-fixture-v1": content "milestoneData" changed after the last judged run (2026-10-06T00:00:00.000Z) — regenerate (npm run eval:loop:build) and re-run content-staleness-fixture-v1',
    ]);
    fs.writeFileSync(results, `${JSON.stringify({ ts: "2026-10-06T01:00:00.000Z", contentHashes: live })}\n`, "utf8");
    expect(staleContentWarnings(suiteWith(live), tmpRoot)).toEqual([]);
  });

  it("the shipped tree: milestone-loop-v1 validates (errors []), and content warnings ride beside — never inside — errors", () => {
    const { reports } = runOfflineAcceptance(REPO_ROOT);
    const loop = reports.find((r) => r.suite === "milestone-loop-v1");
    expect(loop, "evals/milestone-loop-v1.eval.json is committed").toBeTruthy();
    expect(loop!.errors).toEqual([]);
    for (const w of loop!.contentWarnings ?? []) expect(w).toMatch(/STALE|changed after the last judged run/);
  });
});
