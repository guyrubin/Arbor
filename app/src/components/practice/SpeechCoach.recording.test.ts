import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Run the production startRecording closure. Media/React boundaries alone
// are synthetic; this catches a nested-ASR failure resetting a live recorder.
const file = ts.createSourceFile("SpeechCoachTab.tsx", fs.readFileSync(path.join(__dirname, "SpeechCoachTab.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let body = "";
const walk = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === "startRecording") body = node.initializer!.getText(file);
  ts.forEachChild(node, walk);
};
walk(file);
if (!body) throw new Error("Missing production recorder");
function harness(mediaFails = false, consent = "granted", unmounted = false) {
  const trackStop = vi.fn(), recognitionStart = vi.fn(() => { throw new DOMException("ASR unavailable", "NotAllowedError"); });
  const states: string[] = [], errors: unknown[] = [];
  const stream = { getTracks: () => [{ stop: trackStop }] };
  const mediaRef = { current: null as any };
  const scope = {
    setMicError: (error: unknown) => errors.push(error), setHeard: vi.fn(), setAutoResult: vi.fn(), setLastSaved: vi.fn(), cleanupAudio: vi.fn(),
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    MediaRecorder: class { stream = stream; state = "inactive"; start() { if (mediaFails) throw new Error("device lost"); this.state = "recording"; } },
    chunksRef: { current: [] }, mediaRef, recogRef: { current: null }, setRecState: (state: string) => states.push(state),
    setAudioUrl: vi.fn(), scoreUtterance: vi.fn(), level: "word", autoVerdictOk: true,
    voiceConsent: consent, platformAsrAllowed: (value: string) => value === "granted",
    getRecognitionCtor: () => class { start = recognitionStart; }, recognitionLangFor: () => "en-US", aiLang: "en",
    target: "sun", sound: { id: "s" }, kidMode: false, t: (key: string) => key,
    // B-KID-41: the record path runs only with the control shown (micHidden false).
    micHidden: false, sittingCounted: { current: false },
    // B-KID-74: the world can be left while the mic open is pending.
    unmountedRef: { current: unmounted },
  };
  const compiled = ts.transpileModule(`return (${body});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const start = new Function(...Object.keys(scope), compiled)(...Object.values(scope));
  return { start, states, errors, trackStop, recognitionStart, mediaRef };
}

describe("speech practice recording ownership", () => {
  it("optional browser ASR startup failure leaves the actual recorder usable", async () => {
    const h = harness(); await h.start();
    expect(h.states).toEqual(["recording"]);
    expect(h.mediaRef.current.state).toBe("recording");
    expect(h.trackStop).not.toHaveBeenCalled();
    expect(h.errors).toEqual([null]);
  });
  it("actual MediaRecorder startup failure releases the mic and explains the error", async () => {
    const h = harness(true); await h.start();
    expect(h.trackStop).toHaveBeenCalledTimes(1);
    expect(h.states).toEqual(["idle"]);
    expect(h.errors.at(-1)).toBe("prac.speech.micError");
  });
  it("B-KID-74: a stream that arrives after the world was left is stopped at once; nothing records", async () => {
    const h = harness(false, "granted", true); await h.start();
    expect(h.trackStop).toHaveBeenCalledTimes(1);
    expect(h.states).toEqual([]);
    expect(h.mediaRef.current).toBeNull();
  });
  it("without child voice consent local recording never starts platform ASR", async () => {
    const h = harness(false, "denied"); await h.start();
    expect(h.states).toEqual(["recording"]);
    expect(h.recognitionStart).not.toHaveBeenCalled();
  });
});


/* B-KID-03 — the network spy: with voice consent GRANTED, a Kid Mode recording
   runs its full lifecycle (start → stop → onstop) through the production
   closure and the REAL gates, and never reaches /api/score-utterance nor the
   platform recogniser. The parent path with the same grant still scores. */
async function kidRound(kidMode: boolean) {
  const gate = await import("./speechConsentGate");
  const scoreUtterance = vi.fn(async () => ({ source: "cloud", result: "got", heard: "sun" }));
  const recognitionStart = vi.fn();
  const noteKidActivity = vi.fn();
  const stream = { getTracks: () => [{ stop: vi.fn() }] };
  const mediaRef = { current: null as any };
  class Recorder {
    stream = stream; state = "inactive"; mimeType = "audio/webm"; onstop: null | (() => Promise<void>) = null; ondataavailable: unknown = null;
    start() { this.state = "recording"; }
    async stop() { this.state = "inactive"; await this.onstop?.(); }
  }
  const scope = {
    setMicError: vi.fn(), setHeard: vi.fn(), setAutoResult: vi.fn(), setLastSaved: vi.fn(), cleanupAudio: vi.fn(),
    navigator: { mediaDevices: { getUserMedia: async () => stream } },
    MediaRecorder: Recorder, Blob, URL: { createObjectURL: () => "blob:local" },
    chunksRef: { current: [] }, mediaRef, recogRef: { current: null }, setRecState: vi.fn(),
    setAudioUrl: vi.fn(), scoreUtterance, level: "word", autoVerdictOk: true,
    voiceConsent: "granted", platformAsrAllowed: gate.platformAsrAllowed, speechScoringAllowed: gate.speechScoringAllowed,
    getRecognitionCtor: () => class { start = recognitionStart; }, recognitionLangFor: () => "en-US", aiLang: "en",
    target: "sun", sound: { id: "s" }, kidMode, t: (key: string) => key, noteKidActivity,
    // B-KID-41: an already-granted mic in Kid Mode (the record button is shown).
    micHidden: false, sittingCounted: { current: false }, unmountedRef: { current: false },
  };
  const compiled = ts.transpileModule(`return (${body});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const start = new Function(...Object.keys(scope), compiled)(...Object.values(scope));
  await start();
  await mediaRef.current.stop();
  return { scoreUtterance, recognitionStart, noteKidActivity };
}

describe("B-KID-03 · Kid Mode recording never scores (network spy)", () => {
  it("consent granted + Kid Mode → 0 calls to /api/score-utterance, 0 recogniser starts; one kid activity counted", async () => {
    const kid = await kidRound(true);
    expect(kid.scoreUtterance).not.toHaveBeenCalled();
    expect(kid.recognitionStart).not.toHaveBeenCalled();
    expect(kid.noteKidActivity).toHaveBeenCalledTimes(1);
  });
  it("positive control: the parent door with the same grant still scores and still recognises", async () => {
    const parent = await kidRound(false);
    expect(parent.scoreUtterance).toHaveBeenCalledTimes(1);
    expect(parent.recognitionStart).toHaveBeenCalledTimes(1);
    expect(parent.noteKidActivity).not.toHaveBeenCalled();
  });
});

/* B-KID-41 (KC-15) — the record path never reaches getUserMedia while the
   control is hidden (Kid Mode without an already-granted microphone). */
describe("B-KID-41 · no permission prompt in front of the child", () => {
  it("micHidden → startRecording returns before getUserMedia", async () => {
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [] }));
    const scope = {
      micHidden: true, setMicError: vi.fn(), setHeard: vi.fn(), setAutoResult: vi.fn(), setLastSaved: vi.fn(), cleanupAudio: vi.fn(),
      navigator: { mediaDevices: { getUserMedia } }, MediaRecorder: class {}, chunksRef: { current: [] }, mediaRef: { current: null },
      recogRef: { current: null }, setRecState: vi.fn(), setAudioUrl: vi.fn(), kidMode: true, t: (key: string) => key,
    };
    const compiled = ts.transpileModule(`return (${body});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    await new Function(...Object.keys(scope), compiled)(...Object.values(scope))();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
