import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F-CHILD-2 — the Keep-a-moment capture sheet: a Sheet below lg, three
 * capture modes, where/area chips, an honest privacy line, a saved state that
 * appears only with the resolved write (one confirmation: the Receipt), and
 * no bare "n / 5" grade — at capture or at review.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");
const modal = read("QuickLogModal.tsx");
const chips = read("CaptureWhereArea.tsx");
const review = read("ConfirmCaptureReview.tsx");
const sheet = read("../ui/Sheet.tsx");

describe("F-CHILD-2 Keep-a-moment sheet", () => {
  it("is titled Keep a moment and picks a Sheet below lg", () => {
    expect(modal).toContain("const Surface = useCompactSurface() ? Sheet : Modal;");
    expect(modal).toContain('t("companion.capture.keepTitle")');
    expect(modal).not.toContain("<Modal ");
  });

  it("offers Write · Dictate · Photo, each on the 44 px floor", () => {
    expect(modal).toContain('data-testid="quicklog-modes"');
    for (const mode of ["write", "dictate", "photo"]) {
      expect(modal).toMatch(new RegExp(`data-capture-mode="${mode}"[^\\n]*className="inline-flex min-h-11`));
    }
    expect(modal).toContain('data-capture-mode="dictate" onClick={startVoice}');
  });

  it("where and area chips prefill from ?area and stay on the floor", () => {
    expect(modal).toContain("<CaptureWhereArea place={newLogContext}");
    expect(modal).toContain("setArea(areaFromHash())");
    expect(chips).toContain("data-capture-place");
    expect(chips).toContain("data-capture-area");
    expect((chips.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(chips).not.toMatch(/\b(ml|mr|pl|pr)-\d|marginLeft|marginRight|paddingLeft|paddingRight/);
  });

  it("the saved state appears only with the resolved write and leads to Moments", () => {
    // reply is set only after the write resolves; the saved state lives inside the reply branch
    const replyAt = modal.indexOf("setReply({ log: written");
    const awaitAt = modal.lastIndexOf("await ", replyAt);
    expect(replyAt).toBeGreaterThan(0);
    expect(awaitAt).toBeGreaterThan(0);
    expect(modal).toMatch(/data-testid="quicklog-reply-another"\s+onClick=\{anotherMoment\}/);
    expect(modal).toContain('href={`#${routeHash("timeline", { view: "time" })}`}');
    expect(modal).toContain('data-testid="quicklog-reply-moments"');
    expect(modal).toContain('data-testid="quicklog-reply-done"');
    expect(modal).toContain('{t("elev.capture.reply.done")}');
  });

  it("one confirmation: the Receipt line, no second 'Moment kept' line", () => {
    expect(modal).not.toContain("quicklog-reply-saved");
    expect(modal).not.toContain("companion.capture.saved");
    expect(modal.match(/<Receipt\b/g) ?? []).toHaveLength(1);
    expect(modal).toContain('testId="quicklog-reply-line1"');
  });

  it("the new saved-state chrome belongs to plain moments only, and both onward doors are outlined", () => {
    expect(modal).toContain('{!reply.hard && !!reply.log.trigger?.trim() && <p dir="auto" data-testid="quicklog-reply-words"');
    const onwardAt = modal.indexOf('data-testid="quicklog-reply-onward"');
    expect(onwardAt).toBeGreaterThan(0);
    const gate = modal.lastIndexOf("{!reply.hard && (", onwardAt);
    expect(gate).toBeGreaterThan(0);
    expect(onwardAt - gate).toBeLessThan(120);
    const onward = modal.slice(onwardAt, modal.indexOf("</div>", onwardAt));
    expect(onward).toContain('data-testid="quicklog-reply-another"');
    expect(onward).toContain('data-testid="quicklog-reply-moments"');
    expect(onward).not.toContain('background: "var(--arbor-clay)"');
    expect((onward.match(/border: "1px solid var\(--arbor-rule-strong\)"/g) ?? []).length).toBe(2);
  });

  it("Another moment keeps the filtered view's area, as opening the sheet does", () => {
    const another = /const anotherMoment = \(\) => \{[\s\S]*?\n  \};/.exec(modal)?.[0] ?? "";
    expect(another).toBeTruthy();
    expect(another).toContain("setArea(areaFromHash());");
    expect(another).not.toContain("setArea(null)");
  });

  it("intensity is named in words, never a bare number out of five, at capture and at review", () => {
    expect(modal).not.toMatch(/\/\s*5\b/);
    expect(modal).toContain('import { INTENSITY_WORDS, intensityWordKey } from "../../lib/intensityWords";');
    expect(modal).toContain("aria-valuetext={t(intensityWordKey(newLogIntensity))}");
    // the review step (ConfirmCaptureReview) says the same word, in one neutral chip
    expect(review).not.toMatch(/\/\s*5\b/);
    expect(review).not.toMatch(/\[1, 2, 3, 4, 5\]\.map/);
    expect(review).toContain("{t(intensityWordKey(intensity))}");
  });

  it("only the capture and evidence sheets frost the page: the Sheet's blur is opt-in", () => {
    expect(sheet).toContain("scrimBlur = false,");
    expect(sheet).toContain('...(scrimBlur ? { backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" } : {})');
    expect(sheet.match(/backdropFilter/g) ?? []).toHaveLength(1);
    expect(modal).toContain("<Surface open={open} onClose={closeSheet} scrimBlur title=");
  });

  it("carries the honest privacy line and no white-on-accent class", () => {
    expect(modal).toContain('data-testid="quicklog-privacy"');
    expect(modal).toContain('t("companion.capture.privacy")');
    expect(modal).not.toMatch(/\btext-white\b/);
  });
});
