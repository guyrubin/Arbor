import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * G2 (22 Sep 2026) — "every generated story is a comic" source contract.
 *
 * The reader draws one framed page per beat through the shared comic pipeline,
 * a smudged page stays framed with narration and a Redraw control (never a
 * silent swap to generic art), the cover is drawn once per story, and a
 * complete page set is saved to the child's shelf when the story finishes.
 * Locked at the source level, coachCaptureHonesty.test.ts style.
 */
const SRC = path.resolve(__dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const player = read("components/stories/HeroScenePlayer.tsx");
const tab = read("components/tabs/HeroJourneyTab.tsx");

describe("HeroScenePlayer — one framed page per beat", () => {
  it("generates through the shared journey pipeline, never through the raw comic API", () => {
    expect(player).toContain("generateJourneyPage(pageArgs)");
    expect(player).toContain("journeyPageKey(pageArgs)");
    expect(player).not.toMatch(/api\.generateComic\(/);
    expect(player).not.toContain('from "../../lib/sceneCache"');
  });

  it("a failed page stays a framed ComicPage with a Redraw control and localized copy", () => {
    expect(player).toContain("(sceneArt || artLoading || artError) ? (");
    expect(player).toContain("error={!sceneArt && !artLoading && artError}");
    expect(player).toContain("onRetry={() => { setArtError(false); setRetryTick((n) => n + 1); }}");
    expect(player).toContain('errorLabel={kidsStoriesText("page.smudged", aiLang)}');
    expect(player).toContain('retryLabel={kidsStoriesText("page.redraw", aiLang)}');
    // the effect re-arms on retry, and the failure never falls through to StoryIllustration
    expect(player).toContain("}, [artRequestKey, retryTick]);");
    expect(player).toContain(".catch(() => { if (active) setArtError(true); })");
  });

  it("reports each resolved page key upward and passes the child partition to the device store", () => {
    expect(player).toContain("onPageResolved?.({ beatNumber, key });");
    expect(player).toMatch(/childId,\n\s+childIdentity: childIdentity \?\? heroName \?\? seed,/);
  });
});

describe("HeroJourneyTab — cover, shelf save, child ending", () => {
  it("draws the cover once per story start and only when a hero exists", () => {
    expect(tab).toContain("if (!activeStory || !render || !heroAvatarUrl) return;");
    expect(tab).toContain("pageIndex: 0,\n      cover: true,");
    expect(tab).toContain("}, [activeStory?.id, heroAvatarUrl, aiLang]);");
  });

  it("saves the book only when the cover and every illustrated beat resolved — never a book that cannot open", () => {
    expect(tab).toContain("const expected = 1 + scenes.filter((scene) => scene.imagePrompt).length;");
    expect(tab).toContain("if (keys.length !== expected) return;");
    expect(tab).toContain("await savedComicsCol.upsert(toSavedComicMeta({");
    expect(tab).toContain("pageKeys: keys,");
    expect(tab).toContain("await saveStoryAsComic().catch(");
  });

  it("wires the scene player to the child's store and the page-key collector", () => {
    expect(tab).toContain("childId={childProfile.id}");
    expect(tab).toContain("onPageResolved={({ beatNumber, key }) => comicPageKeys.current.set(beatNumber, key)}");
  });

  it("tells the child their comic is on the shelf, in the kid register only", () => {
    const kidEnding = tab.slice(tab.indexOf('kidsStoriesText("journey.childEndingTitle"'));
    expect(kidEnding).toContain('kidsStoriesText("journey.comicSaved", aiLang)');
    expect(tab).not.toMatch(/toast\([^)]*comicSaved/);
  });
});
