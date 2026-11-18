import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ slots: [] as unknown[], at: 0 }));
vi.mock("react", async original => {
  const real = await original<typeof import("react")>();
  return { ...real, useState: (initial: unknown) => {
    const index = state.at++;
    if (!(index in state.slots)) state.slots[index] = initial;
    return [state.slots[index], (next: unknown) => { state.slots[index] = typeof next === "function" ? (next as (value: unknown) => unknown)(state.slots[index]) : next; }];
  } };
});
import { StoryArtwork } from "./StoryArtwork";
import { JOSEPH_STORY_ART } from "../../lib/storyPlateArt";
import { bookString } from "../../lib/library/bookStrings";

function nodes(value: React.ReactNode): React.ReactElement<Record<string, any>>[] {
  if (!React.isValidElement(value)) return [];
  const element = value as React.ReactElement<Record<string, any>>;
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}
const HERO = "data:image/svg+xml,synthetic-approved-geometric-hero";
const OTHER = "data:image/svg+xml,second-synthetic-approved-hero";
function render(lang: "en" | "he" = "en", heroUrl: string | undefined = HERO) {
  state.at = 0;
  const wrapper = StoryArtwork({ art: JOSEPH_STORY_ART.pages.growth, lang, heroUrl, heroName: "Noa" });
  return nodes((wrapper.type as (props: any) => React.ReactNode)(wrapper.props));
}
beforeEach(() => { state.slots = []; state.at = 0; });

describe("B-BOOK-83 static story picture recovery", () => {
  it.each(["en", "he"] as const)("%s: an actual image error keeps identity and offers one explicit static-file retry", lang => {
    let tree = render(lang);
    const image = tree.find(node => node.props["data-story-art-image"]);
    expect(image?.props.src).toBe(JOSEPH_STORY_ART.pages.growth.src);
    expect(image?.props.srcSet).toContain("480w");
    image!.props.onError();
    tree = render(lang);
    expect(tree.find(node => node.props["data-story-art-image"])).toBeUndefined();
    expect(tree.find(node => node.type === "img")?.props.src).toBe(HERO);
    expect(tree.find(node => node.props.role === "status")?.props.children).toBe(bookString("picture.unavailable", lang));
    const retry = tree.find(node => node.props["data-story-picture-retry"] !== undefined)!;
    expect(retry.props["aria-label"]).toBe(bookString("picture.retry", lang));
    retry.props.onClick();
    tree = render(lang);
    const retried = tree.find(node => node.props["data-story-art-image"]);
    expect(retried?.props.src).toBe(`${JOSEPH_STORY_ART.pages.growth.src}?picture-retry=1`);
    expect(retried?.props.srcSet).toContain("growth-480.webp?picture-retry=1 480w");
    expect(tree.find(node => node.props["data-story-picture-retry"] !== undefined)).toBeUndefined();
    retried!.props.onError();
    expect(render(lang).filter(node => node.props["data-story-picture-retry"] !== undefined)).toHaveLength(1);
  });

  it("keys page lifetime by the real scene URL, never carries a failed page into the next beat", () => {
    const first = StoryArtwork({ art: JOSEPH_STORY_ART.pages.call, lang: "en" });
    const next = StoryArtwork({ art: JOSEPH_STORY_ART.pages.growth, lang: "en" });
    expect(first.key).toBe(JOSEPH_STORY_ART.pages.call.src);
    expect(next.key).toBe(JOSEPH_STORY_ART.pages.growth.src);
    expect(first.key).not.toBe(next.key);
  });

  it("an unavailable approved portrait uses the named mascot, then a new own hero is immediately eligible", () => {
    const first = render().find(node => node.type === "img" && node.props.src === HERO)!;
    first.props.onError();
    const fallback = render();
    expect(fallback.some(node => node.type === "img" && node.props.src === HERO)).toBe(false);
    expect(fallback.find(node => node.props["data-story-own-hero"])?.props["data-story-own-hero"]).toBe("mascot");
    const updated = render("he", OTHER);
    expect(updated.find(node => node.type === "img" && node.props.src === OTHER)?.props.alt).toContain("Noa");
    expect(updated.find(node => node.props["data-story-own-hero"])?.props["data-story-own-hero"]).toBe("approved");
  });
});
