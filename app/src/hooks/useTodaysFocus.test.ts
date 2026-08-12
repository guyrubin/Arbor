import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { isFocusStale } from "./useTodaysFocus";

/**
 * P1 language defect (2026-08-12), second instance: the AI focus sentence was
 * cached under `arbor.todaysFocus.<childId>` for 24h with NO language in the
 * cache identity, so a Hebrew sentence could render inside a fully English
 * Today (and vice versa). Language is now part of both the key and the record.
 */

// Comments name the getter they replaced; the scan is about live code.
const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, "..", rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("isFocusStale — day AND language are both cache identity", () => {
  const today = "2026-08-12";

  it("same day + same language is a real cache hit", () => {
    expect(isFocusStale({ dateKey: today, lang: "he" }, today, "he")).toBe(false);
  });

  it("a new day invalidates the cache (unchanged 24h behavior)", () => {
    expect(isFocusStale({ dateKey: "2026-08-11", lang: "he" }, today, "he")).toBe(true);
  });

  it("SAME day, other language → stale (the reported defect, both directions)", () => {
    expect(isFocusStale({ dateKey: today, lang: "en" }, today, "he")).toBe(true);
    expect(isFocusStale({ dateKey: today, lang: "he" }, today, "en")).toBe(true);
  });

  it("a pre-fix record carries no language → stale, regenerated once", () => {
    expect(isFocusStale({ dateKey: today }, today, "en")).toBe(true);
  });

  it("no cache at all is stale", () => {
    expect(isFocusStale(null, today, "en")).toBe(true);
  });
});

describe("useTodaysFocus source — language in the key, the record, and the request", () => {
  const src = read("hooks/useTodaysFocus.ts");

  it("the localStorage key is language-scoped", () => {
    expect(src).toContain("`arbor.todaysFocus.${child.id}.${aiLang}`");
  });

  it("the stored record carries the generation language", () => {
    expect(src).toMatch(/lang:\s*aiLang/);
  });

  it("the request language comes from LanguageContext, not the module getter", () => {
    expect(src).toContain("useLanguage(");
    expect(src).toMatch(/language:\s*aiLang/);
    expect(src).not.toContain("getAiLanguage(");
  });

  it("cache-load and auto-generate both re-run on a language switch", () => {
    expect(src).toMatch(/\[child\.id, remote, uid, aiLang\]/);
    expect(src).toMatch(/\[focus, signals\.count, loading, aiLang\]/);
  });

  it("the verdict-strip firewall payload is untouched (CODEX-2 condition)", () => {
    expect(src).not.toContain("signals.avg");
    expect(src).not.toContain("signals.milestonesPercent");
    expect(src).toContain("count: signals.count");
  });
});
