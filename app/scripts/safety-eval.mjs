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

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

for (const file of files) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const text = fs.readFileSync(fullPath, "utf8");

  for (const check of checks) {
    if (check.pattern.test(text)) failures.push(`${file}: ${check.name}`);
  }
}

const serverText = read("server.ts");
const appText = read("src/App.tsx");
const routeText = read("src/routes/api.ts");
const safetyText = read("src/safety/escalation.ts");
const contractText = read("src/contracts/coach.ts");
const aiText = read("src/ai/modelRouter.ts");
const configText = read("src/config/env.ts");
const createAppText = read("src/server/createApp.ts");
const firestoreMemoryText = read("src/memory/firestoreMemoryStore.ts");
const safetyFunction = safetyText.match(/export const screenForImmediateEscalation[\s\S]*?^};/m)?.[0] || "";

const structuralChecks = [
  { name: "thin Arbor bootstrap", passed: /createApp/.test(serverText) && /startHttpServer/.test(serverText) },
  { name: "coach frameRouting contract", passed: /frameRouting/.test(contractText) },
  { name: "Zod coach contract validation", passed: /coachResponseZodSchema/.test(routeText) && /zod/.test(contractText) },
  { name: "memory review read endpoint", passed: /router\.get\("\/memory\/:childId"/.test(routeText) },
  { name: "memory review update endpoint", passed: /router\.patch\("\/memory\/:memoryId"/.test(routeText) },
  { name: "Firestore memory adapter", passed: /FirestoreMemoryStore/.test(firestoreMemoryText) },
  { name: "approved memory only injected", passed: /getApprovedMemoryContext/.test(routeText) },
  { name: "Hebrew safety patterns", passed: /להתאבד/.test(safetyText) && /התעללות/.test(safetyText) },
  { name: "caregiver distress safety category", passed: /caregiver_distress/.test(safetyText) },
  { name: "category-specific escalation copy", passed: /renderEscalationMarkdown/.test(safetyText) && /Local Resource Placeholder/.test(safetyText) },
  { name: "typed safety extraction", passed: /extractSafetyText/.test(safetyText) && !/JSON\.stringify/.test(safetyFunction) },
  { name: "streaming chat transport", passed: /generateJsonStream/.test(routeText) && /text\/event-stream/.test(routeText) },
  { name: "Vertex provider boundary", passed: /VertexModelProvider/.test(aiText) && /MODEL_PROVIDER=vertex/.test(configText) },
  { name: "production Firestore guard", passed: /Production Arbor requires MEMORY_ADAPTER=firestore/.test(configText) },
  { name: "Arbor AI Wiki retrieval", passed: /retrieveKnowledgeCards/.test(routeText) && /sourceCardsUsed/.test(contractText) },
  { name: "Express hardening middleware", passed: /helmet/.test(createAppText) && /cors/.test(createAppText) && /rateLimit/.test(createAppText) },
  { name: "client chat abort controller", passed: /AbortController/.test(appText) && /chatAbortRef/.test(appText) },
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
