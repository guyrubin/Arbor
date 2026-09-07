import fs from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, "..");
const frameworkPath = path.join(appRoot, "src", "framework.json");
const docPath = path.join(repoRoot, "docs", "developmental-ai-operating-model.md");

const framework = JSON.parse(fs.readFileSync(frameworkPath, "utf8"));
const doc = fs.readFileSync(docPath, "utf8");

const failures = [];

for (const domain of framework.domains) {
  if (!doc.includes(domain.label)) {
    failures.push(`Missing domain in docs: ${domain.label}`);
  }
  if (!doc.includes(domain.id)) {
    failures.push(`Missing domain id in docs: ${domain.id}`);
  }
}

for (const ageBand of framework.ageBands) {
  if (!doc.includes(ageBand.id)) {
    failures.push(`Missing age-band id in docs: ${ageBand.id}`);
  }
}

for (const frame of framework.sixFrames) {
  if (!doc.includes(frame.label)) {
    failures.push(`Missing Six Frame label in docs: ${frame.label}`);
  }
}

// KB-4: scholar card coverage map — reviewed evidence per developmental domain.
const scholarsDir = path.join(repoRoot, "knowledge", "framework", "scholars");
try {
  const coverage = Object.fromEntries(framework.domains.map((d) => [d.id, { reviewed: 0, total: 0 }]));
  for (const file of fs.readdirSync(scholarsDir).filter((f) => f.endsWith(".md"))) {
    const fm = fs.readFileSync(path.join(scholarsDir, file), "utf8").match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
    const domains = (fm.match(/^domains:\s*\[(.*)\]/m)?.[1] || "").split(",").map((s) => s.trim()).filter(Boolean);
    const reviewed = /review_status:\s*reviewed/.test(fm);
    for (const d of domains) {
      if (!coverage[d]) coverage[d] = { reviewed: 0, total: 0 };
      coverage[d].total += 1;
      if (reviewed) coverage[d].reviewed += 1;
    }
  }
  console.log("\nScholar card coverage by domain (reviewed/total):");
  for (const [id, c] of Object.entries(coverage)) {
    console.log(`  ${id}: ${c.reviewed}/${c.total}${c.reviewed === 0 ? "  ⚠ no reviewed card" : ""}`);
  }
} catch (error) {
  console.warn("Coverage map skipped:", error.message);
}

/* ════════════════════════════════════════════════════════════════════════════
   Item 11 (IA-02) — every ROUTE_IDS leaf carries the stamps its contract needs.

   `surfaceContract.ts` declared a moduleBudget for 43 routes and exactly ONE
   enforced it; `data-primary-move` occurred zero times in the DOM, so nothing
   could assert that the declared move renders at all, let alone above the fold.
   Shell now stamps `data-route` / `data-module-budget` on the active tab
   (SurfaceFrame); this rule is the other half — the leaf must stamp its own
   top-level sibling sections with `data-module` and its declared control with
   exactly ONE `data-primary-move`.

   KNOWN_UNSTAMPED is a RATCHET, not a policy. It is seeded with every leaf that
   is not stamped today (measured: all of them — `git grep data-module` returned
   nothing before this commit), so the gate is green on arrival and tightens
   only as builders stamp their surfaces and delete their route from the list.
   Removing an entry is the only edit this list may receive; a route that is
   NOT listed and NOT stamped fails the build. surfaceContract.render.test.ts
   holds the frozen seed and fails if the list ever grows.

   A stale exemption (route listed, leaf now stamped) is reported as a WARN and
   not a failure ON PURPOSE: several builders stamp leaves concurrently on this
   branch, and a gate that broke the moment somebody stamped a surface would
   punish exactly the work it is meant to pull forward.
   ════════════════════════════════════════════════════════════════════════════ */

const KNOWN_UNSTAMPED = new Set([
  "overview", "coach", "behaviors", "milestones", "plans",
  "stories", "weekly", "scholar", "language", "handoff",
  "safety", "profile", "memory", "strengths", "screening",
  "timeline", "journal", "find-pro", "care-team", "appointments",
  "sharing", "reports", "masterclasses", "learn", "family",
  "comics", "speech", "mimic", "feelings", "journey",
  "adventures", "copilot", "development", "daily-play", "practice",
  "consult", "attribution", "day-windows", "smart-reminders", "science",
  "school-brief", "bedtime-stories", "routines"
]);

const layoutDir = path.join(appRoot, "src", "components", "layout");
const shellSource = fs.readFileSync(path.join(layoutDir, "Shell.tsx"), "utf8");

/** Route id → leaf component file, read from Shell's lazy imports + tabRegistry. */
function routeLeafFiles() {
  const lazyPaths = new Map();
  for (const m of shellSource.matchAll(/const (\w+) = lazy\(\(\) => import\("([^"]+)"\)\);/g)) {
    lazyPaths.set(m[1], m[2]);
  }
  const start = shellSource.indexOf("const tabRegistry");
  const registry = shellSource.slice(start, shellSource.indexOf("};", start));
  const out = new Map();
  for (const m of registry.matchAll(/^\s*"?([a-zA-Z-]+)"?:\s*(\w+),/gm)) {
    const rel = lazyPaths.get(m[2]);
    if (!rel) continue;
    out.set(m[1], path.join(layoutDir, rel + ".tsx"));
  }
  return out;
}

/** Comment-stripped source — a doc-comment naming an attribute is not a stamp. */
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const leaves = routeLeafFiles();
if (leaves.size < 40) {
  failures.push(`Surface-contract rule: only ${leaves.size} routes resolved from Shell's tabRegistry — the parser has drifted from the source`);
}

const staleExemptions = [];
for (const [route, file] of leaves) {
  if (!fs.existsSync(file)) {
    failures.push(`Surface-contract rule: leaf file missing for route "${route}": ${path.relative(appRoot, file)}`);
    continue;
  }
  const source = stripComments(fs.readFileSync(file, "utf8"));
  const modules = (source.match(/\bdata-module\b(?!-)/g) || []).length;
  const moves = (source.match(/\bdata-primary-move\b(?!-)/g) || []).length;
  const compliant = modules >= 1 && moves === 1;
  if (KNOWN_UNSTAMPED.has(route)) {
    if (compliant) staleExemptions.push(route);
    continue;
  }
  if (modules < 1) {
    failures.push(`Surface-contract rule: route "${route}" (${path.relative(appRoot, file)}) has no data-module stamp`);
  }
  if (moves !== 1) {
    failures.push(`Surface-contract rule: route "${route}" (${path.relative(appRoot, file)}) has ${moves} data-primary-move stamps, expected exactly 1`);
  }
}

for (const route of KNOWN_UNSTAMPED) {
  if (!leaves.has(route)) {
    failures.push(`Surface-contract rule: KNOWN_UNSTAMPED lists "${route}", which is not a route in Shell's tabRegistry`);
  }
}

console.log(`\nSurface-contract stamps: ${leaves.size - KNOWN_UNSTAMPED.size}/${leaves.size} routes enforced (${KNOWN_UNSTAMPED.size} on the shrink-only ratchet).`);
if (staleExemptions.length > 0) {
  console.warn(`  ⚠ now stamped, drop from KNOWN_UNSTAMPED: ${staleExemptions.join(", ")}`);
}

if (failures.length > 0) {
  console.error("Framework consistency check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nFramework consistency check passed.");
