/**
 * GP-33 — first-words ledger: the Language Lab writes to the record.
 *
 * `langObs` has been a registered child collection (lib/childData
 * CHILD_SUBCOLLECTIONS) fed by the Language Lab's vocab view for months, and
 * the child's record never showed a single word: the language surface contract
 * still reads threadWrite: "none", and the Lab leads with generic activity
 * cards while the child's own words sit last on the page.
 *
 * BEHAVIOUR tests on the fold, plus a firewall scan over the card. The rule for
 * this feature: phrases, languages and dates — never a vocabulary-size
 * expectation, a mix percentage, or a comparison to any norm.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFirstWordsLedger } from "./firstWords";
import type { LangObservation } from "../growth/vocabAgg";

const obs = (id: string, phrase: string, language: string, timestamp: string): LangObservation => ({
  id,
  phrase,
  language,
  timestamp,
});

describe("buildFirstWordsLedger — a keepsake, not an aggregate", () => {
  it("returns an empty ledger for an empty sink", () => {
    const l = buildFirstWordsLedger([]);
    expect(l.rows).toEqual([]);
    expect(l.wordCount).toBe(0);
    expect(l.languageCount).toBe(0);
  });

  it("orders rows newest FIRST-logged first", () => {
    const l = buildFirstWordsLedger([
      obs("1", "mama", "English", "2026-08-01T10:00:00.000Z"),
      obs("2", "כדור", "Hebrew", "2026-08-20T10:00:00.000Z"),
      obs("3", "more", "English", "2026-08-10T10:00:00.000Z"),
    ]);
    expect(l.rows.map((r) => r.phrase)).toEqual(["כדור", "more", "mama"]);
  });

  it("keeps the EARLIEST date when a phrase is logged again — that is the 'first'", () => {
    const l = buildFirstWordsLedger([
      obs("later", "mama", "English", "2026-08-20T10:00:00.000Z"),
      obs("first", "Mama", "English", "2026-08-01T10:00:00.000Z"),
    ]);
    expect(l.wordCount).toBe(1);
    expect(l.rows[0].firstLoggedAt).toBe("2026-08-01T10:00:00.000Z");
  });

  it("treats the same word in two languages as two entries", () => {
    const l = buildFirstWordsLedger([
      obs("a", "mama", "English", "2026-08-01T10:00:00.000Z"),
      obs("b", "mama", "Hebrew", "2026-08-02T10:00:00.000Z"),
    ]);
    expect(l.wordCount).toBe(2);
    expect(l.languageCount).toBe(2);
  });

  it("drops rows with no phrase, no language or no timestamp", () => {
    const l = buildFirstWordsLedger([
      obs("a", "   ", "English", "2026-08-01T10:00:00.000Z"),
      obs("b", "ball", "  ", "2026-08-01T10:00:00.000Z"),
      obs("c", "ball", "English", ""),
      obs("d", "ball", "English", "2026-08-01T10:00:00.000Z"),
    ]);
    expect(l.wordCount).toBe(1);
    expect(l.rows[0].phrase).toBe("ball");
  });

  it("counts DISTINCT languages, case-insensitively", () => {
    const l = buildFirstWordsLedger([
      obs("a", "one", "english", "2026-08-01T10:00:00.000Z"),
      obs("b", "two", "English", "2026-08-02T10:00:00.000Z"),
    ]);
    expect(l.languageCount).toBe(1);
    expect(l.wordCount).toBe(2);
  });

  it("caps the rendered rows but counts the whole record", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      obs(String(i), `word-${i}`, "English", `2026-08-${String(i + 1).padStart(2, "0")}T10:00:00.000Z`),
    );
    const l = buildFirstWordsLedger(many, 6);
    expect(l.rows.length).toBe(6);
    expect(l.wordCount).toBe(20);
  });

  it("preserves the parent's own text verbatim (never normalised for display)", () => {
    const l = buildFirstWordsLedger([obs("a", "  All done!  ", "English", "2026-08-01T10:00:00.000Z")]);
    expect(l.rows[0].phrase).toBe("All done!");
  });

  it("emits ONLY keepsake fields — no rate, size expectation or mix", () => {
    const l = buildFirstWordsLedger([obs("a", "ball", "English", "2026-08-01T10:00:00.000Z")]);
    expect(Object.keys(l).sort()).toEqual(["languageCount", "rows", "wordCount"]);
    expect(Object.keys(l.rows[0]).sort()).toEqual(["firstLoggedAt", "id", "language", "phrase"]);
  });
});

describe("GP-33 — the ledger card keeps the record's register", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const read = (rel: string) =>
    readFileSync(path.join(here, "..", rel), "utf8").replace(/\r\n/g, "\n");
  const CARD = read("components/growth/FirstWordsLedger.tsx");
  const MODULE = read("lib/firstWords.ts");
  const HUB = read("components/tabs/DevelopmentTab.tsx");

  it("all three files were actually read (extraction proven)", () => {
    expect(CARD.length).toBeGreaterThan(1000);
    expect(MODULE.length).toBeGreaterThan(500);
    expect(HUB.length).toBeGreaterThan(1000);
  });

  it("NEGATIVE CONTROL — the matcher catches the shapes this feature must not grow", () => {
    const banned = /mixPct|\bpercent|\btypical for\b|\bexpected by\b|\bshould be saying\b|\bon[\s-]?track\b/i;
    for (const bad of [
      "const pct = mixPct(lang.count, total);",
      'label: "typical for 18 months"',
      '"she should be saying 50 words"',
    ]) {
      expect(banned.test(bad), `matcher missed: ${bad}`).toBe(true);
    }
    expect(banned.test("wordCount / languageCount")).toBe(false);
  });

  it("neither the fold nor the card derives a rate, mix or expectation", () => {
    const code = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const banned = /mixPct|\bpercent|\btypical for\b|\bexpected by\b|\bshould be saying\b|\bon[\s-]?track\b/i;
    expect(banned.test(code(MODULE))).toBe(false);
    expect(banned.test(code(CARD))).toBe(false);
  });

  it("reads the SAME registered collection the Language Lab writes", () => {
    expect(CARD).toMatch(/useChildCollection<LangObservation>\(childProfile\.id, "langObs"/);
    const childData = read("lib/childData.ts");
    expect(childData).toContain('"langObs"'); // still export/erase swept
  });

  it("is MOUNTED on the Growth hub (not another capability built and left unwired)", () => {
    expect(HUB).toContain('import FirstWordsLedger from "../growth/FirstWordsLedger"');
    expect(HUB).toMatch(/<FirstWordsLedger \/>/);
  });

  it("renders counts and dates, and offers the write path back to the Lab", () => {
    expect(CARD).toContain('data-testid="growth-first-words-count"');
    expect(CARD).toContain("elev.waveR.words.firstOn");
    expect(CARD).toContain('setActiveTab("language")');
    expect(CARD).toContain('data-testid="growth-first-words-add"');
  });
});
