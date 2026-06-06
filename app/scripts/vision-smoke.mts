/**
 * Live multimodal verification: build a known solid-colour PNG in memory and ask
 * the real Vertex Gemini model what colour it is. If the model reports the colour,
 * image parts are reaching the model end-to-end (VIS-1). Auth via gcloud ADC.
 *
 *   npx tsx scripts/vision-smoke.mts
 */
import zlib from "node:zlib";
import { Type } from "@google/genai";
import { loadConfig } from "../src/config/env.js";
import { createModelProvider } from "../src/ai/modelRouter.js";

// --- minimal solid-colour RGB PNG encoder ---
const crcTable = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
};
const solidPng = (size: number, [r, g, b]: [number, number, number]) => {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: size }, () => Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
};

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

  const png = solidPng(96, [20, 160, 90]); // a clear green
  const data = png.toString("base64");
  console.log(`[vision-smoke] sending ${png.length}-byte green PNG to ${config.vertexModelAnalysis} @ ${config.vertexLocation}`);

  const result = await provider.generateJson({
    route: "analysis_structured",
    prompt: "Look at the attached image. What is its single dominant colour? Return JSON only.",
    temperature: 0,
    images: [{ data, mimeType: "image/png" }],
    schema: {
      type: Type.OBJECT,
      required: ["dominantColor", "sawImage"],
      properties: {
        dominantColor: { type: Type.STRING },
        sawImage: { type: Type.BOOLEAN },
      },
    },
  });

  console.log("[vision-smoke] model replied:", JSON.stringify(result));
  const color = String((result as any)?.dominantColor || "").toLowerCase();
  if (color.includes("green")) {
    console.log("✅ VISION OK — the model saw the image and reported the correct colour.");
    process.exit(0);
  }
  console.error("❌ VISION MISMATCH — model did not report green:", color);
  process.exit(1);
};

run().catch((e) => { console.error("❌ vision-smoke failed:", e?.message || e); process.exit(1); });
