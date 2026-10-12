/**
 * F-CHILD-2 — the review step, rendered in EN and HE.
 *
 * The capture sheet's review used to read the intensity back as "{n} / 5"
 * beside five filled green pips: a graded meter about a moment of the child.
 * Rendered here, the stepper says the same word as the capture slider in one
 * neutral chip, in the page language, with no number out of five, no meter
 * and no verdict colour — at every step of the 1..5 band.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({
      t: (k: string, v?: Record<string, string | number>) => translate(state.lang, k, v),
      uiLang: state.lang,
    }),
  };
});

import ConfirmCaptureReview from "./ConfirmCaptureReview";
import { translate } from "../../lib/i18n";
import { INTENSITY_WORDS } from "../../lib/intensityWords";

const LANGS = ["en", "he"] as const;
const noop = () => {};

function renderReview(intensity: number) {
  return renderToStaticMarkup(
    <ConfirmCaptureReview
      source="text"
      rows={[]}
      intensity={intensity}
      onIntensityChange={noop}
      onEdit={noop}
      onDiscard={noop}
      onConfirm={noop}
    />,
  );
}

function chip(html: string) {
  const m = /<span data-testid="review-intensity-word"([^>]*)>([^<]*)<\/span>/.exec(html);
  expect(m, "the intensity word chip rendered").toBeTruthy();
  return { attrs: m![1], text: m![2] };
}

describe("F-CHILD-2 · the review stepper says the intensity in words", () => {
  for (const lang of LANGS) {
    it(`${lang}: each step of 1..5 renders its word, never "n / 5", a meter or a verdict colour`, () => {
      state.lang = lang;
      for (let n = 1; n <= 5; n++) {
        const html = renderReview(n);
        const word = translate(lang, INTENSITY_WORDS[n - 1]);
        expect(word).not.toBe(INTENSITY_WORDS[n - 1]);
        const c = chip(html);
        expect(c.text).toBe(word);
        expect(c.attrs).not.toContain("--arbor-green-ink");
        expect(html).not.toMatch(/\/\s*5\b/);
        expect(html).not.toContain(translate(lang, "beh.level", { n }));
        expect(html).not.toMatch(/background:var\(--arbor-green-ink\)/);
        expect(html).not.toMatch(/role="(progressbar|meter)"/);
      }
    });
  }

  it("HE words carry no Latin letters", () => {
    for (const key of INTENSITY_WORDS) {
      expect(translate("he", key)).toMatch(/[֐-׿]/);
      expect(translate("he", key)).not.toMatch(/[A-Za-z]/);
    }
  });
});
