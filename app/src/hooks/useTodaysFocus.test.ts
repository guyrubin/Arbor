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

/**
 * N2-errfocus (2026-08-26): a failed /api/todays-focus fetch was swallowed
 * silently — the Today overview degraded to the guaranteed-action fallback
 * with no error signal and no way to retry. The hook now surfaces an `error`
 * flag + `regenerate`, and OverviewTab renders the shared ErrorState in the
 * day-anchor slot ALONGSIDE the fallback (never instead of it).
 */
describe("N2-errfocus — focus fetch failure surfaces an inline error + retry", () => {
  const hookSrc = read("hooks/useTodaysFocus.ts");
  const overviewSrc = read("components/tabs/OverviewTab.tsx");
  const i18nSrc = read("lib/i18n.ts");

  it("the hook exposes the error flag and the retry alongside the focus", () => {
    expect(hookSrc).toContain("return { focus, loading, error, regenerate: generate }");
  });

  it("a generation failure SETS the flag; a new attempt clears it first", () => {
    // catch → setError(true): the failure is no longer swallowed.
    expect(hookSrc).toMatch(/catch\s*\{\s*[\s\S]{0,120}setError\(true\)/);
    // generate() opens by clearing the flag, so retry → in-flight → clean.
    expect(hookSrc).toMatch(/setLoading\(true\);\s*setError\(false\);/);
  });

  it("a child/language switch drops the stale banner", () => {
    expect(hookSrc).toMatch(/triedAuto\.current = false;\s*setError\(false\);/);
  });

  it("OverviewTab renders ErrorState on failure — gated, not always-on", () => {
    expect(overviewSrc).toContain('import { ErrorState } from "../ui/ErrorState"');
    expect(overviewSrc).toMatch(/\{focusError && !focus && !activeTodayAction && \(\s*<ErrorState/);
  });

  it("the banner sits ALONGSIDE the guaranteed-action fallback, never instead of it", () => {
    // The chooseTodayAction anchor chain is intact: every fallback renderer is
    // still present, and ErrorState is NOT a branch of that ternary (the
    // ternary still closes into the plain PromptCaptureCard floor).
    for (const renderer of ["<TodayActionLoop", "<TodayRecommendation", "<PromptCaptureCard"]) {
      expect(overviewSrc).toContain(renderer);
    }
    // ErrorState renders AFTER the ternary's close — additive, not a branch.
    const ternaryFloor = overviewSrc.indexOf("<PromptCaptureCard");
    const banner = overviewSrc.indexOf("<ErrorState");
    expect(ternaryFloor).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(ternaryFloor);
  });

  it("retry refetches through the hook's regenerate", () => {
    expect(overviewSrc).toContain("regenerate: regenerateFocus");
    expect(overviewSrc).toContain("onRetry={() => void regenerateFocus()}");
  });

  it("copy rides err.* i18n keys present in BOTH language maps", () => {
    for (const key of ["err.focus.title", "err.focus.body", "err.retry"]) {
      expect(overviewSrc).toContain(`t("${key}")`);
      const hits = i18nSrc.split(`"${key}":`).length - 1;
      expect(hits).toBeGreaterThanOrEqual(2); // en + he
    }
  });
});
