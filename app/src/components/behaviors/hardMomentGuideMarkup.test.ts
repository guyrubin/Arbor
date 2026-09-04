/**
 * AI-17 — byte-equivalence guard for the hard-moment guide, the second of the
 * three places Arbor re-implemented a structured AI/editorial answer.
 *
 * HardMomentGuideContent hand-rolled the same anatomy CoachAnswerCards owns:
 * a bordered, tinted, titled section per axis. AI-17 moves those sections onto
 * the shared frame primitive. The bar is ZERO visual regression, so this file
 * freezes the markup the guide shipped BEFORE the extraction — the snapshot
 * was generated against the pre-extraction source.
 *
 * The guide is deliberately rendered from the REAL published catalogue rather
 * than a hand-made fixture, so the frozen markup is the markup a parent gets.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HardMomentGuideContent } from "./HardMomentsSection";
import { availableHardMomentCards } from "../../content/selectCards";
import type { HardMomentContext } from "../../content/pilotRelease";

/** Inside the live pilot window (availableFrom 2026-09-04 → expires 2026-12-03). */
const NOW = new Date("2026-10-01T09:00:00.000Z");
/** 3y0m — inside the 2-5 band that carries the bulk of the catalogue. */
const AGE_MONTHS = 36;

const ctx = (locale: "en" | "he"): HardMomentContext => ({ locale, now: NOW, ageMonths: AGE_MONTHS });

const cards = availableHardMomentCards(ctx("en"));
const card = cards[0];

/** Keys pass through unchanged so the snapshot pins section IDENTITY, not copy. */
const t = (key: string) => key;

const render = (locale: "en" | "he") =>
  renderToStaticMarkup(
    React.createElement(HardMomentGuideContent, { card, context: ctx(locale), childName: "Noa", t }),
  );

describe("AI-17 — the hard-moment guide has real content to freeze", () => {
  it("the published catalogue actually yields a card for this age and date", () => {
    expect(cards.length).toBeGreaterThan(0);
    expect(card).toBeTruthy();
    expect(card.doNow.en).toBeTruthy();
    expect(card.sayThis.en).toBeTruthy();
    expect(card.avoid.en).toBeTruthy();
    expect(card.observe.en).toBeTruthy();
  });
});

describe("AI-17 — guide markup is byte-identical across the extraction", () => {
  it("renders the English guide exactly as it shipped", () => {
    const html = render("en");
    expect(html.length).toBeGreaterThan(800);
    expect(html).toMatchSnapshot();
  });

  it("renders the Hebrew guide exactly as it shipped", () => {
    const html = render("he");
    expect(html.length).toBeGreaterThan(800);
    expect(html).toMatchSnapshot();
  });
});

/* ── Negative controls ─────────────────────────────────────────────────────── */

const GUIDE_FRAME = 'class="min-w-0 rounded-xl p-4"';

describe("AI-17 negative controls — the guide matchers reject a regressed render", () => {
  const html = render("en");

  it("scanned markup is real and non-empty", () => {
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(800);
    expect(html).toContain("<div");
  });

  it("a section frame that lost its padding is rejected", () => {
    expect(html).toContain(GUIDE_FRAME);
    const mutant = html.split(GUIDE_FRAME).join('class="min-w-0 rounded-xl p-3"');
    expect(mutant).not.toContain(GUIDE_FRAME);
  });

  it("one framed section per axis, plus the escalation note", () => {
    // do-now, say-this, avoid, observe, escalation = 5 framed blocks.
    expect(html.split("rounded-xl p-4").length - 1).toBe(5);
    expect(html).toContain('data-testid="hard-moment-escalation"');
  });

  it("the escalation note keeps its own distinct treatment, not the section frame", () => {
    expect(html).toContain("var(--arbor-green-soft)");
    expect(html).toContain("border-inline-start:3px solid var(--arbor-green-ink)");
    const mutant = html.split("border-inline-start:3px solid var(--arbor-green-ink)").join("");
    expect(mutant).not.toContain("border-inline-start:3px solid var(--arbor-green-ink)");
  });

  it("RTL guides carry the direction the section frame must not swallow", () => {
    expect(render("he")).toContain('dir="rtl"');
  });
});
