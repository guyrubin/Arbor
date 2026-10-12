/**
 * v3 EXTRA-FORYOU — the parent's open family question as a reading signal.
 *
 * The question is the parent's own words (the same class of input as a saved
 * read or a logged concern), never a score about the child. These tests pin:
 *  · the matcher (EN suffixes, HE prefixes and plural endings, stop words, and
 *    the negative controls that keep two different words apart);
 *  · concepts (reviewer r1): a word that names a concern tag ("bedtime",
 *    "השינה", "biting", "נושך") meets a read with that tag in EN and HE alike,
 *    worth less than a shared word, and never counted twice;
 *  · that the scorer is byte-identical when no question is open;
 *  · the boost and its cap, and that a question outranks the focus domain;
 *  · `todaysLearnPick.fromTopic`: true only when the question moved the winner.
 *
 * Shelves are synthetic (ids carry no words the matcher can read), so the
 * assertions do not move when the real catalogue is edited. Questions are
 * invented examples.
 */
import { describe, expect, it } from "vitest";
import { sharedTopicWords, stemEnglish, topicOverlap, topicWords } from "./topicMatch";
import {
  learnCardScore,
  rankLearnCards,
  topicBoost,
  TOPIC_BOOST_CAP,
  TOPIC_CONCEPT_BOOST,
  TOPIC_WORD_BOOST,
  type LearnCard,
  type LearnRankSignals,
} from "./learnLibrary";
import { todaysLearnPick } from "./todaysPick";

const CHILD = "child-topic";
const DAY = "2026-10-12";

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

const signals = (over: Partial<LearnRankSignals> = {}): LearnRankSignals => ({
  ageYears: 4,
  focusDomain: null,
  ...over,
});

const words = (q: string) => topicWords(q).map((w) => w.word);
const shared = (q: string, text: string) => sharedTopicWords(topicWords(q), text);

const BEDTIME_Q = "How do we get through bedtime without a fight?";
const BEDTIME_Q_HE = "איך עוברים את השינה בלי ריב?";
const concepts = (q: string) => Object.fromEntries(topicWords(q).map((w) => [w.word, w.concepts]));
const BEDTIME_CARD = card("x2", { category: "sleep", title: { en: "The bedtime routine", he: "טקס השינה" } });
const LIMITS_CARD = card("x1", { title: { en: "Calm limits", he: "גבולות רגועים" } });

describe("stemEnglish — a short suffix rule set", () => {
  it.each([
    ["sleeping", "sleep"],
    ["feelings", "feel"],
    ["cries", "cry"],
    ["cried", "cry"],
    ["hitting", "hit"],
    ["stopped", "stop"],
    ["tantrums", "tantrum"],
    ["boundaries", "boundary"],
    ["goodbyes", "goodbye"],
    ["screens", "screen"],
    ["watches", "watch"],
  ])("%s → %s", (word, stem) => {
    expect(stemEnglish(word)).toBe(stem);
  });

  it("leaves words without a suffix, and a doubled l or s, alone", () => {
    expect(stemEnglish("bedtime")).toBe("bedtime");
    expect(stemEnglish("class")).toBe("class");
    expect(stemEnglish("fall")).toBe("fall");
  });
});

describe("topicWords — only the question's content words", () => {
  it("drops stop words and the generic words of every parenting question", () => {
    expect(words(BEDTIME_Q)).toEqual(["bedtime", "fight"]);
    expect(words("How do I help my kid with my child?")).toEqual([]);
    expect(words("He is a big boy now")).toEqual([]);
    expect(words("הוא ילד גדול")).toEqual([]);
    expect(words("")).toEqual([]);
    expect(words("   ")).toEqual([]);
  });

  it("keeps Hebrew content words (normalised)", () => {
    expect(words("איך עוברים את השינה בלי ריב?")).toContain("השינה");
    expect(words("איך עוברים את השינה בלי ריב?")).not.toContain("איך");
  });
});

