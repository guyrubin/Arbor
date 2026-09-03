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
import { HubHero } from "./HubHero";
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
