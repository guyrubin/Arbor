import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { isFocusStale, liveInputsUsed } from "./useTodaysFocus";

/**
 * OBJ-TODAY-02 — the Today hero speaks the language the parent is reading.
 *
 * Measured on 7 Sep at 390 EN, day-0: the hero rendered the HEBREW cached
 * focus inside the English UI, with the why-line "Chosen from recent moments,
 * age." at `momentCount 0`. Two seams, both closed here:
 *
 *  1. The cache identity was `aiLang`, but `document.documentElement.lang` is
 *     `uiLang`. A legacy `arbor.aiLang=he` (set before `setUiLang` began
 *     driving both — LanguageContext, the one language canon of OBJ-SHELL-02)
 *     therefore rendered a Hebrew paragraph in an English page and was a
 *     legitimate cache HIT, so nothing regenerated it.
 *  2. The cached `inputsUsed` outranked the live ledger.
 *
 * The hook itself needs React, and the vitest env is node-only, so the two
 * decisions are pure exports tested directly and the wiring is a source
 * assertion (the house pattern).
 */

const here = path.resolve(__dirname);
const src = readFileSync(path.join(here, "useTodaysFocus.ts"), "utf8");
const today = new Date().toISOString().slice(0, 10);

describe("OBJ-TODAY-02 — one language seam: the cache follows uiLang", () => {
  it("the hook reads uiLang, not aiLang", () => {
    expect(src).toMatch(/const\s*\{\s*uiLang\s*\}\s*=\s*useLanguage\(\)/);
    // No surviving read of aiLang anywhere in the hook body — a single
    // leftover in the key or the POST body reopens the divergence.
    expect(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))
      .not.toMatch(/\baiLang\b(?!\s*[;,}])/);
  });

  it("read, write and generate all use the SAME language, so no regeneration loop", () => {
    expect(src).toMatch(/arbor\.todaysFocus\.\$\{child\.id\}\.\$\{focusLang\}/);
    expect(src).toMatch(/language:\s*focusLang,/);
    expect(src).toMatch(/lang:\s*focusLang,/);
    expect(src).toMatch(/isFocusStale\(cached, todayKey\(\), focusLang\)/);
  });

  it("a `.he` record is stale in an English session and vice versa", () => {
    expect(isFocusStale({ dateKey: today, lang: "he" }, today, "en")).toBe(true);
    expect(isFocusStale({ dateKey: today, lang: "en" }, today, "he")).toBe(true);
    expect(isFocusStale({ dateKey: today, lang: "en" }, today, "en")).toBe(false);
  });

  it("negative control: the shipped key template keeps the divergence open", () => {
    const preFix = "const lsKey = `arbor.todaysFocus.${child.id}.${aiLang}`;";
    expect(/arbor\.todaysFocus\.\$\{child\.id\}\.\$\{focusLang\}/.test(preFix)).toBe(false);
    expect(/\baiLang\b/.test(preFix)).toBe(true);
  });
});

describe("OBJ-TODAY-02 — provenance is reconciled against the live count", () => {
  it("an empty live ledger drops the report entirely (day-0 wins)", () => {
    expect(liveInputsUsed({ momentCount: 4, topTrigger: "leaving" }, 0)).toBeUndefined();
  });

  it("a report cannot claim more moments than the ledger holds", () => {
    expect(liveInputsUsed({ momentCount: 9 }, 3)?.momentCount).toBe(3);
  });

  it("a smaller report survives — the model saw a window, not the whole ledger", () => {
    expect(liveInputsUsed({ momentCount: 2 }, 7)?.momentCount).toBe(2);
  });

  it("the non-count fields ride through untouched", () => {
    expect(liveInputsUsed({ momentCount: 2, topTrigger: "leaving", lastActionOutcome: "helped" }, 7))
      .toEqual({ momentCount: 2, topTrigger: "leaving", lastActionOutcome: "helped" });
  });

  it("no report and no live moments is still nothing to print", () => {
    expect(liveInputsUsed(undefined, 5)).toBeUndefined();
    expect(liveInputsUsed(undefined, 0)).toBeUndefined();
  });

  it("negative control: the pre-fix pass-through would have printed the stale count", () => {
    const preFix = (stored: { momentCount?: number } | undefined) => stored;
    expect(preFix({ momentCount: 4 })?.momentCount).toBe(4);
    expect(liveInputsUsed({ momentCount: 4 }, 0)).toBeUndefined();
  });

  it("the hook hands consumers the reconciled record, not the stored one", () => {
    expect(src).toMatch(/liveInputsUsed\(focus\.inputsUsed,\s*signals\.count\)/);
    expect(src).toMatch(/return \{ focus: liveFocus,/);
  });
});
