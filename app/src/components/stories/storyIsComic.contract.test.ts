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
    // R2: Redraw now CLEARS the session failure key before re-arming — the
    // guard added below makes a retry the only thing that pays again.
    expect(player).toContain("onRetry={() => { if (artRequestKey) clearJourneyPageFailure(artRequestKey); setArtError(false); setRetryTick((n) => n + 1); }}");
    expect(player).toContain('errorLabel={kidsStoriesText("page.smudged", aiLang)}');
    expect(player).toContain('retryLabel={kidsStoriesText("page.redraw", aiLang)}');
    // the effect re-arms on retry, and the failure never falls through to StoryIllustration
    expect(player).toContain("}, [artRequestKey, retryTick]);");
    expect(player).toContain(".catch(() => { if (active) setArtError(true); })");
    // R2: and the key is remembered so a remount does not buy it again.
    expect(player).toContain("if (hasJourneyPageFailed(artRequestKey)) {");
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
    // R2: the collector still records the key and now also drives the shelf
    // write, because the last page usually resolves after the child arrives.
    expect(tab).toContain("onPageResolved={({ beatNumber, key }) => { comicPageKeys.current.set(beatNumber, key); void shelveWhenComplete(); }}");
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
    expect(tab).toContain('import { ComicPage, MascotSay, PlayButton, PlayPanel, usePrefersReducedMotion } from "../ui/playkit";');
    expect(tab).toContain("const coverPage = (immersiveMode: boolean) => (");
    expect(tab).toContain('key="journey-cover"');
    expect(tab).toContain("src={coverArt.url}");
    // R2: cover and beat are the two presence states of one animated slot, so
    // the cover flips OUT before beat 1 flips in (round 1 simply unmounted it).
    expect(tab).toContain("{onCover ? (");
    expect(tab).toContain("{coverPage(immersiveMode)}");
    expect(tab).toContain(") : displayScene ? (");
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

/**
 * M2 round 2 — what the critic failed on round 1 (d5d3044).
 *
 * The biggest one was not a pixel: shelving hung off the Finish button, and a
 * story that already has a run HAS no Finish button. A child re-reading their
 * favourite story read cover + eight pages, was told the story was saved, and
 * `savedComics` stayed empty.
 */
describe("M2 R2 — reading the book to its end is what shelves it", () => {
  it("the ending shelves the comic, Finish button or not", () => {
    expect(tab).toContain("const shelveWhenComplete = async () => {");
    expect(tab).toContain("if (!reachedEnding.current || comicSavedRef.current || shelvingRef.current) return;");
    // armed by arriving at the last beat…
    expect(tab).toContain("if (!isReflection || !activeStory || !render) return;");
    expect(tab).toContain("reachedEnding.current = true;");
    // …and retried as the last pages resolve
    expect(tab).toContain("void shelveWhenComplete(); }}");
  });

  it("stays idempotent and still refuses an incomplete book", () => {
    expect(tab).toContain("shelvingRef.current = true;");
    expect(tab).toContain("if (keys.length !== expected) return;");
    // the bounded cover retry is once per STORY now that the attempt repeats
    expect(tab).toContain("if (coverRetried.current) return;");
    expect(tab).toContain("coverRetried.current = false;");
  });

  it("the ending claims only what happened", () => {
    // the comic line is gated on the shelf state, never on `saved` (the run)
    expect(tab).toContain('{comicSaved && <p className="text-sm font-black"');
    expect(tab).not.toMatch(/toast\([^)]*comicSaved/);
  });
});

