/**
 * TJB-22 · OBJ-BEH-04 — dates that followed the wrong locale, and a patterns
 * card that graded the child's week.
 *
 * TJB-22: the Behaviors row meta, its PDF export and the week headers rendered
 * bare `toLocaleString()` / `toLocaleDateString(undefined, …)`. Those follow
 * the BROWSER's locale, so a Hebrew app on an English machine printed
 * "9/7/2026, 4:15 PM" — ambiguous numeric order included — above Hebrew rows.
 *
 * OBJ-BEH-04: "Toughest place / day / time" reads as a verdict on the child's
 * week; the tiles count what the PARENT logged. "{count} moments noted"
 * printed "1 moments". And the place was the stored English enum, so the
 * headline read "…מתרכזים ב-home".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fmtDayShort, fmtDayTime } from "../../lib/formatDate";
import { en as loopEn, he as loopHe } from "../../lib/i18nElevation/closeloop";
import { contextLabel } from "./contextLabel";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
/** Comments cite the retired calls by name; scan the CODE. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const BEH = stripComments(read("components/tabs/BehaviorsTab.tsx"));
const PATTERNS = stripComments(read("components/behaviors/PatternInsights.tsx"));

const WHEN = new Date("2026-07-09T16:15:00Z");

describe("TJB-22 · dates follow the APP's language", () => {
  it("fmtDayTime names the month and differs by app language", () => {
    const enOut = fmtDayTime(WHEN, "en");
    const heOut = fmtDayTime(WHEN, "he");
    expect(enOut).toMatch(/Jul/);
    expect(enOut).toMatch(/2026/);
    expect(heOut).toMatch(/[֐-׿]/);
    expect(heOut).not.toBe(enOut);
    // Never a bare ambiguous numeric date (9/7 vs 7/9).
    expect(enOut).not.toMatch(/^\d+\/\d+\/\d+/);
  });

  it("fmtDayShort carries no year — a week header's year is its context", () => {
    expect(fmtDayShort(WHEN, "en")).toMatch(/Jul/);
    expect(fmtDayShort(WHEN, "en")).not.toMatch(/2026/);
  });

  it("both formatters return an empty string for missing or invalid input", () => {
    for (const bad of [null, undefined, "", "not a date"]) {
      expect(fmtDayTime(bad as never, "en")).toBe("");
      expect(fmtDayShort(bad as never, "he")).toBe("");
    }
  });

  it("NEGATIVE CONTROL: every browser-locale date call is gone from Behaviors", () => {
    expect(BEH).not.toContain("toLocaleString()");
    expect(BEH).not.toContain("toLocaleDateString(undefined");
    expect(BEH).not.toMatch(/toLocaleDateString\(uiLang === "he" \? "he-IL" : undefined/);
    // …and the four sites now run through the one seam.
    expect(BEH.match(/fmtDayTime\(/g)?.length).toBeGreaterThanOrEqual(3);
    expect(BEH).toMatch(/weekLabel\(weekKey, uiLang\)/);
    expect(BEH).toMatch(/fmtDayShort\(start, lang\)/);
  });
});

describe("OBJ-BEH-04 · the place, in the reader's language", () => {
  const t = (k: string) => loopHe[k] ?? k;

  it("localizes the four stored enum values, case-insensitively", () => {
    for (const value of ["Home", "School", "Transit", "Public", "home", "SCHOOL"]) {
      expect(contextLabel(value, t), value).toMatch(/[֐-׿]/);
    }
  });

  it("a legacy free-text place renders the parent's own word, bidi-isolated", () => {
    const out = contextLabel("Grandma's house", t);
    expect(out).toContain("Grandma's house");
    expect(out).not.toBe("elev.closeloop.ctx.home");
  });

  it("an absent context renders nothing at all", () => {
    expect(contextLabel(undefined, t)).toBe("");
    expect(contextLabel("  ", t)).toBe("");
  });

  it("both surfaces route the context through it", () => {
    expect(BEH).toMatch(/contextLabel\(log\.context, t\)/);
    expect(PATTERNS).toMatch(/contextLabel\(insights\.context\.label, t\)/);
    // NEGATIVE CONTROL: the raw enum renders.
    expect(PATTERNS).not.toContain("insights.context.label.toLowerCase()");
    expect(PATTERNS).not.toMatch(/value=\{insights\.context\.label\}/);
  });
});

describe("OBJ-BEH-04 · the patterns card counts, and can say 'one'", () => {
  it("the three tile labels say what they count, not who is toughest", () => {
    for (const k of ["place", "day", "time"]) {
      expect(loopEn[`elev.closeloop.pattern.${k}`]).toMatch(/^Most-logged /);
      expect(loopHe[`elev.closeloop.pattern.${k}`]).toMatch(/[֐-׿]/);
    }
    expect(PATTERNS).not.toMatch(/t\("beh\.pattern\.(place|day|time)"\)/);
  });

  it("the headline states what the parent logged, not where hard moments cluster", () => {
    expect(loopEn["elev.closeloop.pattern.headline"]).toContain("what you logged");
    expect(loopEn["elev.closeloop.pattern.headline"]).not.toMatch(/Hard moments cluster/);
    expect(PATTERNS).toMatch(/t\("elev\.closeloop\.pattern\.headline"/);
  });

  it("one and many are separate keys — '1 moments' cannot come back", () => {
    for (const dict of [loopEn, loopHe]) {
      expect(dict["elev.closeloop.pattern.noted.one"]).not.toContain("{count}");
      expect(dict["elev.closeloop.pattern.noted.many"]).toContain("{count}");
      expect(dict["elev.closeloop.pattern.resolvedSub.one"]).not.toContain("{count}");
      expect(dict["elev.closeloop.pattern.resolvedSub.many"]).toContain("{count}");
    }
    expect(loopEn["elev.closeloop.pattern.noted.one"]).toBe("1 moment noted");
    expect(PATTERNS).toMatch(/count === 1 \? "one" : "many"/);
    expect(PATTERNS).toMatch(/insights\.resolved === 1 \? "one" : "many"/);
  });

  it("NEGATIVE CONTROL: the shipped key really did pluralise unconditionally", () => {
    // Still in lib/i18n.ts (nothing renders it now) — the defect, on record.
    expect(PATTERNS).not.toMatch(/beh\.pattern\.(place|day|time)Sub/);
    expect(PATTERNS).not.toMatch(/t\("beh\.pattern\.resolvedSub"/);
  });

  it("every new key exists in EN and HE", () => {
    const keys = Object.keys(loopEn).filter((k) => k.startsWith("elev.closeloop.pattern.") || k.startsWith("elev.closeloop.ctx."));
    expect(keys.length).toBe(12);
    for (const k of keys) {
      expect(loopHe[k], `he missing ${k}`).toBeTruthy();
      expect(loopHe[k], `he ${k} is English`).toMatch(/[֐-׿]/);
    }
  });
});
