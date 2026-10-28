/**
 * B-PROV-12 — the client gate at the one voice path (house source-guard
 * pattern; the vitest env is node-only). Before ANY audio is processed —
 * the Live mint or the browser voice loop — toggleVoice checks the runtime
 * route's notice acknowledgement; the mint carries that acknowledgement;
 * a server refusal for a changed route shows the new notice and never falls
 * back silently; the notice renders in the B-VOICE-06 line slot.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const strip = (code: string) => code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const coach = strip(fs.readFileSync(path.join(SRC, "components/tabs/CoachTab.tsx"), "utf8"));
const bar = strip(fs.readFileSync(path.join(SRC, "components/overview/QuickCaptureBar.tsx"), "utf8"));
const toggle = /const toggleVoice = async[\s\S]*?\n  };/.exec(coach)?.[0] ?? "";

describe("B-PROV-12 · CoachTab gates every voice start on the runtime notice", () => {
  it("the one-tap decision precedes the microphone, the Live mint and the browser voice loop", () => {
    const gate = toggle.indexOf("voiceNoticeTap(noticeId, noticePending, voiceNoticeAcknowledged(noticeId))");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(toggle.indexOf("requestLiveMicrophone("));
    expect(gate).toBeLessThan(toggle.indexOf("await mintLive()"));
    expect(gate).toBeLessThan(toggle.indexOf("startBrowserVoice()"));
    expect(toggle).toMatch(/runtimeVoiceNoticeId\(liveAvail \? liveNoticeId : null\)/);
    expect(toggle).toMatch(/if \(tap === "show"\) \{ setVoiceNotice\(null\); setNoticePending\(noticeId\); return; \}\s*if \(tap === "acknowledge_and_start"\) acknowledgeVoiceNotice\(noticeId\);/);
  });

  it("cancel and decline clear a showing notice: stopping/leaving (stopVoice) and typing instead (handleChatSend)", () => {
    const stop = /const stopVoice = \(review = true\) => \{[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
    expect(stop).toContain("setNoticePending(null)");
    const send = /const handleChatSend = async[\s\S]*?\n  \};/.exec(coach)?.[0] ?? "";
    expect(send).toContain("setNoticePending(null)");
  });

  it("the mint (first slice and every renewal) carries the acknowledged notice id from ONE call site", () => {
    expect(coach.match(/api\.liveToken\(/g)?.length).toBe(1);
    expect(toggle).toMatch(/const mintLive = \(\) => api\.liveToken\(\{[^\n]*noticeAck: noticeId \}, \{ signal: attempt\.signal \}\)/);
  });

  it("a changed route is a new notice, never a silent fallback to browser voice", () => {
    const branch = /if \(err instanceof VoiceNoticeRequiredError\) \{[\s\S]*?return;\s*\}/.exec(toggle)?.[0] ?? "";
    expect(branch).toContain("setNoticePending(runtimeVoiceNoticeId(next))");
    expect(branch).not.toContain("startBrowserVoice");
    expect(toggle.indexOf("err instanceof VoiceNoticeRequiredError")).toBeLessThan(toggle.indexOf('t("coach.toast.voiceFallback")', toggle.indexOf("catch (err)")));
  });

  it("the notice renders in the B-VOICE-06 line slot as one short line plus one start line", () => {
    expect(coach).toContain('data-testid="voice-provider-notice"');
    expect(coach).toMatch(/className="companion-voice-invite" dir="auto">\{voiceNoticeShortLine\(t, noticePending\)\}<\/p>/);
    expect(coach).toContain('t("elev.wave2Daily.capture.voice.tapAgain")');
  });

  it("the capture bar's first-use line is the runtime notice, and counts as seen only once it rendered", () => {
    expect(bar).not.toContain('t("elev.coachcontract.uses.liveResidencyUndated")');
    expect(bar).toContain("voiceNoticeLine(t, noticeId)");
    expect(bar).toMatch(/runtimeVoiceNoticeId\(liveNoticeIdFrom\(r\)\)/);
    expect(bar).toMatch(/if \(firstUse && noticeId\) \{\s*markVoiceDoorNoticeSeen\(\);/);
    expect(bar).toMatch(/\{firstUse && noticeId && \(/);
  });
});

describe("B-AIOPS-02 · the family's voice time at the one voice path", () => {
  it("P1-1: the microphone is opened before any mint; a refusal returns before a token exists and is no availability signal", () => {
    const mic = toggle.indexOf("micStream = await requestLiveMicrophone(attempt.signal)");
    expect(mic).toBeGreaterThan(0);
    expect(mic).toBeLessThan(toggle.indexOf("await mintLive()"));
    expect(toggle).toMatch(/\["NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError"\]\.includes\(err\.name\)/);
    // The microphone stage is excluded inside liveUnavailableReason itself (lib/kpiEvents).
    expect(toggle).toMatch(/const unavailable = liveUnavailableReason\(err, liveStage\);\s*if \(unavailable\) trackLiveUnavailable\(unavailable\);/);
    // The opened microphone never leaks: released in the catch and on lost attempts, owned by the session after handoff.
    expect(toggle).toMatch(/\} catch \(err\) \{\s*releaseMic\(\);/);
    expect(toggle).toContain("if (!attempt.isCurrent()) { releaseMic(); return; }");
    expect(toggle).toContain("stream: stream ?? undefined,");
  });

  it("P1-2: the slice's expiry and the family's remaining time reach the session, and renewal goes through the same mint", () => {
    expect(toggle).toContain("expiresAt: fresh.expiresAt,");
    expect(toggle).toContain("remainingMs: fresh.budget?.remainingMs,");
    expect(toggle).toMatch(/renew: async \(\) => \{[\s\S]*?await mintLive\(\)[\s\S]*?if \(isLiveResting\(renewError\)\) return null;/);
  });

  it("a budget end is a resting state: onAllowanceEnd shows the resting line and never the connection-ended notice", () => {
    const end = /onAllowanceEnd: \(\) => \{[\s\S]*?\n              \},/.exec(toggle)?.[0] ?? "";
    expect(end).toContain("setVoiceResting(true)");
    expect(end).not.toContain("microphoneRecovery");
    expect(end).not.toContain("setVoiceNotice");
    expect(end).not.toContain("setAiFailure");
  });

  it("a spent allowance (mint or fallback turn) is the resting line, never the failure card", () => {
    expect(toggle).toMatch(/if \(isLiveResting\(err\)\) \{\s*attempt\.end\(\);\s*setVoicePhase\("off"\);\s*setVoiceResting\(true\);\s*return;\s*\}/);
    expect(coach).toMatch(/if \(ownsTurn\(\) && isLiveResting\(err\)\) \{\s*stopVoice\(false\);\s*setVoiceResting\(true\);/);
    expect(coach).not.toMatch(/setAiFailure\(classifyAiFailure\(err[^)]*\)\)[^\n]*\n[^\n]*isLiveResting/);
  });

  it("the resting line is its own polite status element; the failure card keeps its single alert", () => {
    const resting = /\{voiceResting && !isChatLoading && !failureCopy && \([\s\S]*?\n          \)\}/.exec(coach)?.[0] ?? "";
    expect(resting).toContain('role="status"');
    expect(resting).toContain('data-testid="coach-voice-resting"');
    expect(resting).toContain('t("elev.aierrors.voiceResting.title")');
    expect(resting).not.toContain("retry");
    expect(coach.match(/role="alert"/g)?.length).toBe(1);
    expect(coach).not.toContain('"voiceResting" ? { role');
  });

  it("while voice rests, the composer does not invite the parent to continue by voice", () => {
    const composer = strip(fs.readFileSync(path.join(SRC, "components/companion/CompanionComposer.tsx"), "utf8"));
    expect(composer).toMatch(/\{draftPending && !voiceActive && !voiceResting && <p className="companion-media-note">/);
    expect(coach).toContain("voiceResting={voiceResting}");
  });
});
