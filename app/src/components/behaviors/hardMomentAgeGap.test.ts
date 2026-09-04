/* WAVE-G · THE AGE GAP — a family outside the guides' age range gets an
 * explanation, not a blank space.
 *
 * Pre-fix behaviour (the negative controls below pin it): the 25 published
 * hard-moment guides are banded ["2-5"] × 22 and ["6-9","10-12"] × 3, and
 * `fitsHardMomentAge` is fail-CLOSED — so a child of 18 months, or of 13
 * years, matched ZERO cards and `HardMomentsSection` returned `null`. The
 * parent saw nothing at all, with no way to tell "not written yet" from
 * "broken".
 *
 * These tests render the REAL section (static markup, node env) with the app
 * contexts stubbed, and assert on what a parent would SEE.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hardMomentCards } from "../../content/hardMomentCards";
import { hardMomentAgeCoverage, hardMomentAgeFit } from "../../content/hardMomentAgeFit";
import { fitsHardMomentAge, parseHardMomentAgeBand } from "../../content/pilotRelease";
import { availableHardMomentCards } from "../../content/selectCards";

/** Inside the live pilot window (availableFrom 2026-09-04 → expires 2026-12-03). */
const NOW = new Date("2026-10-01T09:00:00.000Z");
const ctx = (ageMonths: number | null) => ({ locale: "en" as const, now: NOW, ageMonths });

const profile = { id: "c1", name: "Noa Levi", age: 1, birthDate: "2025-04-01", ageMonths: 18 };

vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({
    childProfile: profile,
    seedCoach: vi.fn(),
    requestLearnRead: vi.fn(),
  }),
}));
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ t: (k: string) => k, uiLang: "en", aiLang: "en" }),
}));
vi.mock("../ui/Modal", () => ({ Modal: () => null, default: () => null }));

const renderSection = async () => {
  const { default: HardMomentsSection } = await import("./HardMomentsSection");
  return renderToStaticMarkup(React.createElement(HardMomentsSection));
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  profile.birthDate = "2025-04-01";
  profile.ageMonths = 18;
  profile.age = 1;
});

// ── The gap itself, measured from the shipped pack ──────────────────────────

describe("the shipped pack really does leave the youngest and oldest children out", () => {
  it("NEGATIVE CONTROL: a 18-month-old and a 13-year-old match zero cards", () => {
    expect(availableHardMomentCards(ctx(18))).toHaveLength(0);
    expect(availableHardMomentCards(ctx(13 * 12))).toHaveLength(0);
    // …while a 3-year-old is well served, so the emptiness is about AGE.
    expect(availableHardMomentCards(ctx(36)).length).toBeGreaterThan(10);
  });

  it("coverage is DERIVED from the pack, not hard-coded", () => {
    const coverage = hardMomentAgeCoverage(ctx(36));
    expect(coverage).not.toBeNull();
    expect(coverage!.startYears).toBe(2);
    expect(coverage!.endYears).toBe(12);
    // Cross-check against the raw bands so a future card edit moves both.
    const starts = hardMomentCards.flatMap((c) => c.ageBands.map((b) => parseHardMomentAgeBand(b)!.startMonths));
    expect(coverage!.startMonths).toBe(Math.min(...starts));
  });

  it("classifies younger / covered / older / unknown", () => {
    expect(hardMomentAgeFit(ctx(18)).fit).toBe("younger");
    expect(hardMomentAgeFit(ctx(36)).fit).toBe("covered");
    expect(hardMomentAgeFit(ctx(13 * 12)).fit).toBe("older");
    expect(hardMomentAgeFit(ctx(null)).fit).toBe("unknown");
  });

  it("the one band parser serves both the gate and the explanation", () => {
    // If these ever disagree, a parent could be told a range that does not
    // match what they are actually shown.
    for (const card of hardMomentCards) {
      for (const band of card.ageBands) {
        const range = parseHardMomentAgeBand(band)!;
        expect(fitsHardMomentAge(card, range.startMonths)).toBe(true);
      }
    }
  });
});

// ── What the parent sees ────────────────────────────────────────────────────

describe("HardMomentsSection explains itself instead of vanishing", () => {
  it("an 18-month-old's parent gets the age explanation and the real range", async () => {
    const html = await renderSection();
    expect(html).toContain('data-testid="hard-moments-age-notice"');
    expect(html).toContain('data-age-fit="younger"');
    expect(html).toContain("ages 2–12");
    // The gap is attributed to Arbor's writing, never to the child.
    expect(html).toContain("we have not written those guides yet");
    // And it is not silently pretending to be the catalogue.
    expect(html).not.toContain('data-testid="hard-moments-section"');
  });

  it("a 13-year-old's parent gets the same honesty from the other end", async () => {
    profile.birthDate = "2013-04-01";
    profile.ageMonths = 13 * 12;
    profile.age = 13;
    const html = await renderSection();
    expect(html).toContain('data-age-fit="older"');
    expect(html).toContain("ages 2–12");
  });

  it("NEGATIVE CONTROL: an in-range child still gets the catalogue, not the notice", async () => {
    profile.birthDate = "2023-04-01";
    profile.ageMonths = 42;
    profile.age = 3;
    const html = await renderSection();
    expect(html).toContain('data-testid="hard-moments-section"');
    expect(html).not.toContain('data-testid="hard-moments-age-notice"');
  });

  it("an expired pilot promises NOTHING — no notice, no range, no section", async () => {
    // The release window is the incident lever. Once it closes, nothing
    // publishes at ANY age, so the surface must not leave an explanation of
    // guides that are no longer available.
    const past = new Date("2027-01-05T09:00:00.000Z");
    const expired = { locale: "en" as const, now: past, ageMonths: 18 };
    expect(availableHardMomentCards(expired)).toHaveLength(0);
    expect(hardMomentAgeCoverage(expired)).toBeNull();
    expect(hardMomentAgeFit(expired).fit).toBe("none");

    vi.setSystemTime(past);
    const html = await renderSection();
    expect(html).toBe("");
  });
});
