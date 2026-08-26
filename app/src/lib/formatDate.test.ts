/**
 * F-09 — locale-driven date helpers (fmtDay / fmtDayLong / fmtMonthYear).
 *
 * The contract: every parent-surface date renders with an EXPLICIT month name
 * in the APP's language (uiLang), never the browser's ambiguous numeric
 * DD/MM vs MM/DD default. Hebrew output routes through i18n isolate() so a
 * Hebrew month name embedded in LTR text cannot reorder its surroundings.
 */
import { describe, expect, it } from "vitest";
import { fmtDay, fmtDayLong, fmtMonthYear } from "./formatDate";

const ISO = "2026-07-09T12:00:00Z";
const FSI = "⁨";
const PDI = "⁩";
const strip = (s: string) => s.replace(/[⁨⁩]/g, "");
/** An all-numeric date like 09/07/2026 or 9.7.26 — the ambiguity F-09 bans. */
const AMBIGUOUS_NUMERIC = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/;

describe("F-09 fmtDay — explicit month, app locale", () => {
  it("en renders an explicit short month name", () => {
    expect(fmtDay(ISO, "en")).toBe("Jul 9, 2026");
  });

  it("he renders a Hebrew month name, bidi-isolated", () => {
    const out = fmtDay(ISO, "he");
    expect(out.startsWith(FSI)).toBe(true);
    expect(out.endsWith(PDI)).toBe(true);
    expect(strip(out)).toBe("9 ביולי 2026");
  });

  it("never emits an ambiguous all-numeric date in either language", () => {
    for (const lang of ["en", "he"] as const) {
      expect(strip(fmtDay(ISO, lang))).not.toMatch(AMBIGUOUS_NUMERIC);
    }
  });

  it("accepts Date and epoch-ms inputs", () => {
    expect(fmtDay(new Date(ISO), "en")).toBe("Jul 9, 2026");
    expect(fmtDay(Date.parse(ISO), "en")).toBe("Jul 9, 2026");
  });

  it("returns empty string for missing/invalid input (never 'Invalid Date')", () => {
    expect(fmtDay(null, "en")).toBe("");
    expect(fmtDay(undefined, "he")).toBe("");
    expect(fmtDay("", "en")).toBe("");
    expect(fmtDay("not-a-date", "en")).toBe("");
  });
});

describe("F-09 fmtDayLong / fmtMonthYear", () => {
  it("fmtDayLong spells the month out", () => {
    expect(fmtDayLong(ISO, "en")).toBe("July 9, 2026");
    expect(strip(fmtDayLong(ISO, "he"))).toBe("9 ביולי 2026");
  });

  it("fmtMonthYear renders month + year only", () => {
    expect(fmtMonthYear(ISO, "en")).toBe("July 2026");
    expect(strip(fmtMonthYear(ISO, "he"))).toBe("יולי 2026");
  });

  it("english output carries no isolate marks (isolate is RTL-only)", () => {
    expect(fmtDay(ISO, "en")).not.toContain(FSI);
    expect(fmtDayLong(ISO, "en")).not.toContain(FSI);
    expect(fmtMonthYear(ISO, "en")).not.toContain(FSI);
  });
});
