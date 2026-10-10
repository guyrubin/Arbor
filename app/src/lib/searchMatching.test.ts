/** B-SHELL-37: execute the three matchers; local records never join the index. */
import { describe, expect, it } from "vitest";
import { LEARN_CARDS } from "../learn/learnCards";
import { searchLearnCards, type LearnCard } from "../learn/learnLibrary";
import { matchesJournalFilter, type JournalFilterContext } from "./journalFilters";
import { placeForTab } from "./companionPlaces";
import { getSearchIndex, searchCatalog } from "./searchIndex";
import type { TimelineSignal } from "./signalTimeline";

const card = LEARN_CARDS.find((c) => c.id === "tantrums-development")!;
const signal: TimelineSignal = {
  id: "moment-search-fixture", kind: "moment", at: null, tone: "lav",
};
const context = (query: string, over: Partial<JournalFilterContext> = {}): JournalFilterContext => ({
  query, filter: "all", logsById: new Map(), keptIds: new Set(), labelOf: () => "", ...over,
});

describe("B-SHELL-37 · the same EN/HE query matches in all three consumers", () => {
  it.each([
    { query: "  TANTRUMS  ", he: false },
    { query: "tántrums", he: false },
    { query: "התקפי זעם", he: true },
    { query: "  הִתְקְפֵי זַעַם  ", he: true },
    { query: "התקפי זעמ", he: true },
  ])("matches the real Learn title for $query", ({ query, he }) => {
    expect(card).toBeDefined();
    expect(searchCatalog(query, 100).map((r) => r.id)).toContain(`learn:${card.id}`);
    expect(searchLearnCards(LEARN_CARDS, query, he).map((c) => c.id)).toContain(card.id);
    expect(matchesJournalFilter({ ...signal, refTitle: he ? card.title.he : card.title.en }, context(query))).toBe(true);
  });

  it.each(["", " \t\n ", "\u05B0\u05B7\u0301"])("preserves each surface's empty-query policy (%j)", (query) => {
    expect(searchCatalog(query)).toEqual([]);
    for (const he of [false, true]) expect(searchLearnCards(LEARN_CARDS, query, he) === LEARN_CARDS).toBe(true);
    expect(matchesJournalFilter(signal, context(query))).toBe(true);
    // Normalizing to empty must not bypass either selected Journal filter.
    expect(matchesJournalFilter(signal, context(query, { filter: "hard" }))).toBe(false);
    expect(matchesJournalFilter(signal, context(query, { filter: "kept" }))).toBe(false);
    expect(matchesJournalFilter(signal, context(query, { filter: "kept", keptIds: new Set([signal.id]) }))).toBe(true);
  });

  it("keeps misses empty across all three consumers", () => {
    const query = "no-such-search-result-xyzzy";
    expect(searchCatalog(query)).toEqual([]);
    for (const he of [false, true]) expect(searchLearnCards(LEARN_CARDS, query, he)).toEqual([]);
    expect(matchesJournalFilter({ ...signal, refTitle: card.title.en }, context(query))).toBe(false);
  });

  it.each(["journal", "consult", "learn"] as const)("keeps the current %s destination and place in both languages", (tab) => {
    const row = getSearchIndex().find((entry) => entry.id === `route:${tab}`)!;
    expect(row).toBeDefined();
    const place = placeForTab(tab);
    for (const lang of ["en", "he"] as const) {
      const first = searchCatalog(row.title[lang])[0];
      expect(first?.id).toBe(row.id);
      expect(first?.tab).toBe(tab);
      expect(first?.sub).toEqual({ en: place.en, he: place.he });
    }
  });
});

