/**
 * AI-05 — the two dropped hand-offs on the Ask surface.
 *
 *  (a) TEACHER NOTE. CoachAnswerCards renders the button only when the contract
 *      carries `handoffNotes.teacher`, hands the note text to `onAddToHandoff`,
 *      and CoachTab's callback took NO argument: `() => { setActiveTab("consult") }`.
 *      The parent tapped "Teacher note", landed in Consult, and the composer was
 *      empty — the note existed and was thrown away. AIX-S3(a) already fixed the
 *      identical defect for ArborVision via `requestConsultPrefill`; this is the
 *      same seam.
 *
 *  (b) THE OVERFLOW "LOG". The answer-card path routes an AI-authored draft
 *      through `requestCapture("ai-draft")` — the fail-closed gate that arms the
 *      review flag, stamps 'ai-draft' provenance and opens the Behaviors form
 *      into view (AI-CAP-4). The "…" overflow on a plain (contract-less) answer
 *      wrote `setNewLogNotes(msg.text…)` and then did a BARE `setActiveTab`,
 *      skipping the gate entirely — an AI-authored draft heading for the log
 *      store with none of the review posture the gate exists to enforce.
 *
 * Source-scan tests in the repo's typedCaptureExtraction pattern: `\r\n` is
 * normalised FIRST, every extraction is guarded with toBeTruthy(), and every
 * assertion is proven against the PRE-fix snippet so it cannot pass vacuously.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(here, "..", "..");
const coachSrc = readFileSync(path.join(srcRoot, "components", "tabs", "CoachTab.tsx"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const cardsSrc = readFileSync(path.join(here, "CoachAnswerCards.tsx"), "utf8").replace(/\r\n/g, "\n");

/* ── (a) the teacher note ────────────────────────────────────────────────── */

const OLD_HANDOFF = `                      onAddToHandoff={() => {
                        setActiveTab("consult");
                        toast(t("coach.toast.teacherNoteCopied"), "info");
                      }}`;
/** The note must be BOUND (a parameter) and CONSUMED (through the prefill seam). */
const HANDOFF_CONSUMES_NOTE = /onAddToHandoff=\{\(note\) => \{[\s\S]{0,300}?requestConsultPrefill\(note\)/;

describe("AI-05(a) — the teacher note is consumed, not dropped", () => {
  it("negative control: the regex does NOT match the pre-fix zero-argument callback", () => {
    expect(HANDOFF_CONSUMES_NOTE.test(OLD_HANDOFF)).toBe(false);
    // …and the pre-fix snippet really is the shape that shipped: no parameter.
    expect(/onAddToHandoff=\{\(\) =>/.test(OLD_HANDOFF)).toBe(true);
  });

  it("the card still SUPPLIES a real note to the callback (the value exists to drop)", () => {
    expect(cardsSrc).toMatch(/onAddToHandoff\(contract\.handoffNotes\.teacher\)/);
  });

  it("CoachTab binds the note and prefills the Consult composer with it", () => {
    expect(coachSrc).toMatch(HANDOFF_CONSUMES_NOTE);
    expect(coachSrc).not.toMatch(/onAddToHandoff=\{\(\) =>/);
  });

  it("it routes through the SAME prefill seam ArborVision's handoff already uses", () => {
    // Two call sites now: the vision handoff (AIX-S3a) and the teacher note.
    expect((coachSrc.match(/requestConsultPrefill\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

/* ── (b) the overflow "Log" and the ai-draft gate ────────────────────────── */

const OLD_OVERFLOW_LOG = `                            onClick={() => {
                              setNewLogNotes(msg.text.replace(/[#*]/g, "").trim().slice(0, 400));
                              setActiveTab("behaviors");
                              setOpenMenuIdx(null);
                              toast(t("coach.toast.logPrefilled"), "info");
                            }}`;
/** Every branch that writes an AI-authored draft must arm the gate BEFORE the
 *  tab switch — the Behaviors consumer reads pendingCaptureMode on arrival. */
const GATED_OVERFLOW_LOG =
  /setNewLogNotes\(msg\.text[\s\S]{0,900}?requestCapture\("ai-draft"\);\s*\n\s*setActiveTab\("behaviors"\);/;

describe("AI-05(b) — the overflow Log no longer bypasses the fail-closed ai-draft gate", () => {
  it("negative control: the pre-fix snippet writes a draft and switches tab with NO gate", () => {
    expect(GATED_OVERFLOW_LOG.test(OLD_OVERFLOW_LOG)).toBe(false);
    expect(/setNewLogNotes\(msg\.text/.test(OLD_OVERFLOW_LOG)).toBe(true);
    expect(/requestCapture/.test(OLD_OVERFLOW_LOG)).toBe(false);
  });

  it("the overflow Log arms requestCapture('ai-draft') before navigating", () => {
    expect(coachSrc).toMatch(GATED_OVERFLOW_LOG);
  });

  it("NO setNewLog* write in CoachTab reaches Behaviors without the gate", () => {
    // Every `setActiveTab("behaviors")` in this file must be preceded, within
    // the same handler, by the gate. Extraction is guarded so an empty match
    // set fails loudly instead of passing silently.
    const navigations = [...coachSrc.matchAll(/setActiveTab\("behaviors"\)/g)];
    expect(navigations.length).toBeGreaterThan(0);
    for (const nav of navigations) {
      const before = coachSrc.slice(Math.max(0, nav.index! - 900), nav.index!);
      expect(before).toBeTruthy();
      // A navigation that carries no draft at all needs no gate; one that does
      // must have armed it.
      if (/setNewLog/.test(before)) {
        expect(
          /requestCapture\("ai-draft"\)/.test(before),
          `a setNewLog* write reaches Behaviors ungated near index ${nav.index}`,
        ).toBe(true);
      }
    }
  });
});
