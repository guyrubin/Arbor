import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

/* P5 design r1 P0-1 (6 Oct) — at 375 × 812 EN the "Did it" pill sat at
   y 646–694, under the fixed capture dock (top ≈ 668); the card-wide stamp
   let the fold gate pass. Acceptance: the "Did it" bottom edge ≤ 640 at
   375 × 812 in BOTH locales.

   jsdom has no layout, so this guard asserts what it CAN: (1) the ORDER of
   the card (band → title → [the parent's words] → say → do → answers →
   meta → why; pass A1 moved meta + why under the answers), stamp on the
   answers only); (2) the SIZES (title --t-lg, say --t-xl the one largest
   line, do --t-base, answers min-h-12); (3) a line-count height model of
   the card at 375 for the demo child's practice (Dylan, 3 years: the pasta
   necklace, pr-cdc-36m-9), from the card's top as measured on the r1
   render minus what this fix removed (shell hub line 24 px, H1 second line
   28 px). OWED to a rendered check: rendered-sweep.mjs primaryMoveOccluded
   = false and the stamp rect bottom ≤ 640 on #/overview 375 EN + HE (the
   occlusion probe is in the sweep since this commit). */

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

import PracticeCard, { practiceText } from "./PracticeCard";
import { PRACTICES } from "../../content/practices";
import { practiceTitle, titleIsWholeDo } from "../../lib/practice/practiceTitle";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEMO = PRACTICES.find((p) => p.id === "pr-cdc-36m-9")!;
/* Pass A1: the card with the parent's words — two dated demo-length notes
   (the demo family's own moment sentences), and every practice the 38-month
   demo child can be offered (current band + one earlier, shelf practices). */
const QUOTES = {
  en: [
    { text: "Drew a circle and called it grandma's house", date: "21 Sept" },
    { text: "Put his shoes on by himself before breakfast", date: "4 Oct" },
  ],
  he: [
    { text: "צייר עיגול וקרא לו הבית של סבתא", date: "21 בספט׳" },
    { text: "נעל לבד את הנעליים לפני ארוחת הבוקר", date: "4 באוק׳" },
  ],
} as const;
const OFFERABLE = PRACTICES.filter((p) => p.ageMonths >= 24 && p.ageMonths <= 38);

/* The 375 model. Content width = 375 − 2 × 16 (page gutter) − 2 × 16 (card
   padding) = 311 px. Average advance per character (font metrics of the
   app's stacks, generous on purpose): display 0.52 em, editorial 0.5 em,
   body 0.5 em; Hebrew runs ≈ 8 % narrower — the model uses the EN widths
   for both (a conservative bound). */
const WIDTH = 311;
const lines = (text: string, px: number, em = 0.52) => Math.max(1, Math.ceil((text.length * px * em) / WIDTH));
const CARD_TOP_375 = 268 - 24 - 28; // r1 render (EN 375) − shell hub line − H1 second line
const FOLD_LIMIT = 640;

function didItBottom(lang: "en" | "he", gender: string, practice = DEMO, quotes: ReadonlyArray<{ text: string }> = []) {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const doText = practiceText(practice, "do", lang, gender);
  const title = practiceTitle(doText, lang);
  const say = `${t("elev.loop.practice.say")} “${practiceText(practice, "say", lang, gender)}”`;
  let y = CARD_TOP_375 + 1; // border
  y += 12 + 40 + 10; // band: pt-3, 40 px glyph row, pb-2.5
  y += 12 + lines(title, 18) * 18 * 1.375; // mt-3 + title --t-lg leading-snug
  if (quotes.length) {
    y += 8; // mt-2
    y += quotes.length * (15 * 1.375 + 4); // ONE truncated line each (date first) + gap
  }
  y += 12 + lines(say, 22, 0.5) * 22 * 1.375; // mt-3 + say --t-xl leading-snug
  if (!titleIsWholeDo(title, doText)) y += 8 + lines(doText, 15, 0.5) * 15 * 1.375; // mt-2 + do --t-base
  y += 16 + 48; // mt-4 + the answers row (min-h-12); meta + why sit BELOW it
  return Math.round(y);
}

describe("PracticeCard at 375 × 812 — the move sits above the capture dock", () => {
  const render = (lang: "en" | "he", quotes?: ReadonlyArray<{ text: string; date: string }>) => {
    state.lang = lang;
    return renderToStaticMarkup(
      <PracticeCard practice={DEMO} milestone={null} shelf="hands" childName="Dylan" gender="boy" onAnswer={() => undefined} stampMove="do-practice" quotes={quotes} />,
    );
  };

  for (const lang of ["en", "he"] as const) {
    it(`${lang}: order — band, title, the parent's words, say, do, answers, meta, why; the stamp is on the answer group only`, () => {
      const html = render(lang, QUOTES[lang]);
      const at = (id: string) => html.indexOf(`data-testid="${id}"`);
      const order = ["practice-band", "practice-title", "practice-quotes", "practice-say", "practice-do", "practice-answers", "practice-meta", "practice-why"].map(at);
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/data-testid="practice-answers"[^>]*data-primary-move="do-practice"/);
      expect(html).not.toMatch(/data-testid="practice-card"[^>]*data-primary-move/);
    });

    it(`${lang}: sizes — title --t-lg, say --t-xl (the one largest line), do --t-base, answers ≥ 48 px`, () => {
      const html = render(lang);
      expect(html).toMatch(/data-testid="practice-title"[^>]*font-size:var\(--t-lg\)/);
      expect(html).toMatch(/data-testid="practice-say"[^>]*font-size:var\(--t-xl\)/);
      expect(html).toMatch(/data-testid="practice-do"[^>]*font-size:var\(--t-base\)/);
      expect((html.match(/var\(--t-xl\)/g) ?? []).length).toBe(1);
      for (const b of html.match(/<button[^>]*data-answer="[a-z_]+"[^>]*>/g) ?? []) expect(b).toMatch(/min-h-12/);
    });

    for (const gender of ["boy", "girl"]) {
      it(`${lang}/${gender}: the "Did it" bottom edge ≤ ${FOLD_LIMIT} px at 375 × 812 (line model)`, () => {
        expect(didItBottom(lang, gender)).toBeLessThanOrEqual(FOLD_LIMIT);
      });
      it(`${lang}/${gender}: with the parent's two dated notes, every practice the demo child can be offered keeps "Did it" ≤ ${FOLD_LIMIT}`, () => {
        const over = OFFERABLE.map((p) => ({ id: p.id, y: didItBottom(lang, gender, p, QUOTES[lang]) })).filter((r) => r.y > FOLD_LIMIT);
        expect(over).toEqual([]);
      });
    }
  }

  it("the route stamps the answers, never a card wrapper (one literal, OverviewTab)", () => {
    const src = readFileSync(path.join(here, "..", "tabs", "OverviewTab.tsx"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src.match(/\bdata-primary-move\b(?!-)/g)).toHaveLength(1);
    expect(src).not.toMatch(/<div data-primary-move=/);
    expect(src).toContain('stampMove={firstBlock === "practice" ? primaryMoveId : undefined}');
    expect(src).toContain('stampMove={firstBlock === "tonight" ? primaryMoveId : undefined}');
  });
});
