import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "server.ts",
  "metadata.json",
  "src/App.tsx",
  "src/initialData.ts",
  "src/types.ts",
  "src/routes/api.ts",
  "src/safety/escalation.ts",
  "src/contracts/coach.ts",
  "src/ai/modelRouter.ts",
  "src/config/env.ts"
];

const checks = [
  { name: "stale Gemini model", pattern: /gemini-3\.5-flash/i },
  { name: "clinical counselor claim", pattern: /clinical counselor/i },
  { name: "co-therapy positioning", pattern: /co-therapy partner|co-therapy platform/i },
  { name: "diagnosis error copy", pattern: /diagnosis error/i },
  { name: "diagnostic-level copy", pattern: /diagnostic-level/i },
  { name: "medical certainty", pattern: /medical certainty[^.]*without/i }
];

const failures = [];

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");

  for (const check of checks) {
    if (check.pattern.test(text)) failures.push(`${file}: ${check.name}`);
  }
}

if (failures.length > 0) {
  console.error("Arbor safety copy eval failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Arbor safety copy eval passed.");
