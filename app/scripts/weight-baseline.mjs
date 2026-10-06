/**
 * weight-baseline.mjs — B-INF-06: write scripts/weight-baseline.json from ONE rendered sweep.
 *
 *   node scripts/weight-baseline.mjs <sweep.json> [--out scripts/weight-baseline.json]
 *
 * Takes the BASE cells (state "base" or no state) that carry a `weight` block and records,
 * per route × viewport × lang, the seven metrics. The ratchet (scripts/weightLimits.test.ts)
 * fails when a later sweep is heavier on any metric. The baseline is written once from a
 * real sweep (Law 9: numbers come from the built artefact) and only ever LOWERED by hand.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRICS = ["tappableAboveFold", "tappable", "textSizes", "under12", "uppercase", "gradients", "screens"];

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const out = outIdx >= 0 ? args[outIdx + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), "weight-baseline.json");
if (!src) {
  console.error("usage: node scripts/weight-baseline.mjs <sweep.json> [--out file]");
  process.exit(1);
}
const sweep = JSON.parse(fs.readFileSync(src, "utf8"));
const cells = {};
for (const c of sweep.cells ?? []) {
  if ((c.state ?? "base") !== "base" || !c.weight || c.mounted === false) continue;
  cells[`${c.route}|${c.viewport}|${c.lang}`] = Object.fromEntries(METRICS.map((m) => [m, c.weight[m]]));
}
if (Object.keys(cells).length === 0) {
  console.error(`no base cell with a weight block in ${src} — run the sweep with the B-INF-06 rendered-sweep.mjs`);
  process.exit(1);
}
const body = {
  generatedFrom: path.basename(path.dirname(path.resolve(src))),
  generatedAt: new Date().toISOString(),
  note: "B-INF-06 ratchet baseline: a later sweep may only be lighter. Lower by hand when a screen gets lighter; never raise.",
  metrics: METRICS,
  cells: Object.fromEntries(Object.entries(cells).sort(([a], [b]) => a.localeCompare(b))),
};
fs.writeFileSync(out, `${JSON.stringify(body, null, 2)}\n`);
console.log(`WEIGHT-BASELINE cells=${Object.keys(cells).length} -> ${out}`);
