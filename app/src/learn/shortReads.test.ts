/**
 * v3 EXTRA-FORYOU — the short-reads row (reviewer r1).
 *
 * Pins the fill rule the hub renders: the row is full (three) whenever the
 * ranked shelf holds three; the reads that meet the parent's question come
 * first, then the next reads in the same ranked order; the "for your
 * question" title only when the first read meets it; a mark per matched read
 * only in a mixed row. EN and HE meet the same tagged reads alike.
 * Invented cards only — no child data.
 */
import { describe, expect, it } from "vitest";
import type { LearnCard } from "./learnLibrary";
import { pickShortReads, SHORT_READS_SIZE } from "./shortReads";

const card = (id: string, over: Partial<LearnCard> = {}): LearnCard => ({
  id,
  category: "behavior",
  domains: [],
  ageMin: 0,
  ageMax: 18,
  minutes: 3,
  title: { en: id, he: id },
  hook: { en: id, he: id },
  keyPoints: [],
  body: { en: id, he: id },
  tryToday: { en: id, he: id },
  ask: { en: id, he: id },
  concerns: [],
  ...over,
});
/** A read tagged "sleep": met by the bedtime question in EN and HE alike. */
const sleepy = (id: string) => card(id, { concerns: ["sleep"] });
/** A read the bedtime question does not meet. */
const plain = (id: string) => card(id);

const QUESTION = {
  en: "How do we get through bedtime without a fight?",
  he: "איך עוברים את השינה בלי ריב?",
} as const;
const ids = (cards: readonly LearnCard[]) => cards.map((c) => c.id);

describe("pickShortReads — the row is full and honest", () => {
  it("SHORT_READS_SIZE is the brief's three", () => {
    expect(SHORT_READS_SIZE).toBe(3);
  });

  for (const locale of ["en", "he"] as const) {
    it(`${locale}: fewer matches than three → matched first, then the next ranked reads, each matched read marked`, () => {
      const row = pickShortReads([plain("ua"), sleepy("ma"), plain("ub"), plain("uc")], QUESTION[locale]);
      expect(ids(row.reads)).toEqual(["ma", "ua", "ub"]);
      expect([...row.matched]).toEqual(["ma"]);
      expect(row.forTopic).toBe(true);
      expect(row.markMatched).toBe(true);
      expect(row.show).toBe(true);
    });

    it(`${locale}: three or more matches → three matched reads in ranked order, the question title, no marks`, () => {
      const row = pickShortReads([plain("ua"), sleepy("mb"), sleepy("ma"), plain("ub"), sleepy("mc"), sleepy("md")], QUESTION[locale]);
      expect(ids(row.reads)).toEqual(["mb", "ma", "mc"]);
      expect(row.matched.size).toBe(3);
      expect(row.forTopic).toBe(true);
      expect(row.markMatched).toBe(false);
      expect(row.show).toBe(true);
    });
  }

  it("no question, a blank one, or one that meets nothing → the top three ranked reads, the plain title, no marks", () => {
    const shelf = [plain("ua"), sleepy("ma"), plain("ub"), plain("uc")];
    for (const topic of [null, undefined, "", "   ", "Zebra kite accordion"]) {
      const row = pickShortReads(shelf, topic);
      expect(ids(row.reads), String(topic)).toEqual(["ua", "ma", "ub"]);
      expect(row.matched.size).toBe(0);
      expect(row.forTopic).toBe(false);
      expect(row.markMatched).toBe(false);
      expect(row.show).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: a near word is not a match (bedroom is not bedtime)", () => {
    const row = pickShortReads([plain("ua"), sleepy("ma"), plain("ub")], "Painting the bedroom");
    expect(ids(row.reads)).toEqual(["ua", "ma", "ub"]);
    expect(row.forTopic).toBe(false);
  });

  it("a short shelf: the row shows when it answers the question, and hides when it is neither full nor for the question", () => {
    expect(pickShortReads([], QUESTION.en)).toMatchObject({ reads: [], forTopic: false, markMatched: false, show: false });
    const one = pickShortReads([sleepy("ma")], QUESTION.en);
    expect(ids(one.reads)).toEqual(["ma"]);
    expect(one).toMatchObject({ forTopic: true, markMatched: false, show: true });
    const mixed = pickShortReads([plain("ua"), sleepy("ma")], QUESTION.he);
    expect(ids(mixed.reads)).toEqual(["ma", "ua"]);
    expect(mixed).toMatchObject({ forTopic: true, markMatched: true, show: true });
    const two = pickShortReads([plain("ua"), plain("ub")], null);
    expect(two).toMatchObject({ forTopic: false, show: false });
  });

  it("never more than three reads, never one twice", () => {
    const shelf = ["ma", "mb", "mc", "md", "me"].map(sleepy).concat(["ua", "ub"].map(plain));
    const row = pickShortReads(shelf, QUESTION.en);
    expect(row.reads).toHaveLength(SHORT_READS_SIZE);
    expect(new Set(ids(row.reads)).size).toBe(row.reads.length);
  });
});
