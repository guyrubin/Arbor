import { describe, expect, it } from "vitest";
import { ALL_MILESTONES, RETIRED_MILESTONE_IDS } from "../lib/milestoneData";
import { SHELF_IDS, milestoneShelf } from "../lib/shelves/registry";
import { HE_VERDICT_WORDS } from "../lib/milestoneHeRules";
import { findClinicalDiagnosisTerm } from "../lib/clinicalScan";
import {
  FEELING_WORDS, FOOD_BANNED, PRACTICES, PRACTICE_BANNED, PRACTICE_SOURCES, PRACTICE_TECHNIQUES, isPracticePublishable, practiceAsGovernedRecord, practiceCountTable, practicesForMilestone, practicesForShelf, type Practice,
} from "./practices";

/**
 * B-LOOP-08 — the practice library guard (P5-LOOP pack, acceptance):
 *  coverage (every live catalogue row, no retired id) · shape (EN + HE do +
 *  say, technique, source with title + year, minutes, shelf + age from the
 *  row) · word caps · the forbidden-word scan (PRACTICE_BANNED + the
 *  catalogue rules of lib/milestoneHeRules) · the diagnosis scan · the sleep
 *  method scan · the food amount/restriction scan · feelings named only as
 *  an offer · no Latin letters in Hebrew · draft never publishes.
 *  Follow-up (6 Oct): shelf-level practices (`milestoneId: null`) on Sleep
 *  and Family — every shelf has ≥ 1 practice; the scans cover them.
 */

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;
const texts = (p: Practice): { field: string; locale: "en" | "he"; text: string }[] => {
  const out: { field: string; locale: "en" | "he"; text: string }[] = [];
  for (const field of ["do", "say", "materials"] as const) {
    const v = p[field];
    if (!v) continue;
    out.push({ field, locale: "en", text: v.en }, { field, locale: "he", text: v.he });
  }
  return out;
};
const sentences = (s: string): string[] => s.split(/(?<=[.!?…])\s+/).filter(Boolean);

/** Sleep methods with a safety debate — scanned on EVERY practice (sleep shelf or not). */
const SLEEP_METHOD = {
  en: [/cry(?:ing)?[- ]it[- ]out/i, /controlled crying/i, /\bextinction\b/i, /ferber/i, /weissbluth/i, /let (?:him|her|them) cry/i],
  he: ["לתת לו לבכות", "לתת לה לבכות", "שיטת", "פרבר"],
};

describe("B-LOOP-08 — coverage", () => {
  it("every live catalogue row has ≥ 1 practice; no retired id has one; ids unique", () => {
    const missing = ALL_MILESTONES.filter((m) => practicesForMilestone(m.id).length === 0).map((m) => m.id);
    expect(missing).toEqual([]);
    for (const id of RETIRED_MILESTONE_IDS) expect(practicesForMilestone(id), id).toEqual([]);
    const live = new Set(ALL_MILESTONES.map((m) => m.id));
    for (const p of PRACTICES) if (p.milestoneId !== null) expect(live.has(p.milestoneId), p.id).toBe(true);
    expect(new Set(PRACTICES.map((p) => p.id)).size).toBe(PRACTICES.length);
  });

  it("follow-up: every shelf has ≥ 1 practice (Sleep and Family through the shelf-level set)", () => {
    const empty = SHELF_IDS.filter((shelf) => practicesForShelf(shelf).length === 0);
    expect(empty).toEqual([]);
    expect(practicesForShelf("sleep").length).toBeGreaterThanOrEqual(6);
    expect(practicesForShelf("family").length).toBeGreaterThanOrEqual(4);
  });

  it("follow-up: shelf-level practices have milestoneId null, a shelf in SHELVES, an id pr-<shelf>-<nn> and their own age anchor", () => {
    const shelfLevel = PRACTICES.filter((p) => p.milestoneId === null);
    expect(shelfLevel.length).toBeGreaterThanOrEqual(10);
    for (const p of shelfLevel) {
      expect(SHELF_IDS, p.id).toContain(p.shelf);
      expect(p.id, p.id).toMatch(new RegExp(`^pr-${p.shelf}-\\d{2}$`));
      expect(Number.isInteger(p.ageMonths) && p.ageMonths >= 6 && p.ageMonths <= 60, p.id).toBe(true);
      expect(practicesForMilestone(p.id), p.id).toEqual([]);
    }
    // Sleep practices cite the sleep sources only (AAP safe sleep / HealthyChildren, NHS Start for Life, WHO 2019).
    const sleepSources = [PRACTICE_SOURCES.aapSafeSleep, PRACTICE_SOURCES.aapHealthyChildrenSleep, PRACTICE_SOURCES.nhsStartForLifeSleep, PRACTICE_SOURCES.whoMovement];
    for (const p of practicesForShelf("sleep")) expect(sleepSources, p.id).toContain(p.evidence.source);
    for (const p of practicesForShelf("family")) expect([PRACTICE_SOURCES.whoUnicefCcd, PRACTICE_SOURCES.aapBrightFutures], p.id).toContain(p.evidence.source);
  });

  it("the count table adds up to the library (counts only, per shelf × band)", () => {
    const table = practiceCountTable();
    expect(table.reduce((n, c) => n + c.count, 0)).toBe(PRACTICES.length);
    for (const c of table) expect(Number.isInteger(c.count) && c.count > 0, `${c.shelf} ${c.band}`).toBe(true);
  });
});

