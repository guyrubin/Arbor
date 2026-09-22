/** Explicit release verification against a disposable synthetic account; no real family data. */
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import { GoogleGenAI, Modality } from "@google/genai";

const expected = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(expected || "")) throw new Error("Pass the exact deployed commit SHA.");
const origin = "https://arborparentingapp.com";
const rows: Array<Record<string, unknown>> = [];
let idToken = "";
let syntheticUid = "";
const childId = `release-smoke-${randomUUID()}`;
const childProfile = { id: childId, name: "Noa", age: 4, strengths: ["building blocks"], challenges: ["morning transitions"] };
const check = (name: string, ok: boolean, details: Record<string, unknown> = {}) => {
  const row = { name, ok, ...details }; rows.push(row); console.log(JSON.stringify(row));
};
const call = async (route: string, body?: unknown, stream = false) => {
  const start = Date.now();
  const response = await fetch(`${origin}/api/${route}`, { method: body === undefined ? "GET" : "POST", headers: { ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}), "Content-Type": "application/json", ...(stream ? { Accept: "text/event-stream" } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
  const text = await response.text();
  return { status: response.status, ms: Date.now() - start, data: stream ? text : JSON.parse(text) };
};
try {
  const health = await call("health");
  const stamp = await (await fetch(`${origin}/timestamp.txt`, { cache: "no-store" })).text();
  check("API and Hosting exact revision", health.data.version === expected && stamp.startsWith(expected + "-"), { apiVersion: health.data.version, hostingRevision: stamp.trim() });
  if (!rows.at(-1)?.ok) throw new Error("Release revision mismatch; no account created.");
  const config = await (await fetch("https://arborprd-westeu.web.app/__/firebase/init.json")).json();
  if (config.projectId !== "arborprd-westeu" || !config.apiKey) throw new Error("Unexpected Firebase project.");
  const signup = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `arbor-release-smoke-${randomUUID()}@example.com`, password: randomBytes(24).toString("base64url"), returnSecureToken: true }), signal: AbortSignal.timeout(20000) });
  const account = await signup.json();
  if (!signup.ok || !account.idToken || !account.localId) throw new Error(`Synthetic signup HTTP ${signup.status}`);
  idToken = account.idToken; syntheticUid = account.localId;
  const onboard = await call("onboarding/family-child", { childId, childProfile });
  check("Synthetic family onboarding", onboard.status === 200 && onboard.data.userId === syntheticUid, { status: onboard.status });
  if (!rows.at(-1)?.ok) throw new Error("Synthetic onboarding failed.");
  const coach = await call("chat", { childProfile, language: "en", message: "What is one small way to make tomorrow morning less rushed?" });
  check("Parent coaching", coach.status === 200 && !!coach.data.contract && !coach.data.outputBlocked, { status: coach.status, ms: coach.ms });
  const voice = await call("voice", { childProfile, contextChildId: childId, language: "en", message: "What were we going to try?", recentTurns: [{ role: "coach", text: "You could choose tomorrow's shoes together before bedtime." }, { role: "parent", text: "Yes, we'll choose the shoes tonight." }] }, true);
  check("Screened voice continuity", voice.status === 200 && /event: done/.test(voice.data) && /shoes/i.test(voice.data) && !/event: error/.test(voice.data), { status: voice.status, ms: voice.ms });
  for (const language of ["en", "he"]) {
    const speech = await call("tts", { language, text: language === "he" ? "אפשר לנסות צעד קטן ביחד." : "We can try one small step together." });
    check(`Read aloud ${language}`, speech.status === 200 && !!(speech.data.audio || speech.data.audioContent || speech.data.audioBase64), { status: speech.status, ms: speech.ms });
  }
  const clean = await call("live/turn", { childId, role: "model", language: "en", text: "You could choose tomorrow's shoes together tonight." });
  check("Live clean turn screening", clean.status === 200 && clean.data.action === "continue", { status: clean.status });
  const crisis = await call("live/turn", { childId, role: "user", language: "en", text: "I might hurt myself." });
  check("Live crisis handling", crisis.status === 200 && crisis.data.action === "stop_crisis" && !!crisis.data.resourcesMarkdown, { status: crisis.status });
  const live = await call("live/token", { childProfile, contextChildId: childId, language: "en", recentTurns: [] });
  check("Live constrained token", live.status === 200 && live.data.available && !!live.data.token && live.data.model === "gemini-3.8-live", { status: live.status, model: live.data.model });
  if (rows.at(-1)?.ok) {
    const start = Date.now(); let audioChunks = 0; let transcriptChars = 0;
    await new Promise<void>(resolve => {
      let finished = false; let session: any;
      const finish = (error?: string) => { if (finished) return; finished = true; clearTimeout(timer); session?.close(); check("Live ephemeral audio", !error && audioChunks > 0 && transcriptChars > 0, { ms: Date.now()-start, audioChunks, transcriptChars, ...(error ? { error } : {}) }); resolve(); };
      const timer = setTimeout(() => finish("Live timeout"), 25000);
      new GoogleGenAI({ apiKey: live.data.token, httpOptions: { apiVersion: "v1beta" } }).live.connect({ model: live.data.model,
        config: { responseModalities: [Modality.AUDIO], systemInstruction: live.data.systemInstruction, speechConfig: live.data.speechConfig, inputAudioTranscription: {}, outputAudioTranscription: {} },
        callbacks: { onopen() {}, onerror: () => finish("Live transport error"), onclose: () => finish("Live closed early"), onmessage: (message: any) => {
          if (message.setupComplete) setTimeout(() => session?.sendClientContent({ turns: [{ role: "user", parts: [{ text: "Hello. Say one short warm greeting." }] }], turnComplete: true }), 50);
          const content = message.serverContent;
          for (const part of content?.modelTurn?.parts || []) if (part.inlineData) audioChunks++;
          transcriptChars += content?.outputTranscription?.text?.length || 0;
          if (content?.turnComplete) finish();
        } }
      }).then(s => { session = s; if (finished) s.close(); }).catch(() => finish("Live connect rejected"));
    });
  }
} catch (error) {
  check("Smoke execution", false, { error: error instanceof Error ? error.message.slice(0,200) : "Unknown error" });
} finally {
  if (idToken && syntheticUid) {
    // This token belongs only to the account created by this execution; never accept external identities.
    try {
      const cleanup = await call("account/delete", { confirm: "DELETE" });
      check("Synthetic account and data erased", cleanup.status === 200 && cleanup.data.uid === syntheticUid && cleanup.data.complete === true && cleanup.data.authDeleted === true, { status: cleanup.status, complete: cleanup.data.complete, authDeleted: cleanup.data.authDeleted, classes: cleanup.data.classes });
    } catch { check("Synthetic account and data erased", false, { error: "Cleanup failed; inspect the release test identity before retrying." }); }
  }
  const report = { ts: new Date().toISOString(), origin, expectedCommit: expected, syntheticDataOnly: true, syntheticUid, rows };
  fs.writeFileSync(process.argv[3] || "../docs/audits/2026-09-22-ai-foundation/production-smoke.json", JSON.stringify(report, null, 2));
}
if (rows.some(row => !row.ok)) process.exitCode = 1;
