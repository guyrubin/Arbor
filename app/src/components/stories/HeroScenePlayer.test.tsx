import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  at: 0,
  generateComic: vi.fn(),
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
  useLanguage: () => ({ uiLang: "en", aiLang: "en", t: (key: string) => key }),
}));
vi.mock("../../lib/api", () => ({ api: { generateComic: harness.generateComic } }));
vi.mock("../../hooks/useAsyncAction", () => ({ runInstrumented: (_name: string, run: () => unknown) => run() }));
vi.mock("../../lib/tts", () => ({ stopSpeaking: vi.fn() }));
vi.mock("../../lib/heroAvatarCanvas", () => ({ downloadHeroAvatarCanvas: vi.fn() }));
vi.mock("../../lib/kidModeGate", () => ({ isKidModeActive: () => true }));

import { HeroScenePlayer } from "./HeroScenePlayer";

function nodes(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement(node)) return [];
  const element = node as React.ReactElement<Record<string, unknown>>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

beforeEach(() => {
  harness.slots = [];
  harness.at = 0;
  harness.generateComic.mockReset();
});

describe("HeroScenePlayer authored fallback", () => {
  it("renders local story art with no avatar or provider request instead of dereferencing an absent result", () => {
    const tree = HeroScenePlayer({
      scene: {
        beatId: "arrival",
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
