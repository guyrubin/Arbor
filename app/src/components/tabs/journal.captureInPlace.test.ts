/**
 * TJB-08 + B-TODAY-19 — one capture sheet: photo in place, every door in place.
 *
 * Today's capture bar and the Journal's compose tiles offer text, voice and
 * photo. Voice and photo used to hand the capture to Behaviors
 * (`requestCapture(mode)` + `setActiveTab("behaviors")`): the route changed
 * under the parent and the photo was taken on a different hub, because
 * `addMoment` wrote no `photoAttachment`.
 *
 * Now every tile on both surfaces opens `QuickLogModal` — the ONE sheet,
 * portalled to `document.body` — in the tapped mode. The photo is the same
 * in-doc thumbnail the Behaviors form stores, and the answered prompt's key is
 * stored on the log (never the question text in the draft).
 *
 * Source-based where the env is node-only; `buildMomentLog` is the pure record
 * `addMoment` writes and is unit-tested directly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMomentLog, MOMENT_BEHAVIOR_TYPE } from "../../content/behaviorTaxonomy";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
const TODAY = stripComments(read("components/tabs/OverviewTab.tsx"));
const MODAL = stripComments(read("components/overview/QuickLogModal.tsx"));
const CONTEXT = stripComments(read("context/ArborContext.tsx"));

/** The body of a surface's `startCapture`. */
const startCaptureOf = (src: string) => {
  const at = src.indexOf("const startCapture = (mode: CaptureMode");
  expect(at, "startCapture not found").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("\n  };", at));
};

describe("B-TODAY-19 · every capture tile opens the one sheet in place", () => {
  for (const [name, src] of [["Journal", JOURNAL], ["Today", TODAY]] as const) {
    const body = startCaptureOf(src);
    it(`${name}: startCapture never switches hubs or hands off`, () => {
      expect(body).not.toContain('setActiveTab("behaviors")');
      expect(body).not.toContain("requestCapture(");
      expect(body).toContain("setQuickLogMode(mode)");
      expect(body).toContain("setQuickLogOpen(true)");
    });
    it(`${name}: the sheet receives the mode and the prompt key`, () => {
      expect(src).toMatch(/<QuickLogModal open=\{quickLogOpen\} mode=\{quickLogMode\} promptKey=\{quickLogPromptKey\}/);
      expect(src).toContain('import QuickLogModal from "../overview/QuickLogModal";');
      expect(src).not.toContain("handleAddLog");
    });
  }

  it("0 setActiveTab(\"behaviors\") in Today; the Journal keeps only the row editor's hop", () => {
    expect(TODAY).not.toContain('setActiveTab("behaviors")');
    // editOpenSignal hands an existing log to the one editor — not a capture door.
    expect(JOURNAL.split('setActiveTab("behaviors")').length - 1).toBe(1);
    expect(JOURNAL).toMatch(/startEditLog\(logId\);\s*setOpenSignal\(null\);\s*setActiveTab\("behaviors"\)/);
  });

  it("Today's prompt card passes its promptKey into the sheet", () => {
    expect(TODAY).toMatch(/startCapture\("text", todayChoice\.kind === "prompt" \? todayChoice\.promptKey : null\)/);
  });

  it("the Journal's tapped writing prompt rides in as the sheet's cue", () => {
    expect(startCaptureOf(JOURNAL)).toContain("setQuickLogPromptKey(activePromptKey)");
    expect(JOURNAL).not.toContain("setCaptureCue");
  });
});

