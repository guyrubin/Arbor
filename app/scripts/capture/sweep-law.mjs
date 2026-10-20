/**
 * sweep-law.mjs — the rendered sweep's pass/fail law (AR-REL-1).
 *
 * A sweep fails when any base cell did not mount, or any rendered cell (base or a reached
 * state) logged a console error or overflows its viewport horizontally. 429s are already
 * counted apart (`rateLimited`) by the sweep, so they never reach `consoleErrors`.
 *
 * Used by `rendered-sweep.mjs` (exit SWEEP_LAW_EXIT unless --report-only), by the release
 * runner (records `sweepLaw` instead of aborting) and by the Arbor capture workflow:
 *
 *   node scripts/capture/sweep-law.mjs <sweep.json>   → exit 0 PASS · 3 FAIL · 1 unreadable/incomplete
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SWEEP_LAW_EXIT = 3;

const isBase = (cell) => (cell.state ?? 'base') === 'base';

/** @param {{ cells?: any[] }} doc */
export function sweepLawFailures(doc) {
  const failures = [];
  for (const cell of doc?.cells ?? []) {
    if (!isBase(cell) && cell.reached !== true) continue;
    const reasons = [];
    if (isBase(cell) && !cell.mounted) reasons.push('unmounted');
    if ((cell.consoleErrors ?? []).length > 0) reasons.push('console-error');
    if (cell.overflow && cell.overflow.scrollWidth > cell.overflow.clientWidth) reasons.push('overflow');
    if (reasons.length) failures.push({ cell: `${cell.route} ${cell.viewport} ${cell.lang}${isBase(cell) ? '' : ` ${cell.state}`}`, reasons });
  }
  return failures;
}

export function sweepLawLines(failures, limit = 20) {
  const lines = failures.slice(0, limit).map((f) => `  ${f.cell}: ${f.reasons.join(', ')}`);
  if (failures.length > limit) lines.push(`  … ${failures.length - limit} more in sweep.json`);
  return lines;
}

function cli(file) {
  let doc;
  try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (error) {
    console.error(`SWEEP-LAW UNREADABLE ${file}: ${error.message}`);
    return 1;
  }
  if (doc.completed !== true) {
    console.error(`SWEEP-LAW INCOMPLETE ${file}: cells=${doc.cells?.length ?? 0}`);
    return 1;
  }
  const failures = sweepLawFailures(doc);
  if (!failures.length) {
    console.log(`SWEEP-LAW PASS cells=${doc.cells.length}`);
    return 0;
  }
  console.log(`SWEEP-LAW FAIL ${failures.length} cells`);
  for (const line of sweepLawLines(failures)) console.log(line);
  // In Actions, annotations are the one place a public reader sees the cells without a login.
  if (process.env.GITHUB_ACTIONS === 'true') for (const f of failures.slice(0, 10)) console.log(`::error title=sweep law::${f.cell}: ${f.reasons.join(', ')}`);
  return SWEEP_LAW_EXIT;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) {
    console.error('usage: node scripts/capture/sweep-law.mjs <sweep.json>');
    process.exitCode = 1;
  } else process.exitCode = cli(process.argv[2]);
}