describe("sharedTopicWords — EN and HE alike", () => {
  it("matches an English question on a stem", () => {
    expect(shared(BEDTIME_Q, "The bedtime routine")).toBe(1);
    expect(shared("screens at dinner", "Screen time")).toBe(1);
    expect(shared("Hitting his sister", "When a child hits")).toBe(1);
    expect(shared("bedtime fights and hitting", "Bedtime fights hits")).toBe(3);
  });

  it("matches a Hebrew question through a one-letter prefix and a plural ending", () => {
    expect(shared("איך עוברים את השינה בלי ריב?", "שינה")).toBe(1);
    expect(shared("מה עושים עם מסכים בערב", "מסכים ודיגיטל")).toBe(1);
  });

  it("NEGATIVE CONTROLS: different words stay apart", () => {
    expect(shared("שינה", "מינה")).toBe(0);
    expect(shared("bed", "bedtime")).toBe(0);
    expect(shared("What about the garden swing?", "Calm limits")).toBe(0);
    expect(shared(BEDTIME_Q, "")).toBe(0);
  });
});

describe("concepts — a word that names a concern tag, EN and HE alike", () => {
  it("names the tag a parent means, and nothing for the words that name no one concern", () => {
    expect(concepts(BEDTIME_Q)).toEqual({ bedtime: ["sleep"], fight: [] });
    expect(concepts(BEDTIME_Q_HE)["השינה"]).toEqual(["sleep"]);
    expect(concepts(BEDTIME_Q_HE)["ריב"]).toEqual([]);
    expect(concepts("Why does he keep biting?")["biting"]).toEqual(["aggression"]);
    expect(concepts("למה הוא נושך?")["נושכ"]).toEqual(["aggression"]);
    // A Hebrew one-letter prefix and an English suffix still reach the concept.
    expect(concepts("מה עושים בלילה")["בלילה"]).toEqual(["sleep"]);
    expect(concepts("naps are short")["naps"]).toEqual(["sleep"]);
    expect(concepts("tantrums at dinner")).toEqual({ tantrums: ["regulation"], dinner: ["food"] });
  });

  it("NEGATIVE CONTROLS: a near word is not the concept", () => {
    expect(concepts("bedroom paint")).toEqual({ bedroom: [], paint: [] });
    expect(concepts("לחבר את הרכבת")["לחבר"]).toEqual([]);
    expect(concepts("What about the garden swing?")).toEqual({ garden: [], swing: [] });
  });

  it("topicOverlap counts each question word once: a shared word first, else a concept", () => {
    const words = topicWords(BEDTIME_Q);
    expect(topicOverlap(words, "The bedtime routine", ["sleep"])).toEqual({ direct: 1, concept: 0 });
    expect(topicOverlap(words, "Night terrors", ["sleep", "fears"])).toEqual({ direct: 0, concept: 1 });
    expect(topicOverlap(words, "Night terrors", ["food"])).toEqual({ direct: 0, concept: 0 });
    expect(topicOverlap([], "The bedtime routine", ["sleep"])).toEqual({ direct: 0, concept: 0 });
  });
});

