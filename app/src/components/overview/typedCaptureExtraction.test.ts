import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * AI-CAP-3 + AI-CAP-4 — typed capture through the ONE extraction seam and the
 * coach Create-log handoff through the ONE review gate (2026-07-25
 * AI-excellence Wave 2).
 *
 * Firewall CONDITIONS baked in:
 *   (1) an HTTP 409 with escalationCategory on the TYPED path renders the
 *       escalation surface and populates NO draft field — same contract as
 *       AI-CAP-1; it must not fall through to sentence-into-trigger;
 *   (2) extraction-filled drafts carry provenance 'ai-draft', never 'text';
 *   (3) the review gate (setNeedsReview) arms on every extraction-filled draft;
 *   (4) the neutral empty-response placeholder is a visible, editable value.
 *
 * The vitest env is node-only, so these are SOURCE-BASED structural guards in
 * the house pattern (confirmCaptureReview.test.ts / voiceCaptureEscalation
 * .test.ts beside this file); the functional route half lives in
 * routes/extractLog.test.ts.
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

describe("AI-CAP-3 — BehaviorsTab typed capture goes through the extraction seam", () => {
  const extract = /const extractFromTyped = async[\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";

  it("extractFromTyped exists, arms the gate with 'ai-draft' provenance BEFORE the call, and opens review directly", () => {
    expect(extract).toBeTruthy();
    expect(extract).toMatch(/setCaptureSource\(\s*["']ai-draft["']\s*\)/);
    expect(extract).toMatch(/setNeedsReview\(true\)/);
    expect(extract.indexOf("setNeedsReview(true)")).toBeLessThan(extract.indexOf("try {"));
    expect(extract).toMatch(/setReviewOpen\(true\)/);
    expect(extract).toMatch(/api\.extractLog\(\{ message: text, childProfile, language: getAiLanguage\(\) \}\)/);
  });

  it("FAIL-CLOSED: the typed 409 branch renders the escalation surface and writes ZERO draft fields", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(extract)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog/);
    expect(branch).not.toMatch(/toast\(/);
    expect(branch).toMatch(/setEscalationMarkdown\(renderEscalationMarkdown\(/);
    // and the sentence-into-trigger degrade is the ELSE of the escalation
    // check — a 409 can never fall through into the draft.
    const escalationIdx = extract.indexOf("err instanceof EscalationRequiredError");
    const fallbackIdx = extract.indexOf("openFromBar(text)");
    expect(escalationIdx).toBeGreaterThan(-1);
    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(escalationIdx).toBeLessThan(fallbackIdx);
  });

  it("extraction failure (non-escalation) degrades to today's ungated behavior", () => {
    const elseBranch = /\} else \{([\s\S]*?)\}\s*\n\s*\} finally/.exec(extract)?.[1] ?? "";
    expect(elseBranch).toMatch(/setNeedsReview\(false\)/);
    expect(elseBranch).toMatch(/setCaptureSource\(\s*["']text["']\s*\)/);
    expect(elseBranch).toMatch(/openFromBar\(text\)/);
  });

  it("the capture bar's Enter routes long input to extraction, short input to today's openFromBar", () => {
    const router = /const openFromBarOrDraft = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(router).toBeTruthy();
    expect(router).toMatch(/TYPED_EXTRACT_MIN_CHARS/);
    expect(router).toMatch(/extractFromTyped/);
    expect(router).toMatch(/openFromBar\(text\)/);
    expect(behaviors).toMatch(/openFromBarOrDraft\(barText\)/);
  });

  it("the trigger input (where the bar redirects typing) also drafts on Enter for long fresh input only", () => {
    expect(behaviors).toMatch(/!editingLogId && !needsReview && !newLogResponse\.trim\(\) && typed\.length > TYPED_EXTRACT_MIN_CHARS/);
  });

  it("an empty extracted response prefills the neutral editable placeholder (never hard-blocks)", () => {
    const apply = /const applyExtractedDraft = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(apply).toMatch(/setNewLogResponse\(n\.response \|\| t\("beh\.extract\.noResponse"\)\)/);
  });
});

describe("AI-CAP-3 — QuickLogModal typed capture", () => {
  it("drafts through the same api.extractLog seam with language threaded", () => {
    expect(modal).toMatch(/api\.extractLog\(\{ message: text, childProfile, language: getAiLanguage\(\) \}\)/);
    expect(modal).toMatch(/normalizeExtractedLog\(/);
  });

  it("extraction-filled drafts flip the review provenance to 'ai-draft' (never 'text')", () => {
    expect(modal).toMatch(/setSource\(\s*["']ai-draft["']\s*\)/);
    expect(modal).toMatch(/source=\{source\}/);
    expect(modal).not.toMatch(/source="text"/);
  });

  it("FAIL-CLOSED: the modal 409 branch renders a visible alert surface and writes ZERO draft fields", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(modal)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog/);
    expect(branch).toMatch(/setEscalationMarkdown\(renderEscalationMarkdown\(/);
    expect(modal).toContain('data-testid="quicklog-escalation"');
    expect(modal).toMatch(/role="alert"/);
    expect(modal).toMatch(/<MarkdownBlock text=\{escalationMarkdown\}/);
  });

  it("an unknown escalation category still over-blocks toward crisis resources (safe failure)", () => {
    expect(modal).toMatch(/escalationCategories\.find\(\(c\) => c\.category === err\.category\) \?\?\s*escalationCategories\[0\]/);
  });

  it("confirm still writes through the ONE handleAddLog seam only", () => {
    expect(count(modal, /handleAddLog\(e\)/g)).toBe(1);
  });
});

describe("AI-CAP-4 — coach Create-log lands in a VISIBLE, review-gated form", () => {
  it("onCreateLog routes through requestCapture('ai-draft') — never a bare tab switch", () => {
    expect(coach).toMatch(/requestCapture\(\s*["']ai-draft["']\s*\)/);
    // Both the success and the note-prefill fallback route through the seam.
    expect(count(coach, /requestCapture\(\s*["']ai-draft["']\s*\)/g)).toBe(2);
  });

  it("the extraction call threads the parent's AI language and clamps through the shared taxonomy", () => {
    expect(coach).toMatch(/api\.extractLog\(\{ message: source, childProfile, language: getAiLanguage\(\) \}\)/);
    expect(coach).toMatch(/normalizeExtractedLog\(d, source\.slice\(0, 140\)\)/);
  });

  it("FAIL-CLOSED: an escalation on the handoff writes ZERO draft fields and surfaces the resources in the thread", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\n\s*\}/.exec(coach)?.[1] ?? "";
    expect(branch).toBeTruthy();
    expect(branch).not.toMatch(/setNewLog/);
    expect(branch).not.toMatch(/requestCapture/);
    expect(branch).toMatch(/renderEscalationMarkdown\(escalationMatchForCategory\(err\.category\)\)/);
    expect(branch).toMatch(/return;/);
  });

  it("the ArborContext capture seam accepts the 'ai-draft' mode", () => {
    expect(context).toMatch(/export type CaptureMode = "voice" \| "photo" \| "text" \| "ai-draft"/);
  });

  it("BehaviorsTab consumes the ai-draft handoff: gate armed, ai-draft provenance, form opened into view", () => {
    const effect = /if\s*\(!pendingCaptureMode\)\s*return;[\s\S]*?consumeCaptureRequest\(\);/.exec(behaviors)?.[0] ?? "";
    expect(effect).toBeTruthy();
    expect(effect).toMatch(/["']ai-draft["']\s*\?\s*["']ai-draft["']/);
    expect(effect).toMatch(/if \(pendingCaptureMode === "ai-draft"\) focusForm\(\)/);
    expect(effect.indexOf("setNeedsReview(true)")).toBeLessThan(effect.indexOf("focusForm()"));
  });
});

describe("AI-CAP-3/4 — copy: EN+HE parity, factual, zero confidence wording (CODEX-7 extension)", () => {
  it("the new keys exist in both dictionaries", () => {
    for (const key of ["ql.review.source.aiDraft", "beh.extract.noResponse"]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  it("the ai-draft provenance line is factual — drafted by Arbor, no confidence wording", () => {
    expect(en["ql.review.source.aiDraft"]).toMatch(/drafted by Arbor/i);
    for (const value of [en["ql.review.source.aiDraft"], he["ql.review.source.aiDraft"]]) {
      expect(value).not.toMatch(/confidence|certainty|verified|accurate|ודאות|ביטחון|מאומת|מדויק/i);
    }
  });
});
