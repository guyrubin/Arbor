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
function harness(mediaFails = false, consent = "granted") {
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
  it("without child voice consent local recording never starts platform ASR", async () => {
    const h = harness(false, "denied"); await h.start();
    expect(h.states).toEqual(["recording"]);
    expect(h.recognitionStart).not.toHaveBeenCalled();
  });
});
