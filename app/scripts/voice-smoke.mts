import { loadConfig } from "../src/config/env.js";
import { createModelProvider } from "../src/ai/modelRouter.js";
process.env.MODEL_PROVIDER = "vertex";
process.env.GCP_PROJECT_ID ||= "arborprd-westeu";
process.env.FIREBASE_PROJECT_ID ||= "arborprd-westeu";
process.env.GCP_REGION ||= "europe-west4";
process.env.VERTEX_LOCATION ||= "europe-west4";
process.env.MEMORY_ADAPTER = "firestore";
process.env.ENABLE_LOCAL_MEMORY_ADAPTER = "false";
const provider = createModelProvider(loadConfig());
let chunks = 0, full = "";
const t0 = Date.now();
let firstAt = 0;
for await (const c of provider.streamText({ route: "analysis_structured", temperature: 0.6, prompt:
  "You are Arbor, a warm parenting coach speaking aloud. The parent says: 'My 5-year-old melts down every school dropoff.' Reply in 2-3 short spoken sentences, plain text, non-diagnostic." })) {
  if (!firstAt) firstAt = Date.now() - t0;
  chunks++; full += c;
}
console.log(`[voice-smoke] chunks=${chunks} firstTokenMs=${firstAt} totalMs=${Date.now()-t0}`);
console.log(`[voice-smoke] reply: ${full.trim()}`);
if (chunks >= 1 && full.trim().length > 20) { console.log("✅ STREAMING VOICE OK — Gemini streamed the spoken reply in real time."); process.exit(0); }
console.error("❌ streaming voice produced too little."); process.exit(1);
