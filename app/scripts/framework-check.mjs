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

if (failures.length > 0) {
  console.error("Framework consistency check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Framework consistency check passed.");
