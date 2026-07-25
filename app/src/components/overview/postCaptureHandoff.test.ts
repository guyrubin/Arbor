import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * AI-CAP-6 + AI-CAP-7 — capture feel (2026-07-25 AI-excellence Wave 2).
 *
 * AI-CAP-6: dictation is no longer speak-blind or single-shot — BehaviorsTab
 * streams the interim transcript live (calm register, --arbor-muted) and the
 * recognizer runs continuous with a ~4.5s silence-finalize (the functional
 * state-machine half lives in lib/speech.continuous.test.ts). CoachTab's voice
 * loop OPTS OUT intentionally (its own loop owns cycling) — byte-unchanged.
 *
 * AI-CAP-7: a gated confirm no longer dead-ends in a toast — ONE dismissible,
 * non-blocking strip offers the coach handoff via the existing seedCoach seam
 * with source 'post-capture'. Firewall guard baked in: never auto-send (accept
 * only PREFILLS the composer), once per confirm, dismiss leaves no residue,
 * zero change to the behavior-log write path.
 *
 * Node-only vitest env → source-based structural guards in the house pattern
 * (confirmCaptureReview.test.ts beside this file).
 */

const SRC_ROOT = path.resolve(__dirname, "..", "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
// Drop /* */ and // comments so prose about the rules can't trip the scans.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

const behaviors = stripComments(read("components/tabs/BehaviorsTab.tsx"));
const modal = stripComments(read("components/overview/QuickLogModal.tsx"));
const coach = stripComments(read("components/tabs/CoachTab.tsx"));
const context = stripComments(read("context/ArborContext.tsx"));
const strip = stripComments(read("components/overview/PostCaptureCoachStrip.tsx"));
const shell = stripComments(read("components/layout/Shell.tsx"));

describe("AI-CAP-6 — live interim transcript in the capture area", () => {
  it("BehaviorsTab wires onInterim into its dictation and renders the caption in the calm register", () => {
    expect(behaviors).toMatch(/onInterim: \(text\) => setVoiceInterim\(text\)/);
    expect(behaviors).toContain('data-testid="voice-interim-caption"');
    // calm register + a11y + RTL: muted token, polite live region, dir=auto
    const caption = /data-testid="voice-interim-caption"[\s\S]*?<\/p>/.exec(behaviors)?.[0] ?? "";
    expect(behaviors).toMatch(/aria-live="polite"[\s\S]*?data-testid="voice-interim-caption"|data-testid="voice-interim-caption"[\s\S]{0,400}aria-live="polite"/);
    expect(caption).toMatch(/--arbor-muted/);
    expect(behaviors).toMatch(/dir="auto"[\s\S]{0,300}voice-interim-caption|voice-interim-caption[\s\S]{0,300}dir="auto"/);
  });

  it("dictation runs continuous with the silence-finalize window (a pause never truncates the moment)", () => {
    expect(behaviors).toMatch(/\{ continuous: true, silenceFinalizeMs: 4500 \}/);
  });

  it("the interim caption resets when the session ends (no stale words on the next capture)", () => {
    const onEnd = /onEnd: \(\) => \{([\s\S]*?)\}/.exec(behaviors)?.[1] ?? "";
    expect(onEnd).toMatch(/setVoiceInterim\(""\)/);
  });

  it("CoachTab opts out intentionally — its dictation loop stays single-shot per cycle (no continuous opts)", () => {
    expect(coach).not.toMatch(/silenceFinalizeMs/);
    expect(coach).not.toMatch(/continuous: true/);
  });
});

describe("AI-CAP-7 — the post-confirm coach handoff seam (ArborContext)", () => {
  it("accept routes through the ONE seedCoach seam with source 'post-capture' and clears the offer", () => {
    const accept = /const acceptPostCaptureCoach = [\s\S]*?\n  };/.exec(context)?.[0] ?? "";
    expect(accept).toBeTruthy();
    expect(accept).toMatch(/seedCoach\(\{ prompt: postCaptureCoachPrompt, source: "post-capture" \}\)/);
    expect(accept).toMatch(/setPostCaptureCoachPrompt\(null\)/);
  });

  it("accept PREFILLS only — no send call anywhere near the seam (never auto-send)", () => {
    const seam = /const \[postCaptureCoachPrompt[\s\S]*?const acceptPostCaptureCoach = [\s\S]*?\n  };/.exec(context)?.[0] ?? "";
    expect(seam).toBeTruthy();
    expect(seam).not.toMatch(/handleSend|sendMessage|handleChatSend|submit/i);
  });

  it("dismiss clears the offer and nothing else (no residue)", () => {
    expect(context).toMatch(/const dismissPostCaptureCoach = \(\) => setPostCaptureCoachPrompt\(null\);/);
  });
});

