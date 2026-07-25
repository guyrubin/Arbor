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
  it("QuickLogModal and BehaviorsTab both render the SAME ConfirmCaptureReview", () => {
    expect(modal).toMatch(/import ConfirmCaptureReview from ["']\.\/ConfirmCaptureReview["']/);
    expect(behaviors).toMatch(/import ConfirmCaptureReview.* from ["']\.\.\/overview\/ConfirmCaptureReview["']/);
    expect(count(modal, /<ConfirmCaptureReview/g)).toBe(1);
    expect(count(behaviors, /<ConfirmCaptureReview/g)).toBe(1);
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

  it("the provenance line is source-keyed and factual: text / voice transcription / photo", () => {
    expect(review).toMatch(/text:\s*["']ql\.review\.source["']/);
    expect(review).toMatch(/voice:\s*["']ql\.review\.source\.voice["']/);
    expect(review).toMatch(/photo:\s*["']ql\.review\.source\.photo["']/);
  });
});

describe("TODAY-3 — the voice path is driven through review", () => {
  it("parseVoice (the only dictation-transcript consumer) arms the confirm gate with voice provenance", () => {
    const parse = /const parseVoice = async[\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(parse).toBeTruthy();
    expect(parse).toMatch(/setCaptureSource\(\s*["']voice["']\s*\)/);
    expect(parse).toMatch(/setNeedsReview\(true\)/);
    // and the gate is armed BEFORE either fill branch runs (top of the function)
    expect(parse.indexOf("setNeedsReview(true)")).toBeLessThan(parse.indexOf("try {"));
  });

  it("every pendingCaptureMode handoff (Today QuickCaptureBar / Journal tiles) arms the gate", () => {
    const effect = /if\s*\(!pendingCaptureMode\)\s*return;[\s\S]*?consumeCaptureRequest\(\);/.exec(behaviors)?.[0] ?? "";
    expect(effect).toBeTruthy();
    expect(effect).toMatch(/setNeedsReview\(true\)/);
    // the gate arms before the mode's onClick fires
    expect(effect.indexOf("setNeedsReview(true)")).toBeLessThan(effect.indexOf("onClick()"));
  });
});

describe("TODAY-3 — no behavior-log write without explicit confirm", () => {
  it("submitLog interposes the review BEFORE handleAddLog and returns while the gate is armed", () => {
    const submit = /const submitLog = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(submit).toBeTruthy();
    expect(submit).toMatch(/if\s*\(needsReview\)\s*\{\s*setReviewOpen\(true\);\s*return;/);
    expect(submit.indexOf("needsReview")).toBeLessThan(submit.indexOf("handleAddLog"));
  });

  it("handleAddLog is reachable from exactly two seams: ungated submitLog and confirmReview", () => {
    expect(count(behaviors, /handleAddLog\(e\)/g)).toBe(2);
    const confirm = /const confirmReview = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(confirm).toMatch(/handleAddLog\(e\)/);
    expect(confirm).toMatch(/setNeedsReview\(false\)/);
  });

  it("discard never writes — it resets the draft instead", () => {
    const discard = /const discardReview = [\s\S]*?\n  };/.exec(behaviors)?.[0] ?? "";
    expect(discard).toBeTruthy();
    expect(discard).not.toMatch(/handleAddLog/);
    expect(discard).toMatch(/cancelEditLog\(\)/);
  });
});

describe("TODAY-3/CODEX-7 — review copy: EN+HE parity, factual, zero confidence wording", () => {
  it("all provenance keys exist in both dictionaries", () => {
    for (const key of [
      "ql.review.source",
      "ql.review.source.voice",
      "ql.review.source.photo",
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
