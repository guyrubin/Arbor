import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [
  "server.ts",
  "metadata.json",
  "src/App.tsx",
  "src/initialData.ts",
  "src/types.ts"
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
    if (check.pattern.test(text)) {
      failures.push(`${file}: ${check.name}`);
    }
  }
}

const serverText = fs.readFileSync(path.join(root, "server.ts"), "utf8");
const appText = fs.readFileSync(path.join(root, "src", "App.tsx"), "utf8");
const structuralChecks = [
  { name: "coach frameRouting contract", passed: /frameRouting/.test(serverText) },
  { name: "memory ledger path", passed: /MEMORY_LEDGER_PATH/.test(serverText) },
  { name: "memory review read endpoint", passed: /app\.get\("\/api\/memory\/:childId"/.test(serverText) },
  { name: "memory review update endpoint", passed: /app\.patch\("\/api\/memory\/:memoryId"/.test(serverText) },
  { name: "parent approval queue UI", passed: /Parent approval queue/.test(appText) }
];

for (const check of structuralChecks) {
  if (!check.passed) failures.push(`structural: ${check.name}`);
}

if (failures.length > 0) {
  console.error("Arbor safety copy eval failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Arbor safety copy eval passed.");
