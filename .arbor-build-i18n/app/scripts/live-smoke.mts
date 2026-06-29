/**
 * Live verification of Gemini Live streaming: open a real Live session and
 * exchange one turn. Proves the Live integration works before the client is
 * built on it. Uses GEMINI_API_KEY.
 *
 *   npx tsx scripts/live-smoke.mts
 */
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const MODELS = ["gemini-2.0-flash-live-001", "gemini-live-2.5-flash-preview"];

const tryModel = (ai: GoogleGenAI, model: string, modality: Modality) =>
  new Promise<{ text: string; audioBytes: number }>((resolve, reject) => {
    let text = "";
    let audioBytes = 0;
    let settled = false;
    let session: any = null;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      try { session?.close(); } catch { /* ignore */ }
      err ? reject(err) : resolve({ text, audioBytes });
    };
    ai.live
      .connect({
        model,
        config: { responseModalities: [modality] },
        callbacks: {
          onopen: () => {},
          onmessage: (msg: any) => {
            const parts = msg?.serverContent?.modelTurn?.parts || [];
            for (const p of parts) {
              if (p.text) text += p.text;
              if (p.inlineData?.data) audioBytes += Buffer.from(p.inlineData.data, "base64").length;
            }
            if (msg?.serverContent?.turnComplete) finish();
          },
          onerror: (e: any) => finish(new Error(e?.message || "live error")),
          onclose: () => finish(),
        },
      })
      .then((s) => {
        session = s;
        s.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Say hello to a parent in one short sentence." }] }], turnComplete: true });
        setTimeout(() => finish(), 20000);
      })
      .catch(finish);
  });

const run = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { console.error("❌ no GEMINI_API_KEY"); process.exit(1); }
  const ai = new GoogleGenAI({ apiKey });

  for (const model of MODELS) {
    for (const modality of [Modality.AUDIO, Modality.TEXT]) {
      try {
        console.log(`[live-smoke] ${model} (${modality})…`);
        const r = await tryModel(ai, model, modality);
        if (r.text.trim() || r.audioBytes > 0) {
          console.log(`[live-smoke] ${model} replied — text:"${r.text.trim()}" audioBytes:${r.audioBytes}`);
          console.log(`✅ GEMINI LIVE OK — bidirectional ${modality} session worked on ${model}.`);
          process.exit(0);
        }
        console.log(`[live-smoke] ${model} (${modality}) connected, empty turn.`);
      } catch (e: any) {
        console.log(`[live-smoke] ${model} (${modality}) failed: ${e?.message || e}`);
      }
    }
  }
  console.error("❌ No Live model produced output.");
  process.exit(1);
};

run();
