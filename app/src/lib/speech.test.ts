import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startDictation } from "./speech";

/**
 * AI-CAP-2 — Hebrew voice capture end-to-end. startDictation always accepted a
 * `lang`, but callers omitted it, so a Hebrew-speaking parent's dictation was
 * transcribed as en-US garbage before any AI saw it. These tests pin the
 * recognizer language contract with a stub SpeechRecognition constructor.
 */

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  maxAlternatives = 0;
  continuous = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  stopped = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

const hadWindow = "window" in globalThis;
const priorWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  FakeRecognition.instances = [];
  (globalThis as { window?: unknown }).window = { SpeechRecognition: FakeRecognition };
});

afterEach(() => {
  if (hadWindow) (globalThis as { window?: unknown }).window = priorWindow;
  else delete (globalThis as { window?: unknown }).window;
});

const handlers = { onResult: () => {}, onError: () => {}, onEnd: () => {} };

describe("AI-CAP-2 — startDictation recognition language", () => {
  it("sets rec.lang='he-IL' when passed (the Hebrew caller contract)", () => {
    startDictation(handlers, "he-IL");
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(FakeRecognition.instances[0].lang).toBe("he-IL");
    expect(FakeRecognition.instances[0].started).toBe(true);
  });

  it("defaults to en-US when no lang is passed", () => {
    startDictation(handlers);
    expect(FakeRecognition.instances[0].lang).toBe("en-US");
  });

  it("returned stop() stops the recognizer", () => {
    const stop = startDictation(handlers, "en-US");
    stop();
    expect(FakeRecognition.instances[0].stopped).toBe(true);
  });
});

describe("AI-CAP-2 — both dictation call sites thread the parent's language (structural)", () => {
  it("BehaviorsTab passes uiLang-derived he-IL/en-US into startDictation", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const code = fs.readFileSync(
      path.resolve(__dirname, "..", "components", "tabs", "BehaviorsTab.tsx"),
      "utf8",
    );
    // AI-CAP-6 loosened the tail: an opts object (continuous dictation) may
    // follow the lang argument — the guard pins only the language selection.
    expect(code).toMatch(/startDictation\(\s*\{[\s\S]*?\},\s*(?:\/\/[^\n]*\n\s*)*uiLang === "he" \? "he-IL" : "en-US",/);
  });

  it("CoachTab's dictation loop derives he-IL/en-US from aiLang", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const code = fs.readFileSync(
      path.resolve(__dirname, "..", "components", "tabs", "CoachTab.tsx"),
      "utf8",
    );
    expect(code).toMatch(/lang: aiLang === "he" \? "he-IL" : "en-US"/);
  });
});
