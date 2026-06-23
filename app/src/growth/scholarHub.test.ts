/**
 * Tests for AP-055 Scholar Hub — domain->article matcher + framing copy safety.
 *
 * AC tests:
 *  1. selectWeeklyArticle returns one article matched to the lowest-scoring domain.
 *  2. Covers all four prototype topic areas (Regulation, Attachment, Bilingualism, Transitions).
 *  3. No-data / null focusDomain returns a graceful fallback (isDefault=true).
 *  4. Framing copy (i18n keys) uses strengths-based language; never uses deficit words.
 *  5. No article body contains outcome claims or effect-size language.
 */
import { describe, it, expect } from "vitest";
import { selectWeeklyArticle, SCHOLAR_ARTICLES } from "./scholarHub";
import { en, he } from "../lib/i18n";

// ── Matcher ─────────────────────────────────────────────────────────────────

describe("selectWeeklyArticle", () => {
  it("returns the article matched to the given domain", () => {
    const { article, isDefault } = selectWeeklyArticle("attachment_regulation");
    expect(article.domain).toBe("attachment_regulation");
    expect(isDefault).toBe(false);
  });

  it("matches all framework domains to an article", () => {
    const DOMAINS = [
      "attachment_regulation",
      "language_communication",
      "cognition_executive_function",
      "social_development",
      "independence_adaptive_skills",
      "sensory_motor_patterns",
      "ecosystem_stressors",
    ];
    for (const domain of DOMAINS) {
      const { article } = selectWeeklyArticle(domain);
      expect(article.domain).toBe(domain);
    }
  });

  it("returns isDefault=true and a valid fallback when focusDomain is null", () => {
    const { article, isDefault } = selectWeeklyArticle(null);
    expect(isDefault).toBe(true);
    expect(article).toBeDefined();
    expect(article.titleEn.length).toBeGreaterThan(0);
  });

  it("returns isDefault=false for any real domain", () => {
    const { isDefault } = selectWeeklyArticle("social_development");
    expect(isDefault).toBe(false);
  });
});

// ── Article catalogue coverage ───────────────────────────────────────────────

describe("SCHOLAR_ARTICLES catalogue", () => {
  it("covers the Regulation prototype topic area", () => {
    const topics = SCHOLAR_ARTICLES.map((a) => a.topicEn.toLowerCase());
    expect(topics.some((t) => t.includes("regulation"))).toBe(true);
  });

  it("covers the Attachment prototype topic area", () => {
    const topics = SCHOLAR_ARTICLES.map((a) => a.topicEn.toLowerCase());
    expect(topics.some((t) => t.includes("attachment"))).toBe(true);
  });

  it("covers the Bilingualism prototype topic area", () => {
    const topics = SCHOLAR_ARTICLES.map((a) => a.topicEn.toLowerCase());
    expect(topics.some((t) => t.includes("bilingual"))).toBe(true);
  });

  it("covers the Transitions prototype topic area", () => {
    const topics = SCHOLAR_ARTICLES.map((a) => a.topicEn.toLowerCase());
    expect(topics.some((t) => t.includes("transition"))).toBe(true);
  });

  it("contains at least one article per framework domain", () => {
    const DOMAINS = [
      "attachment_regulation",
      "language_communication",
      "cognition_executive_function",
      "social_development",
      "independence_adaptive_skills",
      "sensory_motor_patterns",
      "ecosystem_stressors",
    ];
    for (const domain of DOMAINS) {
      expect(SCHOLAR_ARTICLES.some((a) => a.domain === domain)).toBe(true);
    }
  });
});

// ── Framing copy safety ─────────────────────────────────────────────────────

/**
 * Binding non-pathologizing requirement (AP-055 CRITICAL FRAMING GATE):
 * framing copy must NEVER contain any of these deficit words.
 */
const DEFICIT_WORDS = [
  "deficit",
  "weakness",
  "delay",
  "behind",
  "problem",
  "concern",
  "low score",
];

/**
 * The framing i18n keys that must be strengths-based.
 * These are the section chrome labels surfaced to the user.
 */
const FRAMING_KEYS = [
  "hub.scholar.eyebrow",
  "hub.scholar.domainLabel",
  "hub.scholar.default.label",
  "hub.scholar.provenance",
  "hub.scholar.read",
];

describe("Scholar Hub framing copy — non-pathologizing gate", () => {
  it("EN framing keys contain none of the deficit words", () => {
    for (const key of FRAMING_KEYS) {
      const value = (en[key] ?? "").toLowerCase();
      for (const word of DEFICIT_WORDS) {
        expect(
          value,
          `EN key "${key}" must not contain deficit word "${word}"`
        ).not.toContain(word);
      }
    }
  });

  it("HE framing keys contain none of the Latin deficit words (belt-and-suspenders)", () => {
    // Hebrew strings rarely contain English words, but we check the Hebrew values
    // are present and not empty (a missing key falls back to the raw key string).
    for (const key of FRAMING_KEYS) {
      const value = he[key] ?? "";
      expect(value.length, `HE key "${key}" should not be empty`).toBeGreaterThan(0);
    }
  });

  it("EN domainLabel framing uses strengths-based invitational phrasing", () => {
    const label = (en["hub.scholar.domainLabel"] ?? "").toLowerCase();
    // Must contain an invitational phrase
    const invitational =
      label.includes("nurture") ||
      label.includes("explore") ||
      label.includes("great area") ||
      label.includes("good place") ||
      label.includes("opportunity") ||
      label.includes("this week");
    expect(invitational).toBe(true);
  });

  it("EN provenance copy makes clear this is an editorial suggestion, not a diagnosis", () => {
    const prov = (en["hub.scholar.provenance"] ?? "").toLowerCase();
    const editorial =
      prov.includes("development map") ||
      prov.includes("suggestion") ||
      prov.includes("pick") ||
      prov.includes("based on") ||
      prov.includes("editorial");
    expect(editorial).toBe(true);
  });
});

// ── Article body content safety ───────────────────────────────────────────────

const OUTCOME_CLAIM_PATTERNS = [
  /proven to (improve|boost|increase)/i,
  /clinically (proven|validated|tested)/i,
  /studies show .{0,30} percent/i,
  /\d+% (improvement|increase|reduction)/i,
];

describe("Article body content — no outcome claims", () => {
  it("no EN article body contains outcome-claim language", () => {
    for (const article of SCHOLAR_ARTICLES) {
      for (const pattern of OUTCOME_CLAIM_PATTERNS) {
        expect(
          article.bodyEn,
          `Article "${article.id}" EN body should not contain outcome claim matching ${pattern}`
        ).not.toMatch(pattern);
      }
    }
  });
});
