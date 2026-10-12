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
 * F-TALK-2 (v3 mock L570-578: no floating card): the strip is DELETED. The
 * offer's only home is the capture sheet's saved state, whose next move reads
 * "Talk it through" and still prefills through the seedCoach seam. The
 * ArborContext seam pins below are kept unchanged (never auto-send).
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
// F-TALK-2: the strip file is deleted; the path is kept to prove it stays gone.
const STRIP_FILE = path.join(SRC_ROOT, "components/overview/PostCaptureCoachStrip.tsx");
const shell = stripComments(read("components/layout/Shell.tsx"));

describe("AI-CAP-6 — live interim transcript in the capture area", () => {
  it("QuickLogModal wires live dictation into the same calm indicator", () => {
    expect(modal).toMatch(/onInterim: \(text\) => \{ if \(isCurrent\(\)\) setVoiceInterim\(text\); \}/);
    // REC-01 (8 Oct): the caption moved into the shared RecordingIndicator;
    // Behaviours passes its pinned id, the component owns the calm register.
    expect(modal).toMatch(/<RecordingIndicator[\s\S]{0,500}interim=\{voiceInterim\}/);
    expect(modal).toMatch(/<RecordingIndicator[\s\S]{0,500}captionTestId="quicklog-listening-caption"/);
    // calm register + a11y + RTL: muted token, polite live region, dir=auto
    const indicator = stripComments(read("components/ui/RecordingIndicator.tsx"));
    const caption = /<p\s+dir="auto"[^>]*?data-testid=\{captionTestId\}[\s\S]*?<\/p>/.exec(indicator)?.[0] ?? "";
    expect(caption).not.toBe("");
    expect(caption).toContain('aria-live="polite"');
    expect(caption).toContain('dir="auto"');
    expect(caption).toMatch(/--arbor-muted/);
  });

  it("dictation runs continuous with the silence-finalize window (a pause never truncates the moment)", () => {
    expect(modal).toMatch(/\{ continuous: true \}/);
    expect(stripComments(read("lib/speech.ts"))).toContain("opts.silenceFinalizeMs ?? 4500");
  });

  it("the interim caption resets when the session ends (no stale words on the next capture)", () => {
    const onEnd = /onEnd: \(\) => \{([\s\S]*?)\}/.exec(modal)?.[1] ?? "";
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
  it("the hub owns no confirm or duplicate coach offer after consolidation", () => {
    expect(behaviors).not.toMatch(/confirmReview|handleAddLog|offerPostCaptureCoach/);
    expect(behaviors).toContain('openCaptureSheet');
    // The write's one next move lives in QuickLogModal's persisted reply.
    expect(modal).toContain('setReply({ log: written, hard: isIncidentType(written.behaviorType), seed: confirmedPrompt })');
  });

  it("B-TODAY-20: QuickLogModal no longer offers the strip — its reply panel carries the one next move", () => {
    expect(modal).not.toContain("offerPostCaptureCoach");
    const confirm = /const confirm = async \(e: React\.FormEvent\) => \{[\s\S]*?\n  \};/.exec(modal)?.[0] ?? "";
    expect(confirm).toBeTruthy();
    // The confirmed fields are still snapshotted BEFORE handleAddLog resets
    // the form — as the reply's fallback seed, prefill only.
    expect(confirm).toMatch(/beh\.postCapture\.prompt/);
    expect(confirm.indexOf("confirmedPrompt")).toBeLessThan(confirm.indexOf("handleAddLog(e, { callerShowsFailure: true, ...contentProvenance })"));
    // The reply is built from the DURABLY written record; "hard" follows its own type.
    expect(confirm).toMatch(/setReply\(\{ log: written, hard: isIncidentType\(written\.behaviorType\), seed: confirmedPrompt \}\)/);
    // The reply's Ask is the ONE seedCoach seam, source post-capture, never a send.
    expect(modal).toMatch(/seedCoach\(\{ prompt: reply\.seed, source: "post-capture" \}\)/);
    expect(modal).not.toMatch(/handleSend|sendMessage|api\.chat/);
    // No toast-only end on either save path.
    expect(modal).not.toContain('toast(t("ql.okToast")');
    expect(modal).not.toContain('toast(t("ql.moment.okToast")');
  });

  it("B-TODAY-20: no toast or string names a hub that does not exist ('Behavior Patterns')", () => {
    for (const dict of [en, he]) {
      for (const [k, v] of Object.entries(dict)) {
        if (!k.startsWith("ql.")) continue;
        expect(v, k).not.toMatch(/Behavior Patterns|דפוסי ההתנהגות/);
      }
    }
  });

  it("B-TODAY-20: the reply controls clear 44 px", () => {
    for (const id of ["quicklog-reply-ask", "quicklog-reply-undo", "quicklog-reply-done"]) {
      const at = modal.indexOf(`data-testid="${id}"`);
      expect(at, id).toBeGreaterThan(-1);
      const tag = modal.slice(modal.lastIndexOf("<button", at), modal.indexOf(">", modal.indexOf("className", at)));
      expect(tag, id).toContain("min-h-11");
    }
  });

  // F-TALK-2 re-pin: was "the strip never touches the behavior-log write
  // path"; the strip is deleted, so the same guard now holds the offer's one
  // remaining control, the saved state's Talk.
  it("the saved-state Talk never touches the behavior-log write path", () => {
    const at = modal.indexOf('data-testid="quicklog-reply-ask"');
    expect(at).toBeGreaterThan(-1);
    const talk = modal.slice(modal.lastIndexOf("<button", at), modal.indexOf("</button>", at));
    expect(talk).not.toMatch(/handleAddLog|upsert|logsCol/);
  });
});

/* F-TALK-2 re-pin of "AI-CAP-7 — the strip itself": the floating strip is
   deleted (v3 mock L570-578 has no floating card) and its offer is the capture
   sheet's saved-state next move. Its calm-register pins carry over to that
   control: outline, never the primary gradient, tokens only, 44 px. */
describe("F-TALK-2 — the floating strip is gone; the offer lives in the capture sheet", () => {
  it("the strip component is deleted and Shell mounts nothing in its place", () => {
    expect(fs.existsSync(STRIP_FILE)).toBe(false);
    expect(shell).not.toMatch(/PostCaptureCoachStrip|post-capture-coach-strip|postCaptureCoachPrompt/);
    expect(count(shell, /acceptPostCaptureCoach|dismissPostCaptureCoach/g)).toBe(0);
  });

  it("the saved state's 'Talk it through' prefills via the seam, as a token outline, never the primary gradient", () => {
    const at = modal.indexOf('data-testid="quicklog-reply-ask"');
    expect(at).toBeGreaterThan(-1);
    const talk = modal.slice(modal.lastIndexOf("<button", at), modal.indexOf("</button>", at));
    expect(talk).toContain('{t("companion.capture.talk")}');
    expect(talk).not.toContain("elev.capture.reply.ask");
    // Prefill only: the seam, then the sheet closes; the parent sends.
    expect(talk).toContain('onClick={() => { seedCoach({ prompt: reply.seed, source: "post-capture" }); onClose(); }}');
    expect(talk).not.toMatch(/handleSend|sendMessage|api\.chat/);
    // OBJ-TODAY-01: a secondary offer is outline; the allow-list guard is
    // components/primaryMove.gradient.test.ts.
    expect(talk).not.toMatch(/--arbor-gradient-primary/);
    expect(talk).toMatch(/border: "1px solid var\(--arbor-green-ink\)"/);
    expect(talk).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(talk).toContain("min-h-11");
    // The directional arrow mirrors once in RTL.
    expect(talk).toContain('<Icon name="arrow_forward" size={16} className="rtl:-scale-x-100" />');
  });

  it("copy: EN+HE parity, no pressure mechanics or confidence wording", () => {
    // The strip's own words (body/cta/dismiss) stay in the shared dictionary
    // as dead copy until the cleanup follow-up; nothing renders them.
    for (const key of ["beh.postCapture.body", "beh.postCapture.cta", "beh.postCapture.dismiss", "beh.postCapture.prompt", "beh.capture.listening", "companion.capture.talk"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
    expect(en["companion.capture.talk"]).toBe("Talk it through");
    expect(he["companion.capture.talk"]).not.toMatch(/[A-Za-z]/);
    for (const dict of [en, he]) {
      for (const key of [...Object.keys(dict).filter((k) => k.startsWith("beh.postCapture.")), "companion.capture.talk"]) {
        expect(dict[key]).not.toMatch(/confidence|certainty|hurry|now or never|last chance|ודאות|ביטחון/i);
      }
    }
  });
});
