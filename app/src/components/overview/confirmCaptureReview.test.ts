import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18n";

/**
 * TODAY-3 — confirmed capture for voice/photo (2026-07-23 next-level wave 3).
 *
 * Firewall CONDITIONS (GD-11 flag): one shared ConfirmCaptureReview contract,
 * no forked capture path; no behavior-log write from any Today-originated
 * capture without explicit confirm; the provenance line stays FACTUAL — no
 * confidence/verdict wording (pairs with the CODEX-7 removal).
 *
 * The vitest env is node-only, so these are SOURCE-BASED structural guards in
 * the house pattern (todayConsolidation.test.ts): they pin the code shape that
 * makes the acceptance true at runtime —
 *   1. QuickLogModal and BehaviorsTab render the SAME shared component,
 *   2. the voice path (parseVoice — the only dictation-transcript consumer)
 *      arms the confirm gate, so a voice draft is driven through review,
 *   3. every requestCapture()/pendingCaptureMode handoff arms the gate,
 *   4. submitLog cannot reach handleAddLog while the gate is armed,
 *   5. the review copy set (ql.review.*) has EN+HE parity and zero
 *      confidence/certainty wording.
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

const review = stripComments(read("components/overview/ConfirmCaptureReview.tsx"));
const modal = stripComments(read("components/overview/QuickLogModal.tsx"));
const behaviors = stripComments(read("components/tabs/BehaviorsTab.tsx"));

describe("TODAY-3 — one shared confirmed-capture contract (no forked path)", () => {
  it("QuickLogModal owns the single review; Behaviors only launches that sheet", () => {
    expect(modal).toMatch(/import ConfirmCaptureReview from ["']\.\/ConfirmCaptureReview["']/);
    expect(behaviors).toContain("openCaptureSheet");
    expect(behaviors).not.toMatch(/import ConfirmCaptureReview/);
    expect(count(modal, /<ConfirmCaptureReview/g)).toBe(1);
    expect(count(behaviors, /<ConfirmCaptureReview/g)).toBe(0);
  });

  it("neither surface re-implements the review block inline (the copy lives in the shared component only)", () => {
    expect(review).toMatch(/ql\.review\.title/);
    expect(review).toMatch(/ql\.review\.notSaved/);
    expect(review).toMatch(/ql\.review\.confirm/);
    for (const surface of [modal, behaviors]) {
      expect(surface).not.toMatch(/ql\.review\.title/);
      expect(surface).not.toMatch(/ql\.review\.notSaved/);
      expect(surface).not.toMatch(/ql\.review\.confirm/);
    }
  });

  it("the provenance line is source-keyed and factual: text / voice transcription / photo / ai-draft", () => {
    expect(review).toMatch(/text:\s*["']ql\.review\.source["']/);
    expect(review).toMatch(/voice:\s*["']ql\.review\.source\.voice["']/);
    expect(review).toMatch(/photo:\s*["']ql\.review\.source\.photo["']/);
    // AI-CAP-3/4 (CODEX-7 extension): extraction-filled drafts carry the
    // factual ai-draft source — the review must never claim the parent wrote
    // what the model drafted.
    expect(review).toMatch(/["']ai-draft["']:\s*["']ql\.review\.source\.aiDraft["']/);
  });
});

describe("TODAY-3 — every capture uses the shared review gate", () => {
  const context = stripComments(read("context/ArborContext.tsx"));
  const shell = stripComments(read("components/layout/Shell.tsx"));

  it("voice enters the one extraction function with truthful provenance", () => {
    const voice = /const startVoice = [\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(voice).toBeTruthy();
    expect(voice).toContain('setSource(current => current === "ai-draft" ? current : "voice")');
    expect(voice).toContain('void extractFromTyped(said, hardMomentRef.current ? "incident" : "moment")');
    const extract = /const extractFromTyped = async[\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(extract).toBeTruthy();
    expect(extract).toContain('setSource("ai-draft")');
    expect(extract).toContain('setReviewing(true)');
    expect(extract).not.toMatch(/handleAddLog\(|addMoment\(/);
  });

  it("the context handoff reaches the shell-mounted modal; AI drafts open directly in review", () => {
    expect(context).toContain('setCaptureSheet({ open: true, ...opts })');
    expect(shell).toMatch(/<QuickLogModal[\s\S]{0,500}review=\{captureSheet\.review\}/);
    expect(modal).toMatch(/if \(review\) \{\s*setSource\(review\);\s*setHardMoment\(true\);\s*setReviewing\(true\);/);
    expect(behaviors).not.toMatch(/pendingCaptureMode|consumeCaptureRequest|<ConfirmCaptureReview/);
  });
});

describe("TODAY-3 — no incident write without explicit confirm", () => {
  it("submit opens review and never writes; confirm alone reaches handleAddLog", () => {
    const submit = /const submit = [\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    const confirm = /const confirm = async[\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(submit).toBeTruthy();
    expect(confirm).toBeTruthy();
    expect(submit).toContain('setReviewing(true)');
    expect(submit).not.toMatch(/handleAddLog\(|addMoment\(/);
    expect(count(modal, /handleAddLog\(/g)).toBe(1);
    expect(confirm).toContain('await handleAddLog(e, { callerShowsFailure: true, ...contentProvenance })');
    expect(modal).toContain('onConfirm={confirm}');
    // Negative control: the retired direct-submit shape violates this gate.
    expect('const submitLog = (e) => handleAddLog(e);').toMatch(/handleAddLog\(/);
    expect(behaviors).not.toMatch(/handleAddLog\(|addMoment\(|const submitLog/);
  });

  it("discard clears the draft and closes without writing", () => {
    const discard = /const discard = [\s\S]*?\n  };/.exec(modal)?.[0] ?? "";
    expect(discard).toBeTruthy();
    expect(discard).not.toMatch(/handleAddLog|addMoment/);
    for (const field of ["Trigger", "Response", "Notes"]) expect(discard).toContain(`setNewLog${field}("")`);
    expect(discard).toContain('setReviewing(false)');
    expect(discard).toContain('closeSheet()');
  });
});

describe("TODAY-3/CODEX-7 — review copy: EN+HE parity, factual, zero confidence wording", () => {
  it("all provenance keys exist in both dictionaries", () => {
    for (const key of [
      "ql.review.source",
      "ql.review.source.voice",
      "ql.review.source.photo",
      "ql.review.source.aiDraft",
      "ql.review.photoAlt",
    ]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
  });

  it("no ql.review.* key in either language asserts confidence/certainty/accuracy", () => {
    for (const dict of [en, he]) {
      for (const [key, value] of Object.entries(dict)) {
        if (!key.startsWith("ql.review.")) continue;
        expect(value, `${key} carries confidence wording`).not.toMatch(
          /confidence|certainty|verified|accurate|ודאות|ביטחון|מאומת|מדויק/i,
        );
      }
    }
  });

  it("ConfirmCaptureReview source carries no confidence/certainty wording (CODEX-7 may never return)", () => {
    expect(review).not.toMatch(/confidence/i);
    expect(review).not.toMatch(/certainty/i);
    expect(review).not.toMatch(/ודאות/);
    expect(review).not.toMatch(/ביטחון/);
  });
});

describe("AI-CAP-5 — review honesty: the AI-guessed fields are visible and inline-correctable", () => {
  it("the shared component renders intensity (1-5 stepper), context (chip row), and duration rows in place", () => {
    expect(review).toMatch(/ql\.review\.intensity/);
    expect(review).toMatch(/ql\.review\.context/);
    expect(review).toMatch(/ql\.review\.duration/);
    // stepper clamps to the 1-5 band
    expect(review).toMatch(/onIntensityChange\(Math\.max\(1, intensity - 1\)\)/);
    expect(review).toMatch(/onIntensityChange\(Math\.min\(5, intensity \+ 1\)\)/);
    // context chips select in place
    expect(review).toMatch(/onContextChange\(c\)/);
    // duration corrects in place
    expect(review).toMatch(/onDurationChange\(/);
    // text rows are tap-to-edit (a row with onChange renders an inline editor)
    expect(review).toMatch(/ql\.review\.tapToEdit/);
  });

  it("the one consumer passes the complete editable draft into the shared review", () => {
    for (const surface of [modal]) {
      expect(surface).toMatch(/intensity=\{(?:isIncidentType\(newLogType\) \? )?newLogIntensity(?: : undefined)?\}/);
      expect(surface).toMatch(/onIntensityChange=\{setNewLogIntensity\}/);
      expect(surface).toMatch(/context=\{newLogContext\}/);
      expect(surface).toMatch(/durationMinutes=\{(?:isIncidentType\(newLogType\) \? )?newLogDuration(?: : undefined)?\}/);
      expect(surface).toMatch(/onDurationChange=\{setNewLogDuration\}/);
      expect(surface).toMatch(/onChange: setNewLogTrigger/);
      expect(surface).toMatch(/onChange: setNewLogResponse/);
      expect(surface).toMatch(/onChange: setNewLogNotes/);
    }
  });

  it("'from your note' is a FACTUAL provenance tag: gated on AI-populated sources only, keys exist EN+HE", () => {
    // the tag renders only for voice / ai-draft drafts — never on hand-typed rows
    expect(review).toMatch(/source === "voice" \|\| source === "ai-draft"/);
    for (const key of [
      "ql.review.intensity",
      "ql.review.intensityDown",
      "ql.review.intensityUp",
      "ql.review.context",
      "ql.review.duration",
      "ql.review.fromNote",
      "ql.review.tapToEdit",
    ]) {
      expect(en[key], `en missing ${key}`).toBeTruthy();
      expect(he[key], `he missing ${key}`).toBeTruthy();
    }
    // (the ql.review.* confidence-wording scan above covers the new keys too)
  });

  it("inline correction updates the confirmed write WITHOUT leaving the review (setters are the same draft state handleAddLog reads)", () => {
    // BehaviorsTab: the review's setters are the context draft setters — the
    // confirmed write (handleAddLog) reads newLogIntensity/newLogContext/etc.
    // directly, so a stepper tap inside review is already in the write.
    expect(behaviors).not.toContain("setNewLogContext");
    expect(modal).toMatch(/onContextChange=\{\(c\) => setNewLogContext\(c as BehaviorContext \| ""\)\}/);
  });
});
