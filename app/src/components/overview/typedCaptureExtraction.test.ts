import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";
import { extractionOpensIncidentReview, momentLogFields, normalizeExtractedLog } from "../../content/behaviorTaxonomy";

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

  it("FAIL-CLOSED: the typed 409 branch renders the escalation surface and leaves ZERO draft fields", () => {
    const branch = /if \(err instanceof EscalationRequiredError\) \{([\s\S]*?)\} else \{/.exec(extract)?.[1] ?? "";
    expect(branch).toBeTruthy();
    // Nothing in this branch may WRITE a draft field…
    expect(branch).not.toMatch(/setNewLog/);
    expect(branch).not.toMatch(/applyExtractedDraft/);
    expect(branch).not.toMatch(/toast\(/);
    expect(branch).toMatch(/setEscalationMarkdown\(renderEscalationMarkdown\(/);
    // …and TJB-09 (optimistic draft) makes the ROLLBACK part of this contract:
    // the parent's sentence is now prefilled BEFORE the call, so a 409 must
    // clear it through the shared reset seam (the one discardReview uses)
    // rather than leaving an escalated transcript editable in the form.
    expect(branch).toMatch(/cancelEditLog\(\)/);
    expect(branch).toMatch(/setCaptureOpen\(false\)/);
  });

  it("TJB-09: the typed sentence is in a VISIBLE draft BEFORE the model is called", () => {
    const prefillIdx = extract.indexOf("openFromBar(text)");
    const callIdx = extract.indexOf("api.extractLog(");
    expect(prefillIdx).toBeGreaterThan(-1);
    expect(callIdx).toBeGreaterThan(-1);
    // NEGATIVE CONTROL for this assertion: in the shipped pre-change shape the
    // ONLY openFromBar(text) sat inside the catch — i.e. AFTER the call — so
    // this ordering check fails on it. Reconstruct that shape and prove it.
    const shipped = `const extractFromTyped = async (text) => {
      setParsing(true);
      try { const d = await api.extractLog({ message: text }); }
      catch (err) { openFromBar(text); }
    };`;
    expect(shipped.indexOf("openFromBar(text)")).toBeGreaterThan(shipped.indexOf("api.extractLog("));
    expect(prefillIdx).toBeLessThan(callIdx);
    // …and it is not awaited, so nothing blocks on the round-trip.
    expect(extract).not.toMatch(/await\s+openFromBar/);
  });

  it("extraction failure (non-escalation) degrades to today's ungated behavior", () => {
    const elseBranch = /\} else \{([\s\S]*?)\}\s*\n\s*\} finally/.exec(extract)?.[1] ?? "";
    expect(elseBranch).toMatch(/setNeedsReview\(false\)/);
    expect(elseBranch).toMatch(/setCaptureSource\(\s*["']text["']\s*\)/);
    // The sentence is ALREADY in the trigger field from the optimistic
    // prefill, so this branch must not re-write (and re-scroll) it.
    expect(elseBranch).not.toMatch(/openFromBar/);
  });

  it("W2-ASKJB critic r2: the hub's own capture bar is gone — typed extraction stays reachable through the inline form AND the one capture sheet", () => {
    // The bar's 2-row field opened the inline form on every keystroke, so its
    // Enter router was unreachable by typing. The hub now mounts Today's
    // QuickCaptureBar (every tile opens the ONE capture sheet, which carries
    // its own typed extraction); the inline form's long-text path stays.
    expect(behaviors).not.toMatch(/openFromBarOrDraft|barText/);
    expect(behaviors).toContain('onText={() => openCaptureSheet({ mode: "text" })}');
    expect(behaviors).toMatch(/typed\.length > TYPED_EXTRACT_MIN_CHARS[\s\S]{0,120}void extractFromTyped\(typed\)/);
    const sheet = read("components/overview/QuickLogModal.tsx");
    expect(sheet).toContain("api.extractLog(");
  });

  it("the trigger input (where the bar redirects typing) also drafts on Enter for long fresh input only", () => {
    expect(behaviors).toMatch(/!editingLogId && !needsReview && !newLogResponse\.trim\(\) && typed\.length > TYPED_EXTRACT_MIN_CHARS/);
  });

  it("an empty extracted response prefills the neutral editable placeholder (never hard-blocks)", () => {
    const apply = /const applyExtractedDraft = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(apply).toMatch(/setNewLogResponse\(n\.response \|\| t\("beh\.extract\.noResponse"\)\)/);
  });

  it("a late extraction never writes into another child's draft (lease taken before the request, checked after it)", () => {
    expect(behaviors).toMatch(/const captureLease = \(\) => \{\s*const scope = captureChildScopeRef\.current;\s*return \(\) => captureAliveRef\.current && captureChildScopeRef\.current === scope;/);
    for (const fn of ["parseVoice", "extractFromTyped"]) {
      const body = new RegExp(`const ${fn} = async [\\s\\S]*?\\n  };`).exec(behaviors)?.[0] ?? "";
      expect(body, fn).not.toBe("");
      const lease = body.indexOf("const isCurrent = captureLease();");
      const request = body.indexOf("await api.extractLog(");
      expect(lease, fn).toBeGreaterThan(-1);
      expect(lease, fn).toBeLessThan(request);
      // The success write is gated, and the non-escalation fallback is gated.
      expect(body.slice(request), fn).toMatch(/await api\.extractLog\([^;]*\);\s*if \(!isCurrent\(\)\) return;\s*applyExtractedDraft/);
      expect((body.match(/if \(!isCurrent\(\)\) return;/g) ?? []).length, fn).toBe(2);
    }
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

describe("AI-CAP-4 — coach AI drafts land in the review-gated sheet (B-ASKJB-05: the dead Create-log handler is gone)", () => {
  it("both overflow and inline Edit keep AI drafts in the review-gated capture sheet", () => {
    // Media now enters the same conversation; there is no separate Vision
    // handoff. The overflow and inline advice Edit still require review.
    const tray = stripComments(read("components/capture/CaptureProposalsTray.tsx"));
    expect(count(coach, /openCaptureSheet\(\{ review: "ai-draft" \}\)/g)).toBe(1);
    expect(count(tray, /openCaptureSheet\(\{ review: "ai-draft" \}\)/g)).toBe(1);
    expect(tray).toMatch(/setNewLogNotes\([\s\S]*?openCaptureSheet\(\{ review: "ai-draft" \}\)/);
    expect(coach).not.toContain("<ArborVision");
    expect(coach).not.toContain('setActiveTab("behaviors")');
    expect(coach).not.toContain("onCreateLog");
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

/**
 * B-TODAY-01 — a dictated joyful moment is never filed as an incident.
 * From the moment form, the incident review opens only when the extraction
 * label really is an incident type; otherwise the words stay in the moment
 * field and Save writes a Moment at intensity 1.
 */
describe("B-TODAY-01 — moment-branch extraction routing (both branches)", () => {
  const joyEn = "Noa said butterfly for the first time this morning";
  const joyHe = "נועה אמרה פרפר בפעם הראשונה הבוקר";
  const route = (label: string, text: string) =>
    extractionOpensIncidentReview(normalizeExtractedLog({ behaviorType: label }, text));

  it("{behaviorType:'Moment'} or a free label keeps the moment form; Save = Moment with no intensity", () => {
    expect(route("Moment", joyEn)).toBe(false);
    expect(route("First word", joyEn)).toBe(false);
    expect(route("First word", joyHe)).toBe(false);
    const saved = momentLogFields(joyEn);
    expect(saved.behaviorType).toBe("Moment");
    expect("intensity" in saved).toBe(false); // B-DATA-09
  });

  it("the HE transcript is preserved verbatim on the moment branch", () => {
    expect(momentLogFields(joyHe).trigger).toBe(joyHe);
  });

  it("{behaviorType:'Transition Refusal'} opens the incident review", () => {
    expect(route("Transition Refusal", joyEn)).toBe(true);
  });

  it("the modal gates the moment branch BEFORE any draft field is written; the hard-moment path is unchanged", () => {
    const fn = /const extractFromTyped = async \(text: string, from: "moment" \| "incident" = "incident"\) => \{[\s\S]*?\n  \};/.exec(modal)?.[0] ?? "";
    expect(fn).toBeTruthy();
    const gate = fn.indexOf('if (from === "moment" && !extractionOpensIncidentReview(n)) return;');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(fn.indexOf("setNewLogType("));
    expect(gate).toBeLessThan(fn.indexOf("setHardMoment(true)"));
    // The typed Enter path inside the incident form keeps the default branch.
    expect(modal).toMatch(/void extractFromTyped\(typed\);/);
  });
});
