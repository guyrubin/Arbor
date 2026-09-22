/** Live functional smoke: real providers, local stores, synthetic fixtures only. */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI, Modality } from "@google/genai";
import { startServer } from "./eval-judge.mts";
dotenv.config({ path: ".env.local", quiet: true });
process.env.ARBOR_ENV = "local";
process.env.MEMORY_ADAPTER = "local";
process.env.ENABLE_LOCAL_MEMORY_ADAPTER = "true";
process.env.MODEL_PROVIDER = "vertex";
process.env.GCP_PROJECT_ID ||= "arborprd-westeu";
process.env.VERTEX_MODEL_CHAT = "gemini-2.5-flash";
process.env.VERTEX_MODEL_ANALYSIS = "gemini-2.5-flash";
process.env.LIVE_ENABLED = "true";
process.env.TTS_PROVIDER = "google";
const childProfile = { id: "smoke-synthetic-child", name: "Noa", age: 4, strengths: ["building blocks"], challenges: ["leaving the park"] };
const logs = [{ id: "synthetic-log", date: new Date().toISOString(), behaviorType: "Transition difficulty", trigger: "Leaving the park", response: "Offered a hand and a short countdown", notes: "We walked together", intensity: 2, durationMinutes: 2, context: "Public" }];
const { baseUrl, server, config } = await startServer();
const rows: any[] = [];
const only = process.env.AI_SMOKE_ONLY?.split(",");
const outputDir = path.resolve("../docs/audits/2026-09-22-ai-foundation");
fs.mkdirSync(outputDir, { recursive: true });
const request = async (route: string, body: unknown, accept?: string) => {
  const start = Date.now();
  const response = await fetch(`${baseUrl}/api/${route}`, { method: "POST", headers: { "Content-Type": "application/json", ...(accept ? { Accept: accept } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const text = await response.text();
  const data = accept ? text : JSON.parse(text);
  return { status: response.status, ms: Date.now() - start, data };
};
const test = async (name: string, route: string, body: unknown, valid: (data: any) => boolean, accept?: string) => {
  if (only && !only.includes(name)) return undefined;
  try {
    const { status, ms, data } = await request(route, body, accept);
    const ok = status === 200 && valid(data) && !data?.outputBlocked;
    // Never persist credentials, audio or image bytes in the evidence record.
    const evidence = route === "live/token" ? { available: data.available, model: data.model } : data?.dataUrl ? { image: true, chars: data.dataUrl.length } : (data?.audioContent || data?.audio) ? { audio: true, chars: (data.audioContent || data.audio).length } : data;
    rows.push({ name, route, status, ms, ok, evidence });
    console.log(JSON.stringify({ name, status, ms, ok }));
    fs.writeFileSync(path.join(outputDir, "capability-smoke.json"), JSON.stringify({ ts: new Date().toISOString(), models: { chat: config.vertexModelChat, analysis: config.vertexModelAnalysis, image: config.vertexModelImage, live: config.liveModel }, rows }, null, 2));
    return data;
  } catch (error) { rows.push({ name, route, ok: false, error: error instanceof Error ? error.message.slice(0,300) : "Unknown error" }); console.log(JSON.stringify(rows.at(-1))); }
};
try {
  await test("coach", "chat", { childProfile, language: "en", message: "Leaving the park is hard. What is one small thing to try today?" }, d => !!d.text && !!d.contract);
  await test("council", "council", { childProfile, language: "en", message: "How can we make leaving the park easier without a battle?" }, d => !!d.text && Array.isArray(d.council));
  await test("screened voice", "voice", { childProfile, language: "en", message: "Leaving the park is difficult. Give me one sentence I could say." }, d => /event: delta/.test(d) && /event: done/.test(d) && !/event: error/.test(d), "text/event-stream");
  await test("capture", "extract-log", { childProfile, language: "en", message: "Today at the park, leaving was hard for two minutes. I offered a hand and we walked together." }, d => !!d.behaviorType && typeof d.notes === "string");
  await test("conversation proposals", "conversation/proposals", { childProfile, language: "en", transcript: "Today at the park leaving was hard for two minutes. I offered a hand and we walked together.", milestones: [] }, d => Array.isArray(d.proposals));
  await test("focus", "todays-focus", { childProfile, language: "en", signals: { count: 1, topTrigger: "Leaving the park" } }, d => !!d.focus && !!d.tryToday);
  await test("explain Hebrew", "explain", { childProfile, language: "he", subject: "Taking turns", details: "A four year old learning to share blocks" }, d => /[\u0590-\u05FF]/.test(JSON.stringify(d)));
  await test("plan", "generate-plan", { childProfile, challengeTopic: "A calmer departure from the park" }, d => !!d.title && d.phases?.length > 0);
  await test("transition story", "generate-story", { childName: "Noa", age: 4, topic: "Leaving the park", moral: "We can wave goodbye and return another day" }, d => !!d.title && d.pages?.length > 0);
  await test("hero journey", "generate-hero-journey", { childName: "Noa", age: 4, storyId: "david-and-goliath", language: "en" }, d => !!d.title && !!d.storyId);
  await test("bedtime story", "generate-bedtime-story", { childName: "Noa", age: 4, language: "en", dayEvents: [{ description: "Built a tall block tower with a parent", tone: "positive" }] }, d => !!d.title && d.pages?.length > 0);
  await test("adventure", "generate-adventure", { childProfile, focusSkill: "sequencing" }, d => d.scenes?.length === 3 && d.scenes.every((s: any) => s.choices?.length === 3 && s.choices.filter((c: any) => c.correct).length === 1));
  await test("behavior observations", "analyze-behavior", { childProfile, logs }, d => !!d.expertInsights);
  await test("handoff", "generate-handoff", { childProfile, logs, milestones: [], audience: "teacher", language: "en" }, d => !!d.title && !!d.overview);
  await test("digest", "digest", { childProfile, logs, milestones: [], language: "en" }, d => d.generated === "ai" && !!d.summary);
  await test("read aloud English", "tts", { text: "We can take one small step together.", language: "en" }, d => !!(d.audioContent || d.audioBase64 || d.audio));
  await test("read aloud Hebrew", "tts", { text: "אפשר לנסות צעד קטן ביחד.", language: "he" }, d => !!(d.audioContent || d.audioBase64 || d.audio));
  const avatar = await test("avatar", "generate-avatar", { descriptors: { hair: "brown", vibe: "cheerful cartoon explorer" }, style: "storybook" }, d => d.dataUrl?.startsWith("data:image/"));
  if (avatar?.dataUrl) await test("vision synthetic illustration", "vision", { childProfile, image: avatar.dataUrl, mode: "observe", note: "This is a synthetic cartoon illustration, not a child photo.", language: "en" }, d => typeof d.offTopic === "boolean");
  await test("scene", "generate-scene", { imagePrompt: "A cheerful child and friendly fox build a block tower in a sunny playroom", style: "storybook" }, d => d.dataUrl?.startsWith("data:image/"));
  await test("comic", "generate-comic", { heroName: "Star", theme: "Helping a friend build a block tower", style: "comichero", sfx: ["Yay!"] }, d => d.dataUrl?.startsWith("data:image/"));
  const token = await test("Live session token", "live/token", { childProfile, language: "en", contextChildId: childProfile.id, recentTurns: [] }, d => d.available && !!d.token);
  if (token?.token) {
    const start = Date.now(); let audioChunks = 0; let transcript = "";
    await new Promise<void>((resolve) => {
      let finished = false; let session: any;
      const finish = (error?: string) => { if (finished) return; finished = true; clearTimeout(timer); session?.close(); const ok = !error && audioChunks > 0 && !!transcript; rows.push({ name: "Live ephemeral audio", ok, ms: Date.now()-start, audioChunks, transcript, ...(error ? { error } : {}) }); console.log(JSON.stringify(rows.at(-1))); resolve(); };
      const timer = setTimeout(() => finish("Live smoke timed out"), 25000);
      new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: "v1beta" } }).live.connect({ model: token.model,
        config: { responseModalities: [Modality.AUDIO], systemInstruction: token.systemInstruction, speechConfig: token.speechConfig, inputAudioTranscription: {}, outputAudioTranscription: {} },
        callbacks: { onopen() {}, onerror: () => finish("Live transport error"), onclose: () => finish("Live closed before completion"), onmessage: (message: any) => {
          if (message.setupComplete) setTimeout(() => session?.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello. Say one short warm greeting." }] }], turnComplete: true }), 50);
          const content = message.serverContent; for (const part of content?.modelTurn?.parts || []) if (part.inlineData) audioChunks++;
          if (content?.outputTranscription?.text) transcript += content.outputTranscription.text;
          if (content?.turnComplete) finish();
        } }
      }).then(s => { session = s; if (finished) s.close(); }).catch(() => finish("Live connect rejected"));
    });
  }
} finally {
  fs.writeFileSync(path.join(outputDir, "capability-smoke.json"), JSON.stringify({ ts: new Date().toISOString(), models: { chat: config.vertexModelChat, analysis: config.vertexModelAnalysis, image: config.vertexModelImage, live: config.liveModel }, rows }, null, 2));
  await new Promise<void>(resolve => server.close(() => resolve()));
}
console.log(`Capability smoke: ${rows.filter(r => r.ok).length}/${rows.length} passed`);
if (rows.some(r => !r.ok)) process.exitCode = 1;
