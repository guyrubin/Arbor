/**
 * B-ASKJB-38 guard — hard-moment cards by age.
 *  · no card has an empty band list (no blanket default left);
 *  · a 22-month child sees only toddler cards, a 5-year-old only 2–5 cards
 *    (+ overlaps), a 7-year-old only cards that fit 6–8;
 *  · every card has Do / Say / Avoid / escalation EN + HE and an https source;
 *  · the two new sets are drafts behind the editorial pilot (no reviewer
 *    stamp; withdrawal still closes them; expiry still closes them);
 *  · the sheet no longer prints an age band (the only age a parent reads is
 *    the child's own); it reads the band months from lib/age.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hardMomentCards, hardMomentCatalogue, CHILD_NAME_TOKEN } from "./hardMomentCards";
import { toddlerHardMomentCards } from "./hardMomentCardsToddler";
import { schoolHardMomentCards } from "./hardMomentCardsSchool";
import { availableHardMomentCards } from "./selectCards";
import { HARD_MOMENT_PILOT, computePilotDigest, hardMomentPublication } from "./pilotRelease";
import { CONTENT_CONCERNS } from "./governance";
import { bandForMonths, fits } from "../lib/age/forChild";

const NOW = new Date("2026-10-06T12:00:00.000Z");
const shown = (ageMonths: number, locale: "en" | "he" = "en") => availableHardMomentCards({ now: NOW, ageMonths, locale });
const toddlerIds = new Set(toddlerHardMomentCards.map((c) => c.id));
const schoolIds = new Set(schoolHardMomentCards.map((c) => c.id));

describe("B-ASKJB-38 · bands", () => {
  it("the catalogue is the 25 + ten toddler + ten school-age cards, ids unique", () => {
    expect(hardMomentCards).toHaveLength(25);
    expect(toddlerHardMomentCards).toHaveLength(10);
    expect(schoolHardMomentCards).toHaveLength(10);
    expect(new Set(hardMomentCatalogue.map((c) => c.id)).size).toBe(45);
  });

  it("no card has an empty band list, and the factory has no blanket default", () => {
    for (const c of hardMomentCatalogue) expect(c.ageBands.length, c.id).toBeGreaterThan(0);
    const src = readFileSync(path.join(__dirname, "hardMomentCards.ts"), "utf8");
    expect(src).not.toMatch(/ageBands \?\? \[/);
    expect(src.match(/^  card\("/gm)?.length).toBe(25);
    // every one of the 25 names its own bands
    expect(src.split("\n  card(").slice(1).every((part) => /ageBands: \[/.test(part))).toBe(true);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: pre-review R18 — the screen handover card starts at 18 months (12 m: no; 18 m and 35 m: yes; 36 m: no)`, () => {
      expect(fits(["18-24m", "2-3y"], bandForMonths(12))).toBe(false);
      expect(shown(12, locale).map((c) => c.id)).not.toContain("t-screen-handover");
      expect(shown(18, locale).map((c) => c.id)).toContain("t-screen-handover");
      expect(shown(35, locale).map((c) => c.id)).toContain("t-screen-handover");
      expect(shown(36, locale).map((c) => c.id)).not.toContain("t-screen-handover");
    });
    it(`${locale}: a 22-month child sees only toddler cards — and all ten of them`, () => {
      const ids = shown(22, locale).map((c) => c.id);
      expect(ids.length).toBe(10);
      for (const id of ids) expect(toddlerIds.has(id), id).toBe(true);
    });
    it(`${locale}: a 5-year-old (62 m) sees only 2–5 cards (+ overlaps), no toddler or school-age set`, () => {
      const cards = shown(62, locale);
      expect(cards.length).toBeGreaterThan(0);
      for (const c of cards) {
        expect(toddlerIds.has(c.id) || schoolIds.has(c.id), c.id).toBe(false);
        expect(fits(c, bandForMonths(62)), c.id).toBe(true);
      }
    });
    it(`${locale}: a 7-year-old sees only cards that fit 6–8 — the school-age set leads`, () => {
      const cards = shown(84, locale);
      for (const c of cards) expect(fits(c, "6-8y"), c.id).toBe(true);
      for (const id of schoolIds) expect(cards.some((c) => c.id === id), id).toBe(true);
      for (const c of cards) expect(c.ageBands.includes("2-5") && c.ageBands.length === 1, c.id).toBe(false);
    });
  }

  it("Leni (22 m) and Dylan (5 y) get disjoint chip lists", () => {
    const leni = new Set(shown(22).map((c) => c.id));
    for (const c of shown(62)) expect(leni.has(c.id), c.id).toBe(false);
  });
});

describe("B-ASKJB-38 · the new sets are complete drafts with sources", () => {
  const vocab = new Set<string>(CONTENT_CONCERNS);
  for (const c of [...toddlerHardMomentCards, ...schoolHardMomentCards]) {
    it(`${c.id}: Do / Say / Avoid / Notice / escalation EN + HE, an https source, a draft`, () => {
      for (const field of [c.title, c.doNow, c.sayThis, c.avoid, c.observe, c.escalation]) {
        expect(field.en.trim().length).toBeGreaterThan(3);
        expect(field.he.trim().length).toBeGreaterThan(2);
        expect(field.he.split(CHILD_NAME_TOKEN).join(""), "Latin in HE").not.toMatch(/[A-Za-z]{2,}/);
      }
      expect(c.escalation.en).toMatch(/pediatrician|emergency/);
      expect(c.evidenceRefs.length).toBeGreaterThan(0);
      for (const ref of c.evidenceRefs) expect(ref).toMatch(/^https:\/\/www\.(healthychildren\.org|cdc\.gov|nhs\.uk)\//);
      for (const concern of c.concerns) expect(vocab.has(concern), concern).toBe(true);
      expect(c.reviewStatus).toBe("draft");
      expect(c.reviewedBy).toBe("");
      expect(c.contentHash).toBeUndefined();
      // pre-review R18: t-screen-handover starts at 18 months (no phone in a 12-month-old's hands)
      expect(c.ageBands).toEqual(c.id === "t-screen-handover" ? ["18-24m", "2-3y"] : toddlerIds.has(c.id) ? ["1-2"] : ["6-8"]);
      // clinical firewall: no verdict words in the copy
      const all = [c.title, c.doNow, c.sayThis, c.avoid, c.observe, c.escalation].map((f) => `${f.en} ${f.he}`).join(" ");
      expect(all).not.toMatch(/\bbehind\b|\bdelay|\bdisorder|\bscore\b|%/i);
    });
  }

  it("they publish only through the pilot: digest pinned, expiry and withdrawal still close them", () => {
    for (const c of [...toddlerHardMomentCards, ...schoolHardMomentCards]) {
      expect(HARD_MOMENT_PILOT.entries[c.id], c.id).toBe(computePilotDigest(c));
      const months = toddlerIds.has(c.id) ? 22 : 84;
      expect(hardMomentPublication(c, { locale: "en", ageMonths: months, now: NOW })).toBe("editorial-pilot");
      expect(hardMomentPublication(c, { locale: "en", ageMonths: months, now: new Date("2026-12-04T00:00:00.000Z") })).toBeNull();
      expect(hardMomentPublication(c, { locale: "en", ageMonths: months, now: NOW, release: { ...HARD_MOMENT_PILOT, withdrawnIds: [c.id] } })).toBeNull();
    }
    // the 25 keep their release digests (explicit bands, same values)
    for (const c of hardMomentCards) expect(HARD_MOMENT_PILOT.entries[c.id], c.id).toBe(computePilotDigest(c));
  });

  it("the sheet prints no age band and reads the band months from lib/age", () => {
    const src = readFileSync(path.join(__dirname, "../components/behaviors/HardMomentsSection.tsx"), "utf8");
    expect(src).not.toMatch(/card\.ageBands\.join/);
    expect(src).toMatch(/ageMonths: comparisonMonthsOf\(childProfile, now\)/);
    const sel = readFileSync(path.join(__dirname, "selectCards.ts"), "utf8");
    expect(sel.match(/= hardMomentCatalogue/g)?.length).toBe(4);
  });
});
