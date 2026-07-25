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

describe("AI-CAP-1 — voice capture goes through the ONE hardened extraction seam", () => {
  it("no fetch('/api/chat') — or any /api/chat reference — remains in BehaviorsTab", () => {
    expect(behaviors).not.toContain("/api/chat");
    expect(behaviors).not.toMatch(/fetch\(/);
  });

  it("parseVoice calls api.extractLog (schema-enforced, server-screened, redacted)", () => {
    const parse = /const parseVoice = async[\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(parse).toBeTruthy();
    expect(parse).toMatch(/api\.extractLog\(\{ message: text, childProfile \}\)/);
  });

  it("the greedy JSON-regex extraction path is deleted", () => {
    // The old code carried the literal source sequence `[\s\S]*` (the greedy
    // brace-matcher) and JSON.parse(match[0]). Neither may return.
    expect(behaviors).not.toContain("[\\s\\S]*");
    expect(behaviors).not.toMatch(/JSON\.parse\(match/);
  });

  it("every extracted field is clamped/validated before touching the draft", () => {
    const parse = /const parseVoice = async[\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    // intensity clamped to 1..5
    expect(parse).toMatch(/Math\.min\(5, Math\.max\(1,/);
    // duration >= 1
    expect(parse).toMatch(/setNewLogDuration\(Math\.max\(1,/);
    // context restricted to the enum, safe default
    expect(parse).toMatch(/CONTEXTS\.includes\(d\.context as BehaviorContext\) \? d\.context : "Home"/);
  });

  it("FAIL-CLOSED order: the escalation branch runs BEFORE the raw-transcript fallback", () => {
    const parse = /const parseVoice = async[\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    const escalationIdx = parse.indexOf("err instanceof EscalationRequiredError");
    const fallbackIdx = parse.indexOf("setNewLogTrigger(text)");
    expect(escalationIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(escalationIdx).toBeLessThan(fallbackIdx);
    // and the fallback is the ELSE of the escalation check, so a 409 can never
    // fall through into the draft.
    expect(parse).toMatch(/if \(err instanceof EscalationRequiredError\) \{[\s\S]*?\} else \{[\s\S]*?setNewLogTrigger\(text\);/);
  });

  it("the escalation branch writes ZERO draft fields and shows no toast", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(behaviors)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog/);
    expect(branch).not.toMatch(/toast\(/);
    expect(branch).toMatch(/setEscalationMarkdown\(renderEscalationMarkdown\(/);
  });

  it("the crisis resources render as a visible alert surface (renderEscalationMarkdown content, never a toast)", () => {
    expect(behaviors).toContain('data-testid="voice-capture-escalation"');
    expect(behaviors).toMatch(/role="alert"/);
    expect(behaviors).toMatch(/<MarkdownBlock text=\{escalationMarkdown\}/);
    // Resources come from the shared safety module — the same approved
    // renderEscalationMarkdown contract the /chat surface shows.
    expect(behaviors).toMatch(/import \{ escalationCategories, renderEscalationMarkdown \} from ["']\.\.\/\.\.\/safety\/escalation["']/);
  });

  it("an unknown escalation category still over-blocks toward crisis resources (safe failure)", () => {
    expect(behaviors).toMatch(/escalationCategories\.find\(\(c\) => c\.category === err\.category\) \?\?\s*escalationCategories\[0\]/);
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
    // true on the same line (the parent's explicit opt-in).
    expect(coach).toMatch(/voiceOnRef\.current = true; startListening\(\);/);
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
