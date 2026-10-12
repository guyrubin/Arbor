import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F-CHILD-2 — the Keep-a-moment capture sheet: a Sheet below lg, three
 * capture modes, where/area chips, an honest privacy line, a saved state that
 * appears only with the resolved write, and no bare "n / 5" grade.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.resolve(here, rel), "utf8").replace(/\r\n/g, "\n");
const modal = read("QuickLogModal.tsx");
const chips = read("CaptureWhereArea.tsx");

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
    // reply is set only after the write resolves; the saved line lives inside the reply branch
    const replyAt = modal.indexOf("setReply({ log: written");
    const awaitAt = modal.lastIndexOf("await ", replyAt);
    expect(replyAt).toBeGreaterThan(0);
    expect(awaitAt).toBeGreaterThan(0);
    expect(modal).toContain('data-testid="quicklog-reply-saved"');
    expect(modal).toMatch(/data-testid="quicklog-reply-another"\s+onClick=\{anotherMoment\}/);
    expect(modal).toContain('href={`#${routeHash("timeline", { view: "time" })}`}');
    expect(modal).toContain('data-testid="quicklog-reply-moments"');
    expect(modal).toContain('data-testid="quicklog-reply-done"');
    expect(modal).toContain('{t("elev.capture.reply.done")}');
  });

  it("intensity is named in words, never a bare number out of five", () => {
    expect(modal).not.toMatch(/\/\s*5\b/);
    expect(modal).toContain("aria-valuetext={t(INTENSITY_WORDS[newLogIntensity - 1] ?? INTENSITY_WORDS[2])}");
  });

  it("carries the honest privacy line and no white-on-accent class", () => {
    expect(modal).toContain('data-testid="quicklog-privacy"');
    expect(modal).toContain('t("companion.capture.privacy")');
    expect(modal).not.toMatch(/\btext-white\b/);
  });
});
