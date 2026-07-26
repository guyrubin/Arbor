/**
 * EVAL-1: check:acceptance — the eval-as-CI gate (runs via `npm run check:acceptance`).
 *
 * OFFLINE TIER (always, CI — adds seconds, never minutes):
 *   - validates every evals/*.eval.json against the suite schema (pinned
 *     judgeModel, semver version, hard-safe rubric gate + passBar, >=5
 *     scenarios including one safety-trip);
 *   - runs each suite's deterministic contract assertions (offline-gate files
 *     exist + cover the scenarios; the coach-hardmoment seed contract is
 *     re-asserted directly);
 *   - EVAL-8: fails on evals/pinned-models.json drift against the
 *     loadConfig() defaults ("model changed: re-run suites");
 *   - EVAL-6: WARNs (never fails) when a suite is stale against the live
 *     PROMPT_VERSIONS registry.
 *
 * LIVE TIER (only when judge credentials are present — ANTHROPIC_API_KEY, an
 * explicit ARBOR_EVAL_LIVE=1, or GOOGLE_APPLICATION_CREDENTIALS for Vertex
 * ADC): invokes the EVAL-4 judge runner per suite and fails on any
 * safe===false or a pass rate below the suite passBar. CI without credentials
 * runs the offline tier only, by design.
 *
 * Exit code: non-zero on ANY error in either tier.
 */
import * as path from "node:path";
import { runOfflineAcceptance } from "../src/eval/acceptance.js";

const repoRoot = path.resolve(process.cwd(), "..");
const startedAt = Date.now();

const { reports, globalErrors } = runOfflineAcceptance(repoRoot);

let failed = globalErrors.length > 0;
for (const error of globalErrors) console.error(`FAIL   [pins] ${error}`);

for (const report of reports) {
  if (report.errors.length === 0) {
    console.log(`OK     [${report.suite}] schema + deterministic contract (${report.file})`);
  } else {
    failed = true;
    console.error(`FAIL   [${report.suite}] (${report.file})`);
    for (const error of report.errors) console.error(`       - ${error}`);
  }
  for (const warning of report.warnings) console.warn(`WARN   [${report.suite}] ${warning}`);
}

console.log(`check:acceptance offline tier finished in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

// ── Live tier (credential-gated) ─────────────────────────────────────────────
const liveCredsPresent = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ARBOR_EVAL_LIVE === "1" || process.env.GOOGLE_APPLICATION_CREDENTIALS,
);

if (!liveCredsPresent) {
  console.log("Live judge tier skipped (no ANTHROPIC_API_KEY / ARBOR_EVAL_LIVE=1 / GOOGLE_APPLICATION_CREDENTIALS).");
} else if (failed) {
  console.error("Live judge tier skipped: offline tier already failed.");
} else {
  const { runLiveSuite } = await import("./eval-judge.mts");
  for (const report of reports) {
    try {
      const result = await runLiveSuite(report.suite);
      if (result.ok) {
        console.log(`OK     [${report.suite}] live judge passRate=${result.row.passRate.toFixed(2)}`);
      } else {
        failed = true;
        console.error(`FAIL   [${report.suite}] live judge:`);
        for (const violation of result.violations) console.error(`       - ${violation}`);
      }
    } catch (error: any) {
      failed = true;
      console.error(`FAIL   [${report.suite}] live judge errored: ${error?.message ?? error}`);
    }
  }
}

if (failed) {
  console.error("check:acceptance FAILED.");
  process.exit(1);
}
console.log("check:acceptance passed.");
