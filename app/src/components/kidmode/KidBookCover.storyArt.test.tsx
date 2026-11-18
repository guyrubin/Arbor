import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KidBookCover } from "./KidBookCover";
import { JOSEPH_STORY_ART, JOSEPH_STORY_ID } from "../../lib/storyPlateArt";

const ownHero = <img data-synthetic-own-hero="" src="data:image/svg+xml,synthetic-geometric-identity" alt="" />;
const props = { title: "Joseph and His Brothers", pack: "growth" as const, theme: "film3d" as const, storyId: JOSEPH_STORY_ID, readLabel: "Read", onOpen: () => {}, layout: "grid" as const };

describe("B-BOOK-83 the shared Joseph cover preserves the child's own identity", () => {
  it.each(["row", "grid"] as const)("%s: uses the reviewed cover and exactly one caller-supplied portrait in its reserved slot", layout => {
    const html = renderToStaticMarkup(<KidBookCover {...props} layout={layout} hero={ownHero} />);
    expect(html).toContain(JOSEPH_STORY_ART.cover.src480);
    expect((html.match(/data-synthetic-own-hero=""/g) ?? [])).toHaveLength(1);
    expect((html.match(/data-kid-book-own-hero=""/g) ?? [])).toHaveLength(1);
    expect(html).toContain(`left:${JOSEPH_STORY_ART.cover.heroSlot.centerX * 100}%`);
  });
  it("without a passed hero the cover stays child-free", () => {
    const html = renderToStaticMarkup(<KidBookCover {...props} />);
    expect(html).toContain(JOSEPH_STORY_ART.cover.src480);
    expect(html).not.toContain("data-kid-book-own-hero");
    expect(html).not.toContain("synthetic-geometric-identity");
  });
  it("storybook Joseph keeps its own title-card contract, and existing illustrated books gain no extra portrait", () => {
    const otherTheme = renderToStaticMarkup(<KidBookCover {...props} theme="storybook" hero={ownHero} />);
    expect(otherTheme).not.toContain(JOSEPH_STORY_ART.cover.src480);
    expect(otherTheme).toContain("data-kid-book-titlecard");
    expect((otherTheme.match(/data-synthetic-own-hero=""/g) ?? [])).toHaveLength(1);
    const otherBook = renderToStaticMarkup(<KidBookCover {...props} theme="storybook" storyId="the-lantern-path" hero={ownHero} />);
    expect(otherBook).not.toContain("data-kid-book-own-hero");
    expect(otherBook).not.toContain("synthetic-geometric-identity");
  });
});
