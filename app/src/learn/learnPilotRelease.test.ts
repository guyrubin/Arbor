import { describe, expect, it } from "vitest";
import { LEARN_CARDS } from "./learnCards";
import { LEARN_CARDS_CORE } from "./learnCardsCore";
import { LEARN_CARDS_MORE } from "./learnCardsMore";
import { LEARN_CARDS_BATCH2A } from "./learnCardsBatch2a";
import { LEARN_CARDS_BATCH2B } from "./learnCardsBatch2b";
import { LEARN_CARDS_BATCH2C } from "./learnCardsBatch2c";
import { LEARN_CARDS_BATCH3A } from "./learnCardsBatch3a";
import { LEARN_CARDS_BATCH3B } from "./learnCardsBatch3b";
import { LEARN_CARDS_BATCH3C } from "./learnCardsBatch3c";
import { LEARN_CARDS_BATCH4A } from "./learnCardsBatch4a";
import { LEARN_CARDS_BATCH4B } from "./learnCardsBatch4b";
import {
  LEARN_PILOT, computeLearnDigest, isLearnPilotCard, isLearnPilotPublishable,
  learnPilotText, publishedLearnPilotCards, type LearnPilotRelease,
} from "./learnPilotRelease";
import type { LearnCard } from "./learnLibrary";

/**
 * LL-B4 release contract. This replaces the pre-GD-10 blanket dark guard, which
 * only asserted the cards were unreachable and therefore proved nothing about
 * them. These tests constrain what an actual parent can reach.
 */

const BATCH4 = [...LEARN_CARDS_BATCH4A, ...LEARN_CARDS_BATCH4B];
const PRIOR = [
  ...LEARN_CARDS_CORE, ...LEARN_CARDS_MORE,
  ...LEARN_CARDS_BATCH2A, ...LEARN_CARDS_BATCH2B, ...LEARN_CARDS_BATCH2C,
  ...LEARN_CARDS_BATCH3A, ...LEARN_CARDS_BATCH3B, ...LEARN_CARDS_BATCH3C,
];
/** Inside the release window by construction — never the wall clock. */
const INSIDE = new Date(Date.parse(LEARN_PILOT.availableFrom) + 60_000);
const IDS = [
  "cognitive-flexibility", "early-number-sense", "metacognition-learning",
  "storytelling-development", "childhood-disfluency", "frustration-tolerance",
  "childhood-jealousy", "handling-disappointment", "logical-consequences",
  "boundary-testing", "chores-by-development", "sleep-environment",
  "travel-sleep", "rough-and-tumble-play", "board-games-learning",
  "nature-play", "creative-screen-use", "child-digital-privacy",
];
const find = (id: string) => BATCH4.find((c) => c.id === id)!;
const withRelease = (patch: Partial<LearnPilotRelease>): LearnPilotRelease =>
  ({ ...LEARN_PILOT, ...patch }) as LearnPilotRelease;

describe("LL-B4 pilot membership", () => {
  it("the manifest names exactly the 18 authored batch-4 cards", () => {
    expect(Object.keys(LEARN_PILOT.entries).sort()).toEqual([...IDS].sort());
    expect(BATCH4.map((c) => c.id).sort()).toEqual([...IDS].sort());
    expect(LEARN_CARDS_BATCH4A).toHaveLength(9);
    expect(LEARN_CARDS_BATCH4B).toHaveLength(9);
  });

  it("every batch-4 card publishes inside the window, and reaches the live registry", () => {
    for (const id of IDS) {
      expect(isLearnPilotPublishable(find(id), INSIDE), `${id} must publish`).toBe(true);
      expect(isLearnPilotCard(id)).toBe(true);
    }
    const live = new Set(LEARN_CARDS.map((c) => c.id));
    for (const id of IDS) expect(live.has(id), `${id} must be reachable`).toBe(true);
  });

  it("the registry grows by exactly the pilot, with no duplicate ids", () => {
    expect(LEARN_CARDS).toHaveLength(PRIOR.length + IDS.length);
    expect(new Set(LEARN_CARDS.map((c) => c.id)).size).toBe(LEARN_CARDS.length);
    for (const card of PRIOR) expect(LEARN_CARDS).toContain(card);
  });

  it("a card outside the manifest never publishes, whatever the caller supplies", () => {
    const intruder = { ...find("nature-play"), id: "not-in-the-pilot" } as LearnCard;
    expect(isLearnPilotPublishable(intruder, INSIDE)).toBe(false);
    expect(isLearnPilotPublishable(intruder, INSIDE, withRelease({
      entries: { ...LEARN_PILOT.entries, "not-in-the-pilot": computeLearnDigest(intruder) },
    }))).toBe(false);
    expect(isLearnPilotCard("not-in-the-pilot")).toBe(false);
  });
});

