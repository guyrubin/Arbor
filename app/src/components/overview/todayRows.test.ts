import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { elevationEn as en, elevationHe as he } from "../../lib/i18nElevation";
import { fmtDay } from "../../lib/formatDate";

/**
 * TJB-08 / TJB-28 / TJB-29 / OBJ-TODAY-05 — four Today objects that were doing
 * something other than their job.
 *
 *   TJB-08      the mic tile ran `setActiveTab("behaviors")`: tapping "voice"
 *               on Today changed the route and executed the capture on a
 *               different hub.
 *   TJB-28      the receipt's second line was one static sentence, so "Not
 *               today" and "It helped" produced identical confirmations — the
 *               card asked a question and then ignored the answer.
 *   TJB-29      the hero art was a fixed stock WebP: the same picture of
 *               somebody else's child on every account, above a step written
 *               for this one.
 *   OBJ-TODAY-05 the activity feed stamped time only, so a May log read
 *               "Log a moment · 10:15 AM" in a feed that shows the whole
 *               ledger.
 *
 * Node-only vitest env, so these are source assertions in the house pattern
 * plus real dictionary checks. Each block carries its own negative control.
 */

const app = path.resolve(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(path.join(app, "src", rel), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("TJB-08 — voice captures on Today, not on Behaviors", () => {
  const overview = strip(read("components/tabs/OverviewTab.tsx"));
  const modal = strip(read("components/overview/QuickLogModal.tsx"));

  it("the voice branch opens the modal in place and never switches hub", () => {
    expect(overview).toMatch(/if \(mode === "voice"\) \{[\s\S]{0,120}setQuickLogOpen\(true\);[\s\S]{0,40}return;/);
    // The hub switch survives only on the branch that still needs it (photo).
    const fn = overview.slice(overview.indexOf("const startCapture"), overview.indexOf("const activeGoals"));
    expect((fn.match(/setActiveTab\("behaviors"\)/g) ?? []).length).toBe(1);
    expect(overview).toMatch(/<QuickLogModal open=\{quickLogOpen\} mode=\{quickLogMode\}/);
  });

  it("every other opener resets the mode, so text capture is unchanged", () => {
    const openers = overview.match(/setQuickLogOpen\(true\)/g) ?? [];
    const resets = overview.match(/setQuickLogMode\("text"\)/g) ?? [];
    // one opener is the voice branch itself, which sets mode "voice"
    expect(openers.length - resets.length).toBe(1);
    expect(overview).toMatch(/setQuickLogMode\("voice"\)/);
  });

  it("the modal reuses the existing dictation and extraction seams — no new capture path", () => {
    expect(modal).toMatch(/import \{ speechSupported, startDictation \} from "\.\.\/\.\.\/lib\/speech"/);
    // The transcript lands in the SAME field a typed sentence lands in, and
    // then takes the SAME extraction route into ConfirmCaptureReview.
    expect(modal).toMatch(/setNewLogTrigger\(said\)/);
    expect(modal).toMatch(/said\.length >= TYPED_EXTRACT_MIN_CHARS\) void extractFromTyped\(said\)/);
    expect(modal).toMatch(/<ConfirmCaptureReview/);
  });

  it("dictation runs in the parent's UI language and is stoppable", () => {
    expect(modal).toMatch(/uiLang === "he" \? "he-IL" : "en-US"/);
    expect(modal).toMatch(/speechSupported\(\)/);
    expect(modal).toMatch(/stopRef\.current\?\.\(\)/);
    // Closing the modal stops the microphone.
    expect(modal).toMatch(/if \(!open\) \{[\s\S]{0,260}stopRef\.current\?\.\(\)/);
  });

  it("the Stop control is keyed in both locales and clears the touch floor", () => {
    expect(en["elev.ql.voice.stop"]).toBeTruthy();
    expect(he["elev.ql.voice.stop"]).toBeTruthy();
    expect(he["elev.ql.voice.stop"]).not.toBe(en["elev.ql.voice.stop"]);
    expect(modal).toMatch(/className="touch-target px-2 text-xs font-bold"/);
  });

  it("negative control: the shipped handler switched hub for every mode", () => {
    const shipped = `const startCapture = (mode: CaptureMode) => {\n    requestCapture(mode);\n    setActiveTab("behaviors");\n  };`;
    expect(/if \(mode === "voice"\)/.test(shipped)).toBe(false);
    expect(shipped).toContain('setActiveTab("behaviors")');
  });
});

describe("TJB-28 — the receipt reads back what the parent said", () => {
  const loop = strip(read("components/overview/TodayActionLoop.tsx"));

  it("line 2 is chosen by the recorded outcome, with the old line as fallback", () => {
    expect(loop).toMatch(/const recorded = activeTodayAction\.outcome;/);
    expect(loop).toMatch(/recorded \? t\(OUTCOME_KEY\[recorded\]\) : copy\.adapt/);
    expect(loop).toMatch(/data-testid="today-receipt-outcome"/);
    expect(loop).not.toMatch(/>\{copy\.adapt\}</);
  });

  it("all three outcomes have distinct copy in both locales", () => {
    const keys = ["elev.today.receipt.helped", "elev.today.receipt.somewhat", "elev.today.receipt.notToday"];
    for (const k of keys) {
      expect(en[k], `en missing ${k}`).toBeTruthy();
      expect(he[k], `he missing ${k}`).toBeTruthy();
      expect(he[k]).toMatch(/[֐-׿]/);
    }
    expect(new Set(keys.map((k) => en[k])).size).toBe(3);
    expect(new Set(keys.map((k) => he[k])).size).toBe(3);
  });

  it("the copy states no verdict about the child and no pressure to return", () => {
    for (const k of ["elev.today.receipt.helped", "elev.today.receipt.somewhat", "elev.today.receipt.notToday"]) {
      expect(en[k]).not.toMatch(/tomorrow|streak|progress|score|%/i);
      expect(he[k]).not.toMatch(/מחר|רצף/);
    }
  });

  it("negative control: the shipped static line ignored the outcome", () => {
    const shipped = `<p className="mt-0.5 text-[11px] leading-relaxed">{copy.adapt}</p>`;
    expect(shipped).toContain("{copy.adapt}");
    expect(/OUTCOME_KEY/.test(shipped)).toBe(false);
  });
});

describe("OBJ-TODAY-05 — a feed row older than today carries its date", () => {
  const overview = strip(read("components/tabs/OverviewTab.tsx"));

  it("the feed stamps through the one date seam, on the LOCAL day boundary", () => {
    expect(overview).toMatch(/import \{ fmtDay \} from "\.\.\/\.\.\/lib\/formatDate"/);
    expect(overview).toMatch(/isSameLocalDay\(d, new Date\(\)\) \? time : `\$\{fmtDay\(d, uiLang\)\} · \$\{time\}`/);
    expect(overview).toMatch(/time: fmtWhen\(at\)/);
    expect(overview).not.toMatch(/time: fmtTime\(at\)/);
    // Local, not UTC — the rule OBJ-TODAY-03 pinned for the action id.
    expect(overview).toMatch(/getFullYear\(\) === b\.getFullYear\(\)[\s\S]{0,120}getDate\(\) === b\.getDate\(\)/);
  });

  it("the seam really produces an explicit month name in both locales", () => {
    const may = new Date(2026, 4, 23, 10, 15);
    expect(fmtDay(may, "en")).toMatch(/May/);
    expect(fmtDay(may, "he")).toMatch(/[֐-׿]/);
    // Never the ambiguous numeric form the audit found ("23/05/2026").
    expect(fmtDay(may, "en")).not.toMatch(/^\d+\/\d+\/\d+$/);
  });

  it("negative control: the shipped time-only formatter carries no date", () => {
    const shipped = `new Date(ms).toLocaleTimeString(uiLang === "he" ? "he-IL" : "en-US", { hour: "numeric", minute: "2-digit" })`;
    expect(/fmtDay/.test(shipped)).toBe(false);
  });
});