describe("B-TODAY-19 · QuickLogModal photo mode", () => {
  it("reuses the Behaviors photo seam (fileToThumbnail, accept image/*), in-doc only", () => {
    expect(MODAL).toContain('import { fileToThumbnail } from "../../lib/image";');
    expect(MODAL).toMatch(/type="file"\s+accept="image\/\*"/);
    expect(MODAL).not.toContain("uploadChildPhoto");
  });

  it("photo mode opens the picker and shows a preview with a 44 px remove control", () => {
    expect(MODAL).toMatch(/mode !== "photo"\) return;\s*const timer = window\.setTimeout\(\(\) => photoInputRef\.current\?\.click\(\), 120\)/);
    expect(MODAL).toContain('data-testid="quicklog-photo-remove"');
    const remove = MODAL.slice(MODAL.lastIndexOf("<button", MODAL.indexOf('data-testid="quicklog-photo-remove"')), MODAL.indexOf("</button>", MODAL.indexOf('data-testid="quicklog-photo-remove"')));
    expect(remove).toContain("min-h-11");
    expect(MODAL).toMatch(/<img src=\{photo\} alt=\{t\("elev\.capture\.photo\.alt"\)\}/);
  });

  it("the save writes the photo and the prompt key through addMoment", () => {
    expect(MODAL).toMatch(/addMoment\(words, \{\s*\.\.\.\(photo \? \{ photoAttachment: photo \} : \{\}\),\s*\.\.\.\(promptKey \? \{ promptKey \} : \{\}\),\s*\}\)/);
    expect(MODAL).toContain('trackCaptureStarted(mode === "voice" ? "voice" : mode === "photo" ? "photo" : "text")');
  });

  it("the prompt is a visible cue, never draft text", () => {
    expect(MODAL).toContain('data-testid="quicklog-prompt-cue"');
    expect(MODAL).not.toMatch(/setNewLog\w+\([^)]*promptKey/);
  });

  it("HE labels for the photo mode", () => {
    for (const key of ["elev.capture.photo.label", "elev.capture.photo.caption", "elev.capture.photo.alt", "elev.capture.photo.remove", "beh.addPhoto"]) {
      const en = translate("en", key);
      const he = translate("he", key);
      expect(en, key).not.toBe(key);
      expect(he, key).not.toBe(key);
      expect(he, key).not.toBe(en);
      expect(/[֐-׿]/.test(he), key).toBe(true);
    }
  });
});

describe("B-TODAY-19 · addMoment stores the photo (unit)", () => {
  const now = new Date("2026-10-02T08:00:00Z");

  it("a photo moment saves with its image and the prompt key", () => {
    const log = buildMomentLog("Built a tower", "Home", { photoAttachment: "data:image/jpeg;base64,AAA", promptKey: "elev.prompt.toddler.1" }, now);
    expect(log).toMatchObject({
      behaviorType: MOMENT_BEHAVIOR_TYPE,
      trigger: "Built a tower",
      intensity: 1,
      resolved: true,
      photoAttachment: "data:image/jpeg;base64,AAA",
      promptKey: "elev.prompt.toddler.1",
      timestamp: now.toISOString(),
    });
  });

  it("a plain moment carries no photo or prompt keys at all (never undefined)", () => {
    const log = buildMomentLog("She said butterfly", "Home", {}, now)!;
    expect("photoAttachment" in log).toBe(false);
    expect("promptKey" in log).toBe(false);
  });

  it("no words → no row (the sheet supplies a caption for a photo-only moment)", () => {
    expect(buildMomentLog("   ", "Home", { photoAttachment: "x" }, now)).toBeNull();
    expect(MODAL).toContain('newLogTrigger.trim() || (photo ? t("elev.capture.photo.caption") : "")');
  });

  it("ArborContext.addMoment writes the builder's record (one path)", () => {
    expect(CONTEXT).toMatch(/const addMoment = \(\s*text: string,\s*opts: \{ photoAttachment\?: string; promptKey\?: string \} = \{\},/);
    expect(CONTEXT).toContain("buildMomentLog(text, newLogContext, opts)");
  });

  it("the Journal row reads the stored photo (signalTimeline maps photoAttachment)", () => {
    expect(read("lib/signalTimeline.ts")).toContain("photo: log.photoAttachment");
    expect(JOURNAL).toContain("signal.photo &&");
  });
});

describe("negative control — the pre-fix handler fails the guard", () => {
  it("the old hand-off shape is recognised", () => {
    const prefix = [
      "const startCapture = (mode: CaptureMode) => {",
      '    if (mode === "text") { setQuickLogOpen(true); return; }',
      "    requestCapture(mode);",
      '    setActiveTab("behaviors");',
      "  };",
    ].join("\n");
    const body = startCaptureOf(prefix);
    expect(body).toContain('setActiveTab("behaviors")');
    expect(body).toContain("requestCapture(");
    expect(body).not.toContain("setQuickLogMode(mode)");
  });
});