describe("LL-B4 the digest binds copy AND applicability", () => {
  it("editing any reader-visible string drops the card", () => {
    const card = find("sleep-environment");
    const edits: Partial<LearnCard>[] = [
      { title: { ...card.title, en: "Sleep, rewritten" } },
      { hook: { ...card.hook, he: "טקסט אחר" } },
      { body: { ...card.body, en: card.body.en + " One more sentence." } },
      { tryToday: { ...card.tryToday, en: "Do something else." } },
      { ask: { ...card.ask, he: "שאלה אחרת" } },
      { keyPoints: [{ ...card.keyPoints[0], en: "Different point." }, ...card.keyPoints.slice(1)] },
    ];
    for (const edit of edits) {
      expect(isLearnPilotPublishable({ ...card, ...edit }, INSIDE), JSON.stringify(Object.keys(edit))).toBe(false);
    }
  });

  it("widening who a card is shown to drops it", () => {
    const card = find("creative-screen-use");
    expect(isLearnPilotPublishable({ ...card, ageMin: 0 }, INSIDE)).toBe(false);
    expect(isLearnPilotPublishable({ ...card, ageMax: 18 }, INSIDE)).toBe(false);
    expect(isLearnPilotPublishable({ ...card, concerns: ["sleep"] } as LearnCard, INSIDE)).toBe(false);
    expect(isLearnPilotPublishable({ ...card, domains: ["attachment_regulation"] }, INSIDE)).toBe(false);
  });

  it("a nonsensical age window is refused even if the digest were re-cut", () => {
    const card = { ...find("nature-play"), ageMin: 9, ageMax: 2 };
    const release = withRelease({ entries: { ...LEARN_PILOT.entries, "nature-play": computeLearnDigest(card) } });
    expect(isLearnPilotPublishable(card, INSIDE, release)).toBe(false);
  });

  it("an incomplete bilingual card is refused even if the digest were re-cut", () => {
    const base = find("travel-sleep");
    const broken: LearnCard[] = [
      { ...base, hook: { ...base.hook, he: "   " } },
      { ...base, body: { ...base.body, en: "" } },
      { ...base, keyPoints: base.keyPoints.slice(0, 4) },
    ];
    for (const card of broken) {
      const release = withRelease({ entries: { ...LEARN_PILOT.entries, "travel-sleep": computeLearnDigest(card) } });
      expect(isLearnPilotPublishable(card, INSIDE, release)).toBe(false);
    }
  });
});

describe("LL-B4 withdrawal, expiry and release tampering", () => {
  it("withdrawal removes a card and cannot be undone by the caller", () => {
    const card = find("boundary-testing");
    expect(isLearnPilotPublishable(card, INSIDE, withRelease({ withdrawnIds: ["boundary-testing"] }))).toBe(false);
    // A caller cannot re-admit a card the shipped manifest has withdrawn.
    expect(publishedLearnPilotCards(BATCH4, INSIDE, withRelease({ withdrawnIds: ["boundary-testing"] })))
      .not.toContainEqual(card);
  });

  it("nothing publishes before the window opens or after it expires", () => {
    const before = new Date(Date.parse(LEARN_PILOT.availableFrom) - 1);
    const after = new Date(Date.parse(LEARN_PILOT.expiresAt));
    expect(publishedLearnPilotCards(BATCH4, before)).toHaveLength(0);
    expect(publishedLearnPilotCards(BATCH4, after)).toHaveLength(0);
    expect(publishedLearnPilotCards(BATCH4, new Date(Number.NaN))).toHaveLength(0);
    expect(publishedLearnPilotCards(BATCH4, INSIDE)).toHaveLength(IDS.length);
  });

  it("a substituted release cannot widen, relabel, or reschedule the pilot", () => {
    const card = find("nature-play");
    const tampered: Partial<LearnPilotRelease>[] = [
      { status: "withdrawn" },
      { id: "some-other-release" },
      { kind: "clinical-review" as unknown as "editorial-pilot" },
      { availableFrom: "2020-01-01T00:00:00.000Z" },
      { expiresAt: "2099-01-01T00:00:00.000Z" },
      { entries: { ...LEARN_PILOT.entries, "nature-play": "fnv1a64:0000000000000000" } },
    ];
    for (const patch of tampered) {
      expect(isLearnPilotPublishable(card, INSIDE, withRelease(patch)), JSON.stringify(patch)).toBe(false);
    }
  });
});

describe("LL-B4 honesty of the pilot label", () => {
  it("the label says pilot and explicitly denies individual clinical review", () => {
    for (const locale of ["en", "he"] as const) {
      const copy = learnPilotText(locale);
      expect(copy.status.trim().length).toBeGreaterThan(0);
      expect(copy.note.trim().length).toBeGreaterThan(0);
    }
    expect(learnPilotText("en").note).toMatch(/not had individual clinical review/i);
    expect(learnPilotText("he").note).toContain("לא עברה בדיקה קלינית פרטנית");
  });

  it("no pilot card claims clinical endorsement, and none names a reviewer", () => {
    const banned = [
      /clinically (validated|approved|reviewed)/i,
      /clinician[- ]approved/i,
      /doctor[- ]recommended/i,
      /medically (approved|endorsed)/i,
      /\bDr\.?\s/,
      /אושר קלינית/,
      /ד"ר\s/,
    ];
    for (const card of BATCH4) {
      const text = JSON.stringify([card.title, card.hook, card.keyPoints, card.body, card.tryToday, card.ask]);
      for (const pattern of banned) {
        expect(pattern.test(text), `${card.id} matched ${pattern}`).toBe(false);
      }
    }
  });

  it("the release records itself as editorial, never as a clinical review", () => {
    expect(LEARN_PILOT.kind).toBe("editorial-pilot");
    expect(JSON.stringify(LEARN_PILOT)).not.toMatch(/reviewedBy|clinicalReview|approvedBy/i);
  });
});
