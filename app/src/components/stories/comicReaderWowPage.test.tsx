/**
 * B-SHELL-10 (framer decision, 1 Oct) — ComicReader takes the in-memory wow
 * page when the saved book has no pages (the wow's metadata-only shelf seed),
 * and a page that landed LATE is accepted too.
 *
 * Before: the seeded book (`pageUrls: []`) rebuilt every page on #/comics,
 * re-generating the page the parent had just seen; a late page was dropped
 * the moment the overlay closed.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// The placeholder cover paints the child's hero, which reads ArborContext.
vi.mock("../ui/HeroAvatar", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../ui/HeroAvatar")>()),
  HeroAvatar: () => null,
}));
import { clearPrewarmedComic, holdWowPage, wowPageFor } from "../../lib/comicPrewarm";
import { getAdventure } from "../../lib/heroComics";
import { ComicReader } from "./ComicReader";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");

const WOW = "data:image/png;base64,V09XLVBBR0U=";
const adventure = getAdventure("david-and-goliath")!;
const seeded = { id: "david-and-goliath", adventureId: "david-and-goliath", title: "David", lang: "en" as const, pageUrls: [] as string[], createdAt: "2026-10-01T00:00:00.000Z" };
const render = (childId: string | undefined, lang: "en" | "he" = "en") =>
  renderToStaticMarkup(
    <ComicReader adventure={adventure} lang={lang} heroName="Mia" saved={{ ...seeded, lang }} childId={childId} onSave={() => {}} onClose={() => {}} />,
  );

afterEach(() => clearPrewarmedComic());

describe("the in-memory wow page holder", () => {
  it("holds per child + story + language, is not consumed by a read, and clears on sign-out", () => {
    expect(adventure).toBeTruthy();
    holdWowPage("c1", "david-and-goliath", "en", WOW);
    expect(wowPageFor("c1", "david-and-goliath", "en")).toBe(WOW);
    expect(wowPageFor("c1", "david-and-goliath", "en")).toBe(WOW);
    expect(wowPageFor("c2", "david-and-goliath", "en")).toBeNull(); // another child never gets it
    expect(wowPageFor("c1", "david-and-goliath", "he")).toBeNull(); // nor another language
    expect(wowPageFor(undefined, "david-and-goliath", "en")).toBeNull();
    clearPrewarmedComic();
    expect(wowPageFor("c1", "david-and-goliath", "en")).toBeNull();
  });
});

describe("ComicReader opens the seeded book on the wow page", () => {
  it("pageUrls empty + a held wow page -> the cover renders that page (no placeholder for it)", () => {
    holdWowPage("c1", "david-and-goliath", "en", WOW);
    const html = render("c1");
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain(WOW);
  });

  it("NEGATIVE CONTROL: without a held page (or for another child) the cover is not the wow page", () => {
    expect(render("c1")).not.toContain(WOW);
    holdWowPage("c1", "david-and-goliath", "en", WOW);
    expect(render("c2")).not.toContain(WOW);
  });

  it("the build never requests the cover again when the wow page was taken", () => {
    const src = read("components/stories/ComicReader.tsx");
    expect(src).toContain("saved && !saved.pageUrls.length ? wowPageFor(childId, adventure.id, lang) : null");
    expect(src).toContain("wowCover.current ? initialPages.filter((p) => p.index !== 0) : initialPages,");
  });

  it("the wow holds the in-time page AND the late page, even after the overlay closed", () => {
    const wow = read("components/onboarding/WowOnboarding.tsx");
    expect(wow).toContain("holdWowPage(activeChild.id, firstStory.id, wowLang, first.dataUrl);");
    const late = /void first\.late\.then\(\(late\) => \{[\s\S]*?\n {8}\}\);/.exec(wow);
    expect(late).toBeTruthy();
    const hold = late![0].indexOf("holdWowPage(activeChild.id, firstStory.id, wowLang, late.dataUrl);");
    const mountedGate = late![0].indexOf("if (wowMounted.current)");
    expect(hold).toBeGreaterThan(-1);
    expect(mountedGate).toBeGreaterThan(hold); // the hold is NOT behind the mounted check
    // the composed fallback page is never held (it is a template, not the child's comic)
    expect(wow).not.toMatch(/holdWowPage\([^)]*card\.dataUrl/);
  });
});
