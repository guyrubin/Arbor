import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { filterByAge, loadShowAllAges, windowFromRange } from "../../lib/ageFilter";
import { aimVirtues, loadCharter } from "../../lib/becoming";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { adventureTitle, getAdventure, isStrictComicImageDataUrl, readSavedMetaCoverFromStore, savedBookTitle, shelfBooks, type SavedComicMeta, type ShelfBook } from "../../lib/heroComics";
import { HERO_STORIES, storiesForLanguage, storyLanguage } from "../../lib/heroJourneys";
import { resolveHeroUrl } from "../../lib/heroIdentity";
import { kidArt, kidArtSrcSet, resolveKidTheme, storyCoverKey } from "../../lib/kidThemeManifest";
import { dayKey } from "../../practice/signals";
import type { HeroJourneyRun, HeroStorySpec } from "../../types";
import { kidShelfFor } from "../kidmode/kidBooks";
import { pickTonightsStory } from "../kidmode/tonightsStory";
import { useChildLibraryBooks } from "../kidmode/useChildLibraryBooks";
import { STORY_PACK_LABEL, STORY_PACK_SOFT, storyCardTitle } from "../stories/StoryCard";
import Icon from "../ui/Icon";
import { Sheet } from "../ui/Sheet";

/* ════════════════════════════════════════════════════════════════════════════
   TogetherStories — v3 F-TOG-2: the Stories pill (#/practice?f=stories).

   The old Stories, Comics and Bedtime pages folded into one grid of real
   cards: the catalogue stories this child can be told (story language first,
   then the age view, the family's aims, illustrated covers leading — the same
   gates the reader's pin applies, so every card opens its book), with a
   story started and not finished first and tonight's pick (the kid home's own
   helper and inputs) next. The family's saved comic books follow, each on its
   own cover (page one, read from this device's store under the comic maker's
   key token), else the story's catalogue art.

   A story opens the reader in a sheet (HeroJourneyTab, readerOnly: no page
   header, no tonight switch, no power filter, no "More stories"); a saved
   comic opens the parent's read-only comic reader in a sheet. "Create a story"
   asks TogetherView for its generator sheet. Nothing here grades the child:
   a chip names a book's place on the shelf, never progress through it.
   ════════════════════════════════════════════════════════════════════════════ */

const HeroJourneyReader = lazy(() => import("../tabs/HeroJourneyTab"));
const TogetherComicReader = lazy(() => import("./TogetherComicReader"));

type Reading = { childId: string; kind: "story" | "comic"; id: string; nonce: number };
type StoryCardData = { story: HeroStorySpec; chip: "tonight" | "continue" | null };

