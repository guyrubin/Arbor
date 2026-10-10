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

describe("AI-CAP-3 — the hard-moments launcher reaches the one typed extraction owner", () => {
  const extract = /const extractFromTyped = async[\s\S]*?\n  };/.exec(modal)?.[0] ?? "";

  it("the hub launches the sheet and owns no second form, extraction or draft setters", () => {
    expect(behaviors).toContain('onText={() => openCaptureSheet({ mode: "text" })}');
    expect(behaviors).not.toMatch(/openFromBar|extractFromTyped|setNewLog|<form|handleAddLog/);
    expect(extract).toBeTruthy();
    expect(extract).toContain('setSource("ai-draft")');
    expect(extract).toContain('setReviewing(true)');
    expect(extract).not.toMatch(/handleAddLog\(|addMoment\(/);
  });

  it("the parent's input is immediately visible and remains untouched on non-escalation failure", () => {
    expect(modal).toContain('value={newLogTrigger}');
    expect(modal).toContain('onChange={(e) => changeTrigger(e.target.value)}');
    expect(modal).toMatch(/const changeTrigger = \(text: string\) => \{\s*stopCaptureWork\(\);\s*setNewLogTrigger\(text\);/);
    const fallback = /\} else \{([\s\S]*?)\}\s*\n\s*\} finally/.exec(extract)?.[1] ?? "";
    expect(fallback).toBeTruthy();
    expect(fallback).toContain('toast(t("beh.toast.voiceFallback"), "info")');
    expect(fallback).not.toMatch(/setNewLog|setSource|setReviewing/);
    // Negative control: resetting in fallback would lose the parent's words.
    expect('setNewLogTrigger("");').toMatch(/setNewLog/);
  });

  it("an empty extracted response is a visible editable placeholder", () => {
    expect(extract).toContain('setNewLogResponse(n.response || t("beh.extract.noResponse"))');
    expect(modal).toContain('value: newLogResponse, onChange: setNewLogResponse');
  });

  it("late extraction is fenced from another child, capture, or edited draft", () => {
    expect(modal).toContain('sessionRef.current.sync(`${childProfile.id}:${editLogId ?? "new"}`, open)');
    const lease = extract.indexOf('const isCurrent = sessionRef.current.lease("extract")');
    const request = extract.indexOf('await api.extractLog(');
    expect(lease).toBeGreaterThan(-1);
    expect(request).toBeGreaterThan(lease);
    expect(extract.slice(request)).toMatch(/await api\.extractLog\([^;]*\);\s*if \(!isCurrent\(\)\) return;\s*const n = normalizeExtractedLog/);
    expect(extract.match(/if \(!isCurrent\(\)\) return;/g)).toHaveLength(2);
    expect(modal).toContain('sessionRef.current.retire("extract")');
    expect(modal).toContain('sessionRef.current.invalidate()');
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
    // ...and the words already in the field are dropped, never kept saveable.
    expect(branch).toMatch(/dropEscalatedDraft\(\);/);
    const drop = /const dropEscalatedDraft = \(\) => \{([\s\S]*?)\n  \};/.exec(modal)?.[1] ?? "";
    for (const clear of ['setNewLogTrigger("")', 'setNewLogNotes("")', 'setNewLogResponse("")', "setReviewing(false)"]) expect(drop).toContain(clear);
    expect(drop).not.toMatch(/setNewLog\w+\((?!"")/);
    expect(modal).toContain('data-testid="quicklog-escalation"');
    expect(modal).toMatch(/role="alert"/);
    expect(modal).toMatch(/<MarkdownBlock text=\{escalationMarkdown\}/);
  });

  it("an unknown escalation category still over-blocks toward crisis resources (safe failure)", () => {
    expect(modal).toMatch(/escalationCategories\.find\(\(c\) => c\.category === err\.category\) \?\?\s*escalationCategories\[0\]/);
  });

  it("confirm still writes through the ONE handleAddLog seam only", () => {
    // The sheet owns this write's failure message (inline alert), so the seam stays quiet.
    expect(count(modal, /handleAddLog\(e, \{ callerShowsFailure: true, \.\.\.contentProvenance \}\)/g)).toBe(1);
    expect(count(modal, /handleAddLog\(/g)).toBe(1);
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

  it("AI draft handoffs open the shared modal in review, without reactivating the retired hub form", () => {
    expect(modal).toMatch(/if \(review\) \{\s*setSource\(review\);\s*setHardMoment\(true\);\s*setReviewing\(true\);/);
    expect(behaviors).not.toMatch(/pendingCaptureMode|consumeCaptureRequest|focusForm|setNeedsReview/);
    expect(context).toContain('setCaptureSheet({ open: true, ...opts })');
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
