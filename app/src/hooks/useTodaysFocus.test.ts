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
    expect(src).toContain("`arbor.todaysFocus.${child.id}.${focusLang}`");
  });

  it("the stored record carries the generation language", () => {
    expect(src).toMatch(/lang:\s*focusLang/);
  });

  it("the request language comes from LanguageContext, not the module getter", () => {
    expect(src).toContain("useLanguage(");
    expect(src).toMatch(/language:\s*focusLang/);
    expect(src).not.toContain("getAiLanguage(");
  });

  it("cache-load and auto-generate both re-run on a language switch", () => {
    expect(src).toMatch(/\[child\.id, remote, uid, focusLang\]/);
    // B-TODAY-11: the newest capture/outcome is a dependency too (bounded refresh).
    expect(src).toMatch(/\[focus, signals\.count, signals\.latestAt, loading, focusLang\]/);
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
    expect(hookSrc).toContain("return { focus: liveFocus, loading, error, regenerate: generate }");
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

  // B-LOOP-07 re-pin: Today no longer renders the focus text; a failed focus
  // fetch leaves the pure practice chooser in charge (B-LOOP-09), so there is
  // nothing to banner. The hook keeps its error + regenerate contract above.
  it("Today renders no focus error banner: the pure chooser is the fallback", () => {
    expect(overviewSrc).not.toContain("<ErrorState");
    expect(overviewSrc).toContain("choosePractice({");
  });

  it("the practice renders whether or not the focus fetch succeeded (the AI pick only wins inside the candidates)", () => {
    expect(overviewSrc).toContain("const aiPracticeId = (focus as { practiceId?: string } | null)?.practiceId;");
    expect(overviewSrc).toContain("aiPracticeId,");
  });

  it("the hook still exposes regenerate for any surface that renders the focus", () => {
    expect(hookSrc).toContain("regenerate: generate");
  });

  it("copy rides err.* i18n keys present in BOTH language maps", () => {
    for (const key of ["err.focus.title", "err.focus.body", "err.retry"]) {
      const hits = i18nSrc.split(`"${key}":`).length - 1;
      expect(hits).toBeGreaterThanOrEqual(2); // en + he
    }
  });
});

/* ── B-TODAY-11: local day, bounded regeneration, non-incident families ──── */
describe("B-TODAY-11 — focus refresh", () => {
  it("the hook keys the day LOCALLY and sends it (01:00 local is today, not yesterday's UTC)", async () => {
    const { dayKey } = await import("../practice/signals");
    // 01:00 local on 2 Oct: the local key is the 2nd in EVERY timezone; the
    // old toISOString() slice gave the 1st for any zone east of UTC (Israel).
    expect(dayKey(new Date(2026, 9, 2, 1, 0))).toBe("2026-10-02");
    const src = fs.readFileSync(path.join(__dirname, "useTodaysFocus.ts"), "utf8");
    expect(src).toContain("const todayKey = () => dayKey(new Date());");
    expect(src).not.toMatch(/todayKey = \(\) => new Date\(\)\.toISOString\(\)/);
    expect(src).toContain("dateKey: todayKey(),");
  });

  it("stale-rule table: day/lang → generate; newer capture/outcome → ONE refresh per mount; nothing new → none", async () => {
    const { focusRefreshDecision } = await import("./useTodaysFocus");
    const day = "2026-10-02";
    const gen = "2026-10-02T06:00:00.000Z";
    const focus = { dateKey: day, lang: "he", generatedAt: gen };
    const after = Date.parse(gen) + 3_600_000;
    const before = Date.parse(gen) - 3_600_000;
    const rows: [string, Parameters<typeof focusRefreshDecision>[0], string][] = [
      ["no focus yet, data → generate", { focus: null, day, lang: "he", count: 2, refreshedThisMount: false }, "generate"],
      ["yesterday's focus → generate", { focus: { ...focus, dateKey: "2026-10-01" }, day, lang: "he", count: 2, refreshedThisMount: false }, "generate"],
      ["first capture after the focus → refresh", { focus, day, lang: "he", count: 3, latestAt: after, refreshedThisMount: false }, "refresh"],
      ["second capture in the same open → none (≤1 extra call)", { focus, day, lang: "he", count: 4, latestAt: after + 60_000, refreshedThisMount: true }, "none"],
      ["re-open, nothing new → none (0 calls)", { focus, day, lang: "he", count: 3, latestAt: before, refreshedThisMount: false }, "none"],
      ["no data at all → none", { focus: null, day, lang: "he", count: 0, refreshedThisMount: false }, "none"],
      ["3 play logs, 0 behaviour logs → generate (count includes plays)", { focus: null, day, lang: "en", count: 3, refreshedThisMount: false }, "generate"],
    ];
    for (const [label, input, want] of rows) expect(focusRefreshDecision(input), label).toBe(want);
  });

  it("Today's count = behaviourLogs + playLogs + milestones noticed in 7 days; latestAt rides the signals", () => {
    const overview = fs.readFileSync(path.join(__dirname, "..", "components", "tabs", "OverviewTab.tsx"), "utf8");
    expect(overview).toMatch(/behaviorLogs\.filter\(\(l\) => inWindow\(l\.timestamp\)\)\.length \+\s*playLogs\.filter\(\(p\) => inWindow\(p\.timestamp\)\)\.length \+\s*milestones\.filter\(\(m\) => m\.checked && inWindow\(m\.observationUpdatedAt\)\)\.length/);
    expect(overview).toContain("latestAt: latestRecordAt,");
    expect(overview).toContain("for (const a of actionLoop) consider(a.outcomeAt);");
  });
});
