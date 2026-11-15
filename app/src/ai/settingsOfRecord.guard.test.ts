/**
 * AI settings of record (15 Nov 2026). The voice went mechanical "after we
 * fixed it multiple times" because the settings that decide how Arbor sounds
 * and answers could change with no test failing: the voice timings, the Live
 * model and voice, the book narrator's models, and every sampling temperature.
 *
 * This file pins them. It is a ledger, not a judgement: a value here is the
 * value production runs, and changing one is allowed. It then fails here, so
 * the change is made on purpose, in one diff, next to the eval or listening
 * check that justifies it (AGENTS.md: a prompt or model change needs the
 * matching eval run). Model ids of the text routes stay in
 * evals/pinned-models.json (check:acceptance); prompt bytes in
 * ai/prompts.ts PROMPT_VERSIONS.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { ARBOR_VOICE_NAME, liveSpeechConfig } from "../lib/livePersona";
import { NARRATION_VOICE } from "../lib/library/narrationTts";

const SRC = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const deploy = fs.readFileSync(path.join(SRC, "..", "..", "cloudbuild.prod.yaml"), "utf8");
const temperatures = (rel: string) =>
  [...stripComments(read(rel)).matchAll(/temperature: (?:options\.temperature \?\? )?([0-9.]+)/g)].map((m) => Number(m[1]));
const constant = (rel: string, name: string) =>
  Number((stripComments(read(rel)).match(new RegExp(`const ${name} = ([0-9_]+);`))?.[1] ?? "NaN").replace(/_/g, ""));

describe("voice settings of record", () => {
  it("one voice: Talk, read-aloud and books", () => {
    expect(ARBOR_VOICE_NAME).toBe("Sulafat");
    expect(liveSpeechConfig("en")).toEqual({ languageCode: "en-US", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } });
    expect(liveSpeechConfig("he")).toEqual({ languageCode: "he-IL", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Sulafat" } } });
    expect(deploy).toContain("TTS_PROVIDER=google");
    expect(deploy).toContain("TTS_VOICE_EN=en-US-Chirp3-HD-Sulafat");
    expect(deploy).toContain("TTS_VOICE_HE=he-IL-Chirp3-HD-Sulafat");
    expect(NARRATION_VOICE.voice).toBe("Sulafat");
  });

  it("the Talk model in code and in the deploy file", () => {
    expect(stripComments(read("config/env.ts"))).toContain('liveModel: process.env.LIVE_MODEL || "gemini-3.8-live"');
    expect(deploy).toContain("LIVE_ENABLED=true");
    expect(deploy).toContain("LIVE_MODEL=gemini-3.8-live");
  });

  it("the book narrator's models, English and Hebrew", () => {
    expect(NARRATION_VOICE.en).toEqual({ model: "gemini-2.5-pro-tts", languageCode: "en-US" });
    expect(NARRATION_VOICE.he).toEqual({ model: "gemini-3.1-flash-tts-preview", languageCode: "he-IL" });
    // The deploy file sets no override, so the two defaults above are production.
    expect(deploy).not.toMatch(/BOOK_TTS_MODEL_(EN|HE)=/);
  });

  it("voice timings: how long a line may take to start, and when a session gives up", () => {
    expect(constant("lib/voice.ts", "NEURAL_ONLY_TTFB_MS")).toBe(8000);
    expect(constant("lib/voice.ts", "NATURAL_TTFB_MS")).toBe(1500);
    expect(constant("lib/voice.ts", "NATURAL_DEGRADE_AFTER")).toBe(3);
    expect(constant("lib/voice.ts", "NATURAL_RETRY_MS")).toBe(30000);
  });

  it("production never falls to the device voice: a configured or unanswered probe withholds it", () => {
    const natural = stripComments(read("lib/naturalVoice.ts"));
    expect(natural.match(/setDeviceVoiceAllowed\(false\)/g)?.length).toBe(1);
    expect(natural).toMatch(/const unanswered = \(\) => \{ if \(generation === scope\) useNeuralOnly\(\); \};/);
    expect(natural).toMatch(/catch \{ unanswered\(\);/);
    expect(stripComments(read("lib/voice.ts"))).toContain("(opts.neuralOnly === true || !deviceVoiceAllowed) && !!naturalSynth");
  });
});

describe("sampling temperatures of record", () => {
  // In source order. A new model call adds its value here in the same diff.
  it("routes/api.ts", () => {
    expect(temperatures("routes/api.ts")).toEqual([0.45, 0.4, 0.6, 0.2, 0.1, 0.1, 0.5, 0.5, 0, 0.3, 0.8, 0.7, 0.7, 0.5]);
  });
  it("the router defaults, per provider path", () => {
    expect(temperatures("ai/modelRouter.ts")).toEqual([0.4, 0.4, 0.5, 0.35, 0.35, 0.5]);
    expect(temperatures("ai/claudeVertexProvider.ts")).toEqual([0.45]);
  });
  it("server/plans.ts", () => {
    expect(temperatures("server/plans.ts")).toEqual([0.2]);
  });
});
