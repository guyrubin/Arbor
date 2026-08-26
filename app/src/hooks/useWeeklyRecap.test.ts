import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  recapWeekId,
  shouldAutoGenerateRecap,
  isRecapUnopened,
  isReportLanguageStale,
  weekAnchorDate,
  weekStartKey,
  formatWeekLabel,
  resolveWeekLabel,
  topMomentDisplay,
  TRIGGER_QUOTE_MAX,
} from "./useWeeklyRecap";

/**
 * W2 2.1 — the hoisted weekly-recap generation logic (masterplan 2026-08-11
 * §4 item 2.1). Pure pieces only: week identity, the auto-generate decision
 * (new week vs same week vs day-0), and the "new recap waiting" gate that
 * drives the Since-strip entry line.
 */

describe("recapWeekId — stable week identity (WeeklyTab's historical algorithm)", () => {
  it("formats as YYYY-Wnn", () => {
    expect(recapWeekId(new Date(2026, 7, 11))).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("two days inside the same week share one id (same report doc → upsert last-write-wins)", () => {
    // Tue 11 Aug 2026 and Wed 12 Aug 2026 sit mid-week, far from a boundary.
    expect(recapWeekId(new Date(2026, 7, 11))).toBe(recapWeekId(new Date(2026, 7, 12)));
  });

  it("seven days later is ALWAYS a new week id (the auto-generate trigger)", () => {
    expect(recapWeekId(new Date(2026, 7, 18))).not.toBe(recapWeekId(new Date(2026, 7, 11)));
  });

  it("year boundary produces distinct, year-prefixed ids", () => {
    const dec = recapWeekId(new Date(2026, 11, 28));
    const jan = recapWeekId(new Date(2027, 0, 5));
    expect(dec.startsWith("2026-W")).toBe(true);
    expect(jan.startsWith("2027-W")).toBe(true);
    expect(dec).not.toBe(jan);
  });
});

describe("shouldAutoGenerateRecap — first open of a new week, with data", () => {
  const base = {
    loaded: true,
    hasCurrentWeek: false,
    weekMomentCount: 3,
    alreadyTried: false,
    generating: false,
  };

  it("NEW WEEK: no report yet + logged moments + first attempt → generate", () => {
    expect(shouldAutoGenerateRecap(base)).toBe(true);
  });

  it("SAME WEEK: the report already exists → never regenerate automatically", () => {
    expect(shouldAutoGenerateRecap({ ...base, hasCurrentWeek: true })).toBe(false);
  });

  it("DAY-0: an empty week has nothing truthful to summarize → no generation", () => {
    expect(shouldAutoGenerateRecap({ ...base, weekMomentCount: 0 })).toBe(false);
  });

  it("waits for the collection to load (a not-yet-loaded list is not an absent report)", () => {
    expect(shouldAutoGenerateRecap({ ...base, loaded: false })).toBe(false);
  });

  it("one auto attempt per session (the module guard feeds alreadyTried)", () => {
    expect(shouldAutoGenerateRecap({ ...base, alreadyTried: true })).toBe(false);
  });

  it("never double-fires while a generation is in flight", () => {
    expect(shouldAutoGenerateRecap({ ...base, generating: true })).toBe(false);
  });
});

/* ── P1 language defect (2026-08-12): the report is a persisted per-week
      document, so the language it was written in is part of its identity.
      Two regressions are pinned here: a stale-language narrative must
      regenerate (without forking the week id), and the week label must
      localize at RENDER time from the stored date anchor. ───────────────── */

describe("isReportLanguageStale — language is part of the record identity", () => {
  it("same language → not stale", () => {
    expect(isReportLanguageStale({ lang: "he" }, "he")).toBe(false);
    expect(isReportLanguageStale({ lang: "en" }, "en")).toBe(false);
  });

  it("a Hebrew session with an English report is stale (the reported defect)", () => {
    expect(isReportLanguageStale({ lang: "en" }, "he")).toBe(true);
  });

  it("…and the mirror case: an English session with a Hebrew report", () => {
    expect(isReportLanguageStale({ lang: "he" }, "en")).toBe(true);
  });

  it("a pre-fix report carries no language → unknowable, therefore stale", () => {
    expect(isReportLanguageStale({}, "en")).toBe(true);
  });

  it("no report at all is not 'stale' (nothing to rewrite)", () => {
    expect(isReportLanguageStale(null, "he")).toBe(false);
  });
});

describe("shouldAutoGenerateRecap — language-stale regeneration", () => {
  const base = {
    loaded: true,
    hasCurrentWeek: true,
    weekMomentCount: 3,
    alreadyTried: false,
    generating: false,
  };

  it("an existing report in the WRONG language regenerates in place", () => {
    expect(shouldAutoGenerateRecap({ ...base, languageStale: true })).toBe(true);
  });

  it("one attempt per child/week/language — a spent attempt never loops", () => {
    expect(shouldAutoGenerateRecap({ ...base, languageStale: true, alreadyTried: true })).toBe(false);
  });

  it("an empty week is still never fabricated, whatever the language", () => {
    expect(shouldAutoGenerateRecap({ ...base, languageStale: true, weekMomentCount: 0 })).toBe(false);
  });

  it("language-correct report + no language flag → unchanged behavior", () => {
    expect(shouldAutoGenerateRecap({ ...base, languageStale: false })).toBe(false);
  });
});

describe("week label — localized at RENDER time, never a frozen payload string", () => {
  it("formats in the ACTIVE app language, not the browser locale", () => {
    const en = formatWeekLabel(new Date(2026, 7, 12), "en", "Week of");
    expect(en).toBe("Week of August 12");
    const he = formatWeekLabel(new Date(2026, 7, 12), "he", "שבוע של");
    expect(he.startsWith("שבוע של ")).toBe(true);
    expect(he).toMatch(/[֐-׿]/); // the month name is Hebrew too
    expect(he).not.toMatch(/August/);
  });

  it("weekStartKey writes a local yyyy-mm-dd anchor", () => {
    expect(weekStartKey(new Date(2026, 7, 3))).toBe("2026-08-03");
  });

  it("anchor precedence: weekStart → digest.stats.weekOf → generatedAt", () => {
    expect(weekAnchorDate({ weekStart: "2026-08-03", generatedAt: "2026-08-11T06:00:00.000Z" })!.getDate()).toBe(3);
    expect(weekAnchorDate({ digest: { stats: { weekOf: "2026-08-03" } }, generatedAt: "2026-08-11T06:00:00.000Z" })!.getDate()).toBe(3);
    expect(weekAnchorDate({ generatedAt: "2026-08-11T06:00:00.000Z" })).not.toBeNull();
    expect(weekAnchorDate({})).toBeNull();
    expect(weekAnchorDate({ weekStart: "not-a-date" })).toBeNull();
  });

  it("BACK-COMPAT: a stored label is displayed only in its own language", () => {
    const stored = { weekLabel: "Week of August 11", lang: "en", weekStart: "2026-08-11" };
    expect(resolveWeekLabel(stored, { lang: "en", weekOf: "Week of" })).toBe("Week of August 11");
    // Hebrew session: the English label is re-derived, never shown as-is.
    const he = resolveWeekLabel(stored, { lang: "he", weekOf: "שבוע של" });
    expect(he).not.toContain("Week of August 11");
    expect(he.startsWith("שבוע של ")).toBe(true);
  });

  it("a pre-fix report (label, no language) re-derives rather than displaying", () => {
    const legacy = { weekLabel: "Week of August 11", weekStart: "2026-08-11" };
    expect(resolveWeekLabel(legacy, { lang: "he", weekOf: "שבוע של" })).not.toContain("August");
    expect(resolveWeekLabel(legacy, { lang: "en", weekOf: "Week of" })).toBe("Week of August 11");
  });

  it("no stored anchor at all → falls back to the supplied date", () => {
    expect(resolveWeekLabel(null, { lang: "en", weekOf: "Week of", fallbackDate: new Date(2026, 7, 12) }))
      .toBe("Week of August 12");
  });
});

describe("cold-load race — language comes from the render's own source", () => {
  // Comments discuss the race they fixed; the scan is about live code.
  const read = (rel: string) =>
    fs
      .readFileSync(path.resolve(__dirname, "..", rel), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("neither AI-text cache reads the module-level getAiLanguage()", () => {
    for (const rel of ["hooks/useWeeklyRecap.ts", "hooks/useTodaysFocus.ts"]) {
      expect(read(rel), `${rel} still reads getAiLanguage()`).not.toContain("getAiLanguage(");
    }
  });

  it("both read the LanguageContext value the render uses", () => {
    for (const rel of ["hooks/useWeeklyRecap.ts", "hooks/useTodaysFocus.ts"]) {
      expect(read(rel)).toContain("useLanguage(");
      expect(read(rel)).toMatch(/language:\s*aiLang/);
    }
  });

  it("the stored weekly report carries its generation language + date anchor", () => {
    const src = read("hooks/useWeeklyRecap.ts");
    expect(src).toMatch(/lang:\s*aiLang/);
    expect(src).toMatch(/weekStart:\s*weekStartKey\(\)/);
  });

  it("WeeklyTab localizes the label instead of printing the stored one", () => {
    const tab = read("components/tabs/WeeklyTab.tsx");
    expect(tab).toContain("labelFor(selected)");
    expect(tab).not.toContain("selected.weekLabel");
  });
});

/* ── F-11: parent free text never dresses up as an analytics headline.
      The snapshot separates the schema axis (behaviorType → label map) from
      the parent's free-typed trigger; the render model quotes + truncates the
      parent's words so they are VISIBLY parent words. ───────────────────── */

describe("topMomentDisplay — parent words stay visibly parent words", () => {
  it("separates the schema type (stat) from the free-typed trigger (quote)", () => {
    const top = topMomentDisplay({ topBehaviorType: "Sibling Conflict", topTrigger: "took the iPad away" });
    expect(top.type).toBe("Sibling Conflict");
    expect(top.quote).toBe("took the iPad away");
  });

  it("truncates a long free-typed trigger to ~40 chars with an ellipsis", () => {
    const raw = "hit his sister when I took the iPad away at dinner time again";
    const top = topMomentDisplay({ topTrigger: raw });
    expect(top.quote!.length).toBeLessThanOrEqual(TRIGGER_QUOTE_MAX + 1); // +1 = the ellipsis
    expect(top.quote!.endsWith("…")).toBe(true);
    expect(raw.startsWith(top.quote!.slice(0, -1))).toBe(true);
  });

  it("a short free-typed trigger passes through verbatim (still a quote, no type)", () => {
    expect(topMomentDisplay({ topTrigger: "loud noises" })).toEqual({ type: null, quote: "loud noises" });
  });

  it("LEGACY: a canonical behaviorType stored in topTrigger still renders as a type, never a quote", () => {
    // Old reports stored `trigger || behaviorType` conflated into topTrigger.
    expect(topMomentDisplay({ topTrigger: "Transition Refusal" })).toEqual({ type: "Transition Refusal", quote: null });
  });

  it("empty week ('—' or nothing stored) renders neither axis", () => {
    expect(topMomentDisplay({ topTrigger: "—" })).toEqual({ type: null, quote: null });
    expect(topMomentDisplay({})).toEqual({ type: null, quote: null });
    expect(topMomentDisplay(null)).toEqual({ type: null, quote: null });
  });

  it("SOURCE SCAN: the snapshot never conflates trigger and behaviorType again", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "useWeeklyRecap.ts"), "utf8");
    expect(src, "l.trigger || l.behaviorType is the F-11 defect — keep the two axes separate")
      .not.toMatch(/l\.trigger\s*\|\|\s*l\.behaviorType/);
  });
});

describe("isRecapUnopened — the Since-strip entry-line gate", () => {
  it("a fresh, never-opened weekly report reads as unopened", () => {
    expect(isRecapUnopened(true, "2026-W33", null)).toBe(true);
    expect(isRecapUnopened(true, "2026-W33", "2026-W32")).toBe(true);
  });

  it("opening this week's recap clears the line", () => {
    expect(isRecapUnopened(true, "2026-W33", "2026-W33")).toBe(false);
  });

  it("no report yet → nothing to announce", () => {
    expect(isRecapUnopened(false, "2026-W33", null)).toBe(false);
  });
});
