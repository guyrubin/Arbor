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
  it("the acknowledgement check precedes the Live mint and the browser voice loop", () => {
    const gate = toggle.indexOf("voiceNoticeAcknowledged(noticeId)");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(toggle.indexOf("api.liveToken("));
    expect(gate).toBeLessThan(toggle.indexOf("startBrowserVoice()"));
    expect(toggle).toMatch(/runtimeVoiceNoticeId\(liveAvail \? liveNoticeId : null\)/);
    // An unacknowledged notice returns before anything starts; the next tap acknowledges.
    expect(toggle).toMatch(/if \(noticePending !== noticeId\) \{ setVoiceNotice\(null\); setNoticePending\(noticeId\); return; \}\s*acknowledgeVoiceNotice\(noticeId\);/);
  });

  it("the mint carries the acknowledged notice id", () => {
    expect(toggle).toMatch(/api\.liveToken\(\{[^\n]*noticeAck: noticeId \}, \{ signal: attempt\.signal \}\)/);
  });

  it("a changed route is a new notice, never a silent fallback to browser voice", () => {
    const branch = /if \(err instanceof VoiceNoticeRequiredError\) \{[\s\S]*?return;\s*\}/.exec(toggle)?.[0] ?? "";
    expect(branch).toContain("setNoticePending(runtimeVoiceNoticeId(next))");
    expect(branch).not.toContain("startBrowserVoice");
    expect(toggle.indexOf("err instanceof VoiceNoticeRequiredError")).toBeLessThan(toggle.indexOf('t("coach.toast.voiceFallback")', toggle.indexOf("catch (err)")));
  });

  it("the notice renders in the B-VOICE-06 line slot, from the approved copy of the pending id", () => {
    expect(coach).toContain('data-testid="voice-provider-notice"');
    expect(coach).toMatch(/className="companion-voice-invite" dir="auto">\{voiceNoticeLine\(t, noticePending\)\}/);
  });

  it("the capture bar's first-use line is the runtime notice, not a fixed provider line", () => {
    expect(bar).not.toContain('t("elev.coachcontract.uses.liveResidencyUndated")');
    expect(bar).toContain("voiceNoticeLine(t, noticeId)");
    expect(bar).toMatch(/runtimeVoiceNoticeId\(liveNoticeIdFrom\(r\)\)/);
  });
});