describe("B-LOOP-08 — shape", () => {
  const row = new Map(ALL_MILESTONES.map((m) => [m.id, m]));
  it("EN + HE do and say; technique from the union; source with title + year; minutes 5/10/15; shelf and age from the row; draft", () => {
    for (const p of PRACTICES) {
      const m = p.milestoneId === null ? null : row.get(p.milestoneId)!;
      for (const t of [p.do.en, p.do.he, p.say.en, p.say.he]) expect(t.trim().length, p.id).toBeGreaterThan(0);
      if (p.materials) expect(p.materials.en.trim().length > 0 && p.materials.he.trim().length > 0, p.id).toBe(true);
      expect(PRACTICE_TECHNIQUES, p.id).toContain(p.evidence.technique);
      expect(p.evidence.source.org.trim().length, p.id).toBeGreaterThan(0);
      expect(p.evidence.source.title.trim().length, p.id).toBeGreaterThan(0);
      expect(Number.isInteger(p.evidence.source.year) && p.evidence.source.year >= 1980 && p.evidence.source.year <= 2026, p.id).toBe(true);
      if (p.evidence.source.url) expect(p.evidence.source.url, p.id).toMatch(/^https:\/\//);
      expect([5, 10, 15], p.id).toContain(p.minutes);
      if (m) {
        expect(p.shelf, p.id).toBe(milestoneShelf(m));
        expect(p.ageMonths, p.id).toBe(m.ageMonths);
        expect(p.id, p.id).toBe(`pr-${p.milestoneId}`);
      }
      expect(p.ageMonths >= 2 && p.ageMonths <= 66, p.id).toBe(true);
      expect(p.reviewStatus, p.id).toBe("draft");
    }
  });

  it("word caps: do ≤ 25, say ≤ 15 (EN and HE)", () => {
    const over: string[] = [];
    for (const p of PRACTICES) {
      for (const loc of ["en", "he"] as const) {
        if (words(p.do[loc]) > 25) over.push(`${p.id} do.${loc} = ${words(p.do[loc])}`);
        if (words(p.say[loc]) > 15) over.push(`${p.id} say.${loc} = ${words(p.say[loc])}`);
      }
    }
    expect(over).toEqual([]);
  });

  it("Hebrew strings carry no Latin letters", () => {
    const hits = PRACTICES.flatMap((p) => texts(p).filter((t) => t.locale === "he" && /[A-Za-z]/.test(t.text)).map((t) => `${p.id}.${t.field}`));
    expect(hits).toEqual([]);
  });
});

describe("B-LOOP-08 — the firewall scans", () => {
  it("no target / count / norm / verdict / age / brand word (PRACTICE_BANNED + the catalogue's HE verdict list), EN + HE, over do/say/materials", () => {
    const hits: string[] = [];
    for (const p of PRACTICES) {
      for (const t of texts(p)) {
        if (t.locale === "en") for (const re of PRACTICE_BANNED.en) if (re.test(t.text)) hits.push(`${p.id}.${t.field}.en ${re}`);
        if (t.locale === "he") for (const w of [...PRACTICE_BANNED.he, ...HE_VERDICT_WORDS]) if (t.text.includes(w)) hits.push(`${p.id}.${t.field}.he "${w}"`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("findClinicalDiagnosisTerm is null on every string", () => {
    const hits = PRACTICES.flatMap((p) => texts(p).map((t) => ({ t, term: findClinicalDiagnosisTerm(t.text) })).filter((x) => x.term).map((x) => `${p.id}.${x.t.field}.${x.t.locale}: ${x.term}`));
    expect(hits).toEqual([]);
  });

  it("no sleep method with a safety debate anywhere (sleep shelf included): routine, light, timing and wind-down only", () => {
    // follow-up: the scan really covers the shelf-level sleep rows.
    expect(PRACTICES.filter((p) => p.shelf === "sleep" && p.milestoneId === null).length).toBeGreaterThanOrEqual(6);
    const hits: string[] = [];
    for (const p of PRACTICES) for (const t of texts(p)) {
      if (t.locale === "en" && SLEEP_METHOD.en.some((re) => re.test(t.text))) hits.push(`${p.id}.${t.field}.en`);
      if (t.locale === "he" && SLEEP_METHOD.he.some((w) => t.text.includes(w))) hits.push(`${p.id}.${t.field}.he`);
    }
    expect(hits).toEqual([]);
  });

  it("food shelf: no amount, restriction or reward (responsive feeding and exposure only)", () => {
    const food = PRACTICES.filter((p) => p.shelf === "food");
    expect(food.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const p of food) for (const t of texts(p)) {
      if (t.locale === "en") for (const re of FOOD_BANNED.en) if (re.test(t.text)) hits.push(`${p.id}.${t.field}.en ${re}`);
      if (t.locale === "he") for (const w of FOOD_BANNED.he) if (t.text.includes(w)) hits.push(`${p.id}.${t.field}.he "${w}"`);
    }
    expect(hits).toEqual([]);
  });

  it("feelings shelf: a say sentence that names a feeling is a question — an offer, never a verdict", () => {
    const feelings = PRACTICES.filter((p) => p.shelf === "feelings");
    expect(feelings.length).toBeGreaterThan(0);
    const hits: string[] = [];
    for (const p of feelings) {
      for (const s of sentences(p.say.en)) if (FEELING_WORDS.en.some((re) => re.test(s)) && !s.trim().endsWith("?")) hits.push(`${p.id}.en: ${s}`);
      for (const s of sentences(p.say.he)) if (FEELING_WORDS.he.some((w) => s.includes(w)) && !s.trim().endsWith("?")) hits.push(`${p.id}.he: ${s}`);
    }
    expect(hits).toEqual([]);
  });

  it("NEGATIVE CONTROL: the scans really fire on the shapes they forbid", () => {
    const fires = (text: string) => PRACTICE_BANNED.en.some((re) => re.test(text));
    for (const bad of ["Get her to say ten words.", "Teach him colours.", "Practice until she can do it.", "Most children say this by age two.", "You should read daily.", "Try the Hanen way.", "Let him cry it out.", "Say it 3 times."]) expect(fires(bad), bad).toBe(true);
    for (const bad of ["צריך ללמד אותו", "רוב הילדים כבר", "שיטת פרבר"]) expect(PRACTICE_BANNED.he.some((w) => bad.includes(w)), bad).toBe(true);
    expect(FOOD_BANNED.en.some((re) => re.test("Finish your plate for a treat."))).toBe(true);
    expect(FOOD_BANNED.he.some((w) => "אם תסיים תקבל פרס".includes(w))).toBe(true);
    expect(findClinicalDiagnosisTerm("signs of a speech delay")).not.toBeNull();
  });
});

describe("B-LOOP-08 — governance", () => {
  it("every practice is a draft and isPublishableContent is false (nothing renders publicly before the clinical reviewer signs)", () => {
    for (const p of PRACTICES) {
      expect(isPracticePublishable(p), p.id).toBe(false);
      const rec = practiceAsGovernedRecord(p);
      expect(rec.reviewStatus, p.id).toBe("draft");
      expect(rec.locales, p.id).toEqual(["en", "he"]);
      expect(rec.evidenceRefs.length, p.id).toBe(1);
      expect(rec.contentKind, p.id).toBe("practice");
      expect(rec.citedSource, p.id).toEqual({ title: p.evidence.source.title, year: p.evidence.source.year });
    }
  });

  it("follow-up: an approved practice with the reviewer's named stamp and a cited source publishes (concerns: [] allowed); without a stamp it does not", () => {
    const p = practicesForShelf("sleep")[0];
    const now = new Date("2026-11-01");
    const approved: Practice = { ...p, reviewStatus: "approved", review: { reviewedBy: "Dr. Noa Levi", reviewedAt: "2026-10-20", reviewDueAt: "2027-10-20" } };
    expect(practiceAsGovernedRecord(approved).concerns).toEqual([]);
    expect(isPracticePublishable(approved, now)).toBe(true);
    expect(isPracticePublishable({ ...approved, review: undefined }, now)).toBe(false);
    expect(isPracticePublishable({ ...approved, evidence: { ...approved.evidence, source: { ...approved.evidence.source, title: " " } } }, now)).toBe(false);
  });
});
