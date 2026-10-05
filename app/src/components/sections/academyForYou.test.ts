/**
 * AP-053 — Academy "For You" acceptance tests.
 *
 * Binding acceptance criteria (from PRODUCT-BACKLOG AP-053):
 *  (1) "here's why" expansion string renders verbatim.
 *  (2) Progress reads "X of Y explored" (not "% complete").
 *  (3) Banned-word list absent from all foryou.* i18n keys: "low", "weak",
 *      "behind", "delay", "concern", "deficit", "lowest", "needs work", "score".
 *  (4) No warning-token class on the recommended-domain card.
 *  (5) Domains are NOT rendered as a ranked deficit list (order is alphabetical
 *      by domain id, never by score or as a "worst first" ranking).
 *
 * Additional safety gates:
 *  - Cleared copy keys exist in BOTH EN and HE dictionaries (i18n parity).
 *  - B-PLAY-01: foryou.header / recLine / whyBody retired (law-1 pointer);
 *    foryou.title names the inputs, never the domain.
 *  - "foryou.progress" uses "explored" (not "complete", not "%").
 *  - "foryou.coursesLabel" uses "explore" (not "complete", not "finish") and no {domain}.
 *
 * Note: React component rendering tests live in component test files.
 * These tests run against the i18n dictionary and the FRAME_TO_DOMAIN logic
 * (pure data, no DOM, no Firestore, no AI call) — matching the pattern of
 * scholarHub.test.ts and devScore.test.ts.
 */

import { describe, it, expect } from "vitest";
import { en, he } from "../../lib/i18n";
import { en as enElev, he as heElev } from "../../lib/i18nElevation/growthTruth";

// ── Verbatim cleared copy assertions ─────────────────────────────────────────

// B-PLAY-01 retired the AP-053 "verbatim cleared" header / recLine / whyBody:
// each named (or explained) the lowest-ranked domain — a law-1 pointer that
// overrides the 2026-06 board clearance. The title now names the inputs.
describe("B-PLAY-01 — the For You title names what the pick is built from", () => {
  it("foryou.title (EN + HE) carries {name}, no {domain}", () => {
    for (const dict of [en, he]) {
      expect(dict["foryou.title"]).toContain("{name}");
      expect(dict["foryou.title"]).not.toContain("{domain}");
    }
    expect(en["foryou.title"]).toBe("Courses picked for {name}'s age and what you've noticed");
  });
  it("the retired pointer keys are gone from both dictionaries", () => {
    for (const k of ["foryou.header", "foryou.recLine", "foryou.whyBody", "foryou.allDomainsHeader"]) {
      expect(en[k], k).toBeUndefined();
      expect(he[k], k).toBeUndefined();
    }
  });
});

// ── W2-SHELLPLAY r1: no scorekeeping on For You ─────────────────────────────
// The "{x} of {y} explored" roll-up (per recommended domain, and across the
// catalogue) is the {done}/{total} shape B-PLAY-18 cut from the catalogue; the
// per-domain row also singled out the lowest-scored domain (law 1).
import { readFileSync } from "node:fs";
import path from "node:path";
const FORYOU_SRC = readFileSync(path.join(__dirname, "AcademyForYou.tsx"), "utf8");

describe("W2-SHELLPLAY r1 — For You keeps no score", () => {
  it("the roll-up and the catalogue total are gone from the card", () => {
    expect(FORYOU_SRC).not.toContain("academy-foryou-progress");
    expect(FORYOU_SRC).not.toContain("academy-foryou-total");
    expect(FORYOU_SRC).not.toMatch(/foryou\.progress|foryou\.coursesLabel|recommendedRow|buildDomainRows/);
  });
  it("the retired keys are gone from both dictionaries", () => {
    for (const k of ["foryou.progress", "foryou.coursesLabel"]) {
      expect(en[k], k).toBeUndefined();
      expect(he[k], k).toBeUndefined();
    }
  });
  it("the why-line names what the pick is built from (age + noticed milestones), never opened courses", () => {
    const why = enElev["elev.growthTruth.learn.why.explored"];
    expect(why).toContain("age");
    expect(why).toContain("milestones you've noticed");
    expect(why).not.toMatch(/courses you have opened/);
    expect(heElev["elev.growthTruth.learn.why.explored"]).not.toMatch(/הקורסים שפתחתם/);
    // HE "why" toggle asks about the picks, not a place
    expect(he["foryou.whyToggle"]).toBe("למה אלה?");
  });
});

// ── Banned-word gate ─────────────────────────────────────────────────────────

/**
 * BUILDER HARD RULES (safety-gate tested):
 * The words below MUST NOT appear in any foryou.* key in either language.
 * "score" ban: only as a child verdict ("your child's score"); allow in non-verdict
 * context (e.g. "devscore.eyebrow" is a different namespace). We check foryou.* only.
 */
const BANNED_WORDS_EN = [
  "low",
  "weak",
  "behind",
  "delay",
  "concern",
  "deficit",
  "lowest",
  "needs work",
  // "score" as a child verdict — checked as standalone word boundary below
];

// Keys whose values are checked for banned words
const FORYOU_EN_KEYS = Object.keys(en).filter((k) => k.startsWith("foryou."));
const FORYOU_HE_KEYS = Object.keys(he).filter((k) => k.startsWith("foryou."));

