import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * AI-CAP-1 + VC-4 — voice-safety-hotfix (2026-07-25 AI-excellence Wave 1).
 *
 * AI-CAP-1 (P0, was LIVE in prod): BehaviorsTab.parseVoice posted spoken
 * transcripts to /api/chat with a hand-rolled prompt + greedy JSON regex. A
 * crisis-flagged transcript came back as escalation MARKDOWN (HTTP 200), the
 * regex found no JSON, and the catch branch stuffed the raw crisis transcript
 * into an ordinary editable draft with a friendly toast — fail-OPEN on the
 * exact path the fail-closed constraint targets.
 *
 * The vitest env is node-only, so these are SOURCE-BASED structural guards in
 * the house pattern (confirmCaptureReview.test.ts beside this file): they pin
 * the code shape that makes the acceptance true at runtime. The functional
 * halves live in routes/voiceSafety.test.ts (real /voice handler) and
 * lib/voiceSafetyEvents.test.ts (done-event contract).
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
// Drop /* */ and // comments so prose about the old bug can't trip the scans.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const behaviors = stripComments(read("components/tabs/BehaviorsTab.tsx"));
const coach = stripComments(read("components/tabs/CoachTab.tsx"));

describe("AI-CAP-1 — voice capture goes through the ONE hardened extraction owner", () => {
  const modal = stripComments(read("components/overview/QuickLogModal.tsx"));
  const extract = /const extractFromTyped = async[\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
  it("the launcher has no transcription path; the sheet uses only schema-enforced extraction", () => {
    expect(behaviors).not.toMatch(/parseVoice|startDictation|api\.extractLog|\/api\/chat|fetch\(/);
    expect(modal).not.toMatch(/\/api\/chat|fetch\(|JSON\.parse\(match/);
    expect(extract).toBeTruthy();
    expect(extract).toContain('api.extractLog({ message: text, childProfile, language: getAiLanguage() })');
    expect(modal).toContain('void extractFromTyped(said, hardMomentRef.current ? "incident" : "moment")');
    // Negative control: the shipped raw chat path bypassed schema/safety.
    expect('fetch("/api/chat").then(() => JSON.parse(match[0]))').toMatch(/\/api\/chat|JSON\.parse\(match/);
  });

  it("all extracted fields are normalized before touching the shared draft", () => {
    const normalize = extract.indexOf('const n = normalizeExtractedLog(d, text)');
    expect(normalize).toBeGreaterThan(-1);
    for (const field of ['Type', 'Intensity', 'Duration', 'Context', 'Trigger', 'Response', 'Notes']) {
      expect(extract.indexOf(`setNewLog${field}(`), field).toBeGreaterThan(normalize);
    }
    expect(extract).not.toMatch(/setNewLog\w+\(d\./);
  });

  it("FAIL-CLOSED: a 409 never takes the fallback, writes fields, or shows a success toast", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(extract)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog|toast\(|handleAddLog|addMoment/);
    expect(branch).toContain('setEscalationMarkdown(renderEscalationMarkdown(');
    expect(extract).toMatch(/if \(err instanceof EscalationRequiredError\) \{[\s\S]*?\} else \{\s*toast\(t\("beh\.toast\.voiceFallback"\), "info"\)/);
    // Unlike the old parseVoice catch, neither catch branch invents a new draft.
    expect(extract.slice(extract.indexOf('catch (err)'))).not.toMatch(/setNewLog/);
  });

  it("the alert replaces review and both save forms, with shared crisis resources", () => {
    expect(modal).toContain('data-testid="quicklog-escalation"');
    expect(modal).toMatch(/\{escalationMarkdown \? \([\s\S]*?role="alert"[\s\S]*?<MarkdownBlock text=\{escalationMarkdown\}[\s\S]*?\) : reviewing \? <ConfirmCaptureReview/);
    expect(modal).toContain('from "../../safety/escalation"');
    const alert = modal.indexOf('data-testid="quicklog-escalation"');
    expect(alert).toBeGreaterThan(-1);
    expect(alert).toBeLessThan(modal.indexOf('data-testid="quicklog-moment-form"'));
  });

  it("an unknown escalation category still over-blocks toward crisis resources", () => {
    expect(extract).toMatch(/escalationCategories\.find\(\(c\) => c\.category === err\.category\) \?\?\s*escalationCategories\[0\]/);
  });

  it("escalation surface chrome has EN+HE keys", () => {
    for (const key of ["beh.escalation.title", "beh.escalation.dismiss"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });
});

describe("VC-4 — CoachTab voice loop: escalation stops the loop, resources land on screen", () => {
  it("the streamVoice call wires the done payload through handleVoiceDone", () => {
    expect(coach).toMatch(/import \{ handleVoiceDone \} from ["']\.\.\/\.\.\/lib\/voiceSafetyEvents["']/);
    // AI-V5 added a delta branch (screened-sentence token registration) ahead
    // of the done gate; the safety invariant stays: every done payload routes
    // through handleVoiceDone.
    expect(coach).toMatch(/if \(event !== "done"\) return;\s*handleVoiceDone\(data, \{/);
  });

  it("stopLoop kills the hands-free loop flag — the ONLY auto-relisten sites are guarded by it", () => {
    expect(coach).toMatch(/stopLoop: \(\) => \{ voiceOnRef\.current = false; \}/);
    // Every automatic re-listen in the file is conditional on voiceOnRef.current,
    // so once stopLoop runs, startListening is NOT re-invoked.
    const autoRelisten = coach.match(/(?<!const )startListening\(\);/g) ?? [];
    const guarded = coach.match(/if \(voiceOnRef\.current\) startListening\(\);/g) ?? [];
    // The single unguarded call site is startBrowserVoice, which SETS the flag
    // true immediately beforehand (the parent's explicit opt-in).
    expect(coach).toMatch(/voiceOnRef\.current = true;\s*startListening\(\);/);
    expect(autoRelisten.length - guarded.length).toBe(1);
  });

  it("the done handler itself never re-arms the mic", () => {
    const handler = /onEvent: \(event, data\) => \{[\s\S]*?\n\s*\},\s*\n\s*\},\s*\n\s*\);/.exec(coach)?.[0] ?? "";
    expect(handler).toBeTruthy();
    expect(handler).not.toMatch(/startListening/);
    expect(handler).not.toMatch(/voiceOnRef\.current = true/);
  });

  it("resources/blocked markdown are appended to the persisted AI voice bubble (on screen, not spoken)", () => {
    expect(coach).toMatch(/appendMarkdown: \(md\) => appendVoiceAiDelta\(`\\n\\n\$\{md\}`\)/);
  });
});

describe("B-TODAY-01 — QuickLogModal voice names the branch it was spoken into", () => {
  const modal = stripComments(read("components/overview/QuickLogModal.tsx"));
  it("the dictation result routes with the live branch (ref, not a stale closure)", () => {
    expect(modal).toMatch(/void extractFromTyped\(said, hardMomentRef\.current \? "incident" : "moment"\)/);
    expect(modal).toMatch(/hardMomentRef\.current = hardMoment;/);
  });
  it("the voice transcript lands in the moment field with 'voice' provenance before extraction", () => {
    const onResult = /onResult: \(text\) => \{[\s\S]*?\n        \},/.exec(modal)?.[0] ?? "";
    expect(onResult).toBeTruthy();
    expect(onResult.indexOf("setNewLogTrigger(said)")).toBeLessThan(onResult.indexOf("extractFromTyped("));
    expect(onResult).toContain('setSource(current => current === "ai-draft" ? current : "voice")');
  });
  it("the 409 branch in the modal still writes zero draft fields", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(modal)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog/);
  });
});
