/**
 * B-KID-76 (b) — in Kid Mode the reader is a picture book: full-bleed art on
 * the top ~55 %, the words below at the kid scale, read aloud on page open
 * (per-child mute, gesture rule), ONE big Next + a smaller Back, the Decision
 * question read aloud, an ending page that marks the book read, and no
 * Immersive control. Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const voice = vi.hoisted(() => ({ speakText: vi.fn(() => 7), stopVoice: vi.fn(), supported: true }));
vi.mock("../../lib/voice", () => ({ speakText: voice.speakText, stopVoice: voice.stopVoice, voiceSupported: () => voice.supported, voiceState: () => ({ speaking: false, engine: "basic" }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (k: string) => k }) }));
vi.mock("../../lib/api", () => ({ api: {} }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true }));

import { HeroScenePlayer, BEAT_FOCUS, KID_BOOK_TEXT_PX } from "../stories/HeroScenePlayer";
import type { HeroSceneRender } from "../../types";
import { autoReadPage, isKidReadAloudMuted, setKidReadAloudMuted, KidReadAloudToggle } from "./kidReadAloud";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tab = readFileSync(path.join(__dirname, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
const overlay = readFileSync(path.join(__dirname, "KidModeOverlay.tsx"), "utf8");
const kidReader = tab.slice(tab.indexOf("  if (kidMode) {\n    const bookArt"), tab.indexOf("  return (\n    <motion.div initial={{ opacity: 0, y: 15 }}"));

const scene: HeroSceneRender = { beatId: "call", title: "The Call", narration: "Dana is a small shepherd who hears about a giant.", imagePrompt: "" };

afterEach(() => { voice.speakText.mockClear(); voice.supported = true; vi.unstubAllGlobals(); });

describe("the book page (HeroScenePlayer layout=book)", () => {
  const html = renderToStaticMarkup(
    <HeroScenePlayer layout="book" scene={scene} seed="s" storyId="noahs-ark" beatNumber={2} beatTotal={8} fallbackArtUrl="/cover.webp" fallbackArtHasHero />,
  );
  it("art edge to edge on top, cropped per beat from the story's cover", () => {
    expect(html).toContain("data-kid-book-page");
    expect(html).toContain(`object-position:${BEAT_FOCUS[1]}`);
    // B-KID-128 re-pin: full-bleed at 4:5 on a phone, 3:4 spread from 640 px (kidBookLayout.test).
    expect(html).toContain("aspect-[4/5]");
  });
  it("the words sit below at the kid scale (>= 18 px), three lines then scroll", () => {
    expect(KID_BOOK_TEXT_PX).toBeGreaterThanOrEqual(18);
    // B-KID-133 (D-03) re-pin: the book voice token, floored at KID_BOOK_TEXT_PX (20 px).
    expect(html).toMatch(/data-kid-book-text=""[^>]*font-size:max\(20px, var\(--kid-t-book\)\)/);
    expect(html).toContain("overflow-y:auto");
    expect(html).toContain("max-h-[calc(3*1.5em_+_16px)]"); // B-KID-128 re-pin: the 3-line cap is a phone-only class (B-KID-133 D-03: book line height 1.5)
    expect(html).toContain(scene.narration);
  });
  it("no meta row in front of the child: no Read aloud button, no Save, no smudged/Redraw page", () => {
    expect(html).not.toContain("Read aloud");
    expect(html).not.toContain("page.redraw");
    expect(html).not.toMatch(/Redraw|smudged/);
  });
  it("a cover without a hero gets the hero (or Sprout) cameo; the card layout is unchanged", () => {
    const noHero = renderToStaticMarkup(<HeroScenePlayer layout="book" scene={scene} seed="s" beatNumber={1} beatTotal={8} fallbackArtUrl="/c.webp" />);
    expect(noHero).toMatch(/role="img"|<img[^>]*journey/);
    const card = renderToStaticMarkup(<HeroScenePlayer scene={scene} seed="s" beatNumber={1} beatTotal={8} fallbackArtUrl="/c.webp" />);
    expect(card).not.toContain("data-kid-book-page");
  });
});

describe("read-to-me (kidReadAloud)", () => {
  it("speaks the page when on, after a gesture, through the voice path, in the story language", () => {
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    setKidReadAloudMuted("child-a", false);
    expect(autoReadPage("child-a", "שלום", "he")).toBe(7);
    expect(voice.speakText).toHaveBeenCalledWith("שלום", {}, "he");
  });
  it("never before a user gesture (autoplay rule)", () => {
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: false } });
    expect(autoReadPage("child-a", "hello", "en")).toBe(0);
    expect(voice.speakText).not.toHaveBeenCalled();
  });
  it("the mute is per child", () => {
    vi.stubGlobal("navigator", { userActivation: { hasBeenActive: true } });
    setKidReadAloudMuted("child-b", true);
    expect(isKidReadAloudMuted("child-b")).toBe(true);
    expect(isKidReadAloudMuted("child-a")).toBe(false);
    expect(autoReadPage("child-b", "hello", "en")).toBe(0);
    expect(autoReadPage("child-a", "hello", "en")).toBe(7);
  });
  it("a device that cannot speak shows no toggle and speaks nothing (nothing broken)", () => {
    voice.supported = false;
    expect(renderToStaticMarkup(<KidReadAloudToggle childId="child-a" lang="en" />)).toBe("");
    expect(autoReadPage("child-a", "hello", "en")).toBe(0);
    voice.supported = true;
    const on = renderToStaticMarkup(<KidReadAloudToggle childId="child-a" lang="he" />);
    expect(on).toContain('aria-pressed="true"');
    // B-KID-73 re-pin: the read-to-me toggle IS the ONE Sound control (voice + effects).
    expect(on).toContain('aria-label="צלילים"');
    expect(on).toMatch(/width:44px|inline-size:44px/);
  });
  it("the top bar carries the toggle while a book is open (B-KID-73: on every kid view)", () => {
    expect(overlay).toContain('<KidSoundToggle childId={childProfile.id} lang={uiLang === "he" ? "he" : "en"} />');
    expect(overlay).not.toContain('{view === "journeys" && surfaceTitle && <KidReadAloudToggle');
  });
});

describe("the Kid Mode reader (HeroJourneyTab)", () => {
  it("is its own branch: book pages, no Immersive, no card frame", () => {
    expect(kidReader).toContain('layout="book"');
    expect(kidReader).not.toContain("immersiveButton");
    expect(kidReader).not.toContain("metaAction");
    expect(kidReader).not.toContain("rounded-3xl p-6");
  });
  it("ONE big Next (56 px, full width) and a smaller Back", () => {
    expect(kidReader).toContain("data-kid-book-next");
    expect(kidReader).toContain("minBlockSize: 56");
    expect(kidReader).toContain("flex: 1");
    expect(kidReader).toMatch(/inlineSize: 48, minBlockSize: 48/);
    expect((kidReader.match(/<button\b/g) ?? []).length).toBe(4); // back, next, read again, my books
  });
  it("B-BOOK-28: legacy pages never synthesize narration; the Decision question and choices stay readable", () => {
    expect(tab).not.toContain("autoReadPage");
    expect(tab).not.toContain("kidSay");
    expect(tab).toContain("stopVoice();");
    expect(kidReader).toContain("renderChoices()");
    expect(tab).toContain("<DecisionChoices choices={choices}");
  });
  it("the ending: the cover, The End, Read again / My books — and reaching it marks the book read", () => {
    expect(kidReader).toContain("data-kid-book-ending");
    expect(kidReader).toContain('kidsStoriesText("journey.end"');
    expect(kidReader).toContain('kidsStoriesText("reader.again"');
    expect(kidReader).toContain('kidsStoriesText("kidBooks.title"');
    expect(kidReader).toMatch(/const toEnding = \(\) => \{\s*setAtEnd\(true\);\s*if \(!saved\) void finishJourney\(\);/);
  });
  it("NEGATIVE CONTROL: the parent reader keeps its frame, nav row and Immersive", () => {
    const parent = tab.slice(tab.indexOf("  return (\n    <motion.div initial={{ opacity: 0, y: 15 }}"));
    expect(parent).toContain("{immersiveButton}");
    expect(parent).toContain("rounded-3xl p-6 md:p-8");
  });
});