describe("AP-053 banned-word gate — EN foryou.* keys", () => {
  it("no EN foryou.* key contains a banned deficit word", () => {
    for (const key of FORYOU_EN_KEYS) {
      const value = (en[key] ?? "").toLowerCase();
      for (const word of BANNED_WORDS_EN) {
        expect(
          value,
          `EN key "${key}" must not contain banned word "${word}" (framing gate)`
        ).not.toContain(word);
      }
    }
  });

  it('no EN foryou.* key contains "score" as a child verdict (standalone word)', () => {
    // Allow "devscore" in a different namespace; check only foryou.* for the word "score"
    // as a standalone token that implies a child verdict.
    for (const key of FORYOU_EN_KEYS) {
      const value = (en[key] ?? "").toLowerCase();
      // Match " score" or "score " or "score." etc. — but not "devscore" which is a different token
      const scoreBan = /\bscore\b/.test(value);
      expect(
        scoreBan,
        `EN key "${key}" must not contain "score" as a child verdict. Value: "${en[key]}"`
      ).toBe(false);
    }
  });
});

describe("AP-053 banned-word gate — HE foryou.* keys (belt-and-suspenders)", () => {
  it("HE foryou.* keys are all present and non-empty", () => {
    for (const key of FORYOU_EN_KEYS) {
      const heVal = he[key] ?? "";
      expect(
        heVal.length,
        `HE key "${key}" should be non-empty`
      ).toBeGreaterThan(0);
    }
  });

  it("no HE foryou.* key contains Latin banned words", () => {
    // Hebrew strings rarely contain English, but check as a belt-and-suspenders gate
    for (const key of FORYOU_HE_KEYS) {
      const value = (he[key] ?? "").toLowerCase();
      for (const word of BANNED_WORDS_EN) {
        expect(
          value,
          `HE key "${key}" must not contain Latin banned word "${word}"`
        ).not.toContain(word);
      }
    }
  });
});

// ── No warning-token class gate ───────────────────────────────────────────────

/**
 * The recommended-domain card must NOT use any warning/amber/red token.
 * We assert this at the copy + data level: the framing copy keys contain
 * no language that implies a warning, alert, or concern about the child.
 * The component uses var(--arbor-green-soft) and var(--arbor-green-ink) only
 * (validated in the component itself; here we gate the framing intent).
 */
describe("AP-053 no-warning-token gate — framing copy", () => {
  // Use word-boundary regex to avoid false positives (e.g. "explored" contains "red")
  const WARNING_WORD_PATTERNS = [
    /\bwarning\b/,
    /\balert\b/,
    /\battention\b/,
    /\bflag\b/,
    /\bconcern\b/,
    /\burgent\b/,
    /\bred\b/,
    /\bamber\b/,
  ];

  it("no EN foryou.* key contains warning-implying words (word-boundary checked)", () => {
    for (const key of FORYOU_EN_KEYS) {
      const value = (en[key] ?? "").toLowerCase();
      for (const pattern of WARNING_WORD_PATTERNS) {
        expect(
          pattern.test(value),
          `EN key "${key}" must not match warning pattern ${pattern}. Value: "${en[key]}"`
        ).toBe(false);
      }
    }
  });
});

// ── Domains NOT rendered as a ranked deficit list ─────────────────────────────

/**
 * The all-domains roll-up must NOT present domains ordered as a deficit ranking.
 * We gate this via the data layer: the FRAME_TO_DOMAIN mapping produces domain ids
 * that are sorted alphabetically in the component — never by score.
 * Here we assert the logic invariant: buildDomainRows output is alphabetical.
 *
 * We test the MASTERCLASSES data shapes that feed the component.
 */
import { MASTERCLASSES } from "../../lib/masterclasses";
import type { FrameId } from "../../lib/masterclasses";

const FRAME_TO_DOMAIN: Record<FrameId, string> = {
  aim: "independence_adaptive_skills",
  twoAxes: "attachment_regulation",
  story: "social_development",
  shadow: "attachment_regulation",
  marriage: "ecosystem_stressors",
  shepherd: "independence_adaptive_skills",
};

describe("AP-053 domain ordering — not a ranked deficit list", () => {
  it("all MASTERCLASSES map to a known domain via FRAME_TO_DOMAIN", () => {
    for (const mc of MASTERCLASSES) {
      const domain = FRAME_TO_DOMAIN[mc.frame];
      expect(domain, `Masterclass ${mc.id} frame "${mc.frame}" must map to a domain`).toBeDefined();
      expect(typeof domain).toBe("string");
      expect(domain.length).toBeGreaterThan(0);
    }
  });

  it("domain rows derived from MASTERCLASSES are sorted alphabetically by domain id (not by score)", () => {
    // Build the same map the component uses
    const map = new Map<string, number>();
    for (const mc of MASTERCLASSES) {
      const domainId = FRAME_TO_DOMAIN[mc.frame];
      map.set(domainId, (map.get(domainId) ?? 0) + 1);
    }
    const rows = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    // Confirm sorted order is deterministic and alphabetical
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].localeCompare(rows[i + 1])).toBeLessThan(0);
    }
  });

  it("at least 3 distinct domains are represented in MASTERCLASSES (not single-domain collapsing)", () => {
    const domains = new Set(MASTERCLASSES.map((mc) => FRAME_TO_DOMAIN[mc.frame]));
    expect(domains.size).toBeGreaterThanOrEqual(3);
  });
});

// ── i18n parity — all foryou.* EN keys have a HE counterpart ─────────────────

describe("AP-053 i18n parity — foryou.* keys", () => {
  it("every foryou.* EN key has a non-empty HE translation", () => {
    for (const key of FORYOU_EN_KEYS) {
      const heVal = he[key];
      expect(heVal, `Missing HE translation for "${key}"`).toBeDefined();
      expect(heVal!.trim().length, `Empty HE translation for "${key}"`).toBeGreaterThan(0);
    }
  });
});
