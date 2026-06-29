import { describe, expect, it } from "vitest";
import {
  ALL_MILESTONES,
  CDC_MILESTONES,
  ASHA_MILESTONES,
  ARBOR_EXTENDED_MILESTONES,
  correctedAge,
  comparisonAgeMonths,
  bandForAgeMonths,
  MILESTONE_AGE_BANDS,
} from "./milestoneData";
import type { DevelopmentalDomainId } from "../types";

// The four CDC domains map onto these Arbor domain ids.
const VALID_DOMAINS: DevelopmentalDomainId[] = [
  "attachment_regulation",
  "language_communication",
  "cognition_executive_function",
  "social_development",
  "independence_adaptive_skills",
  "sensory_motor_patterns",
  "ecosystem_stressors",
];

// The 12 CDC/AAP-2022 well-child checklist ages, in months.
const CDC_CHECKPOINTS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60];

describe("CDC/AAP-2022 milestone dataset", () => {
  it("covers all 12 CDC checklists at the canonical ages", () => {
    const ages = new Set(CDC_MILESTONES.map((m) => m.ageMonths));
    for (const cp of CDC_CHECKPOINTS) expect(ages.has(cp)).toBe(true);
    expect(ages.size).toBe(CDC_CHECKPOINTS.length);
  });

  it("holds a faithful share of the full CDC ~159-milestone set", () => {
    // CDC's 2022 tools total ~159 milestones across the 12 checklists; we carry
    // the representative items per checkpoint (several per domain at each age).
    expect(CDC_MILESTONES.length).toBeGreaterThanOrEqual(110);
    expect(CDC_MILESTONES.length).toBeLessThanOrEqual(170);
    // Every checkpoint carries a meaningful set, not a token one or two.
    for (const cp of CDC_CHECKPOINTS) {
      expect(CDC_MILESTONES.filter((m) => m.ageMonths === cp).length).toBeGreaterThanOrEqual(7);
    }
  });

  it("gives every milestone a stable id, valid domain, ageMonths, and both description fields", () => {
    for (const m of ALL_MILESTONES) {
      expect(m.id).toBeTruthy();
      expect(VALID_DOMAINS).toContain(m.domain);
      expect(typeof m.ageMonths).toBe("number");
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      // The "what the skill looks like" plain-language field.
      expect(m.skillLooksLike && m.skillLooksLike.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids", () => {
    const ids = ALL_MILESTONES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the domains the MILESTONE_DOMAIN_MAP relies on populated", () => {
    // signals.ts maps these four CDC domains into practice bands.
    for (const domain of ["language_communication", "cognition_executive_function", "social_development", "attachment_regulation"] as const) {
      expect(ALL_MILESTONES.some((m) => m.domain === domain)).toBe(true);
    }
  });

  it("includes ASHA communication + feeding milestones and the Arbor extended set", () => {
    expect(ASHA_MILESTONES.length).toBeGreaterThan(0);
    expect(ARBOR_EXTENDED_MILESTONES.length).toBe(10);
    expect(ALL_MILESTONES.length).toBe(
      CDC_MILESTONES.length + ASHA_MILESTONES.length + ARBOR_EXTENDED_MILESTONES.length
    );
    // ASHA intelligibility benchmark — 75% understandable at 3y.
    expect(ASHA_MILESTONES.some((m) => m.ageMonths === 36 && /understandable/i.test(m.title))).toBe(true);
  });

  it("preserves the legacy Arbor milestone ids (m-1…m-10) for existing records", () => {
    for (let i = 1; i <= 10; i++) {
      expect(ALL_MILESTONES.some((m) => m.id === `m-${i}`)).toBe(true);
    }
  });
});

describe("corrected age for preterm infants", () => {
  it("does not correct a term baby (40+ weeks)", () => {
    const c = correctedAge(12, 40);
    expect(c.applied).toBe(false);
    expect(c.correctedMonths).toBe(12);
    expect(c.adjustmentWeeks).toBe(0);
  });

  it("treats a missing gestational age as term", () => {
    expect(correctedAge(6).correctedMonths).toBe(6);
  });

  it("subtracts the prematurity gap for a preterm baby under 2 years", () => {
    // Born at 32 weeks → 8 weeks early ≈ 1.85 months correction.
    const c = correctedAge(12, 32);
    expect(c.applied).toBe(true);
    expect(c.adjustmentWeeks).toBe(8);
    expect(c.correctedMonths).toBeCloseTo(12 - 8 * (12 / 52), 1);
    expect(c.correctedMonths).toBeLessThan(12);
  });

  it("never returns a negative corrected age", () => {
    const c = correctedAge(1, 28); // 12 weeks early, only 1 month old
    expect(c.correctedMonths).toBeGreaterThanOrEqual(0);
  });

  it("stops correcting at about 24 months (AAP)", () => {
    const c = correctedAge(30, 32);
    expect(c.applied).toBe(false);
    expect(c.correctedMonths).toBe(30);
  });

  it("comparisonAgeMonths matches the corrected months", () => {
    expect(comparisonAgeMonths(12, 32)).toBe(correctedAge(12, 32).correctedMonths);
    expect(comparisonAgeMonths(18)).toBe(18);
  });
});

describe("age-band grouping", () => {
  it("buckets an age into the highest band it meets", () => {
    expect(bandForAgeMonths(0).months).toBe(2); // below the first band floors to 2m
    expect(bandForAgeMonths(2).label).toBe("2 months");
    expect(bandForAgeMonths(5).months).toBe(4); // 5m → the 4m band, not 6m
    expect(bandForAgeMonths(24).label).toBe("2 years");
    expect(bandForAgeMonths(60).label).toBe("5 years");
    expect(bandForAgeMonths(72).label).toBe("6 years +");
    expect(bandForAgeMonths(120).label).toBe("6 years +"); // anything older stays in the top band
  });

  it("the bands are strictly ascending and cover the CDC checkpoints", () => {
    const months = MILESTONE_AGE_BANDS.map((b) => b.months);
    for (let i = 1; i < months.length; i++) expect(months[i]).toBeGreaterThan(months[i - 1]);
    // Every CDC milestone lands in a real band (no dated item is orphaned).
    for (const m of CDC_MILESTONES) {
      const band = bandForAgeMonths(m.ageMonths as number);
      expect(MILESTONE_AGE_BANDS).toContainEqual(band);
    }
  });

  it("seeds CDC items UNobserved (honest empty state, no fixed-age auto-check)", () => {
    expect(CDC_MILESTONES.every((m) => m.checked === false)).toBe(true);
  });

  it("seeds EVERY non-custom milestone UNobserved (no silent Development Score inflation)", () => {
    // CDC + ASHA + Arbor-extended all seed false: a brand-new child observes
    // nothing until the parent marks it. Custom (parent-authored) rows are exempt.
    for (const m of ALL_MILESTONES) {
      if (m.custom) continue;
      expect(m.checked).toBe(false);
    }
  });
});
