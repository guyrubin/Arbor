/**
 * Listening check for Talk (Gemini Live). Opens a real Live session per
 * language with the SAME instruction and speechConfig the server pins into the
 * token (lib/livePersona), sends one parent line, and writes what the model
 * said as a WAV file plus its transcript. A person then listens: no script can
 * judge whether a voice sounds warm or mechanical.
 *
 *   npx tsx scripts/live-voice-listen.mts <out-dir> [voiceName]
 *
 * Uses GEMINI_API_KEY (.env.local) and spends a few seconds of Live audio per
 * language. Synthetic parent lines only. `voiceName` overrides the pinned voice
 * for an A/B (for example the previous voice).
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, Modality } from "@google/genai";
import { buildLiveSystemInstruction, liveSpeechConfig } from "../src/lib/livePersona.js";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const outDir = process.argv[2];
const voiceOverride = process.argv[3];
if (!outDir) throw new Error("Pass an output directory.");
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
const model = process.env.LIVE_MODEL || "gemini-3.8-live";
fs.mkdirSync(outDir, { recursive: true });

const LINES: Record<"en" | "he", string> = {
  en: "My four year old melted down again at bedtime and I lost my patience. I feel awful. What can I try tomorrow?",
  he: "הבן שלי בן ארבע שוב התפרץ לפני השינה ואיבדתי סבלנות. אני מרגישה נורא. מה אפשר לנסות מחר?",
};

const wav = (pcm: Buffer, rate = 24000) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

const speak = (language: "en" | "he") =>
  new Promise<Record<string, unknown>>((resolve) => {
    const speechConfig = liveSpeechConfig(language);
    if (voiceOverride) speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName = voiceOverride;
    const voice = speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
    const chunks: Buffer[] = [];
    let transcript = "";
    let firstAudioMs = 0;
    let done = false;
    let session: any;
    const start = Date.now();
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { session?.close(); } catch { /* ignore */ }
      const pcm = Buffer.concat(chunks);
      const file = path.join(outDir, `talk-${language}-${voice}.wav`);
      if (pcm.length) fs.writeFileSync(file, wav(pcm));
      resolve({ language, voice, model, ok: !error && pcm.length > 0, error, firstAudioMs, seconds: +(pcm.length / 48000).toFixed(1), transcript: transcript.trim(), file: pcm.length ? file : null });
    };
    const timer = setTimeout(() => finish("timeout"), 40000);
    new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } }).live
      .connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: buildLiveSystemInstruction(language),
          speechConfig,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen() {},
          onerror: (e: any) => finish(`transport error: ${String(e?.message || e).slice(0, 160)}`),
          onclose: (e: any) => finish(`closed early: ${String(e?.reason || "").slice(0, 160)}`),
          onmessage: (message: any) => {
            if (message.setupComplete) session?.sendClientContent({ turns: [{ role: "user", parts: [{ text: LINES[language] }] }], turnComplete: true });
            const content = message.serverContent;
            for (const part of content?.modelTurn?.parts || []) {
              if (part.inlineData?.data) {
                if (!firstAudioMs) firstAudioMs = Date.now() - start;
                chunks.push(Buffer.from(part.inlineData.data, "base64"));
              }
            }
            transcript += content?.outputTranscription?.text || "";
            if (content?.turnComplete) finish();
          },
        },
      })
      .then((s) => { session = s; if (done) s.close(); })
      .catch((e) => finish(`connect rejected: ${String(e?.message || e).slice(0, 160)}`));
  });

const rows = [];
for (const language of ["en", "he"] as const) {
  const row = await speak(language);
  rows.push(row);
  console.log(JSON.stringify(row));
}
fs.writeFileSync(path.join(outDir, `talk-${voiceOverride || "pinned"}.json`), JSON.stringify({ ts: new Date().toISOString(), rows }, null, 2));
if (rows.some((row) => !row.ok)) process.exitCode = 1;
