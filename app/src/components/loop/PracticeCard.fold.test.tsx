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
   occlusion probe is in the sweep since this commit).

   B-DESIGN-04 (P7-DESIGN blend frame 01, 8 Oct): the card is the screen's
   PRIMARY card — no band; a kicker row (44 px duotone glyph · kicker over the
   shelf · minutes tag) on a hairline, the title at --t-title (display), the
   say at --t-say (editorial, still the one largest line); the model below is
   re-pinned to that geometry and the same 640 limit. */

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
import { practiceDoNamed } from "../../lib/journal/shelfView";

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

/* Root 15 px: --t-title 1.375rem = 20.625 px (line-height 1.2), --t-say
   1.5rem = 22.5 px (line-height 1.3). */
const T_TITLE = 20.625;
const T_SAY = 22.5;

function didItBottom(lang: "en" | "he", gender: string, practice = DEMO, quotes: ReadonlyArray<{ text: string }> = []) {
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  const doText = practiceDoNamed(practice, lang, "Dylan", gender);
  const title = practiceTitle(doText, lang);
  const say = `${t("elev.loop.practice.say")} “${practiceText(practice, "say", lang, gender)}”`;
  let y = CARD_TOP_375; // no border: the hairline ring is a box-shadow
  y += 14 + 44 + 10 + 1; // kicker row: pt-3.5, the 44 px glyph row, pb-2.5, the hairline
  y += 10 + lines(title, T_TITLE) * T_TITLE * 1.2; // mt-2.5 + title .arbor-type-title
  if (quotes.length) {
    y += 8; // mt-2
    y += quotes.length * (15 * 1.375 + 4); // ONE truncated line each (date first) + gap
    y += 12; // the say's mt-3
  } else {
    y += 8; // the words block's mt-2
  }
  y += lines(say, T_SAY, 0.5) * T_SAY * 1.3; // say .arbor-type-say
  if (!titleIsWholeDo(title, doText)) y += 8 + lines(doText, 15, 0.5) * 15 * 1.375; // mt-2 + do --t-base
  y += 14 + 48; // mt-3.5 + the answers row (min-h-12); materials + why sit BELOW it
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
    it(`${lang}: order — kicker row, title, the parent's words, say, do, answers, materials, why; the stamp is on the answer group only`, () => {
      const html = render(lang, QUOTES[lang]);
      const at = (id: string) => html.indexOf(`data-testid="${id}"`);
      const ids = ["practice-band", "practice-title", "practice-quotes", "practice-say", "practice-do", "practice-answers", "practice-meta", "practice-why"];
      // the materials line renders only when the practice names materials
      const order = ids.filter((id) => id !== "practice-meta" || DEMO.materials).map(at);
      expect(order.every((i) => i >= 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect(html).toMatch(/data-testid="practice-answers"[^>]*data-primary-move="do-practice"/);
      expect(html).not.toMatch(/data-testid="practice-card"[^>]*data-primary-move/);
    });

    it(`${lang}: sizes — title .arbor-type-title, say .arbor-type-say (the one largest line), do --t-base, answers ≥ 48 px`, () => {
      const html = render(lang);
      expect(html).toMatch(/data-testid="practice-title" class="[^"]*\barbor-type-title\b/);
      expect(html).toMatch(/data-testid="practice-say" class="[^"]*\barbor-type-say\b/);
      expect(html).toMatch(/data-testid="practice-do" class="[^"]*\bt-base\b/);
      expect((html.match(/\barbor-type-say\b/g) ?? []).length).toBe(1);
      expect(html).not.toMatch(/var\(--t-(?:xl|2xl)\)|\bt-(?:xl|2xl)\b/);
      expect(html).not.toMatch(/text-\[\d/);
      for (const b of html.match(/<button[^>]*data-answer="[a-z_]+"[^>]*>/g) ?? []) expect(b).toMatch(/min-h-12/);
    });

    it(`${lang}: B-DESIGN-04 — the primary card: the one deep shadow, the kicker row (duotone glyph · kicker · minutes tag), one CTA gradient, the words + say on the one ink rule`, () => {
      const html = render(lang, QUOTES[lang]);
      expect(html).toMatch(/data-testid="practice-card"[^>]*class="arbor-depth-primary\b/);
      expect(html.match(/arbor-depth-primary/g)).toHaveLength(1);
      expect(html).toMatch(/border-radius:var\(--r-xl\)/);
      const band = html.slice(html.indexOf('data-testid="practice-band"'), html.indexOf('data-testid="practice-title"'));
      const glyphAt = band.indexOf('data-testid="shelf-glyph-duotone"');
      expect(glyphAt).toBeGreaterThan(-1);
      expect(band.indexOf('data-testid="practice-kicker" class="arbor-type-kicker"')).toBeGreaterThan(glyphAt);
      expect(band).toContain('data-testid="practice-minutes"');
      expect(band).toContain(translate(lang, "elev.loop.practice.minutes", { n: DEMO.minutes }));
      expect(html).not.toContain('data-testid="shelf-glyph"');
      expect(html.match(/--gradient-cta|--arbor-gradient-primary/g)).toHaveLength(1);
      const words = html.slice(html.indexOf('data-testid="practice-words"'), html.indexOf('data-testid="practice-answers"'));
      expect(html).toMatch(/data-testid="practice-words" class="[^"]*\barbor-accent-rule\b/);
      expect(words).toContain('data-testid="practice-quotes"');
      expect(words).toContain('data-testid="practice-say"');
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

  it("P2-N1 — 'next to your words' only when a quoted line is on the practice's own shelf", () => {
    state.lang = "en";
    const did = (quotes: ReadonlyArray<{ text: string; lead?: string; shelf?: string; date?: string; onShelf?: boolean }>) =>
      /data-testid="practice-receipt"[^>]*>([\s\S]*?)<\/p>/.exec(
        renderToStaticMarkup(<PracticeCard practice={DEMO} milestone={null} shelf="hands" childName="Dylan" gender="boy" answered="did" onAnswer={() => undefined} quotes={quotes} />),
      )?.[1] ?? "";
    const offShelf = [{ text: "Waved from the window", lead: "Last night you wrote:", shelf: "Words · 6 Oct", onShelf: false }];
    expect(did(offShelf)).not.toContain("next to your words");
    expect(did(offShelf)).toContain(translate("en", "elev.loop.practice.didReceipt"));
    expect(did([{ text: "Waved from the window", onShelf: true }])).toContain("next to your words");
    expect(did(QUOTES.en)).toContain("next to your words");
  });

  it("P2-N4 — the headline and the do-line name the child, as the Journal tile's Try line does", () => {
    const yourChild = PRACTICES.find((p) => /\byour child\b/i.test(p.do.en));
    expect(yourChild).toBeTruthy();
    state.lang = "en";
    const html = renderToStaticMarkup(<PracticeCard practice={yourChild!} milestone={null} shelf={yourChild!.shelf} childName="Dylan" gender="boy" onAnswer={() => undefined} />);
    expect(html).not.toMatch(/your child/i);
    expect(html).toContain("Dylan");
  });

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

/* B-LOOP-13 — the AI's why sentence replaces the chooser's reason line ONLY
   when it is given; it sits under the answers, so the fold model above is
   unchanged (the why-line is already the last line of the card). */
describe("B-LOOP-13 · the why-line", () => {
  const whyOf = (html: string) => /data-testid="practice-why"[^>]*>([^<]*)</.exec(html)?.[1] ?? "";
  const card = (whyText?: string | null) =>
    renderToStaticMarkup(
      <PracticeCard practice={DEMO} milestone={null} shelf="hands" childName="Dylan" gender="boy" onAnswer={() => undefined} whyReason="empty" whyText={whyText} />,
    );
  it("an AI why replaces the reason line; absent / blank keeps the chooser's line", () => {
    state.lang = "en";
    const chooserLine = whyOf(card());
    expect(chooserLine.length).toBeGreaterThan(0);
    expect(whyOf(card("Hands has had fewer notes lately, so here is one small thing to try."))).toBe("Hands has had fewer notes lately, so here is one small thing to try.");
    expect(whyOf(card(null))).toBe(chooserLine);
    expect(whyOf(card("   "))).toBe(chooserLine);
  });
});
