/**
 * B-KID-120 — a story's words take their direction from the STORY's language,
 * never from their first strong character.
 *
 * Production (c743edd, Fable's signed-in check): model-written ENGLISH
 * narration opening with a Hebrew child's name ("דילן felt a strange tingle in
 * the air…") rendered right-aligned with its word order scrambled, because the
 * page text was `dir="auto"`. The page text, the beat title, the Decision
 * question, the choice labels and the book's title now carry `lang` + `dir`
 * from the render's language, and the child's name inside them is isolated
 * (FSI…PDI) at display time. Rendered with react-dom/server (no jsdom here).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "he", aiLang: "he", t: (k: string) => k }) }));
vi.mock("../../lib/api", () => ({ api: {} }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true }));

import { HeroScenePlayer } from "./HeroScenePlayer";
import { DecisionChoices } from "./DecisionChoices";
import { isolateNameIn, langDir } from "../../lib/bidi";
import type { HeroChoiceRender, HeroSceneRender } from "../../types";

const FSI = "⁨";
const PDI = "⁩";
const HE_NAME = "דילן";
const enScene: HeroSceneRender = { beatId: "call", title: `${HE_NAME} and the Call`, narration: `${HE_NAME} felt a strange tingle in the air.`, imagePrompt: "" };
const heScene: HeroSceneRender = { beatId: "call", title: "הקריאה", narration: "Dylan הרגיש עקצוץ מוזר באוויר.", imagePrompt: "" };

const textTag = (html: string) => html.match(/<p[^>]*data-kid-book-text=""[^>]*>/)?.[0] ?? "";

describe("isolateNameIn / langDir (lib/bidi)", () => {
  it("wraps a Hebrew name inside English text, every occurrence, idempotently", () => {
    const once = isolateNameIn(`${HE_NAME} ran. Then ${HE_NAME} smiled.`, HE_NAME, "en");
    expect(once).toBe(`${FSI}${HE_NAME}${PDI} ran. Then ${FSI}${HE_NAME}${PDI} smiled.`);
    expect(isolateNameIn(once, HE_NAME, "en")).toBe(once);
  });
  it("wraps a Latin name inside Hebrew text; leaves a same-script name byte-identical", () => {
    expect(isolateNameIn("Dylan הרגיש", "Dylan", "he")).toBe(`${FSI}Dylan${PDI} הרגיש`);
    expect(isolateNameIn("Dylan felt", "Dylan", "en")).toBe("Dylan felt");
    expect(isolateNameIn(`${HE_NAME} הרגיש`, HE_NAME, "he")).toBe(`${HE_NAME} הרגיש`);
    expect(isolateNameIn("text", undefined, "en")).toBe("text");
  });
  it("direction is the language's, never auto", () => {
    expect(langDir("en")).toBe("ltr");
    expect(langDir("he")).toBe("rtl");
  });
});

describe("the book page (HeroScenePlayer layout=book)", () => {
  it("EN story + Hebrew name (UI in Hebrew): the text is lang=en dir=ltr and the name is isolated", () => {
    const html = renderToStaticMarkup(<HeroScenePlayer layout="book" scene={enScene} seed="s" beatNumber={1} beatTotal={8} heroName={HE_NAME} textLang="en" fallbackArtUrl="/c.webp" fallbackArtHasHero />);
    const tag = textTag(html);
    expect(tag).toContain('lang="en"');
    expect(tag).toContain('dir="ltr"');
    expect(tag).not.toContain('dir="auto"');
    expect(html).toContain(`${FSI}${HE_NAME}${PDI} felt a strange tingle`);
  });
  it("HE story + Latin name: the text is lang=he dir=rtl and the name is isolated", () => {
    const html = renderToStaticMarkup(<HeroScenePlayer layout="book" scene={heScene} seed="s" beatNumber={1} beatTotal={8} heroName="Dylan" textLang="he" fallbackArtUrl="/c.webp" fallbackArtHasHero />);
    const tag = textTag(html);
    expect(tag).toContain('lang="he"');
    expect(tag).toContain('dir="rtl"');
    expect(html).toContain(`${FSI}Dylan${PDI} הרגיש`);
  });
  it("the card page: beat title and narration both take the story's direction", () => {
    const html = renderToStaticMarkup(<HeroScenePlayer scene={enScene} seed="s" beatNumber={1} beatTotal={8} heroName={HE_NAME} textLang="en" fallbackArtUrl="/c.webp" fallbackArtHasHero />);
    expect(html).toMatch(new RegExp(`<h3 lang="en" dir="ltr"[^>]*>${FSI}${HE_NAME}${PDI} and the Call</h3>`));
    expect(html).toMatch(new RegExp(`<p lang="en" dir="ltr"[^>]*>${FSI}${HE_NAME}${PDI} felt`));
    expect(html).not.toContain('dir="auto"');
  });
});

describe("the Decision choices", () => {
  const choices: HeroChoiceRender[] = [{ id: "a", label: `${HE_NAME} climbs the hill`, consequence: "x" }];
  it("labels carry the story's lang + dir and isolate the name", () => {
    const html = renderToStaticMarkup(<DecisionChoices choices={choices} lang="en" heroName={HE_NAME} onChoose={() => {}} />);
    expect(html).toContain('lang="en" dir="ltr"');
    expect(html).toContain(`${FSI}${HE_NAME}${PDI} climbs`);
    expect(html).not.toContain('dir="auto"');
  });
});

describe("the reader (HeroJourneyTab source pins)", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const tab = readFileSync(path.join(here, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
  it("the render carries its own language; the book's title, Decision question and choices read it", () => {
    expect(tab).toContain("const [renderLang, setRenderLang]");
    expect(tab).toMatch(/data-kid-book-title=""/);
    expect(tab).toMatch(/lang=\{renderLang\} dir=\{langDir\(renderLang\)\} data-kid-book-title/);
    expect(tab).toContain('<DecisionChoices choices={choices} lang={renderLang} heroName=');
    expect(tab).toContain('kidsStoriesText("journey.decision", renderLang, { name: isolate(');
    expect((tab.match(/textLang=\{renderLang\}/g) ?? []).length).toBe(2);
  });
});
