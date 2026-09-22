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
    expect(tab).toContain("pageIndex: 0,\n    cover: true as const,");
    // a cover that failed at start gets exactly one more try at finish
    expect(tab).toContain("if (!comicPageKeys.current.has(0)) {");
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

/**
 * M2 (22 Sep 2026) — the story reader IS a comic you can read.
 *
 * G2 shipped a cover that was generated and then never shown: the child's book
 * opened on beat 1 and the cover existed only as a shelf key. M2 puts it on
 * screen as the opening page, through the same ComicPage primitive the beats
 * use, and pins the three things that would silently regress: a second
 * generation path, a cover that blocks the reader while it draws, and a beat
 * counter that starts counting the cover as beat 1.
 */
describe("M2 — the cover is the opening page of the book", () => {
  it("draws it through the SAME pipeline — no second generation path", () => {
    // exactly two call sites: the story-start draw and the bounded finish-time retry
    expect((tab.match(/generateJourneyPage\(/g) || []).length).toBe(2);
    expect(tab).not.toMatch(/api\.generateComic\(/);
    expect(tab).toContain("const drawCover = () => {");
    expect(tab).toContain("comicPageKeys.current.set(0, key);");
    expect(tab).toContain("setCoverArt({ url, loading: false, error: false });");
  });

  it("presents it with the shared ComicPage primitive, unnumbered", () => {
    expect(tab).toContain('import { ComicPage, MascotSay, PlayButton, PlayPanel } from "../ui/playkit";');
    expect(tab).toContain("const coverPage = (immersiveMode: boolean) => (");
    expect(tab).toContain('key="journey-cover"');
    expect(tab).toContain("src={coverArt.url}");
    expect(tab).toContain("{onCover && coverPage(immersiveMode)}");
    expect(tab).toContain("{!onCover && displayScene && (");
    // the cover is not a numbered page — ComicPage only badges pageNumber > 0
    expect(tab).not.toContain("pageNumber={0}");
  });

  it("gives a cover that failed the same framed smudged page and Redraw as a beat", () => {
    expect(tab).toContain("loading={!coverArt.url && coverArt.loading}");
    expect(tab).toContain("error={!coverArt.url && !coverArt.loading && coverArt.error}");
    expect(tab).toContain("onRetry={drawCover}");
    expect(tab).toContain('errorLabel={kidsStoriesText("page.smudged", aiLang)}');
    expect(tab).toContain('retryLabel={kidsStoriesText("page.redraw", aiLang)}');
    expect(tab).toContain('loadingLabel={kidsStoriesText("page.drawing", aiLang)}');
  });

  it("never blocks the reader: a cover still drawing can be turned past", () => {
    expect(tab).toContain("if (onCover) { setOnCover(false); return; }");
    // no reader control is gated on the cover's art resolving
    expect(tab).not.toMatch(/disabled=\{[^}]*coverArt\./);
  });

  it("opens on the cover only when a hero exists — without one the reader is unchanged", () => {
    expect(tab).toContain("setOnCover(Boolean(activeStory && render && heroAvatarUrl));");
    expect(tab).toContain("const hasCoverPage = Boolean(heroAvatarUrl);");
    expect(tab).toContain("const atFirstPage = onCover || (sceneIndex === 0 && !hasCoverPage);");
  });

  it("keeps the beat counter honest — Cover, then 1 / 8", () => {
    expect(tab).toContain('? kidsStoriesText("journey.cover", aiLang)');
    expect(tab).toContain("`${sceneIndex + 1} / ${activeStory.beats.length}`");
    // the beat player still numbers the beats themselves, not the pages
    expect(tab).toContain("beatNumber={sceneIndex + 1}");
    expect(tab).toContain("beatTotal={activeStory.beats.length}");
  });

  it("labels generated cover art AI-made, and only when there is art", () => {
    expect(tab).toContain('{coverArt.url && <ProvenanceBadge lang={uiLang === "he" ? "he" : "en"} className="-mt-2" />}');
    // the beats keep the same rule; authored fallback art carries no badge
    expect(player).toContain("{sceneArt && <ProvenanceBadge");
  });
});

describe("M2 — one saved state, two registers", () => {
  it("the kid line and the parent toast read the same flag, written in one place", () => {
    expect(tab).toContain("const markComicSaved = (value: boolean) => { comicSavedRef.current = value; setComicSaved(value); };");
    expect(tab).toContain("const shelved = comicSavedRef.current;");
    expect(tab).toContain("markComicSaved(true);");
    // markComicSaved is the ONLY writer of the state
    expect(tab.match(/setComicSaved\(/g) || []).toHaveLength(1); // only markComicSaved calls it
  });

  it("the parent toast carries parent copy and the kid line stays in Kid Mode", () => {
    expect(tab).not.toMatch(/toast\([^)]*comicSaved/);
    expect(tab).toContain("Journey complete — story saved and the comic is on the shelf");
    const kidEnding = tab.slice(tab.indexOf('kidsStoriesText("journey.childEndingTitle"'));
    expect(kidEnding).toContain('kidsStoriesText("journey.comicSaved", aiLang)');
  });
});

describe("M2 — the reader speaks the UI language", () => {
  it("no English literal is left in the reader chrome", () => {
    expect(player).not.toMatch(/\/>\s+Save\b/);
    expect(player).toContain('{t("learn.save")}');
    expect(player).not.toContain("`Page ${beatNumber}: ${scene.title}`");
    expect(player).toContain('alt={kidsStoriesText("journey.pageAlt", aiLang, { number: beatNumber, title: scene.title })}');
    expect(player).not.toContain("the story hero");
    expect(player).toContain('kidsStoriesText("journey.heroAltUnnamed", aiLang)');
  });

  it("routes the hero's name through isolate() — a Hebrew name cannot reorder the label", () => {
    expect(player).toContain('import { isolate } from "../../lib/i18n";');
    expect(player).toContain('kidsStoriesText("journey.heroAlt", aiLang, { name: isolate(heroName, aiLang) })');
  });

  it("every new reader key exists in BOTH dictionaries", () => {
    const dict = read("lib/i18nElevation/kidsStories.ts");
    for (const key of ["journey.cover", "journey.coverAlt", "journey.pageAlt", "journey.heroAlt", "journey.heroAltUnnamed"]) {
      expect(dict.match(new RegExp(`"${key.replace(".", "\.")}":`, "g")) || [], key).toHaveLength(2);
    }
  });
});
