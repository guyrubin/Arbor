/**
 * AI-V2(a) + AI-V7 — CoachTab voice wiring pins (house source-guard pattern;
 * the vitest env is node-only, so the React handlers are pinned structurally —
 * the decision table itself is behavior-tested in lib/voiceChipAction.test.ts,
 * the overlay in components/coach/VoiceOverlay.test.ts, interim partials in
 * lib/speech.interim.test.ts + lib/dictationLoop.test.ts, and Live barge-in in
 * lib/geminiLiveClient.interrupt.test.ts + lib/liveTurnGuard.test.ts).
 *
 * Pinned closed here:
 *  - the chip tap routes through voiceChipAction — speaking on the fallback
 *    loop INTERRUPTS instead of turning voice off;
 *  - bargeInVoice = flush TTS queue + stopSpeaking + abort the open stream +
 *    finalizeVoiceAiTurn + immediately startListening — and NEVER voice-off;
 *  - an aborted /voice stream does not double-restart listening (barge-in
 *    already did) — only genuine failures recover in the catch;
 *  - the overlay is OWNED by voicePhase !== "off", its captions carry only
 *    voiceInterim (parent's words) + liveVoiceText (screened output), and it
 *    opens no new entry point (orb tap can only barge in, X only stops).
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC_ROOT = path.resolve(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const coach = stripComments(read("components/tabs/CoachTab.tsx"));

const bargeIn = /const bargeInVoice = \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
const toggle = /const toggleVoice = async \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
const overlay = /<VoiceOverlay[\s\S]*?\/>/.exec(coach)?.[0] ?? "";

describe("AI-V2(a) — chip tap = interrupt while speaking (fallback loop)", () => {
  it("toggleVoice decides via voiceChipAction and routes interrupt → bargeInVoice", () => {
    expect(toggle).toContain("voiceChipAction(voicePhase, Boolean(liveCtlRef.current))");
    expect(toggle).toMatch(/action === "interrupt"[\s\S]{0,80}bargeInVoice\(\)/);
  });

  it("bargeInVoice flushes the queue, cuts speech, aborts the stream, keeps the caption, resumes listening", () => {
    expect(bargeIn).toContain("ttsQueueRef.current = []");
    expect(bargeIn).toContain("ttsSpeakingRef.current = false");
    expect(bargeIn).toContain("streamDoneRef.current = false");
    expect(bargeIn).toContain("voiceAbortRef.current?.abort()");
    expect(bargeIn).toContain("stopSpeaking()");
    expect(bargeIn).toContain("finalizeVoiceAiTurn()");
    expect(bargeIn).toContain("startListening()");
  });

  it("barge-in keeps voice ON (double-tap parity: only stopVoice flips voiceOnRef off)", () => {
    expect(bargeIn).not.toContain("voiceOnRef.current = false");
    expect(bargeIn).not.toContain("stopVoice");
    expect(bargeIn).not.toContain('setVoicePhase("off")');
  });

  it("an ABORTED stream never double-restarts — only genuine failures recover in the catch", () => {
    expect(coach).toMatch(/catch \{[\s\S]{0,700}if \(!controller\.signal\.aborted\) \{[\s\S]{0,200}startListening\(\)/);
  });
});

describe("F-01 — the voice chip can never wedge into a dead button", () => {
  it("clearLiveRefs is the single Live-terminal cleanup (controller + render mirror)", () => {
    const clear = /const clearLiveRefs = \(\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
    expect(clear).toContain("liveCtlRef.current = null");
    expect(clear).toContain("setLiveSession(false)");
  });

  it("the onPhase 'closed' path clears the Live refs (the previously-missing terminal cleanup)", () => {
    const onPhase = /onPhase: \(p\) => \{[\s\S]*?\n              \},/.exec(coach)?.[0] ?? "";
    expect(onPhase).toMatch(/p === "closed"/);
    expect(onPhase).toContain("clearLiveRefs()");
    expect(onPhase).toContain('setVoicePhase("off")');
    // Late 'closed' reports — controller already cleared, or the browser
    // fallback loop running — must never stomp the fallback's phase.
    expect(onPhase).toMatch(/if \(!liveCtlRef\.current \|\| voiceOnRef\.current\) return;/);
  });

  it("toggleVoice from visual-idle clears stale refs and FALLS THROUGH to starting", () => {
    expect(toggle).toMatch(/if \(action !== "start"\) \{ stopVoice\(\); return; \}/);
    // The stale-ref branch clears but does NOT return — the tap keeps going…
    // The stale-ref clear flows STRAIGHT into the Live-availability branch.
    expect(toggle).toMatch(/if \(voiceOnRef\.current \|\| liveCtlRef\.current\) stopVoice\(\);\s*if \(liveAvail\)/);
    // …so every idle-looking tap reaches the token mint or the browser loop.
    expect(toggle).toContain("api.liveToken(");
    expect(toggle).toMatch(/startBrowserVoice\(\);\s*\};\s*$/);
  });

  it("no bare catch on the Live start path — Paywall opens the paywall, everything else toasts", () => {
    expect(toggle).not.toMatch(/catch\s*\{/);
    expect(toggle).toContain("catch (err)");
    expect(toggle).toMatch(/err instanceof PaywallError[\s\S]{0,200}openPaywall\(/);
    expect(toggle).toContain('toast(t("coach.toast.voiceFallback"), "info")');
    expect(toggle).toContain("console.warn");
  });
});

describe("AI-V7 — the overlay is a surface, never an entry point", () => {
  it("VoiceOverlay renders ONLY while voicePhase !== 'off' (owned by the phase)", () => {
    expect(coach).toMatch(/\{voicePhase !== "off" && \(\s*<VoiceOverlay/);
  });

  it("captions carry the parent's interim words + the screened live answer only", () => {
    expect(overlay).toContain("interimText={voiceInterim}");
    expect(overlay).toContain("answerText={liveVoiceText}");
  });

  it("orb tap can only barge in on the fallback loop; X is stopVoice; nothing starts voice", () => {
    expect(overlay).toContain("canInterrupt={voicePhase === \"speaking\" && !liveSession}");
    expect(overlay).toMatch(/onOrbTap=\{\(\) => \{ if \(voicePhase === "speaking" && !liveCtlRef\.current && voiceOnRef\.current\) bargeInVoice\(\); \}\}/);
    expect(overlay).toContain("onClose={stopVoice}");
    expect(overlay).not.toContain("toggleVoice");
    expect(overlay).not.toContain("startBrowserVoice");
    expect(overlay).not.toContain("liveToken");
  });

  it("the dictation loop feeds interim partials into the overlay caption", () => {
    expect(coach).toContain("onInterim: (text) => setVoiceInterim(text)");
    // Live path: input transcription (the parent's own words) accumulates too.
    expect(coach).toContain("onUserInterim: (delta) => setVoiceInterim((prev) => (prev + delta).trimStart())");
    // The settled transcript clears the interim caption before the turn sends.
    expect(coach).toMatch(/onTranscript: \(text\) => \{\s*setVoiceInterim\(""\);/);
  });
});
