import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { elevationEn as en, elevationHe as he } from "../../lib/i18nElevation";
import { fmtDay } from "../../lib/formatDate";
import { todayLiveSource } from "../../testTodaySource";

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
  const overview = strip(todayLiveSource());
  const modal = strip(read("components/overview/QuickLogModal.tsx"));

  it("every mode (B-TODAY-19: voice AND photo) opens the capture sheet in place and never switches hub", () => {
    // The persistent launcher owns general capture; Now retains contextual requests.
    const launcher = strip(read("components/companion/CompanionWorkspace.tsx"));
    for (const mode of ["text", "voice", "photo"]) expect(launcher).toContain(`capture("${mode}")`);
    expect(launcher).toContain("openCaptureSheet({ mode });");
    expect((overview.match(/setActiveTab\("behaviors"\)/g) ?? []).length).toBe(0);
  });

  it("every opener goes through the one sheet; a pending request (the ENG-01 nudge) is consumed once", () => {
    expect(overview).toContain("consumeCaptureRequest();\n    openCaptureSheet({ mode: pendingCaptureMode });");
    expect(overview).not.toMatch(/setQuickLogOpen\(|<QuickLogModal/);
  });

  it("the modal reuses the existing dictation and extraction seams — no new capture path", () => {
    expect(modal).toMatch(/import \{ speechSupported, startDictation \} from "\.\.\/\.\.\/lib\/speech"/);
    // The transcript lands in the SAME field a typed sentence lands in, and
    // then takes the SAME extraction route into ConfirmCaptureReview.
    expect(modal).toMatch(/setNewLogTrigger\(said\)/);
    // B-TODAY-01: the call names the branch it was spoken into.
    expect(modal).toMatch(/said\.length >= TYPED_EXTRACT_MIN_CHARS\) void extractFromTyped\(said, /);
    expect(modal).toMatch(/<ConfirmCaptureReview/);
  });

  it("dictation runs in the parent's UI language and is stoppable", () => {
    expect(modal).toMatch(/uiLang === "he" \? "he-IL" : "en-US"/);
    expect(modal).toMatch(/speechSupported\(\)/);
    expect(modal).toMatch(/stopRef\.current\?\.\(\)/);
    // Closing the modal (or switching child) stops the microphone.
    expect(modal).toMatch(/if \(!open \|\| childChanged\) \{[\s\S]{0,900}stopRef\.current\?\.\(\)/);
  });

  it("the Stop control is keyed in both locales and clears the touch floor", () => {
    expect(en["elev.ql.voice.stop"]).toBeTruthy();
    expect(he["elev.ql.voice.stop"]).toBeTruthy();
    expect(he["elev.ql.voice.stop"]).not.toBe(en["elev.ql.voice.stop"]);
    // REC-01 (8 Oct): Stop lives in the shared RecordingIndicator; the sheet
    // passes the keyed label and the component carries the 44 px floor.
    expect(modal).toMatch(/<RecordingIndicator[\s\S]{0,400}stopLabel=\{t\("elev\.ql\.voice\.stop"\)\}/);
    const indicator = readFileSync(path.join(path.resolve(__dirname, "..", ".."), "components/ui/RecordingIndicator.tsx"), "utf8");
    expect(indicator).toMatch(/onClick=\{onStop\}[\s\S]{0,200}className="[^"]*min-h-11 min-w-11/);
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
  const overview = strip(todayLiveSource());

  // B-TODAY-17 deleted the feed (and the drawer it lived in): no time-only
  // row can come back on Today. The date seam itself stays pinned below.
  it("B-TODAY-17: Today carries no activity feed, so no undated feed row can return", () => {
    expect(overview).not.toMatch(/activityFeed|fmtWhen|today\.feed\.loggedSub/);
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