describe("AI-CAP-7 — both gated confirms offer, once each, with the write path untouched", () => {
  it("BehaviorsTab confirmReview snapshots the confirmed fields BEFORE handleAddLog resets the form", () => {
    const confirm = /const confirmReview = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(confirm).toBeTruthy();
    expect(confirm).toMatch(/beh\.postCapture\.prompt/);
    expect(confirm.indexOf("confirmedPrompt")).toBeLessThan(confirm.indexOf("handleAddLog(e)"));
    // one offer per NEW confirm — edits don't re-nag
    expect(confirm).toMatch(/if \(!wasEditing\) offerPostCaptureCoach\(confirmedPrompt\)/);
    expect(count(confirm, /offerPostCaptureCoach\(/g)).toBe(1);
  });

  it("QuickLogModal confirm does the same through the same context seam", () => {
    const confirm = /const confirm = \(e: React\.FormEvent\) => \{[\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(confirm).toBeTruthy();
    expect(confirm).toMatch(/beh\.postCapture\.prompt/);
    expect(confirm.indexOf("confirmedPrompt")).toBeLessThan(confirm.indexOf("handleAddLog(e)"));
    expect(count(confirm, /offerPostCaptureCoach\(/g)).toBe(1);
  });

  it("the strip never touches the behavior-log write path", () => {
    expect(strip).not.toMatch(/handleAddLog|upsert|logsCol/);
  });
});

describe("AI-CAP-7 — the strip itself: one global render, dismissible, calm register", () => {
  it("renders null without an offer and Shell mounts it exactly once (shared by both confirm surfaces)", () => {
    expect(strip).toMatch(/if \(!postCaptureCoachPrompt\) return null;/);
    expect(count(shell, /<PostCaptureCoachStrip \/>/g)).toBe(1);
  });

  it("CTA accepts (prefill via seam), X dismisses — and the primary CTA is the green gradient token", () => {
    expect(strip).toMatch(/onClick=\{acceptPostCaptureCoach\}/);
    expect(strip).toMatch(/onClick=\{dismissPostCaptureCoach\}/);
    expect(strip).toMatch(/--arbor-gradient-primary/);
    // tokens only — no hex literals in the strip
    expect(strip).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // non-blocking: fixed strip under MobileNav (z-30 < nav z-40), RTL-safe via dir=auto
    expect(strip).toMatch(/z-30/);
    expect(strip).toMatch(/dir="auto"/);
  });

  it("copy: EN+HE parity, no pressure mechanics or confidence wording", () => {
    for (const key of ["beh.postCapture.body", "beh.postCapture.cta", "beh.postCapture.dismiss", "beh.postCapture.prompt", "beh.capture.listening"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
    for (const dict of [en, he]) {
      for (const key of Object.keys(dict).filter((k) => k.startsWith("beh.postCapture."))) {
        expect(dict[key]).not.toMatch(/confidence|certainty|hurry|now or never|last chance|ודאות|ביטחון/i);
      }
    }
  });
});
