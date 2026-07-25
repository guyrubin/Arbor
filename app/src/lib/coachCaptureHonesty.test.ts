import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Next-level Wave-2 guard — COACH-4 + COACH-8 (2026-07-25).
 *
 * COACH-4: CoachTab is ONE conversation canvas. The wave-2 draft had two
 * mirrored composers (hero + in-thread) bound to the same chatInput — two send
 * buttons, two mics, three photo entries — and the answer streamed into a
 * fixed-height inner-scroll card below the fold. The consolidation keeps the
 * hero composer as the single input and lets the thread flow with the page.
 * Firewall CONDITIONS (CODEX-9 lesson): coach.aiDisclosure (EU AI-Act Art. 50)
 * and the photo/voice entry points MUST survive, and the thread viewport must
 * not shrink below the previous min(70dvh,560px) behavior.
 *
 * COACH-8: the Behaviors capture bar must be a REAL input (honest affordance),
 * not a button styled as a text field — typing prefills newLogTrigger and
 * moves focus into the existing form. Zero new capture paths.
 *
 * SOURCE-BASED (same form as clinicalFirewall.wave3.test.ts) so a future
 * re-introduction of the duplicate composer or the fake-affordance bar is
 * caught at CI time.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
function read(rel: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
}
function count(code: string, needle: string): number {
  return code.split(needle).length - 1;
}

describe("COACH-4 — CoachTab is one composer + one flowing thread", () => {
  const code = read("components/tabs/CoachTab.tsx");

  it("has exactly one visible text input bound to chatInput (the hero textarea)", () => {
    expect(count(code, "<textarea")).toBe(1);
    expect(count(code, "value={chatInput}")).toBe(1);
    // The deleted bottom capsule input must not come back.
    expect(code).not.toContain("<input");
  });

  it("has exactly one mic, one photo and one document entry point (firewall condition: they survive)", () => {
    expect(count(code, "onClick={toggleVoice}")).toBe(1);
    expect(count(code, 'setVisionMode("observe")')).toBe(1);
    expect(count(code, 'setVisionMode("document")')).toBe(1);
  });

  it("renders the EU AI-Act Art. 50 disclosure line (firewall condition: it survives)", () => {
    expect(code).toContain('t("coach.aiDisclosure")');
  });

  it("renders coach.empty.title exactly once", () => {
    expect(count(code, "coach.empty.title")).toBe(1);
  });

  it("thread flows with the page — no fixed-height inner scroll, min-height floor kept", () => {
    // A FIXED height class (" h-[min(...)"), as opposed to the kept min-height floor.
    expect(code).not.toMatch(/(?<!min-)h-\[min\(70dvh/);
    expect(code).not.toContain("overflow-y-auto");
    expect(code).toContain("min-h-[min(70dvh,560px)]");
  });

  it("keeps Council and the specialist handoff as the compact row under the thread", () => {
    expect(code).toContain("handleCouncilSend");
    expect(code).toContain("coach.specialist.cta");
  });
});

describe("COACH-8 — Behaviors capture bar is an honest input", () => {
  const code = read("components/tabs/BehaviorsTab.tsx");

  it("the bar is a real input, not a button styled as a text field", () => {
    expect(code).toContain("placeholder={captureCopy.intro}");
    expect(code).not.toMatch(/\{captureCopy\.intro\}\s*<\/button>/);
  });

  it("typing opens the form with the text prefilled into newLogTrigger and focus moved there", () => {
    expect(code).toContain("openFromBar");
    expect(code).toMatch(/const openFromBar = \(text: string\) => \{\s*if \(text\.trim\(\)\) setNewLogTrigger\(text\);/);
    expect(code).toContain("triggerInputRef.current");
    expect(code).toMatch(/el\.focus\(\)/);
  });

  it("Enter opens the form rather than submitting", () => {
    expect(code).toMatch(/e\.key === "Enter"[\s\S]{0,60}preventDefault\(\);\s*openFromBar/);
  });

  it("zero new capture paths — saving still goes only through the one write seam", () => {
    // Exactly two call sites into the SAME existing handleAddLog seam:
    // ungated submitLog, and confirmReview (TODAY-3 wave-3: the explicit
    // ConfirmCaptureReview confirm for voice/photo/handoff captures — an
    // interposed review on the existing seam, not a new capture path;
    // pinned in detail by confirmCaptureReview.test.ts).
    expect(count(code, "handleAddLog(e)")).toBe(2);
  });
});
