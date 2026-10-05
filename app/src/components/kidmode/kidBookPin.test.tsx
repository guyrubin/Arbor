/**
 * B-KID-124 (P0, B-KID-10) — a tapped book opens THAT book, at once.
 *
 * Production (03f0425, Guy's account): tapping a book on the kid home switched
 * to the library view and the child stared at the "My books" GRID for ~7 s
 * with no loading sign while the reader awaited the model's personalised
 * narration — read as "it opened a screen of story titles instead of the
 * story". A second cause: the pin was a once-per-mount boolean, so only the
 * first pinned book of a mounted tab ever opened.
 *
 * Now: the pinned book is open on the FIRST paint on its authored text (the
 * model call never resolves in this file and the book is still there), the
 * pin is keyed by story id + a per-tap nonce, a late personalised render only
 * replaces page 1 while the child has not moved, a refused pin shows that
 * book's cover with Read (never the grid), and every id the kid home row, the
 * Tonight banner and the library grid list passes the pin's own gate.
 * Rendered with react-dom/server (no jsdom in this repo).
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ChildProfile } from "../../types";

const lang = vi.hoisted(() => ({ ui: "en" as "en" | "he" }));
const apiCalls = vi.hoisted(() => ({ n: 0 }));
const child = vi.hoisted(() => ({ profile: null as unknown }));

vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: lang.ui, aiLang: lang.ui, t: (k: string) => k }) }));
vi.mock("../../context/ArborContext", () => ({
  useArbor: () => ({ childProfile: child.profile, behaviorLogs: [], setActiveTab: () => {} }),
  useArborOptional: () => ({ childProfile: child.profile }),
}));
vi.mock("../../context/ToastContext", () => ({ useToast: () => ({ toast: () => {} }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], upsert: async () => {}, remove: async () => {}, loading: false }) }));
vi.mock("../../lib/api", () => ({ api: { generateHeroJourney: () => { apiCalls.n += 1; return new Promise(() => {}); } } }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true, subscribeKidMode: () => () => {}, noteKidActivity: () => {} }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/voice", () => ({ speakText: vi.fn(() => 0), stopVoice: vi.fn(), voiceSupported: () => false }));

import HeroJourneyTab, { kidBookOpening, kidLateRenderApplies, kidPinKey } from "../tabs/HeroJourneyTab";
import { kidBookOpenable, kidBooks } from "./kidBooks";
import { chooseTonightsStory } from "./tonightsStory";
import { HERO_STORIES, getStorySpec } from "../../lib/heroJourneys";

const profile = (age: number, name = "Dana"): ChildProfile => ({ id: "child-1", name, age } as ChildProfile);
const STORY = "david-and-goliath";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("B-KID-124: a pinned book is open on the first paint (the model call never resolves)", () => {
  it("EN: the reader shows the authored page, the grid is absent", () => {
    lang.ui = "en";
    child.profile = profile(6);
    const html = renderToStaticMarkup(<HeroJourneyTab initialStoryId={STORY} pinNonce={1} />);
    const spec = getStorySpec(STORY)!;
    expect(html).toContain("data-kid-book-reader");
    expect(html).toMatch(/<p lang="en" dir="ltr"[^>]*data-kid-book-text/);
    // The authored first page (the child named in it), not a model render.
    const authored = kidBookOpening(spec, "child-1", "en", undefined, { name: "Dana" }, "2026-10-05").render.scenes[0].narration;
    expect(html).toContain(esc(authored.slice(0, 24)));
    expect(html).not.toContain("data-kid-library");
    expect(html).not.toContain("kidBooks.empty");
  });
  it("HE: the same, in Hebrew, right to left", () => {
    lang.ui = "he";
    child.profile = profile(6, "דנה");
    const html = renderToStaticMarkup(<HeroJourneyTab initialStoryId={STORY} pinNonce={1} />);
    expect(html).toContain("data-kid-book-reader");
    expect(html).toMatch(/<p lang="he" dir="rtl"[^>]*data-kid-book-text/);
    lang.ui = "en";
  });
  it("no model call happens during render (the background request is an effect)", () => {
    expect(apiCalls.n).toBe(0);
  });
  it("a refused pin (the pin's own gate says no) shows THAT book's cover with Read, never the grid", () => {
    // Any story the gate refuses for some fixture child: Hebrew-less in HE, or outside every age view.
    const fixtures = [{ l: "he" as const, years: 6 }, { l: "en" as const, years: 1 }, { l: "en" as const, years: 12 }];
    let found: { id: string; l: "en" | "he"; years: number } | undefined;
    for (const f of fixtures) {
      const s = HERO_STORIES.find((x) => !kidBookOpenable(x, { lang: f.l, ageMonths: f.years * 12, showAllAges: false }));
      if (s) { found = { id: s.id, ...f }; break; }
    }
    expect(found, "a refusable fixture exists").toBeTruthy();
    lang.ui = found!.l;
    child.profile = profile(found!.years);
    const html = renderToStaticMarkup(<HeroJourneyTab initialStoryId={found!.id} pinNonce={1} />);
    expect(html).toContain(`data-kid-book-pin-cover="${found!.id}"`);
    expect(html).toContain("data-kid-book-pin-read");
    expect(html).not.toContain("data-kid-book-reader");
    lang.ui = "en";
  });
});

describe("B-KID-124: the pin is keyed by story + tap", () => {
  it("a second book is a new pin; the same book tapped again after Home is a new pin", () => {
    expect(kidPinKey("a", 1)).not.toBe(kidPinKey("b", 2));
    expect(kidPinKey("a", 1)).not.toBe(kidPinKey("a", 2));
    expect(kidPinKey("a", 3)).toBe(kidPinKey("a", 3));
  });
  it("a late personalised render replaces page 1 only for the same open, before any page turn or read-aloud", () => {
    const base = { openSeq: 2, requestSeq: 2, pageMoved: false, narrationSpoken: false };
    expect(kidLateRenderApplies(base)).toBe(true);
    expect(kidLateRenderApplies({ ...base, pageMoved: true })).toBe(false);
    expect(kidLateRenderApplies({ ...base, narrationSpoken: true })).toBe(false);
    expect(kidLateRenderApplies({ ...base, openSeq: 3 })).toBe(false); // another book opened since
  });
  it("the reader and the overlay wire it: nonce per tap, the old boolean is gone, the cover is the Suspense fallback", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const tab = readFileSync(path.join(here, "..", "tabs", "HeroJourneyTab.tsx"), "utf8");
    const overlay = readFileSync(path.join(here, "KidModeOverlay.tsx"), "utf8");
    expect(tab).not.toContain("pinnedOpened");
    expect(tab).toContain("}, [pinKey]);");
    expect(tab).toContain("onOpen={(story) => { openKidBook(story, false); }}");
    expect(tab).toMatch(/kidLateRenderApplies\(\{ openSeq: kidOpenSeq\.current/);
    expect(overlay).toContain("setPinNonce((n) => n + 1);");
    expect(overlay).toContain("<HeroJourneyTab initialStoryId={arcadeWorldId ?? undefined} pinNonce={pinNonce} />");
    expect(overlay).toContain("<KidStageFallback storyId={arcadeWorldId ?? undefined} />");
  });
});

describe("B-KID-124: every listed book passes the pin's own gate (EN + HE, ages 3, 5, 7)", () => {
  for (const l of ["en", "he"] as const) {
    for (const years of [3, 5, 7]) {
      it(`${l} age ${years}: home row / library ids and Tonight's pick are pin-openable`, () => {
        const ctx = { lang: l, ageMonths: years * 12, showAllAges: false };
        const listed = kidBooks({ ...ctx, hasCover: () => true, runs: [] }).map((b) => b.story);
        expect(listed.length).toBeGreaterThan(0);
        for (const s of listed) expect(kidBookOpenable(s, ctx), s.id).toBe(true);
        const tonight = chooseTonightsStory("2026-10-05", "child-1", { readIds: [], aims: [], ageMonths: ctx.ageMonths, showAllAges: false, prefer: () => true, lang: l });
        if (tonight) expect(kidBookOpenable(getStorySpec(tonight)!, ctx), tonight).toBe(true);
      });
    }
  }
});
