/**
 * AI-03 — card retrieval is keyed on something the routes actually have.
 *
 * The defect: /chat and /council both passed
 *   { ageBand: childProfile?.ageBand, domains: childProfile?.domains }
 * to `retrieveKnowledgeCards`. Neither field exists on `ChildProfile` and no
 * client has ever put them on the wire, so both were permanently `undefined`,
 * `filterKnowledgeCards` skipped its age and domain filters, and every parent
 * got the SAME cards in the same order regardless of the child or the question.
 *
 * The negative control below is the load-bearing test: it drives the PRE-fix
 * key shape against real cards and proves a 6-month-old and a 10-year-old were
 * grounded identically. Every positive assertion is measured against that.
 */
import { describe, expect, it } from "vitest";
import { loadKnowledgeCards, filterKnowledgeCards } from "./wiki.js";
import {
  ageBandForMonths,
  domainsFromProfileGoals,
  domainsFromQuestion,
  retrievalKeysFor,
} from "./retrievalKeys.js";

const BABY = { id: "a", name: "A", age: 0, ageMonths: 6 };
const TEEN = { id: "b", name: "B", age: 10 };

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("AI-03 negative control — the pre-fix key shape grounded every child identically", () => {
  it("childProfile.ageBand / childProfile.domains are absent from the profile type at runtime", () => {
    expect((BABY as Record<string, unknown>).ageBand).toBeUndefined();
    expect((BABY as Record<string, unknown>).domains).toBeUndefined();
  });

  it("the OLD call returns the same cards for a 6-month-old and a 10-year-old", async () => {
    const cards = await loadKnowledgeCards();
    expect(cards.length).toBeGreaterThan(0); // guard: an empty corpus would pass vacuously
    const oldCall = (profile: Record<string, unknown>) =>
      ids(
        filterKnowledgeCards(cards, {
          ageBand: profile.ageBand as string | undefined,
          domains: Array.isArray(profile.domains) ? (profile.domains as string[]) : undefined,
          allowedUse: "coach_context",
          limit: 4,
        }),
      );
    expect(oldCall(BABY as never)).toEqual(oldCall(TEEN as never));
  });
});

describe("AI-03 — the derived keys actually differentiate", () => {
  it("a 6-month-old and a 10-year-old no longer get the same cards", async () => {
    const cards = await loadKnowledgeCards();
    const newCall = (profile: unknown, message: string) =>
      ids(
        filterKnowledgeCards(cards, {
          ...retrievalKeysFor(profile, message),
          allowedUse: "coach_context",
          limit: 4,
        }),
      );
    const babyCards = newCall(BABY, "she cries at every nap and I cannot calm her");
    const teenCards = newCall(TEEN, "homework is a battle, he cannot focus for ten minutes");
    expect(babyCards.length).toBeGreaterThan(0);
    expect(teenCards.length).toBeGreaterThan(0);
    expect(babyCards).not.toEqual(teenCards);
  });

  it("the age key really filters: every card returned declares the child's band", async () => {
    const cards = await loadKnowledgeCards();
    const keys = retrievalKeysFor(BABY, "she cries at every nap");
    expect(keys.ageBand).toBe("0-12m");
    for (const card of filterKnowledgeCards(cards, { ...keys, allowedUse: "coach_context", limit: 5 })) {
      expect(card.age_bands).toContain("0-12m");
    }
  });

  it("a question that matches no keyword still retrieves cards (degrades, never empties)", async () => {
    const cards = await loadKnowledgeCards();
    const keys = retrievalKeysFor(TEEN, "zzzzz");
    expect(keys.domains).toBeUndefined();
    expect(
      filterKnowledgeCards(cards, { ...keys, allowedUse: "coach_context", limit: 4 }).length,
    ).toBeGreaterThan(0);
  });
});

describe("AI-03 — ageBandForMonths buckets onto the card vocabulary", () => {
  it.each([
    [0, "0-12m"],
    [11, "0-12m"],
    [12, "12-36m"],
    [35, "12-36m"],
    [36, "3-5y"],
    [71, "3-5y"],
    [72, "6-8y"],
    [107, "6-8y"],
    [108, "9-12y"],
    [200, "9-12y"], // clamps up rather than returning nothing
  ])("%i months → %s", (months, band) => {
    expect(ageBandForMonths(months)).toBe(band);
  });

  it("returns undefined (not a guess) when there is no age", () => {
    expect(ageBandForMonths(null)).toBeUndefined();
    expect(ageBandForMonths(undefined)).toBeUndefined();
    expect(ageBandForMonths(Number.NaN)).toBeUndefined();
    expect(retrievalKeysFor({ id: "x", name: "X" }, "hello").ageBand).toBeUndefined();
  });
});

describe("AI-03 — domain derivation", () => {
  it("reads the parent's own question, in English and Hebrew", () => {
    expect(domainsFromQuestion("bedtime ends in a meltdown")).toContain("attachment_regulation");
    expect(domainsFromQuestion("he cannot focus on homework")).toContain("cognition_executive_function");
    expect(domainsFromQuestion("הוא לא מדבר הרבה מילים")).toContain("language_communication");
    expect(domainsFromQuestion("הם רבים עם החברים בגן")).toContain("social_development");
  });

  it("returns nothing for an empty or unmatched question", () => {
    expect(domainsFromQuestion("")).toEqual([]);
    expect(domainsFromQuestion(undefined)).toEqual([]);
    expect(domainsFromQuestion("zzzzz")).toEqual([]);
  });

  it("folds in the parent's selected goal domains", () => {
    expect(domainsFromProfileGoals({ activeGoals: [{ label: "g", domainId: "language" }] })).toEqual([
      "language_communication",
    ]);
    expect(domainsFromProfileGoals({ activeGoals: [{ label: "g" }] })).toEqual([]);
    expect(domainsFromProfileGoals({})).toEqual([]);
  });

  it("the question leads and duplicates collapse", () => {
    const keys = retrievalKeysFor(
      { id: "x", name: "X", age: 4, activeGoals: [{ label: "g", domainId: "regulation" }] },
      "he cannot focus on homework",
    );
    expect(keys.domains).toEqual(["cognition_executive_function", "attachment_regulation"]);
  });
});
