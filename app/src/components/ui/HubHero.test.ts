/**
 * RUN-08 — the day-0 "zero wall". Every hub hero printed a stat triplet of
 * zeros ("0 of 133 noticed · 0 areas · 0 logged this week") within a new
 * parent's first minute. Rule: when EVERY stat is zero the hero renders the
 * teach line instead of numerals; the first non-zero stat brings them back.
 *
 * Render test (node env, static markup) + a source pin that the two lane-G
 * hubs pass the translated teach line. Negative control: one non-zero stat
 * renders digits, proving the assertion is sensitive to the values.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HubHero, statIsZero } from "./HubHero";
import { en as growthTruthEn, he as growthTruthHe } from "../../lib/i18nElevation/growthTruth";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

const TEACH = "Nothing noticed yet — one moment starts the picture.";
// Digit-free chrome so any digit in the output can only come from a stat.
const base = { eyebrow: "Growth", title: "Small moments become the growth story", subtitle: "Every milestone you notice is kept." };
const labels = ["of total noticed", "areas", "logged this week"];

const render = (values: Array<number | string>, zeroLine?: string) =>
  renderToStaticMarkup(
    React.createElement(HubHero, {
      ...base,
      stats: values.map((value, i) => ({ value, label: labels[i] })),
      zeroLine,
      testId: "growth-hub-hero",
    }),
  );
/** What a parent READS: the text nodes (class names and inline styles carry
 *  digits like `rounded-[20px]` / `0.45s`, which are not numerals on screen). */
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("HubHero — RUN-08 zero wall", () => {
  it("all-zero stats render the teach line and NO numeral", () => {
    const html = render([0, 0, 0], TEACH);
    expect(html).toContain(TEACH);
    expect(html).toContain('data-testid="growth-hub-hero-zero-line"');
    expect(textOf(html)).not.toMatch(/\d/);
    // The stat labels are not rendered either — no "of total noticed" without a numerator.
    expect(html).not.toContain("of total noticed");
  });

  it("all-zero stats WITHOUT a zeroLine still render no numeral (never a wall of zeros)", () => {
    const html = render([0, 0, 0]);
    expect(textOf(html)).not.toMatch(/\d/);
    expect(html).not.toContain("zero-line");
  });

  it("NEGATIVE CONTROL: one non-zero stat brings the digits back and hides the teach line", () => {
    const html = render([0, 1, 0], TEACH);
    expect(textOf(html)).toMatch(/\d/);
    expect(html).toContain(">1<");
    expect(html).toContain(">0<");
    expect(html).not.toContain(TEACH);
  });

  it("string zeros count as zero; a non-numeric string does not", () => {
    expect(textOf(render(["0", "0"], TEACH))).not.toMatch(/\d/);
    expect(render(["3 min", 0], TEACH)).toContain("3 min");
  });

  /* RUN-08 re-evidenced: the rule was `Number(s.value) === 0`, and Behaviors
     passes a RATIO ("0/0 Resolved"). Number("0/0") is NaN, NaN !== 0, so the
     guard silently did nothing on that hub and a day-0 parent met a wall of
     zeros. A ratio is zero when its numerator is. */
  it("a ratio stat with a zero numerator is zero — the '0/0' that defeated the guard", () => {
    const html = render([0, 0, "0/0"], TEACH);
    expect(html).toContain(TEACH);
    expect(textOf(html)).not.toMatch(/\d/);
  });

  it("NEGATIVE CONTROL: the pre-fix Number() test would have let '0/0' through", () => {
    // The exact expression that shipped at HubHero.tsx:75.
    expect(Number("0/0") === 0).toBe(false);
    expect(Number.isNaN(Number("0/0"))).toBe(true);
    // What replaced it.
    expect(statIsZero("0/0")).toBe(true);
  });

  it("statIsZero: ratios, plain numbers, and values that are NOT zero", () => {
    for (const zero of [0, "0", "0/0", "0 / 7", "0 of 39", "0 מתוך 39", "", "0.0"]) {
      expect(statIsZero(zero), `${JSON.stringify(zero)} should read as zero`).toBe(true);
    }
    for (const some of [1, "1", "1/7", "3/0", "3 of 39", "3 min", "—", "Mon"]) {
      expect(statIsZero(some), `${JSON.stringify(some)} should NOT read as zero`).toBe(false);
    }
  });

  it("a ratio with a real numerator keeps the whole trio visible", () => {
    const html = render([0, 0, "2/5"], TEACH);
    expect(html).not.toContain(TEACH);
    expect(html).toContain("2/5");
  });

  it("no stats → no trio and no teach line (the prop is about stats, not the hero)", () => {
    const html = renderToStaticMarkup(React.createElement(HubHero, { ...base, zeroLine: TEACH }));
    expect(html).not.toContain(TEACH);
  });
});

describe("HubHero — lane G hubs pass the translated teach line", () => {
  it("Development and Profile heroes wire elev.growthTruth.hero.empty", () => {
    for (const rel of ["components/tabs/DevelopmentTab.tsx", "components/sections/ChildProfile.tsx"]) {
      expect(read(rel), `${rel} has no zeroLine`).toMatch(/zeroLine=\{t\("elev\.growthTruth\.hero\.empty"\)\}/);
    }
  });

  it("the teach line exists in EN + HE and carries no digit or verdict", () => {
    for (const dict of [growthTruthEn, growthTruthHe]) {
      const v = dict["elev.growthTruth.hero.empty"];
      expect(v).toBeTruthy();
      expect(v).not.toMatch(/\d|%/);
    }
    expect(growthTruthEn["elev.growthTruth.hero.empty"]).toBe(TEACH);
  });
});