describe("Journal · normalize every local field, without indexing records", () => {
  const fields = ["label", "refTitle", "detail", "trigger", "response", "notes"] as const;
  it.each(fields)("matches niqqud/final letters in %s in either direction", (field) => {
    for (const [text, query] of [["שָׁלוֹם", "שלומ"], ["שלומ", "שָׁלוֹם"], ["Café", "CAFE"], ["CAFE", "café"], ["ך ם ן ף ץ", "כ מ נ פ צ"], ["כ מ נ פ צ", "ך ם ן ף ץ"]]) {
      const row = { ...signal, ...(field === "refTitle" || field === "detail" ? { [field]: text } : {}) };
      const log = { behaviorType: "Moment", trigger: "", response: "", notes: "", [field]: text };
      const ctx = context(query, {
        labelOf: () => field === "label" ? text : "",
        logsById: new Map([["search-fixture", log]]),
      });
      expect(matchesJournalFilter(row, ctx), `${field}: ${text} / ${query}`).toBe(true);
    }
  });

  it("keeps substring matching and field boundaries, without changing the local record", () => {
    const row = Object.freeze({ ...signal, refTitle: "Shoes", detail: "after school" });
    expect(matchesJournalFilter(row, context("HOE"))).toBe(true);
    expect(matchesJournalFilter(row, context("shoes after"))).toBe(false);
    expect(row.refTitle).toBe("Shoes");
  });

  it.each(["שָׁלוֹם", "\u05B0\u05B7\u0301"])("keeps all Journal facets when a query matches or normalizes to empty (%j)", (query) => {
    const logsById: JournalFilterContext["logsById"] = new Map([["search-fixture", {
      behaviorType: "Transition Refusal", trigger: "שלומ", response: "", notes: "", intensity: 3, resolved: false,
    }]]);
    const matching = context(query, { logsById, filter: "hard", type: "Transition Refusal", intensity: "3", status: "open" });
    expect(matchesJournalFilter(signal, matching)).toBe(true);
    for (const facet of [{ type: "Sleep Meltdown" }, { intensity: "5" }, { status: "resolved" }]) {
      expect(matchesJournalFilter(signal, { ...matching, ...facet })).toBe(false);
    }
    expect(matchesJournalFilter(signal, { ...matching, filter: "kept" })).toBe(false);
    expect(matchesJournalFilter(signal, { ...matching, filter: "kept", keptIds: new Set([signal.id]) })).toBe(true);
    expect(matchesJournalFilter({ ...signal, id: "moment-missing" }, matching)).toBe(false);
    expect(matchesJournalFilter(signal, { ...matching, logsById: new Map([["search-fixture", {
      ...logsById.get("search-fixture")!, behaviorType: "Moment",
    }]]) })).toBe(false);
  });

  it("a locally matched private note does not become static catalog metadata", () => {
    const query = "private-journal-search-fixture-8e31";
    const index = getSearchIndex();
    const snapshot = JSON.stringify(index);
    expect(searchCatalog(query)).toEqual([]);
    expect(matchesJournalFilter(signal, context(query, {
      logsById: new Map([["search-fixture", { behaviorType: "Moment", trigger: "", response: "", notes: query }]]),
    }))).toBe(true);
    expect(getSearchIndex()).toBe(index);
    expect(JSON.stringify(index)).toBe(snapshot);
    expect(searchCatalog(query)).toEqual([]);
  });
});

describe("Learn · locale and field scope stay unchanged", () => {
  const blank = { en: "", he: "" };
  const emptyCard: LearnCard = { ...card, title: blank, hook: blank, keyPoints: [] };

  it.each(["title", "hook", "keyPoints"] as const)("normalizes stored text and queries in %s", (field) => {
    for (const [text, query, he] of [
      ["Café", "CAFE", false], ["CAFE", "café", false],
      ["שָׁלוֹם", "שלומ", true], ["שלומ", "שָׁלוֹם", true],
      ["ך ם ן ף ץ", "כ מ נ פ צ", true], ["כ מ נ פ צ", "ך ם ן ף ץ", true],
    ] as const) {
      const pair = he ? { en: "", he: text } : { en: text, he: "" };
      const fixture: LearnCard = { ...emptyCard, [field]: field === "keyPoints" ? [pair] : pair };
      expect(searchLearnCards([fixture], query, he).map((c) => c.id)).toEqual([fixture.id]);
      expect(searchLearnCards([fixture], query, !he)).toEqual([]);
    }
  });

  it("keeps input order, substring matching and existing searchable fields only", () => {
    const first = { ...emptyCard, id: "first", title: { en: "Shoes", he: "נעליים" } };
    const second = { ...first, id: "second" };
    const cards = [first, second];
    expect(searchLearnCards(cards, "HOE", false)).toEqual(cards);
    expect(searchLearnCards(cards, "נעליימ", false)).toEqual([]);
    expect(searchLearnCards(cards, "SHOES", true)).toEqual([]);
    expect(searchLearnCards([{ ...first, hook: { en: "after school", he: "" } }], "shoes after", false)).toEqual([]);
    const hiddenText = { en: "search-only-in-excluded-field", he: "חיפוש-רק-בשדה-מוחרג" };
    const hidden = { ...emptyCard, body: hiddenText, ask: hiddenText, tryToday: hiddenText };
    expect(searchLearnCards([hidden], hiddenText.en, false)).toEqual([]);
    expect(searchLearnCards([hidden], hiddenText.he, true)).toEqual([]);
  });
});

describe("Local search · meaningful punctuation is not an empty query", () => {
  it.each(["־", "׀", "׃", "׆", "׳", "״", "+", "❤️"])("requires the searched symbol %s to be present", (query) => {
    const withSymbol = `אב${query}גד`;
    const withoutSymbol = "אבגד";
    expect(matchesJournalFilter({ ...signal, refTitle: withSymbol }, context(query))).toBe(true);
    expect(matchesJournalFilter({ ...signal, refTitle: withoutSymbol }, context(query))).toBe(false);
    for (const he of [false, true]) {
      const localCards: LearnCard[] = [
        { ...card, id: "with-symbol", title: { en: withSymbol, he: withSymbol }, hook: { en: "", he: "" }, keyPoints: [] },
        { ...card, id: "without-symbol", title: { en: withoutSymbol, he: withoutSymbol }, hook: { en: "", he: "" }, keyPoints: [] },
      ];
      expect(searchLearnCards(localCards, query, he).map((entry) => entry.id)).toEqual(["with-symbol"]);
    }
  });
});