export default function TogetherStories({ headingId, onCreate }: { headingId: string; onCreate: () => void }) {
  const { childProfile } = useArbor();
  const { t, uiLang, aiLang } = useLanguage();
  const lang: "en" | "he" = uiLang === "he" ? "he" : "en";
  const storyLang = storyLanguage(uiLang, aiLang ?? uiLang);
  const runsCol = useChildCollection<HeroJourneyRun>(childProfile.id, "heroRuns");
  const savedCol = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const libraryBooks = useChildLibraryBooks(childProfile.id);
  const [readingState, setReading] = useState<Reading | null>(null);
  const reading = readingState && readingState.childId === childProfile.id ? readingState : null;
  const theme = resolveKidTheme(childProfile.kidTheme);
  const cover = (id: string) => kidArt(theme, storyCoverKey(id));
  const runs = runsCol.items ?? [];
  const saved = savedCol.items ?? [];
  const heroUrl = resolveHeroUrl(childProfile);
  const avatarKeyToken = heroUrl && heroUrl.startsWith("data:") ? heroUrl : "no-hero";

  const cards = useMemo<StoryCardData[]>(() => {
    const childMonths = ageMonthsFromProfile(childProfile);
    const showAllAges = loadShowAllAges("hero-journeys");
    const aims = aimVirtues(loadCharter());
    const told = storiesForLanguage(HERO_STORIES, storyLang);
    const ordered = aims.length ? [...told].sort((a, b) => (aims.includes(b.primaryMetric) ? 1 : 0) - (aims.includes(a.primaryMetric) ? 1 : 0)) : told;
    const visible = showAllAges ? ordered : filterByAge(ordered, (s) => windowFromRange(s.ageRange), childMonths).visible;
    const list = [...visible.filter((s) => cover(s.id)), ...visible.filter((s) => !cover(s.id))];
    const tonight = pickTonightsStory(dayKey(new Date()), childProfile.id, {
      readIds: runs.map((run) => run.storyId), aims, ageMonths: childMonths, showAllAges,
      prefer: (s) => cover(s.id) !== null, lang: storyLang, stories: kidShelfFor(libraryBooks),
    }).story;
    // The newest run with no ending is the story to pick up again.
    const open = [...runs].filter((run) => !run.completedAt).sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""))[0];
    const lead: StoryCardData[] = [];
    const again = open ? list.find((s) => s.id === open.storyId) : undefined;
    if (again) lead.push({ story: again, chip: "continue" });
    const first = tonight ? list.find((s) => s.id === tonight.id && s.id !== again?.id) : undefined;
    if (first) lead.push({ story: first, chip: "tonight" });
    const taken = new Set(lead.map((card) => card.story.id));
    return [...lead, ...list.filter((s) => !taken.has(s.id)).map((story) => ({ story, chip: null }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfile, storyLang, runs, libraryBooks, theme]);

  const comics = useMemo<ShelfBook[]>(() => {
    const { authored, extra } = shelfBooks(saved);
    return [...extra, ...authored.filter((book) => book.meta)];
  }, [saved]);
  // Each saved book's cover: page one from this device's store, checked the
  // way the reader checks its pages; anything else keeps the catalogue art.
  const comicsKey = `${childProfile.id}|${comics.map((book) => `${book.id}:${book.meta?.createdAt ?? ""}`).join(";")}`;
  const [comicCovers, setComicCovers] = useState<{ key: string; values: Record<string, string> }>({ key: "", values: {} });
  useEffect(() => {
    const books = comics.filter((book) => book.meta);
    if (books.length === 0) return;
    let live = true;
    void (async () => {
      const values: Record<string, string> = {};
      for (const book of books) {
        try {
          const page = book.meta ? await readSavedMetaCoverFromStore(childProfile.id, book.meta, avatarKeyToken) : undefined;
          if (page && isStrictComicImageDataUrl(page)) values[book.id] = page;
        } catch { /* the catalogue art stands in */ }
      }
      if (live) setComicCovers({ key: comicsKey, values });
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comicsKey, avatarKeyToken]);

  const close = () => setReading(null);
  const openStory = reading?.kind === "story" ? cards.find((card) => card.story.id === reading.id)?.story : undefined;
  const openComic = reading?.kind === "comic" ? comics.find((book) => book.id === reading.id) : undefined;
  const comicTitle = (book: ShelfBook) => (book.meta ? savedBookTitle(book.meta, lang, getAdventure(book.adventureId)) : adventureTitle(book, lang));
  const storyLine = (story: HeroStorySpec) => (lang === "he" ? story.themeHe || story.learningObjectiveHe || STORY_PACK_LABEL[story.pack].he : story.theme);

  return (
    <div className="together-stories" data-testid="together-stories">
      <div className="companion-section-heading">
        <div>
          <span className="companion-eyebrow">{t("companion.together-view.read-imagine-talk")}</span>
          <h2 id={headingId} tabIndex={-1}>{t("companion.together-view.which-story-shall-we-step-into")}</h2>
        </div>
        <button type="button" className="companion-text-button" data-testid="together-create-story" onClick={onCreate}>
          <Icon name="auto_stories" size={18} />
          {t("companion.together-view.door-create-story")}
        </button>
      </div>
      {cards.length === 0 && comics.length === 0 ? (
        <p className="companion-caption" data-testid="together-stories-none">{t("companion.together-view.stories-none")}</p>
      ) : (
        <ul className="companion-story-grid together-story-grid">
          {cards.map(({ story, chip }) => {
            const art = cover(story.id);
            return (
              <li key={story.id}>
                <button type="button" className="together-story-card" data-story={story.id} onClick={() => setReading({ childId: childProfile.id, kind: "story", id: story.id, nonce: Date.now() })}>
                  <span className="together-story-art" style={{ background: STORY_PACK_SOFT[story.pack] }}>
                    {art ? (
                      <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 539px) 92vw, 320px" width={art.width} height={Math.round((art.width * 4) / 3)} alt="" loading="lazy" decoding="async" style={{ objectPosition: art.objectPosition }} />
                    ) : (
                      <Icon name="auto_stories" size={30} style={{ color: STORY_PACK_LABEL[story.pack].ink }} />
                    )}
                    {chip && <span className="together-story-chip" data-testid={`together-story-${chip}`}>{chip === "tonight" ? t("companion.together-view.story-tonight") : t("companion.together-view.story-continue")}</span>}
                  </span>
                  <span className="together-story-copy">
                    <span className="together-story-title" dir="auto">{storyCardTitle(story, lang)}</span>
                    <span className="together-story-line" dir="auto">{storyLine(story)}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {comics.map((book) => {
            const page = comicCovers.key === comicsKey ? comicCovers.values[book.id] : undefined;
            const art = page ? null : cover(book.adventureId);
            return (
              <li key={book.id}>
                <button type="button" className="together-story-card" data-comic={book.id} onClick={() => setReading({ childId: childProfile.id, kind: "comic", id: book.id, nonce: Date.now() })}>
                  <span className="together-story-art" style={{ background: STORY_PACK_SOFT[book.pack] }}>
                    {page ? (
                      <img src={page} width={240} height={320} alt="" decoding="async" data-testid="together-comic-cover" />
                    ) : art ? (
                      <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 539px) 92vw, 320px" width={art.width} height={Math.round((art.width * 4) / 3)} alt="" loading="lazy" decoding="async" style={{ objectPosition: art.objectPosition }} />
                    ) : (
                      <Icon name="photo_library" size={30} style={{ color: STORY_PACK_LABEL[book.pack].ink }} />
                    )}
                    <span className="together-story-chip" data-testid="together-story-comic">{t("companion.together-view.story-comic")}</span>
                  </span>
                  <span className="together-story-copy">
                    <span className="together-story-title" dir="auto">{comicTitle(book)}</span>
                    <span className="together-story-line" dir="auto">{lang === "he" ? book.copy.themeHe : book.copy.theme}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {openStory && reading && (
        <Sheet open onClose={close} title={storyCardTitle(openStory, lang)}>
          <div className="together-sheet together-reader-sheet" data-testid="together-story-reader" dir={lang === "he" ? "rtl" : "ltr"}>
            <Suspense fallback={<p role="status" className="companion-caption">{t("companion.together-view.story-opening")}</p>}>
              <HeroJourneyReader key={`${reading.id}-${reading.nonce}`} readerOnly initialStoryId={reading.id} pinNonce={reading.nonce} onExit={close} />
            </Suspense>
          </div>
        </Sheet>
      )}
      {openComic && reading && (
        <Sheet open onClose={close} title={comicTitle(openComic)}>
          <div className="together-sheet together-reader-sheet" data-testid="together-comic-reader" dir={lang === "he" ? "rtl" : "ltr"}>
            <Suspense fallback={<p role="status" className="companion-caption">{t("companion.together-view.book-opening")}</p>}>
              <TogetherComicReader key={`${reading.id}-${reading.nonce}`} book={openComic} title={comicTitle(openComic)} onClose={close} />
            </Suspense>
          </div>
        </Sheet>
      )}
    </div>
  );
}
