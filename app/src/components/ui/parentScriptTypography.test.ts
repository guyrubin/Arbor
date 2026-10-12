import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SayThis } from "./AiBlock";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const bodyScript = (tag: string) => tag.includes("var(--font-sans)") && tag.includes("font-style:normal") && tag.includes("t-base") && !/italic|font-editorial|font-display|text-\[13px\]/.test(tag);

describe("words parents use are readable instructions, not decorative quotations", () => {
  for (const [lang, text] of [["en", "Which book shall we read together?"], ["he", "איזה ספר נקרא יחד?"]] as const) {
    it(`${lang}: preserves exact words, quotation marks and copy action in body type`, () => {
      const html = renderToStaticMarkup(React.createElement(SayThis, { text, lang, title: "Say this", copyLabel: "Copy", copiedLabel: "Copied" }));
      const paragraph = /<p[^>]*>[^<]*<\/p>/.exec(html)?.[0] ?? "";
      expect(bodyScript(paragraph)).toBe(true);
      expect(paragraph).toContain(`“${text}”`);
      expect(html).toContain("Copy");
      expect(html).toContain('data-testid="say-this"');
      expect(bodyScript(paragraph.replace("var(--font-sans)", "var(--font-editorial)"))).toBe(false);
      expect(bodyScript(paragraph.replace("font-style:normal", "font-style:italic"))).toBe(false);
      expect(bodyScript(paragraph.replace("t-base", "text-[13px]"))).toBe(false);
    });
  }

  // F-TALK-2 re-pin (mock L405): a Talk answer sets its parent script as the
  // say-quote (SayThis presentation="quote": display face behind a 2 px navy
  // inline-start rule), so the report no longer forces the card's sans face.
  // The guard now runs the other way: the quote cannot fall back to sans, and
  // the report's CSS only sizes it, in either direction.
  it("the report sets its script as the say-quote, and its CSS cannot pull it back to sans", () => {
    const css = read("../coach/coachReport.css");
    const cards = read("../coach/CoachAnswerCards.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const script = /<SayThis\b[^>]*?text=\{contract\.parentScript\}[\s\S]*?\/>/.exec(cards)?.[0] ?? "";
    expect(script).toContain('presentation="quote"');
    expect(script).not.toMatch(/font-sans/);
    const rule = /\.coach-report \[data-testid="say-this"\]\[data-presentation="quote"\] > blockquote \{([^}]+)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/font-size: var\(--t-lg\)/);
    expect(rule).not.toMatch(/font-family|font-sans|italic/);
    expect(css).not.toMatch(/\[data-testid="say-this"\] > p/);
    expect(css).not.toMatch(/\[data-testid="say-this"\][^{]*\{[^}]*font-family: var\(--font-sans\)/);
    const html = renderToStaticMarkup(React.createElement(SayThis, { text: "איזה ספר נקרא יחד?", lang: "he", title: "אפשר להגיד", copyLabel: "העתקה", copiedLabel: "הועתק", presentation: "quote" }));
    const quote = /<blockquote[^>]*>/.exec(html)?.[0] ?? "";
    expect(quote).toContain("font-family:var(--font-display)");
    expect(quote).toContain("border-inline-start:2px solid var(--arbor-ink)");
    expect(quote.replace("var(--font-display)", "var(--font-sans)")).not.toContain("font-family:var(--font-display)");
  });

  it("Together's portaled preview gets the same instructional treatment", () => {
    const css = read("../companion/togetherDiscovery.css");
    expect(css).toMatch(/\.companion-together \.companion-say,\s*\.companion-preview \.companion-say \{ font-family: var\(--font-sans\); font-size: var\(--t-base\); font-style: normal; line-height: 1\.6 !important;/);
    expect(css).not.toMatch(/^\.companion-say\s*\{/m);
  });

  const inlineBody = (markup: string) => markup.includes('fontFamily: "var(--font-sans)"') && markup.includes('fontStyle: "normal"') && markup.includes("t-base") && !/font-editorial|font-display|italic/.test(markup);
  for (const [file, expression] of [
    ["../tabs/SafetyTab.tsx", /data-testid="safety-crisis-script"[\s\S]*?<\/p>/],
    ["../nextopen/RitualTurnCard.tsx", /data-testid="ritual-turn-closing"[\s\S]*?<\/p>/],
    ["../tabs/HeroJourneyTab.tsx", /<dd[^>]*>\{tonightAskAfter\}<\/dd>/],
    ["../sections/Masterclasses.tsx", /<p[^>]*>\{he \? m\.parentScriptHe : m\.parentScript\}<\/p>/],
  ] as const) {
    it(`${file}: the precise words-to-use field keeps body typography`, () => {
      const markup = expression.exec(read(file))?.[0] ?? "";
      expect(inlineBody(markup)).toBe(true);
      expect(inlineBody(markup.replace("var(--font-sans)", "var(--font-editorial)"))).toBe(false);
    });
  }

  it("kept Profile and story-memory quotations remain editorial", () => {
    const profile = read("../sections/ChildProfile.tsx");
    const stories = read("../tabs/HeroJourneyTab.tsx");
    expect(profile).toContain("var(--font-editorial)");
    expect(stories).toMatch(/fontFamily: "var\(--font-editorial\)"[^}]*\}\}[^>]*>[\s\S]{0,100}notedMoment/);
  });
});
