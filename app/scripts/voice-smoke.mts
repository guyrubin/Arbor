/**
 * eval:voice-live (EVAL-2) — the LIVE budget tier of evals/voice-loop-v1.
 *
 * Streams one real spoken-register reply through the production model route
 * (`analysis_structured`, the same route /api/voice uses) and ENFORCES the
 * voice-loop latency budgets from the AI-excellence plan:
 *   - firstTokenMs        < 2000  (time to first streamed token)
 *   - firstSentenceMs     < 2500  (first COMPLETE sentence available — the
 *                                  cadence number the parent actually feels)
 *   - totalMs             < 8000  (full reply)
 *
 * Every run appends one JSON line to evals/voice-loop-v1.results.jsonl —
 * append-only, so latency is trendable across model/config changes:
 *   {ts, model, firstTokenMs, firstSentenceMs, totalMs, chunks, pass}
 *
 * Requires real Vertex ADC (this is the live tier — CI runs the deterministic
 * tier in src/routes/voiceLoopEval.test.ts instead). Run: npm run eval:voice-live
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../src/config/env.js";
import { createModelProvider } from "../src/ai/modelRouter.js";
import { splitCompleteSentences } from "../src/lib/sentenceStream.js";

process.env.MODEL_PROVIDER = "vertex";
process.env.GCP_PROJECT_ID ||= "arborprd-westeu";
process.env.FIREBASE_PROJECT_ID ||= "arborprd-westeu";
process.env.GCP_REGION ||= "europe-west4";
process.env.VERTEX_LOCATION ||= "europe-west4";
process.env.MEMORY_ADAPTER = "firestore";
process.env.ENABLE_LOCAL_MEMORY_ADAPTER = "false";

const BUDGETS = { firstTokenMs: 2000, firstSentenceMs: 2500, totalMs: 8000 } as const;

const config = loadConfig();
const provider = createModelProvider(config);
// The /api/voice prompt routes to analysis_structured — record THAT model.
const model = config.vertexModelAnalysis;

let chunks = 0;
let full = "";
const t0 = Date.now();
let firstTokenMs = 0;
let firstSentenceMs = 0;

for await (const c of provider.streamText({ route: "analysis_structured", temperature: 0.6, prompt:
  "You are Arbor, a warm parenting coach speaking aloud. The parent says: 'My 5-year-old melts down every school dropoff.' Reply in 2-3 short spoken sentences, plain text, non-diagnostic." })) {
  if (!firstTokenMs) firstTokenMs = Date.now() - t0;
  chunks++;
  full += c;
  // Cadence probe: the same pure splitter the client voice loop uses.
  if (!firstSentenceMs && splitCompleteSentences(full).complete.length > 0) {
    firstSentenceMs = Date.now() - t0;
  }
}
const totalMs = Date.now() - t0;
// A terminal sentence with no trailing whitespace only completes at stream end.
if (!firstSentenceMs && splitCompleteSentences(`${full} `).complete.length > 0) firstSentenceMs = totalMs;

const failures: string[] = [];
if (chunks < 1 || full.trim().length <= 20) failures.push(`reply too short (chunks=${chunks}, len=${full.trim().length})`);
if (firstTokenMs >= BUDGETS.firstTokenMs) failures.push(`firstTokenMs ${firstTokenMs} >= ${BUDGETS.firstTokenMs}`);
if (!firstSentenceMs || firstSentenceMs >= BUDGETS.firstSentenceMs) failures.push(`firstSentenceMs ${firstSentenceMs || "n/a"} >= ${BUDGETS.firstSentenceMs}`);
if (totalMs >= BUDGETS.totalMs) failures.push(`totalMs ${totalMs} >= ${BUDGETS.totalMs}`);

// Append-only trend line (evals/voice-loop-v1.results.jsonl at the repo root).
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const resultsPath = path.join(repoRoot, "evals", "voice-loop-v1.results.jsonl");
const row = { ts: new Date().toISOString(), model, firstTokenMs, firstSentenceMs, totalMs, chunks, pass: failures.length === 0 };
fs.appendFileSync(resultsPath, `${JSON.stringify(row)}\n`);

console.log(`[eval:voice-live] model=${model} chunks=${chunks} firstTokenMs=${firstTokenMs} firstSentenceMs=${firstSentenceMs} totalMs=${totalMs}`);
console.log(`[eval:voice-live] reply: ${full.trim()}`);
console.log(`[eval:voice-live] appended → ${path.relative(process.cwd(), resultsPath)}`);

if (failures.length === 0) {
  console.log("✅ VOICE LIVE BUDGETS OK — streamed within the voice-loop-v1 latency budgets.");
  process.exit(0);
}
console.error(`❌ voice live budgets FAILED:\n  - ${failures.join("\n  - ")}`);
process.exit(1);
