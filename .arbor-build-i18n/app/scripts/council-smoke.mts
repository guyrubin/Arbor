/**
 * Live verification of the multi-agent scholar council (SAGE-2): selects the
 * council, runs each scholar agent as its own real Vertex call in parallel, and
 * confirms we get N distinct, non-empty lensed takes. Auth via gcloud ADC.
 *
 *   npx tsx scripts/council-smoke.mts
 */
import { loadConfig } from "../src/config/env.js";
import { createModelProvider } from "../src/ai/modelRouter.js";
import { selectCouncil, runScholarTakes } from "../src/services/council.js";
import { INTEGRATED } from "../src/services/scholars.js";

const run = async () => {
  process.env.MODEL_PROVIDER = "vertex";
  process.env.GCP_PROJECT_ID ||= "arborprd-westeu";
  process.env.FIREBASE_PROJECT_ID ||= "arborprd-westeu";
  process.env.GCP_REGION ||= "europe-west4";
  process.env.VERTEX_LOCATION ||= "europe-west4";
  process.env.MEMORY_ADAPTER = "firestore";
  process.env.ENABLE_LOCAL_MEMORY_ADAPTER = "false";

  const config = loadConfig();
  const provider = createModelProvider(config);

  const childProfile = { name: "Dylan", age: 5, domains: ["attachment_regulation", "language_communication"] };
  const council = selectCouncil(INTEGRATED, childProfile.domains, 3);
  console.log("[council-smoke] council:", council.map((s) => s.name).join(", "));

  const message = "Every morning Dylan refuses to get dressed for school and it ends in a meltdown.";
  const takes = await runScholarTakes(provider, council, { message, childProfile });

  for (const t of takes) console.log(`\n• ${t.name} (${t.concept})\n  takeaway: ${t.takeaway}\n  suggestion: ${t.suggestion}`);

  const distinct = new Set(takes.map((t) => t.takeaway)).size;
  if (takes.length >= 2 && takes.every((t) => t.takeaway && t.suggestion) && distinct === takes.length) {
    console.log(`\n✅ COUNCIL OK — ${takes.length} distinct scholar agents deliberated against the live model.`);
    process.exit(0);
  }
  console.error("\n❌ COUNCIL WEAK — takes missing or not distinct.");
  process.exit(1);
};

run().catch((e) => { console.error("❌ council-smoke failed:", e?.message || e); process.exit(1); });
