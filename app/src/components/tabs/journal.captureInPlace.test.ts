/**
 * TJB-08 (Journal half) — capture executed on another hub.
 *
 * The Journal's compose card offers three modality tiles. All three ran
 * `setActiveTab("behaviors")`: a parent who tapped "Text" to write down a
 * moment was moved to a different hub, losing the feed they were reading and
 * changing the route under them. The Journal's own promise — "catch the moment
 * before it's gone" — was the one thing it could not do in place.
 *
 * The text tile now opens `QuickLogModal`, the EXISTING text-capture surface
 * (Today mounts it the same way), which portals to `document.body`. No second
 * capture path, no route change.
 *
 * Voice and photo still hand off: their affordances (the dictation seam, the
 * file input) live on the Behaviors capture form and QuickLogModal takes no
 * mode. That cross-file edit is in FOLLOW-UPS — this guard pins what landed.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
const MODAL = stripComments(read("components/overview/QuickLogModal.tsx"));

/** The body of `startCapture`, where the tile decides what to do. */
const startCapture = (() => {
  const at = JOURNAL.indexOf("const startCapture = (mode: CaptureMode) => {");
  expect(at, "startCapture not found").toBeGreaterThan(-1);
  return JOURNAL.slice(at, JOURNAL.indexOf("\n  };", at));
})();

describe("TJB-08 · the text tile captures on the Journal", () => {
  it("text opens the modal and returns before any hub switch", () => {
    expect(startCapture).toMatch(/if \(mode === "text"\) \{\s*setQuickLogOpen\(true\);\s*return;\s*\}/);
    // The early return is what keeps setActiveTab out of the text path.
    const textBranch = startCapture.slice(0, startCapture.indexOf("}", startCapture.indexOf('mode === "text"')));
    expect(textBranch).not.toContain("setActiveTab");
    expect(textBranch).not.toContain("requestCapture");
  });

  it("the Journal mounts QuickLogModal — no second capture path", () => {
    expect(JOURNAL).toContain('import QuickLogModal from "../overview/QuickLogModal";');
    expect(JOURNAL).toMatch(/<QuickLogModal open=\{quickLogOpen\} onClose=\{\(\) => setQuickLogOpen\(false\)\} \/>/);
    // It is the SAME component, not a fork: the Journal declares no fields,
    // no handleAddLog call, no validation of its own.
    expect(JOURNAL).not.toContain("handleAddLog");
    expect(JOURNAL).not.toContain("validateLogDraft");
  });

  it("QuickLogModal portals to the document body, so the route is untouched", () => {
    // It renders through ui/Modal, whose createPortal target is document.body.
    expect(MODAL).toContain('import { Modal } from "../ui/Modal";');
    expect(stripComments(read("components/ui/Modal.tsx"))).toContain("document.body");
    // Nothing in the text path writes location.hash.
    expect(startCapture).not.toContain("location");
    expect(startCapture).not.toContain("hash");
  });

  it("NEGATIVE CONTROL: the pre-fix handler switched hubs for every mode", () => {
    const prefix = [
      "const startCapture = (mode: CaptureMode) => {",
      "  setCaptureCue(activePromptKey);",
      "  requestCapture(mode);",
      '  setActiveTab("behaviors");',
      "};",
    ].join("\n");
    expect(prefix).not.toMatch(/mode === "text"/);
    // Every mode reached setActiveTab; now the text one cannot.
    expect(prefix.split("setActiveTab").length - 1).toBe(1);
    expect(JOURNAL).not.toContain(prefix);
  });

  it("voice and photo keep the existing handoff — no capability lost (law 6)", () => {
    expect(startCapture).toContain("requestCapture(mode)");
    expect(startCapture).toContain('setActiveTab("behaviors")');
    expect(startCapture).toContain("setCaptureCue(activePromptKey)");
  });
});
