/**
 * geminiLiveClient wiring (VC-1 conditions 1-3 + AI-V9) — the vitest env is
 * node-only (no AudioContext / getUserMedia / Live socket), so the client
 * wiring is pinned in the house source-guard pattern (same as
 * coachLiveGate.test.ts): the behavioral state machine itself is fully covered
 * in liveTurnGuard.test.ts against the real guard.
 *
 * What this pins closed:
 *  - playChunk is module-PRIVATE and reachable ONLY as the guard's sink — no
 *    socket message routes to playback directly (the pre-VC-1 client played
 *    every `msg.data` the instant it arrived);
 *  - input+output transcription are always requested in live.connect;
 *  - the socket handler feeds the guard (pushAudio / transcriptions /
 *    endModelTurn), and the old unscreened `parts → onText` relay is gone;
 *  - the guard's lexical screen is the SHARED outputScreenLexical module (the
 *    server path re-exports the same function — byte-identical patterns);
 *  - CoachTab persists Live turns via the COACH-2 reducers only and passes the
 *    server-pinned persona from the token response (AI-V9: no client-side
 *    persona source of truth).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildLiveSystemInstruction,
  liveSpeechConfig,
  LIVE_SYSTEM_INSTRUCTION,
  HE_SPOKEN_DIRECTIVE,
  SPOKEN_COACH_PERSONA,
} from "./livePersona";
import { NON_DIAGNOSTIC_CONTRACT } from "../contracts/coach";

const SRC_ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const client = stripComments(read("lib/geminiLiveClient.ts"));
const coach = stripComments(read("components/tabs/CoachTab.tsx"));
const routes = stripComments(read("routes/api.ts"));

describe("VC-1 — playChunk is unreachable except via the guard", () => {
  it("playChunk is module-private (defined once, never exported)", () => {
    expect(client.match(/const playChunk =/g)?.length).toBe(1);
    expect(client).not.toMatch(/export[^\n]*playChunk/);
  });

  it("the ONLY playChunk call site is the guard's sink", () => {
    // The definition reads `const playChunk = (…` — so `playChunk(` matches
    // invocations only. Exactly one exists: inside the guard's sink lambda.
    const calls = client.match(/playChunk\(/g) ?? [];
    expect(calls.length).toBe(1);
    expect(client).toMatch(/sink:\s*\(b64\) => \{[^}]*playChunk\(b64\)/);
  });

  it("socket messages route audio through guard.pushAudio, never playback", () => {
    expect(client).toContain("guard.pushAudio(msg.data)");
    expect(client).not.toMatch(/playChunk\(msg/);
  });

  it("the unscreened parts→onText relay is gone (no raw model text reaches a parent)", () => {
    expect(client).not.toContain("modelTurn?.parts");
    expect(client).not.toMatch(/onText/);
  });
});

describe("VC-1 condition 1 — transcription always on, absence handled by the guard", () => {
  it("live.connect requests input AND output audio transcription", () => {
    const connect = /ai\.live\.connect\(\{[\s\S]*?callbacks:/.exec(client)?.[0] ?? "";
    expect(connect).toContain("inputAudioTranscription: {}");
    expect(connect).toContain("outputAudioTranscription: {}");
  });

  it("transcription + turn-complete events feed the guard", () => {
    expect(client).toContain("guard.pushInputTranscription(sc.inputTranscription.text)");
    expect(client).toContain("guard.pushOutputTranscription(sc.outputTranscription.text)");
    expect(client).toContain("guard.endModelTurn()");
  });

  it("the guard's lexical screen is the shared outputScreenLexical module", () => {
    expect(client).toContain('from "../safety/outputScreenLexical"');
    expect(client).toContain("screenLexical: screenModelOutputLexical");
  });

  it("the guard's halt closes the WHOLE session (stop before render)", () => {
    expect(client).toContain("halt: stopAll");
  });
});

describe("VC-3 / COACH-2 — CoachTab persists Live turns via the existing reducers only", () => {
  it("Live handlers use appendVoiceUserTurn / appendVoiceAiDelta / finalizeVoiceAiTurn", () => {
    const live = /startGeminiLive\(([\s\S]*?)\n          \);/.exec(coach)?.[1] ?? "";
    expect(live).toContain("appendVoiceUserTurn(text)");
    expect(live).toContain("appendVoiceAiDelta(text)");
    expect(live).toContain("finalizeVoiceAiTurn()");
  });

  it("the per-turn screen posts to api.liveTurn (the authoritative server screen)", () => {
    expect(coach).toContain("api.liveTurn({ role, text");
  });

  it("VC-5: fail-closed degrade shows the visible notice and starts the screened browser loop", () => {
    const fail = /onFailClosed: \(\) => \{[\s\S]*?\},/.exec(coach)?.[0] ?? "";
    expect(fail).toContain('t("coach.toast.voiceStandardMode")');
    expect(fail).toContain("startBrowserVoice()");
  });
});

describe("AI-V9 — one source of truth for the spoken persona", () => {
  it("the HE directive lands in the Live instruction when the language is he", () => {
    expect(buildLiveSystemInstruction("he")).toContain(HE_SPOKEN_DIRECTIVE.trim());
    expect(buildLiveSystemInstruction("en")).not.toContain(HE_SPOKEN_DIRECTIVE.trim());
    expect(buildLiveSystemInstruction(undefined)).toBe(LIVE_SYSTEM_INSTRUCTION);
  });

  it("the instruction embeds the NON_DIAGNOSTIC_CONTRACT + spoken persona", () => {
    const he = buildLiveSystemInstruction("he");
    expect(he).toContain(NON_DIAGNOSTIC_CONTRACT);
    expect(he).toContain(SPOKEN_COACH_PERSONA);
  });

  it("speechConfig picks a per-language voice/locale", () => {
    expect(liveSpeechConfig("he").languageCode).toBe("he-IL");
    expect(liveSpeechConfig("en").languageCode).toBe("en-US");
    expect(liveSpeechConfig("he").voiceConfig.prebuiltVoiceConfig.voiceName).toBeTruthy();
  });

  it("grep: the persona string exists ONLY in livePersona.ts — /voice imports it", () => {
    // routes/api.ts must compose from the shared constants, not restate them.
    expect(routes).not.toContain("speaking OUT LOUD to a parent");
    expect(routes).toContain("SPOKEN_COACH_PERSONA");
    expect(routes).toContain("spokenLanguageDirective(language)");
    expect(routes).not.toContain("Reply in warm, natural spoken Hebrew");
    // The client passes the server-pinned instruction from the token response.
    expect(coach).toContain("fresh.systemInstruction");
    expect(coach).not.toContain("speaking OUT LOUD to a parent");
  });
});
