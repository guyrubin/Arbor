/**
 * Wave L · TJB-12 — the Journal writing prompt must reach the capture form.
 *
 * Tapping a promptBank chip in the Journal showed it as a writing cue, then
 * the Voice/Photo/Text tile switched to Behaviors and the question was gone:
 * the parent arrived at an empty "What happened?" with nothing to answer.
 *
 * The constraint that makes this delicate is the sanctioned W1 pattern (pinned
 * by tabs/journalPrompts.test.ts): the question is a CUE and must never be
 * injected into the draft body, so it cannot ride `requestCapture(mode)`.
 * These tests cover the one-slot channel it rides instead, and prove both ends
 * are wired with a negative control on the pre-change shape.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetCaptureCue,
  clearCaptureCue,
  getCaptureCue,
  setCaptureCue,
  subscribe,
} from "./captureCue";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8");
const strip = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("captureCue store", () => {
  beforeEach(() => __resetCaptureCue());

  it("starts empty, so an unrelated capture is never greeted by a stale question", () => {
    expect(getCaptureCue()).toBeNull();
  });

  it("carries exactly one prompt key and clears on demand", () => {
    setCaptureCue("elev.prompt.toddler.1");
    expect(getCaptureCue()).toBe("elev.prompt.toddler.1");
    setCaptureCue("elev.prompt.toddler.2");
    expect(getCaptureCue()).toBe("elev.prompt.toddler.2");
    clearCaptureCue();
    expect(getCaptureCue()).toBeNull();
  });

  it("notifies subscribers only when the value actually changes", () => {
    // The same subscribe path useSyncExternalStore binds to — a re-set of the
    // identical key must not churn the capture surface's render.
    let calls = 0;
    const unsub = subscribe(() => { calls += 1; });
    setCaptureCue("k");
    expect(calls).toBe(1);
    setCaptureCue("k");
    expect(calls).toBe(1);
    clearCaptureCue();
    expect(calls).toBe(2);
    unsub();
    setCaptureCue("k2");
    expect(calls).toBe(2);
  });

  it("arming with null is the same as clearing (an untapped prompt sends nothing)", () => {
    setCaptureCue(null);
    expect(getCaptureCue()).toBeNull();
  });
});

describe("TJB-12 — both ends of the handoff are wired", () => {
  const journal = strip(read("../components/tabs/JournalTab.tsx"));
  const behaviors = strip(read("../components/tabs/BehaviorsTab.tsx"));

  it("B-TODAY-19: the Journal's prompt now rides into the ONE sheet in place", () => {
    // The Journal no longer hands captures to Behaviors, so it no longer arms
    // this store: the tapped prompt goes to QuickLogModal as `promptKey`,
    // rendered as a visible cue and stored on the log.
    const startCapture = /const startCapture = \(mode: CaptureMode\) => \{[\s\S]*?\n  \};/.exec(journal)?.[0] ?? "";
    expect(startCapture).toBeTruthy();
    expect(startCapture).toContain("setQuickLogPromptKey(activePromptKey)");
    expect(startCapture).not.toContain("requestCapture(");
    const modal = strip(read("../components/overview/QuickLogModal.tsx"));
    expect(modal).toContain('data-testid="quicklog-prompt-cue"');
    expect(modal).not.toMatch(/setNewLog\w+\([^)]*promptKey/);
  });

  it("the shared sheet renders the cue and never merges it into the draft", () => {
    const modal = strip(read("../components/overview/QuickLogModal.tsx"));
    expect(modal).toContain('data-testid="quicklog-prompt-cue"');
    expect(modal).toContain("{t(promptKey)}");
    expect(modal).not.toMatch(/setNewLog\w+\([^)]*promptKey/);
    expect(behaviors).not.toMatch(/useCaptureCue|capture-prompt-cue|openFromBar/);
    // Negative control: the original handoff lost the selected cue entirely.
    expect('requestCapture(mode);').not.toContain("promptKey");
  });

  it("each opening snapshots the selected cue, and the saved record receives it as metadata only", () => {
    const start = /const startCapture = \(mode: CaptureMode\) => \{[\s\S]*?\n  \};/.exec(journal)?.[0] ?? "";
    expect(start).toContain("setQuickLogPromptKey(activePromptKey)");
    expect(journal).toContain("promptKey={quickLogPromptKey}");
    const modal = strip(read("../components/overview/QuickLogModal.tsx"));
    expect(modal).toContain("...(promptKey ? { promptKey } : {})");
    expect(modal).toContain("const words = newLogTrigger.trim()");
    expect(modal).not.toMatch(/const words =[^;]*promptKey/);
  });
});