describe("M2 R2 — a smudged page is bought once, not once per page turn", () => {
  const comics = read("lib/heroComics.ts");

  it("the guard sits at the spend seam, so every caller is covered", () => {
    expect(comics).toContain("const journeyPageFailures = new Set<string>();");
    expect(comics).toContain("if (journeyPageFailures.has(key)) throw new JourneyPageFailedBeforeError(key);");
    expect(comics).toContain("if (!(error instanceof ComicGenerationCancelledError)) journeyPageFailures.add(key);");
    expect(comics).toContain("export function clearJourneyPageFailure(key: string): void {");
    // session-scoped only: a failure is never written to a device store
    expect(comics).not.toMatch(/putComicPage\([^)]*journeyPageFailures/);
  });

  it("only a deliberate request clears a failed key", () => {
    expect(player).toContain("clearJourneyPageFailure(artRequestKey)");
    // the cover's story-start/Redraw path and the one bounded finish retry
    expect((tab.match(/clearJourneyPageFailure\(/g) || []).length).toBe(2);
  });
});

describe("M2 R2 — the cover reads as a cover", () => {
  it("prints 'Cover' once: the nav counter, not a second eyebrow", () => {
    expect((tab.match(/kidsStoriesText\("journey\.cover", aiLang\)/g) || []).length).toBe(1);
  });

  it("lets the lettered art carry the title, keeping the text title as the fallback", () => {
    expect(tab).toContain("{!coverArt.url && (\n        <h3");
    expect(tab).toContain('alt={kidsStoriesText("journey.coverAlt", aiLang, { title: render.title || activeStory.title })}');
  });

  it("puts the hero on the front page, the same cameo the beats carry", () => {
    const cover = tab.slice(tab.indexOf("const coverPage = (immersiveMode: boolean)"), tab.indexOf("const playerBody = (immersiveMode: boolean)"));
    expect(cover).toContain("{heroAvatarUrl && (");
    expect(cover).toContain('insetInlineStart: "5%"');
    expect(cover).toContain('outline: "2px solid var(--comic-ink)"');
    expect(cover).toContain('kidsStoriesText("journey.heroAlt", aiLang, { name: isolate(heroName, aiLang) })');
    // the beats' cameo is the pattern being reused
    expect(player).toContain('insetInlineStart: "5%"');
  });

  it("turns the page off the cover instead of vanishing it", () => {
    expect(tab).toContain('<AnimatePresence mode="wait" initial={false}>');
    expect(tab).toContain('key="journey-cover"');
    expect(tab).toContain("key={`journey-beat-${displayScene.beatId}`}");
    // reduced motion collapses the flip, as the shared primitive does
    expect(tab).toContain("const reducedMotion = usePrefersReducedMotion();");
    expect(tab).toContain("exit={reducedMotion");
    expect(tab).toContain('transformOrigin: uiLang === "he" ? "right center" : "left center"');
  });
});

describe("M2 R2 — the reader's own controls clear the touch floor", () => {
  it("Immersive is 44 wide as well as 44 tall at 390", () => {
    const imm = tab.split("<button").slice(1).find((chunk) => chunk.includes("immersiveTriggerRef"))!;
    expect(imm).toContain("min-h-[44px]");
    expect(imm).toContain('minWidth: "var(--touch-min)"');
    expect(imm).toContain("justify-center");
    // the icon-only mobile treatment survives
    expect(imm).toContain('className="hidden sm:inline"');
  });

  it("the ending reflection toggles clear 44 in both registers", () => {
    expect(tab).toContain('className="w-full text-start p-2.5 min-h-[44px] rounded-xl transition flex items-start gap-2"');
    expect(tab).toContain('className="w-full rounded-xl p-3 min-h-[44px] text-start"');
  });

  it("NEGATIVE CONTROL: the pre-fix controls are what the rules reject", () => {
    expect('className="inline-flex items-center gap-1.5 text-sm font-bold px-2 min-h-[44px]"').not.toContain("minWidth");
    expect('className="w-full text-start p-2.5 rounded-xl transition flex items-start gap-2"').not.toContain("min-h-[44px]");
  });
});

describe("M2 R2 — no TDZ window on the cover helpers", () => {
  it("coverPageArgs is declared before its only caller", () => {
    expect(tab.indexOf("const coverPageArgs = ")).toBeLessThan(tab.indexOf("const drawCover = "));
  });
});
