import { describe, expect, it } from "vitest";
import {
  LEARN_CATEGORIES,
  bestCardForDomain,
  cardConcerns,
  concernsContributed,
  learnCardScore,
  matchLearnCards,
  rankLearnCards,
  searchLearnCards,
} from "./learnLibrary";
import { LEARN_CARDS, learnCardById } from "./learnCards";

describe("Learn Library catalogue integrity", () => {
  it("has unique ids, 5 key points, and full EN+HE on every card", () => {
    const seen = new Set<string>();
    for (const card of LEARN_CARDS) {
      expect(seen.has(card.id), `duplicate id ${card.id}`).toBe(false);
      seen.add(card.id);
      expect(card.keyPoints, card.id).toHaveLength(5);
      for (const field of [card.title, card.hook, card.body, card.tryToday, card.ask, ...card.keyPoints]) {
        expect(field.en.trim().length, `${card.id} en`).toBeGreaterThan(0);
        expect(field.he.trim().length, `${card.id} he`).toBeGreaterThan(0);
      }
      expect(card.ageMin).toBeLessThanOrEqual(card.ageMax);
      expect(card.minutes).toBeGreaterThan(0);
    }
  });

  it("every card belongs to a declared category and covers only known domains", () => {
    const catIds = new Set(LEARN_CATEGORIES.map((c) => c.id));
    const knownDomains = new Set(LEARN_CATEGORIES.flatMap((c) => c.domains));
    for (const card of LEARN_CARDS) {
      expect(catIds.has(card.category), card.id).toBe(true);
      expect(card.domains.length, card.id).toBeGreaterThan(0);
      for (const d of card.domains) expect(knownDomains.has(d), `${card.id} → ${d}`).toBe(true);
    }
  });

  it("every framework domain used by categories has at least one card (doors never dead-end)", () => {
    for (const domain of new Set(LEARN_CATEGORIES.flatMap((c) => c.domains))) {
      expect(bestCardForDomain(LEARN_CARDS, domain, 4), domain).toBeDefined();
    }
  });
});

describe("explainable ranking", () => {
  const base = { ageYears: null, focusDomain: null };

  it("age window beats near-window beats out-of-window", () => {
    const card = LEARN_CARDS.find((c) => c.id === "theory-of-mind")!; // ages 3-6
    expect(learnCardScore(card, { ...base, ageYears: 4 })).toBeGreaterThan(
      learnCardScore(card, { ...base, ageYears: 7 })
    );
    expect(learnCardScore(card, { ...base, ageYears: 7 })).toBeGreaterThan(
      learnCardScore(card, { ...base, ageYears: 10 })
    );
  });

  it("focus domain adds rank as opportunity signal", () => {
    const card = LEARN_CARDS.find((c) => c.domains.includes("attachment_regulation"))!;
    expect(learnCardScore(card, { ...base, focusDomain: "attachment_regulation" })).toBe(
      learnCardScore(card, base) + 3
    );
  });

  it("observed concerns lift matching cards, capped, and never rank without overlap", () => {
    const sleepCard = LEARN_CARDS.find((c) => c.id === "sleep-regressions")!;
    const withConcern = learnCardScore(sleepCard, { ...base, recentConcerns: ["sleep"] });
    expect(withConcern).toBe(learnCardScore(sleepCard, base) + 2);
    expect(concernsContributed(sleepCard, ["sleep"])).toBe(true);
    expect(concernsContributed(sleepCard, ["aggression"])).toBe(false);
    // cap: even many overlapping concerns add at most 4
    const capped = learnCardScore(sleepCard, { ...base, recentConcerns: cardConcerns(sleepCard) });
    expect(capped - learnCardScore(sleepCard, base)).toBeLessThanOrEqual(4);
  });

  it("helpful pulse nudges, unhelpful demotes harder (parent's own signal wins ties)", () => {
    const card = LEARN_CARDS[0];
    expect(learnCardScore(card, { ...base, helpfulness: { [card.id]: 1 } })).toBe(
      learnCardScore(card, base) + 1
    );
    expect(learnCardScore(card, { ...base, helpfulness: { [card.id]: -1 } })).toBe(
      learnCardScore(card, base) - 2
    );
  });

  it("rankLearnCards is stable for equal scores (catalogue order preserved)", () => {
    const ranked = rankLearnCards(LEARN_CARDS, base);
    expect(ranked.map((c) => c.id)).toEqual(LEARN_CARDS.map((c) => c.id));
  });
});

describe("context matching (coach chips, hard-moment door)", () => {
  it("matches on concern overlap and returns nothing without signal", () => {
    const matches = matchLearnCards(LEARN_CARDS, { concerns: ["sleep"] }, 2);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) expect(cardConcerns(m)).toContain("sleep");
    expect(matchLearnCards(LEARN_CARDS, { concerns: [] }, 2)).toHaveLength(0);
    expect(matchLearnCards(LEARN_CARDS, {}, 2)).toHaveLength(0);
  });

  it("domain overlap outranks concern overlap", () => {
    const domainMatch = matchLearnCards(
      LEARN_CARDS,
      { domains: ["sensory_motor_patterns"], concerns: ["sleep"] },
      1
    )[0];
    expect(domainMatch.domains).toContain("sensory_motor_patterns");
  });
});

describe("search + lookup", () => {
  it("locale-aware search hits titles in both languages", () => {
    expect(searchLearnCards(LEARN_CARDS, "tantrum", false).length).toBeGreaterThan(0);
    expect(searchLearnCards(LEARN_CARDS, "שינה", true).length).toBeGreaterThan(0);
  });
  it("learnCardById resolves every catalogue id and rejects unknowns", () => {
    for (const c of LEARN_CARDS) expect(learnCardById(c.id)).toBe(c);
    expect(learnCardById("no-such-card")).toBeUndefined();
  });
});
