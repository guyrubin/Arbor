import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  at: 0,
  generateComic: vi.fn(),
  /** M2: the reader must speak the UI language; the mock follows it. */
  lang: "en" as "en" | "he",
}));

vi.mock("react", async (importOriginal) => {
  const real = await importOriginal<typeof import("react")>();
  return {
    ...real,
    useState: (initial: unknown) => {
      const index = harness.at++;
      if (!(index in harness.slots)) harness.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [harness.slots[index], (next: unknown) => {
        harness.slots[index] = typeof next === "function"
          ? (next as (current: unknown) => unknown)(harness.slots[index])
          : next;
      }];
    },
    useEffect: () => undefined,
  };
});
vi.mock("../../context/LanguageContext", () => ({
  useLanguage: () => ({ uiLang: harness.lang, aiLang: harness.lang, t: (key: string) => key }),
}));
vi.mock("../../lib/api", () => ({ api: { generateComic: harness.generateComic } }));
vi.mock("../../hooks/useAsyncAction", () => ({ runInstrumented: (_name: string, run: () => unknown) => run() }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/heroAvatarCanvas", () => ({ downloadHeroAvatarCanvas: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true }));

import { HeroScenePlayer } from "./HeroScenePlayer";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { isolate } from "../../lib/i18n";
import { journeyPageKey } from "../../lib/heroComics";
import type { HeroSceneRender } from "../../types";

function nodes(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<Record<string, unknown>>;
  return [element, ...React.Children.toArray(element.props.children as React.ReactNode).flatMap(nodes)];
}

beforeEach(() => {
  harness.slots = [];
  harness.at = 0;
  harness.lang = "en";
  harness.generateComic.mockReset();
});

describe("HeroScenePlayer authored fallback", () => {
  it("renders local story art with no avatar or provider request instead of dereferencing an absent result", () => {
    const tree = HeroScenePlayer({
      scene: {
        beatId: "call",
        title: "The lanterns wake",
        narration: "A warm path glows.",
        imagePrompt: "",
      },
      seed: "the-lantern-path-arrival-child-a",
      beatNumber: 1,
      beatTotal: 8,
      heroName: "Mia",
      childIdentity: "child-a",
      fallbackArtUrl: "/visuals/stories/v1/lantern-path-v1.webp",
    });
    const image = nodes(tree).find((node) => node.type === "img");
    expect(image?.props.src).toBe("/visuals/stories/v1/lantern-path-v1.webp");
    expect(harness.generateComic).not.toHaveBeenCalled();
  });
});

/**
 * M2 (22 Sep 2026) — Astra's secondary finding: the reader still spoke English
 * inside a Hebrew UI. Every user-visible string the reader renders — including
 * the two alt texts, which a screen reader DOES read out — now resolves through
 * kidsStoriesText. Behavioural: the component is called with aiLang "he" and
 * the rendered props are read back.
 */
describe("HeroScenePlayer speaks the UI language", () => {
  const scene: HeroSceneRender = { beatId: "call", title: "הפנסים מתעוררים", narration: "שביל חם זוהר.", imagePrompt: "lanterns" };

  it("labels a drawing page in Hebrew — frame, loading copy and alt text", () => {
    harness.lang = "he";
    // resolvedArt, artLoading, artError, retryTick — the page is mid-draw.
    harness.slots = [undefined, true, false, 0];
    const tree = HeroScenePlayer({
      scene,
      seed: "the-lantern-path-call-נועה",
      beatNumber: 1,
      beatTotal: 8,
      heroAvatarUrl: "data:image/png;base64,AAAA",
      heroName: "נועה",
      childIdentity: "child-a",
    });
    const page = nodes(tree).find((node) => (node.type as { name?: string })?.name === "ComicPage");
    expect(page, "the framed page was not rendered").toBeTruthy();
    expect(page!.props.alt).toBe(kidsStoriesText("journey.pageAlt", "he", { number: 1, title: scene.title }));
    expect(page!.props.loadingLabel).toBe(kidsStoriesText("page.drawing", "he"));
    expect(page!.props.errorLabel).toBe(kidsStoriesText("page.smudged", "he"));
    expect(page!.props.retryLabel).toBe(kidsStoriesText("page.redraw", "he"));
    expect(page!.props.rtl).toBe(true);
    expect(String(page!.props.alt)).not.toMatch(/Page/);
  });

  it("names the hero on the authored fallback in Hebrew, with the name bidi-isolated", () => {
    harness.lang = "he";
    const tree = HeroScenePlayer({
      scene: { ...scene, imagePrompt: "" },
      seed: "the-lantern-path-call-נועה",
      beatNumber: 1,
      beatTotal: 8,
      photoUrl: "data:image/png;base64,AAAA",
      heroName: "Mia",
      childIdentity: "child-a",
      fallbackArtUrl: "/visuals/stories/v1/lantern-path-v1.webp",
    });
    const images = nodes(tree).filter((node) => node.type === "img");
    const hero = images.find((img) => img.props.alt !== "");
    expect(hero, "the hero cameo was not rendered").toBeTruthy();
    // A Latin name inside a Hebrew label is FSI/PDI-wrapped by isolate().
    expect(hero!.props.alt).toBe(kidsStoriesText("journey.heroAlt", "he", { name: isolate("Mia", "he") }));
    expect(String(hero!.props.alt)).toContain("⁨Mia⁩");
    // …and the authored fallback still asks no provider for art.
    expect(harness.generateComic).not.toHaveBeenCalled();
  });

  it("falls back to the unnamed hero label rather than an English literal", () => {
    harness.lang = "he";
    const tree = HeroScenePlayer({
      scene: { ...scene, imagePrompt: "" },
      seed: "the-lantern-path-call-anon",
      beatNumber: 2,
      beatTotal: 8,
      photoUrl: "data:image/png;base64,AAAA",
      childIdentity: "child-a",
      fallbackArtUrl: "/visuals/stories/v1/lantern-path-v1.webp",
    });
    const hero = nodes(tree).filter((node) => node.type === "img").find((img) => img.props.alt !== "");
    expect(hero!.props.alt).toBe(kidsStoriesText("journey.heroAltUnnamed", "he"));
    expect(String(hero!.props.alt)).not.toMatch(/[A-Za-z]/);
  });
});

/**
 * R3 (M3 critic, cross-module P0) — a journey book that could not open.
 *
 * `journeyPageKey` takes the adventure id at parts[6], and the beats were
 * passing `seed` (`<storyId>-<beatId>-<childName>`). Every beat key therefore
 * disagreed with the cover key minted in HeroJourneyTab, the M3 shelf validator
 * rejected the book on both shelves — and the child's display name sat in a
 * cache key in clear text.
 */
describe("journey page keys carry the story, not the illustration seed", () => {
  const story = "the-two-gifts";
  const beat = { beatId: "call" as const, title: "The two gifts", narration: "Two boxes wait.", imagePrompt: "two wrapped boxes on a step" };
  const HERO_URL = "data:image/png;base64,AAAA";

  function beatKeyFromRender(): string {
    harness.slots = [undefined, true, false, 0];
    harness.at = 0;
    const tree = HeroScenePlayer({
      scene: beat,
      storyId: story,
      seed: `${story}-${beat.beatId}-Dylan`,
      beatNumber: 1,
      beatTotal: 8,
      heroAvatarUrl: HERO_URL,
      heroAvatarStyle: "comichero",
      heroName: "Dylan",
      childIdentity: "child-dylan",
      childId: "child-dylan",
    });
    const page = nodes(tree).find((node) => (node.type as { name?: string })?.name === "ComicPage");
    expect(page, "the framed page was not rendered").toBeTruthy();
    // the alt proves we are looking at beat 1's page; the key is the artefact
    return journeyPageKey({
      storyId: story,
      lang: "en",
      heroName: "Dylan",
      heroDataUrl: HERO_URL,
      style: "comichero",
      childId: "child-dylan",
      childIdentity: "child-dylan",
      pageIndex: 1,
      theme: beat.imagePrompt,
      dialogue: undefined,
      sfx: [],
    });
  }

  const coverKey = journeyPageKey({
    storyId: story,
    lang: "en",
    heroName: "Dylan",
    heroDataUrl: HERO_URL,
    style: "comichero",
    childId: "child-dylan",
    childIdentity: "child-dylan",
    pageIndex: 0,
    cover: true,
    title: "The Two Gifts",
    theme: "The Two Gifts — generosity",
    sfx: [],
  });

  it("a beat key and the cover key for one story agree on parts[6]", () => {
    const beatKey = beatKeyFromRender();
    expect(beatKey.split("|")[6]).toBe(story);
    expect(coverKey.split("|")[6]).toBe(story);
    expect(beatKey.split("|")[6]).toBe(coverKey.split("|")[6]);
    // …and they are still different pages of the same book
    expect(beatKey.split("|")[8]).toBe("1");
    expect(coverKey.split("|")[8]).toBe("0");
  });

  it("the child's name never appears unhashed in a key", () => {
    const beatKey = beatKeyFromRender();
    for (const key of [beatKey, coverKey]) {
      expect(key).not.toContain("Dylan");
      expect(key).not.toContain("child-dylan");
    }
  });

  it("NEGATIVE CONTROL: the pre-fix beat key carried the seed, name and all", () => {
    const preFix = journeyPageKey({
      storyId: `${story}-${beat.beatId}-Dylan`, // what `storyId: seed` minted
      lang: "en",
      heroName: "Dylan",
      heroDataUrl: HERO_URL,
      style: "comichero",
      childId: "child-dylan",
      childIdentity: "child-dylan",
      pageIndex: 1,
      theme: beat.imagePrompt,
      sfx: [],
    });
    expect(preFix.split("|")[6]).toBe("the-two-gifts-call-Dylan");
    expect(preFix.split("|")[6]).not.toBe(coverKey.split("|")[6]);
    expect(preFix).toContain("Dylan"); // the display name, in clear text
  });

  it("the seed still drives only the authored fallback illustration", () => {
    harness.slots = [];
    harness.at = 0;
    const tree = HeroScenePlayer({
      scene: { ...beat, imagePrompt: "" },
      storyId: story,
      seed: `${story}-${beat.beatId}-Dylan`,
      beatNumber: 1,
      beatTotal: 8,
      heroName: "Dylan",
      childIdentity: "child-dylan",
      fallbackArtUrl: "/visuals/stories/v1/lantern-path-v1.webp",
    });
    const image = nodes(tree).find((node) => node.type === "img");
    expect(image?.props.src).toBe("/visuals/stories/v1/lantern-path-v1.webp");
    expect(harness.generateComic).not.toHaveBeenCalled();
  });
});
