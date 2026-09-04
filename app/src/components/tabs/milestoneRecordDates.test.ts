/* GP-10 / GP-12 — the record keeps dates, says "first time", and is tappable.
 *
 *  GP-10 · `observationUpdatedAt` was written on every mark (ArborContext
 *          setMilestoneObservation) and rendered NOWHERE. A milestone without
 *          a date is a checkbox; with one it is a keepsake. The observe row
 *          also said "Yes", answering a question nobody asked, under a job
 *          sentence about noticing something for the first time.
 *  GP-12 · The observe buttons were `min-h-9` (36px) — the surface's primary
 *          move, on a 390px phone, where a mis-tap between "Not sure" and
 *          "Not yet" changes what monitoring counts as an answer
 *          (lib/monitoring.ts isMilestoneAnswered).
 *
 * The milestone rows live behind the Map's single-domain drill-in, which
 * static markup cannot open, so this follows the house pattern for this file
 * (milestonesPolish.test.ts): scan the shipped row source, and pin the runtime
 * strings it composes by calling the same helpers the component calls. Every
 * source assertion carries a NEGATIVE CONTROL showing the pre-change shape
 * would have failed it.
 */

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fmtDay } from "../../lib/formatDate";
import { tGCare } from "../../lib/growthCareText";

const SRC_ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => fs.readFileSync(path.join(SRC_ROOT, rel), "utf8");
const code = read("components/tabs/MilestonesTab.tsx");

/** The observe-row block and the chip block, isolated from the rest of the file. */
const observeRow = code.slice(code.indexOf('<div className="grid grid-cols-3'), code.indexOf("observeNotSureHint"));
const chipBlock = code.slice(code.indexOf('data-testid="ms-noticed-chip"') - 400, code.indexOf('data-testid="ms-noticed-chip"') + 700);

/** Exactly what shipped before this change. */
const BEFORE_ROW =
  '<div className="grid grid-cols-3 gap-1.5 pt-2" role="group" aria-label={t("ms.observePrompt")}>' +
  '{([["yes", t("ms.observe.yes")],["not_sure", t("ms.observe.notSure")],["not_yet", t("ms.observe.notYet")]]).map(([status, label]) => {' +
  'return <button className="min-h-9 rounded-lg px-1.5 text-[11px] font-bold">{label}</button>; })}</div>';
const BEFORE_CHIP =
  '{item.checked && <span className="text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded">{t("ms.observed")}</span>}';

describe("GP-12 — the marking control is 44px", () => {
  it("the observe buttons are min-h-11", () => {
    expect(observeRow).toContain("min-h-11");
    expect(observeRow).not.toContain("min-h-9");
  });

  it("NEGATIVE CONTROL: the pre-change row fails both assertions", () => {
    expect(BEFORE_ROW).toContain("min-h-9");
    expect(BEFORE_ROW).not.toContain("min-h-11");
  });

  it("the three-column grid is kept (the fix is height, not layout)", () => {
    expect(observeRow).toContain("grid-cols-3");
  });
});

describe("GP-10 — the row is about noticing for the first time", () => {
  it("the affirmative control and the group label come from the Wave G copy", () => {
    expect(observeRow).toContain('tGCare(uiLang, "elev.gcare.ms.observe.yes")');
    expect(observeRow).toContain('tGCare(uiLang, "elev.gcare.ms.observePrompt")');
    expect(observeRow).not.toContain('t("ms.observe.yes")');
    expect(observeRow).not.toContain('aria-label={t("ms.observePrompt")}');
    // The other two answers are unchanged — this is a relabel, not a rewrite.
    expect(observeRow).toContain('t("ms.observe.notSure")');
    expect(observeRow).toContain('t("ms.observe.notYet")');
  });

  it("NEGATIVE CONTROL: the pre-change row fails those assertions", () => {
    expect(BEFORE_ROW).toContain('t("ms.observe.yes")');
    expect(BEFORE_ROW).not.toContain("elev.gcare.ms.observe.yes");
  });

  it("the strings a parent actually reads, in both languages", () => {
    expect(tGCare("en", "elev.gcare.ms.observe.yes")).toBe("Seen it");
    expect(tGCare("en", "elev.gcare.ms.observePrompt")).toBe("Mark what you have seen for the first time");
    // EN and HE both present — no key falls back to itself.
    for (const key of ["elev.gcare.ms.observe.yes", "elev.gcare.ms.observePrompt", "elev.gcare.ms.noticedOn"]) {
      expect(tGCare("he", key)).not.toBe(key);
      expect(tGCare("he", key)).not.toBe(tGCare("en", key));
    }
  });
});

describe("GP-10 — the record keeps its dates", () => {
  it("the checked-row chip renders observationUpdatedAt through the ONE date seam", () => {
    expect(chipBlock).toContain("item.observationUpdatedAt");
    expect(chipBlock).toContain("fmtDay(item.observationUpdatedAt, uiLang)");
    expect(chipBlock).toContain('elev.gcare.ms.noticedOn');
    // An undated legacy mark is not given an invented day.
    expect(chipBlock).toContain('elev.gcare.ms.noticedUndated');
  });

  it("NEGATIVE CONTROL: the pre-change chip rendered a bare label and no date", () => {
    expect(BEFORE_CHIP).toContain('t("ms.observed")');
    expect(BEFORE_CHIP).not.toContain("observationUpdatedAt");
    expect(BEFORE_CHIP).not.toContain("fmtDay");
  });

  it("the composed string is a real, unambiguous date in both languages", () => {
    const at = "2026-08-14T10:00:00.000Z";
    expect(tGCare("en", "elev.gcare.ms.noticedOn", { date: fmtDay(at, "en") })).toBe("Noticed Aug 14, 2026");
    const he = tGCare("he", "elev.gcare.ms.noticedOn", { date: fmtDay(at, "he") });
    expect(he).toContain("2026");
    expect(he).not.toContain("{date}");
    // Never a bare numeric DD/MM — the F-09 seam always names the month.
    expect(fmtDay(at, "en")).not.toMatch(/^\d+\/\d+/);
  });

  it("an unparseable timestamp degrades to an empty date, never to 'Invalid Date'", () => {
    expect(fmtDay("not-a-date", "en")).toBe("");
    expect(tGCare("en", "elev.gcare.ms.noticedOn", { date: "" })).not.toContain("Invalid");
    expect(tGCare("en", "elev.gcare.ms.noticedUndated")).toBe("Noticed");
  });
});
