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

if (failures.length > 0) {
  console.error("Framework consistency check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nFramework consistency check passed.");