describe("the scorer with a family question", () => {
  const shelf = [LIMITS_CARD, BEDTIME_CARD, card("x3", { category: "screens", title: { en: "Screen time", he: "זמן מסך" } })];

  it("is byte-identical when no question is open (absent, null, empty, or stop words only)", () => {
    for (const c of shelf) {
      const base = learnCardScore(c, signals());
      expect(learnCardScore(c, signals({ topicText: null }))).toBe(base);
      expect(learnCardScore(c, signals({ topicText: "" }))).toBe(base);
      expect(learnCardScore(c, signals({ topicText: "How do I help my child?" }))).toBe(base);
    }
    const order = rankLearnCards(shelf, signals()).map((c) => c.id);
    expect(rankLearnCards(shelf, signals({ topicText: null })).map((c) => c.id)).toEqual(order);
    expect(rankLearnCards(shelf, signals({ topicText: "" })).map((c) => c.id)).toEqual(order);
  });

  it(`adds ${TOPIC_WORD_BOOST} per shared word, capped at ${TOPIC_BOOST_CAP}`, () => {
    expect(topicBoost(BEDTIME_CARD, BEDTIME_Q)).toBe(TOPIC_WORD_BOOST);
    const many = card("x4", { title: { en: "Bedtime fights and hitting", he: "x4" } });
    expect(topicBoost(many, "bedtime fights and hitting")).toBe(TOPIC_BOOST_CAP);
    expect(learnCardScore(many, signals({ topicText: "bedtime fights and hitting" })) - learnCardScore(many, signals())).toBe(TOPIC_BOOST_CAP);
    expect(topicBoost(LIMITS_CARD, BEDTIME_Q)).toBe(0);
  });

  it("matches the card's title and shelf name, never its body", () => {
    const bodyOnly = card("x5", { body: { en: "bedtime bedtime bedtime", he: "x5" } });
    expect(topicBoost(bodyOnly, BEDTIME_Q)).toBe(0);
    const shelfOnly = card("x6", { category: "sleep" });
    expect(topicBoost(shelfOnly, "איך עוברים את השינה בלי ריב?")).toBe(TOPIC_WORD_BOOST);
  });

  it("EN and HE meet the same tagged read alike (the reviewer's parity case)", () => {
    const tagged = card("x8", { concerns: ["sleep"] });
    expect(topicBoost(tagged, BEDTIME_Q)).toBe(TOPIC_CONCEPT_BOOST);
    expect(topicBoost(tagged, BEDTIME_Q_HE)).toBe(TOPIC_CONCEPT_BOOST);
    const biting = card("x9", { concerns: ["aggression"] });
    expect(topicBoost(biting, "Why does he keep biting?")).toBe(TOPIC_CONCEPT_BOOST);
    expect(topicBoost(biting, "למה הוא נושך?")).toBe(TOPIC_CONCEPT_BOOST);
    // NEGATIVE CONTROLS: another tag, or no tags, is not met by the concept.
    expect(topicBoost(card("x10", { concerns: ["food"] }), BEDTIME_Q)).toBe(0);
    expect(topicBoost(card("x11", { concerns: [] }), BEDTIME_Q_HE)).toBe(0);
  });

  it("a shared word outranks a concept-only match, and one word never counts twice", () => {
    expect(TOPIC_WORD_BOOST).toBeGreaterThan(TOPIC_CONCEPT_BOOST);
    const both = card("x12", { title: { en: "Bedtime", he: "x12" }, concerns: ["sleep"] });
    expect(topicBoost(both, BEDTIME_Q)).toBe(TOPIC_WORD_BOOST);
    const conceptOnly = card("x13", { concerns: ["sleep"] });
    expect(rankLearnCards([conceptOnly, both], signals({ topicText: BEDTIME_Q })).map((c) => c.id)).toEqual(["x12", "x13"]);
  });

  it("the question the parent is asking outranks the focus domain", () => {
    const focus = card("x7", { category: "language", domains: ["language_communication"] });
    const s = signals({ focusDomain: "language_communication" });
    expect(rankLearnCards([focus, BEDTIME_CARD], s)[0].id).toBe("x7");
    expect(rankLearnCards([focus, BEDTIME_CARD], { ...s, topicText: BEDTIME_Q })[0].id).toBe("x2");
    // A concept-only match outranks the focus domain too.
    const tagged = card("x14", { concerns: ["sleep"] });
    expect(rankLearnCards([focus, tagged], { ...s, topicText: BEDTIME_Q })[0].id).toBe("x14");
  });
});

describe("todaysLearnPick.fromTopic is re-derived, not asserted", () => {
  const shelf = [LIMITS_CARD, BEDTIME_CARD];

  it("true when the question moved the winning card (EN and HE)", () => {
    const en = todaysLearnPick(shelf, signals({ topicText: BEDTIME_Q }), { childId: CHILD, dayKey: DAY });
    expect(en!.card.id).toBe("x2");
    expect(en!.fromTopic).toBe(true);
    const he = todaysLearnPick(shelf, signals({ topicText: "איך עוברים את השינה בלי ריב?" }), { childId: CHILD, dayKey: DAY });
    expect(he!.card.id).toBe("x2");
    expect(he!.fromTopic).toBe(true);
  });

  it("false with no question, and false when the question matches nothing on the shelf", () => {
    expect(todaysLearnPick(shelf, signals(), { childId: CHILD, dayKey: DAY })!.fromTopic).toBe(false);
    expect(todaysLearnPick(shelf, signals({ topicText: null }), { childId: CHILD, dayKey: DAY })!.fromTopic).toBe(false);
    expect(
      todaysLearnPick(shelf, signals({ topicText: "What about the garden swing?" }), { childId: CHILD, dayKey: DAY })!.fromTopic,
    ).toBe(false);
  });

  it("the sibling flags stay independent of the question", () => {
    const pick = todaysLearnPick(shelf, signals({ topicText: BEDTIME_Q }), { childId: CHILD, dayKey: DAY });
    expect(pick!.fromFocus).toBe(false);
    expect(pick!.fromConcerns).toBe(false);
    expect(pick!.fromSaved).toBe(false);
  });
});
