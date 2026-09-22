import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { RegisterShell, PlayButton, PlayPanel } from "../ui/playkit";
import { EmptyState, GhostBlock } from "../ui/EmptyState";
import { statesText } from "../../lib/i18nElevation/states";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ComicReader } from "../stories/ComicReader";
import SavedComicReader from "../stories/SavedComicReader";
import {
  ADVENTURES,
  adventureTitle,
  getAdventure,
  isStrictComicImageDataUrl,
  readSavedMetaCoverFromStore,
  rehydrateSavedMetaPagesFromStore,
  savedMetaPagesAvailable,
  shelfBooks,
  toSavedComicMeta,
  type ComicRequestKind,
  type HeroComic,
  type SavedComicMeta,
  type ShelfBook,
} from "../../lib/heroComics";
import { isolate } from "../../lib/i18n";
import { normalizeAvatarStyle } from "../../lib/avatarStyle";
// W0.7 — age-fit filtering (shared helper; windows come from the canon
// HeroStorySpec ageRange each adventure is built from)
import { classifyAgeFit, loadShowAllAges, saveShowAllAges, windowFromRange } from "../../lib/ageFilter";
import { agefilterText } from "../../lib/i18nElevation/agefilter";
import { ageMonthsFromProfile } from "../../lib/childAge";
import { getStorySpec } from "../../lib/heroJourneys";
import { track } from "../../lib/analytics";
// TJB-28 — the shelf is where an evening actually ends, so this is the surface
// most likely to be open at the close of a day. It writes the return hook; the
// hook itself is SHOWN on Growth (components/nextopen/TomorrowReasonCard).
import { closeDay } from "../../lib/tomorrowReason";
import { readRitualRecord, ritualOfTheMoment } from "../../lib/familyRitualsCadence";
import { resolveWatchFocus } from "../../lib/screeningWatch";
import { countSince } from "../../lib/pulse";
import type { HeroPackId } from "../../types";
import { comicShelfReadIsCurrent } from "../../lib/comicShelfScope";

/**
 * ComicsTab (p1-comic-reader) — the bookshelf host for the `comics` route.
 * The shelf lists every canon ADVENTURE as a comic BOOK: saved books re-open
 * instantly from their cached pages ("Read again"), unread adventures invite
 * a fresh build ("Make this comic"). Opening a book mounts ComicReader, which
 * owns the whole multi-page experience (cover-first streaming build, RTL page
 * turns, per-page retry, save/share).
 *
 * M3 (22 Sep 2026): a shelf holds TWO kinds of book. Beside the authored
 * adventures sit the comics the child made by READING a story (`kind:
 * "journey"`, doc id `<adventureId>:journey`, frozen `comic4|journey|…` keys,
 * possibly for a story with no authored comic copy). Those were counted here
 * but never listed, so they had no tile and could not be opened. They now get
 * their own tile, and they are REPLAYED through the presentation-only
 * SavedComicReader — their pages were drawn for that story, so this surface
 * never re-generates one and never mounts ComicReader for one.
 *
 * COST GUARD: the shelf itself never generates anything — a book build (up to
 * ~6 image-gen calls, throttled by lib/sceneCache) starts only when the parent
 * explicitly opens a book. Saved books replay with zero new calls from the
 * in-session cache OR the device-local IndexedDB page store (AIX-S5).
 *
 * W5.4: the shelf is durable — saved books persist as METADATA ONLY through the
 * GDPR-registered "savedComics" child collection (Firestore + realtime, or the
 * localStorage sandbox). Art data-URLs never enter Firestore (1MB doc cap) or
 * localStorage (banned regression — lib/sceneCache).
 *
 * AIX-S5: page ART persists device-locally in IndexedDB (lib/comicPageStore —
 * keyed per child, LRU-bounded, purged on child erase + sign-out, NEVER
 * uploaded/synced). The shelf badge is honest: "Read again" only when every
 * page is available on this device, else "Rebuild this book". Cross-DEVICE
 * durability stays the separate Guy-gated Firebase Storage decision (GG-6).
 */

/** Comic-world skin per pack (matches HeroJourneyTab + the Hero Arcade layer). */
const PACK_WORLD: Record<HeroPackId, { bg: string; ink: string; label: string; labelHe: string }> = {
  courage: { bg: "var(--arbor-peach)", ink: "var(--arbor-peach-ink)", label: "Courage", labelHe: "אומץ" },
  responsibility: { bg: "var(--arbor-yellow)", ink: "var(--arbor-yellow-ink)", label: "Responsibility", labelHe: "אחריות" },
  growth: { bg: "var(--arbor-clay)", ink: "var(--arbor-clay-deep)", label: "Growth", labelHe: "צמיחה" },
  wisdom: { bg: "var(--arbor-sky)", ink: "var(--arbor-sky-ink)", label: "Wisdom", labelHe: "חוכמה" },
  truth: { bg: "var(--arbor-pack-truth)", ink: "var(--arbor-pack-truth)", label: "Truth", labelHe: "אמת" },
};

/** Per-story scene prop, so an unread book still shows the hero in-world. */
const STORY_EMOJI: Record<string, string> = {
  "david-and-goliath": "🛡️",
  "moses-and-pharaoh": "👑",
  "the-lion-who-was-afraid": "🦁",
  "noahs-ark": "🌈",
  "jonah-and-the-great-fish": "🐋",
  "the-dragon-of-responsibility": "🐉",
  "joseph-and-his-brothers": "🧥",
  "jacob-wrestling-the-angel": "🌅",
  "the-garden-of-forgotten-seeds": "🌻",
  "king-solomons-choice": "⚖️",
  "the-lantern-path": "🏮",
  "the-cloud-orchestra": "🎼",
  "the-little-bridge-builders": "🌉",
};

const savedMetaFingerprint = (meta: SavedComicMeta): string =>
  JSON.stringify([meta.id, meta.adventureId, meta.lang, meta.createdAt, meta.pageCount, meta.identityVersion, meta.pageKeys]);

export default function ComicsTab() {
  const { childProfile, setActiveTab, openPaywall, milestones, behaviorLogs, playLogs } = useArbor();
  const { user } = useAuth();
  const { aiLang, t } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  // The durable shelf: one metadata doc per saved BOOK. A parent-built book
  // sits at the adventureId; the comic the child made by reading the same
  // story sits at `<adventureId>:journey` (M3 — they are two books).
  const savedCol = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  // Every authored adventure is a tile; every saved book that is NOT one of
  // those slots (a read-along comic, including one for a story with no
  // authored copy) is a tile of its own — so the shelf lists what it counts.
  const { authored: authoredBooks, extra: journeyBooks } = useMemo(
    () => shelfBooks(savedCol.items),
    [savedCol.items]
  );
  /** Every slot the shelf can open, by doc id (age filter never hides a slot
   *  from `openComic` — it only decides which tiles are drawn). */
  const shelfByDocId = useMemo(
    () => Object.fromEntries([...authoredBooks, ...journeyBooks].map((b) => [b.id, b])) as Record<string, ShelfBook>,
    [authoredBooks, journeyBooks]
  );
  // The adventure currently open in the reader (null = bookshelf). AIX-S5:
  // opening a saved book first rehydrates its pages (memory cache → the
  // device-local IndexedDB store) so the reader mounts with the art in hand —
  // fully cached books re-open with ZERO /generate-comic calls.
  const [openBook, setOpenBook] = useState<{
    partitionKey: string;
    scopeKey: string;
    fingerprint?: string;
    /** The shelf slot (doc id) that was opened. */
    id: string;
    /** The story behind that slot — what the catalog is keyed by. */
    adventureId: string;
    /** A journey book is READ-ONLY: it never mounts a generating reader. */
    kind: ComicRequestKind;
    pages: string[];
    lang: "en" | "he";
    meta?: SavedComicMeta;
  } | null>(null);

  // W0.7 — default the bookshelf to the child's age band; "Show all ages"
  // (persisted per surface) keeps every book reachable (UC-1 rule). SAVED
  // books are ALWAYS shown regardless of age fit — the shelf is the child's
  // own library, never pruned by a filter.
  const [showAllAges, setShowAllAges] = useState<boolean>(() => loadShowAllAges("comics"));
  const childMonths = ageMonthsFromProfile(childProfile);
  const toggleShowAllAges = () => {
    setShowAllAges((prev) => {
      const next = !prev;
      saveShowAllAges("comics", next);
      track("agefilter_toggle", { surface: "comics", showAll: next });
      return next;
    });
  };

  const he = aiLang === "he";
  const heroDataUrl = heroUrl && heroUrl.startsWith("data:") ? heroUrl : undefined;
  // Must match generatePage's cache-key token so rehydration finds its pages.
  const avatarKeyToken = heroDataUrl || "no-hero";
  const heroStyle = normalizeAvatarStyle(childProfile.avatar?.style);
  const savedCount = savedCol.items.length;
  const partitionKey = `${user?.uid ?? "anon"}|${childProfile.id}`;
  const collectionFingerprint = savedCol.items.map(savedMetaFingerprint).sort().join(";");
  const scopeKey = `${partitionKey}|${avatarKeyToken}|${collectionFingerprint}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const openRequestRef = useRef(0);
  const probeRequestRef = useRef(0);
  const visibleOpenBook = openBook?.partitionKey === partitionKey && openBook.scopeKey === scopeKey
    ? openBook
    : null;

  // TJB-28 — the close half. Before the closing hour this is a no-op, and it
  // writes at most once a day; the shelf itself never renders the hook.
  useEffect(() => {
    const now = Date.now();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    closeDay(childProfile.id, now, {
      ritualDue: ritualOfTheMoment(now, readRitualRecord()) !== null,
      watchFocus: resolveWatchFocus(childProfile.id, milestones) != null,
      // An authored adventure with no saved book of its own is still unopened —
      // read-along comics live in their own slots and never mask one.
      unopenedStory: authoredBooks.some((book) => !book.meta),
      momentsToday:
        countSince(behaviorLogs, startOfToday, now) + countSince(playLogs, startOfToday, now),
    });
    // One write per mount is the whole intent — the day's reason must not be
    // re-chosen as the parent browses the shelf.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AIX-S5 honesty layer: per saved adventure, are ALL pages available on this
  // device? Only then does the shelf promise "Read again"; otherwise the badge
  // says "Rebuild this book" so the promise matches the real cost/latency.
  const [fullyCached, setFullyCached] = useState<{ scope: string; values: Record<string, boolean> }>({ scope: "", values: {} });
  const [coverThumbs, setCoverThumbs] = useState<{ scope: string; values: Record<string, string> }>({ scope: "", values: {} });
  const scopedCached = fullyCached.scope === scopeKey ? fullyCached.values : {};
  const scopedCovers = coverThumbs.scope === scopeKey ? coverThumbs.values : {};
  useEffect(() => {
    openRequestRef.current += 1;
    setOpenBook(null);
    setFullyCached({ scope: "", values: {} });
    setCoverThumbs({ scope: "", values: {} });
  }, [partitionKey]);
  useEffect(() => {
    const request = ++probeRequestRef.current;
    const startedScope = scopeKey;
    (async () => {
      const map: Record<string, boolean> = {};
      const covers: Record<string, string> = {};
      // Keyed by DOC id: two books for one story must not share a verdict.
      for (const m of savedCol.items) {
        try {
          map[m.id] = await savedMetaPagesAvailable(childProfile.id, m, avatarKeyToken);
          if (map[m.id]) {
            const cover = await readSavedMetaCoverFromStore(childProfile.id, m, avatarKeyToken);
            if (cover && isStrictComicImageDataUrl(cover)) covers[m.id] = cover;
          }
        } catch {
          map[m.id] = false;
        }
      }
      if (comicShelfReadIsCurrent(
        { request, scope: startedScope },
        { request: probeRequestRef.current, scope: scopeRef.current },
      )) {
        setFullyCached({ scope: startedScope, values: map });
        setCoverThumbs({ scope: startedScope, values: covers });
      }
    })();
    return () => { probeRequestRef.current += 1; };
    // Re-probe when the shelf, language, avatar or open book changes (a fresh
    // build persists pages, so returning from the reader can flip a badge).
  }, [savedCol.items, avatarKeyToken, childProfile.id, openBook, scopeKey]);

  const openComic = (docId: string) => {
    const request = ++openRequestRef.current;
    const startedScope = scopeKey;
    const book = shelfByDocId[docId];
    if (!book) return;
    const isCurrent = () => comicShelfReadIsCurrent(
      { request, scope: startedScope },
      { request: openRequestRef.current, scope: scopeRef.current },
    );
    const meta = book.meta;
    if (!meta) {
      // An unsaved slot is always an authored adventure: this is the ONE entry
      // that starts a build, and it never fires for a read-along comic.
      setOpenBook({ partitionKey, scopeKey, id: docId, adventureId: book.adventureId, kind: "book", pages: [], lang: aiLang });
      return;
    }
    const fingerprint = savedMetaFingerprint(meta);
    // Saved book: rehydrate (all-or-nothing) before mounting the reader.
    void rehydrateSavedMetaPagesFromStore(childProfile.id, meta, avatarKeyToken)
      .then((pages) => {
        if (!isCurrent()) return;
        // A read-along comic is presentation of stored bytes only — with any
        // page missing there is nothing honest to show, so the tile flips to
        // its off-device state instead of opening an empty reader.
        if (book.kind === "journey" && !(pages.length > 0 && pages.every(isStrictComicImageDataUrl))) {
          setFullyCached((state) => state.scope === startedScope
            ? { ...state, values: { ...state.values, [docId]: false } }
            : state);
          return;
        }
        setOpenBook({ partitionKey, scopeKey, fingerprint, id: docId, adventureId: book.adventureId, kind: book.kind, pages, lang: meta.lang, meta });
      })
      .catch(() => {
        if (!isCurrent()) return;
        if (book.kind === "journey") {
          setFullyCached((state) => state.scope === startedScope
            ? { ...state, values: { ...state.values, [docId]: false } }
            : state);
          return;
        }
        setOpenBook({ partitionKey, scopeKey, fingerprint, id: docId, adventureId: book.adventureId, kind: book.kind, pages: [], lang: meta.lang, meta });
      });
  };

  // No hero yet → invite the parent to create one (cross-domain entry point).
  // AIX-S7: the entry-gate bookend follows the file's he? pattern — Hebrew
  // families must not hit English exactly where register matters most.
  if (!hasHero) {
    return (
      <RegisterShell
        kidMode={false}
        title={t("nav.tab.comics")}
        subtitle={he ? `הפכו את ${name} לכוכב של ספר קומיקס משלו.` : `Turn ${name} into the star of their own comic book.`}
      >
        <PlayPanel tone="lav" className="text-center">
          <p className="text-[1.3rem] font-extrabold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
            {he ? `קודם כול, צרו את הגיבור של ${isolate(name)}` : `First, create ${isolate(name)}'s hero`}
          </p>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {he
              ? `צרו ל${name} דמות מאוירת משלו — ומשם הוא מככב בכל סיפור, קומיקס והרפתקה באקדמיה של ארבור.`
              : `Create ${isolate(name)}'s own illustrated character — then they star in every Academy story, comic and adventure across Arbor.`}
          </p>
          <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
            <Icon name="auto_awesome" size={16} /> {he ? `צרו את הגיבור של ${isolate(name)}` : `Create ${isolate(name)}'s hero`}
          </PlayButton>
        </PlayPanel>
      </RegisterShell>
    );
  }

  // ── Reader view — one open book ────────────────────────────────────────────
  const openAdventure = visibleOpenBook ? getAdventure(visibleOpenBook.adventureId) : undefined;
  if (visibleOpenBook && openAdventure && visibleOpenBook.kind === "journey" && visibleOpenBook.meta) {
    // M3 — a read-along comic is REPLAYED, never rebuilt: the parent sees the
    // exact pages the child's story produced, straight from the device store,
    // with no generation, save or paywall seam in reach. Page count comes from
    // the stored pages, which are cover + every beat of THAT story.
    const journeyMeta = visibleOpenBook.meta;
    const journeyTitle = journeyMeta.title || adventureTitle(openAdventure, journeyMeta.lang);
    const journeyPages = visibleOpenBook.pages.map((dataUrl, index) => ({
      dataUrl,
      title: index === 0 ? journeyTitle : `${adventureTitle(openAdventure, journeyMeta.lang)} · ${index}`,
    }));
    return (
      <RegisterShell kidMode={false} title={journeyTitle}>
        <SavedComicReader
          key={`${partitionKey}|${visibleOpenBook.id}|${journeyMeta.createdAt}`}
          title={journeyTitle}
          lang={journeyMeta.lang}
          pages={journeyPages}
          onBack={() => setOpenBook(null)}
          onUnavailable={() => {
            setOpenBook(null);
            setFullyCached((state) => state.scope === scopeKey
              ? { ...state, values: { ...state.values, [visibleOpenBook.id]: false } }
              : state);
          }}
        />
      </RegisterShell>
    );
  }
  if (visibleOpenBook && openAdventure) {
    // Re-open a saved book in the CURRENT language: the pages were rehydrated
    // in openComic (memory cache → device-local IndexedDB store) — a fully
    // available book mounts with zero /generate-comic calls; any miss hands
    // ComicReader an empty pageUrls so it falls back to a fresh build (whose
    // pages then persist through the store). `createdAt` carries over so
    // re-saving upserts the same shelf slot.
    const meta = visibleOpenBook.meta;
    const savedBook: HeroComic | undefined = meta
      ? {
          id: meta.id,
          adventureId: meta.adventureId,
          title: meta.title || adventureTitle(openAdventure, meta.lang),
          lang: meta.lang,
          pageUrls: visibleOpenBook.pages,
          createdAt: meta.createdAt,
          pageKeys: meta.pageKeys,
        }
      : undefined;
    return (
      <RegisterShell kidMode={false} title={adventureTitle(openAdventure, visibleOpenBook.lang)}>
        <ComicReader
          key={`${partitionKey}|${openAdventure.id}|${visibleOpenBook.lang}|${meta?.createdAt ?? "new"}`}
          adventure={openAdventure}
          lang={visibleOpenBook.lang}
          heroName={name}
          heroDataUrl={heroDataUrl}
          saved={savedBook}
          childId={childProfile.id}
          heroStyle={heroStyle}
          onSave={(comic) => { void savedCol.upsert(toSavedComicMeta(comic)); }}
          onClose={() => setOpenBook(null)}
          // Paywall stop: open the upgrade sheet and return to the shelf — the
          // stopped build would otherwise leave un-generated pages spinning.
          onPaywall={(err) => {
            setOpenBook(null);
            openPaywall(err.feature || "heroComic", err.plan);
          }}
        />
      </RegisterShell>
    );
  }

  // ── Bookshelf view ─────────────────────────────────────────────────────────
  // W0.7 — per-adventure age fit from the canon story spec it was built from.
  // Saved books always show (the child's own shelf); unsaved out-of-band books
  // sit behind the "Show all ages" door with an age chip explaining why.
  const adventureFit = (id: string) =>
    classifyAgeFit(windowFromRange(getStorySpec(id)?.ageRange), childMonths);
  const shownAuthored = showAllAges
    ? authoredBooks
    : authoredBooks.filter((a) => !!a.meta || adventureFit(a.adventureId) !== "out");
  // Saved read-along comics are never age-filtered — they are books the child
  // already made, and they are listed, not just counted.
  const shelfAdventures = [...shownAuthored, ...journeyBooks];
  const shelfTotal = ADVENTURES.length + journeyBooks.length;
  const hiddenAdventures = authoredBooks.length - shownAuthored.length;
  const hiddenSpecs = authoredBooks
    .filter((a) => !shownAuthored.includes(a))
    .map((a) => getStorySpec(a.adventureId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  // IA-08 / RUN-12: `#/comics` is a PARENT door — no Kid-Mode surface mounts
  // ComicsTab (KidModeOverlay maps only `arcade` and `journeys`, and the
  // in-hub Hero Comics tile is behind `kidNav`, which is null while kid-locked).
  // So the register is fixed at parent: kit chrome, no `.arbor-play` wash.
  return (
    <RegisterShell
      kidMode={false}
      title={t("nav.tab.comics")}
      subtitle={he ? `כל הרפתקה היא ספר קומיקס שלם — בכיכוב ${name}!` : `Every adventure is a whole comic book — starring ${name}!`}
    >

      {/* item 11 (IA-02): the surface contract reaches the DOM. `data-module`
          marks a top-level sibling module (counted against the route's
          moduleBudget); `data-primary-move` marks the ONE control the
          contract declares. Playkit primitives take no data-* props, so the
          stamp goes on a wrapping <section> that adds no box of its own. */}
      {/* Shelf summary */}
      <section data-module="comics-shelf-summary">
      <PlayPanel tone="clay">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <p className="text-[1.05rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
              {he ? `מדף הקומיקס של ${isolate(name)}` : `${isolate(name)}'s comic bookshelf`}
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {he ? `${savedCount} מתוך ${shelfTotal} ספרים על המדף` : `${savedCount} of ${shelfTotal} books on the shelf`}
            </p>
          </div>
          {/* W0.7 — "Show all ages" toggle: only when the child's-age view
              actually hides books (or the parent already opted in). */}
          {(hiddenAdventures > 0 || showAllAges) && (
            <span className="ms-auto inline-flex items-center gap-2">
              {!showAllAges && hiddenAdventures > 0 && (
                <span className="text-[11.5px] font-black" style={{ color: "var(--arbor-muted)" }} dir="auto">
                  {agefilterText("elev.agefilter.hiddenCount", he, { n: hiddenAdventures })}
                </span>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={showAllAges}
                onClick={toggleShowAllAges}
                data-testid="agefilter-toggle-comics"
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-black"
                style={{
                  background: showAllAges ? "var(--arbor-yellow)" : "#fff",
                  border: "2px solid var(--comic-ink)",
                  color: "var(--arbor-ink)",
                }}
              >
                <Icon name={showAllAges ? "check" : "unfold_more"} size={14} />
                {agefilterText("elev.agefilter.showAll", he)}
              </button>
            </span>
          )}
        </div>
      </PlayPanel>
      </section>

      {/* Masterplan 4.3 — teach-empty for the untouched shelf: a ghost
          bookshelf shows what saved books will look like lined up, with ONE
          CTA that opens the first age-fit adventure (the same openComic path
          every cover uses — no second build entry). Copy = elev.states.
          comics.* (en+he, encouraging, never celebrating the zero). */}
      {savedCount === 0 && shelfAdventures.length > 0 && (
        <PlayPanel tone="lav">
          <EmptyState
            className="py-4"
            headline={statesText("elev.states.comics.head", he)}
            body={statesText("elev.states.comics.body", he, { name })}
            cta={statesText("elev.states.comics.cta", he)}
            ctaTestId="comics-empty-cta"
            onCta={() => {
              try { track("empty_cta_tap", { surface: "comics" }); } catch { /* noop */ }
              openComic(shelfAdventures[0].id);
            }}
            preview={
              /* Ghost bookshelf: three muted book covers on a shelf line —
                 the filled state in miniature. */
              <div className="mx-auto w-full max-w-[260px]">
                <div className="flex items-end justify-center gap-2.5">
                  <GhostBlock className="w-16 rounded-md" style={{ height: 64 }} />
                  <GhostBlock className="w-16 rounded-md" style={{ height: 78 }} />
                  <GhostBlock className="w-16 rounded-md" style={{ height: 70 }} />
                </div>
                <div className="mt-1 h-1.5 rounded-full" style={{ background: "var(--arbor-rule)" }} />
              </div>
            }
          />
        </PlayPanel>
      )}

      {/* W0.7 — honest empty state when every book is for other ages. */}
      {shelfAdventures.length === 0 && hiddenSpecs.length > 0 && (
        <PlayPanel tone="lav" className="text-center">
          <p className="text-[14px] font-black" dir="auto" data-testid="agefilter-empty-comics" style={{ color: "var(--arbor-ink)" }}>
            {agefilterText("elev.agefilter.empty", he, {
              min: Math.min(...hiddenSpecs.map((s) => s.ageRange[0])),
              max: Math.max(...hiddenSpecs.map((s) => s.ageRange[1])),
              name,
            })}
          </p>
          <PlayButton tone="clay" className="mt-3" onClick={toggleShowAllAges}>
            <Icon name="unfold_more" size={15} /> {agefilterText("elev.agefilter.showAll", he)}
          </PlayButton>
        </PlayPanel>
      )}

      {/* Book grid — every canon adventure as a multi-page comic book. The
          declared primaryMove for #/comics is "open-comic": opening a book off
          the shelf. Stamped once, on the shelf itself. */}
      <div data-module="comics-shelf" data-primary-move="open-comic" className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {shelfAdventures.map((a) => {
          const w = PACK_WORLD[a.pack];
          const emoji = STORY_EMOJI[a.adventureId] ?? "⭐";
          const saved = a.meta;
          // Cover thumbnail read from the device store for this exact slot.
          const coverThumb = saved ? scopedCovers[a.id] : undefined;
          // Authored books title from the catalog in the CURRENT language; a
          // read-along comic keeps the title the story gave it.
          const title = a.kind === "journey" && saved?.title ? saved.title : adventureTitle(a, aiLang);
          // AIX-S5 honesty: "Read again" ONLY when every page is available on
          // this device (memory or IndexedDB) — a cold state (new device, or
          // pages evicted) says "Rebuild this book" instead of promising an
          // instant re-read that actually re-pays a full build.
          const readAgain = !!saved && scopedCached[a.id] === true;
          // M3 — a read-along comic can only ever be REPLAYED: its pages were
          // drawn for the story the child read, so a "rebuild" would be a
          // different book. With the bytes gone the tile says so and opens
          // nothing; reading the story again is what makes a new one.
          const offDevice = a.kind === "journey" && !readAgain;
          const badgeLabel = readAgain
            ? (he ? "לקרוא שוב" : "Read again")
            : offDevice
            ? (he ? "לא במכשיר הזה" : "Not on this device")
            : saved
            ? (he ? "לבנות את הספר מחדש" : "Rebuild this book")
            : (he ? "צרו את הקומיקס" : "Make this comic");
          const coverFace = (
            <>
              {coverThumb ? (
                <img src={coverThumb} alt="" className="absolute inset-0 w-full h-full object-contain" />
              ) : (
                <div className="comic-halftone absolute inset-0 grid place-items-center">
                  <div className="flex items-center gap-1.5">
                    <HeroAvatar size={74} ring animate={false} decorative />
                    <span style={{ fontSize: 42, filter: "drop-shadow(2px 2px 0 rgba(23,27,34,.3))" }} aria-hidden="true">{emoji}</span>
                  </div>
                </div>
              )}
              <span
                className="absolute bottom-2 inline-flex items-center gap-1 text-[12px] font-black rounded-full px-3 py-1"
                style={{ insetInlineStart: 8, background: "#fff", border: "var(--comic-line)", color: "var(--arbor-ink)" }}
              >
                <Icon name={readAgain ? "menu_book" : offDevice ? "cloud_off" : "auto_awesome"} size={14} /> {badgeLabel}
              </span>
            </>
          );
          return (
            <div key={a.id} className="comic-panel overflow-hidden" data-book-kind={a.kind}>
              {/* Book cover: the saved cover art, or the hero waiting in this world */}
              <div className="relative" style={{ aspectRatio: "3 / 2", borderBottom: "var(--comic-line)" }}>
                {offDevice ? (
                  /* Nothing to open: a plain face, not a control that lies. */
                  <div
                    className="absolute inset-0 grid place-items-center"
                    style={coverThumb ? undefined : { background: w.bg }}
                    data-testid={`comic-offdevice-${a.id}`}
                  >
                    {coverFace}
                  </div>
                ) : (
                <button
                  onClick={() => openComic(a.id)}
                  aria-label={readAgain
                    ? (he ? `לקרוא שוב: ${title}` : `Read again: ${title}`)
                    : saved
                    ? (he ? `לבנות את הספר מחדש: ${title}` : `Rebuild this book: ${title}`)
                    : (he ? `צרו קומיקס: ${title}` : `Make this comic: ${title}`)}
                  className="absolute inset-0 grid place-items-center"
                  style={coverThumb ? undefined : { background: w.bg }}
                >
                  {coverFace}
                </button>
                )}
              </div>

              {/* Caption */}
              <div className="p-3.5">
                {/* Wraps at 390: a read-along comic can carry one chip more
                    than an authored book, and nothing may push out of the
                    panel (containment floor). */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                    {title}
                  </span>
                  <span className="ms-auto inline-flex items-center gap-1.5">
                    {/* W0.7 age chip — only on out-of-band books (a catalog
                        fact about the story, never a claim about the child). */}
                    {/* M3 — which of the two books this is, so a story with both
                        a parent-built book and a read-along comic reads as two
                        books rather than a duplicate. */}
                    {a.kind === "journey" && (
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full" dir="auto" style={{ border: "2px solid var(--comic-ink)", color: "var(--arbor-ink)" }}>
                        {he ? "מהסיפור" : "From the story"}
                      </span>
                    )}
                    {adventureFit(a.adventureId) === "out" && getStorySpec(a.adventureId) && (
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full" dir="auto" style={{ background: "#fff", border: "2px solid var(--comic-ink)", color: "var(--arbor-ink)" }}>
                        {agefilterText("elev.agefilter.chip", he, {
                          min: getStorySpec(a.adventureId)!.ageRange[0],
                          max: getStorySpec(a.adventureId)!.ageRange[1],
                        })}
                      </span>
                    )}
                    <span className="inline-block text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ border: "2px solid var(--comic-ink)", color: w.ink }}>
                      {he ? w.labelHe : w.label}
                    </span>
                  </span>
                </div>
                {saved && !offDevice && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black mt-2" style={{ color: "var(--arbor-green-ink)" }}>
                    <Icon name="check" size={14} /> {he ? "על המדף" : "On the shelf"}
                  </span>
                )}
                {offDevice && (
                  <p className="text-[11px] mt-2" dir="auto" style={{ color: "var(--arbor-muted)" }}>
                    {he
                      ? "הדפים של הקומיקס הזה לא נמצאים במכשיר הזה. קריאה נוספת של הסיפור תיצור קומיקס חדש."
                      : "This comic's pages are not on this device. Reading the story again makes a new one."}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AIX-S7: trust/safety bookend in the file's he? pattern. The
          never-a-real-photo and provenance-watermark claims survive verbatim
          in meaning in BOTH languages (comicsBookendsI18n.test.ts locks it). */}
      <div className="rounded-2xl p-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-ink)" }}>
        <span className="font-extrabold inline-flex items-center gap-1.5" style={{ color: "var(--arbor-green-ink)" }} dir="auto">
          <Icon name="verified_user" size={16} /> {he ? "בטוח ופרטי" : "Safe & private"}
        </span>
        <span style={{ color: "var(--arbor-muted)" }} dir="auto">
          {he
            ? `הקומיקס משתמש בדמות הגיבור המצוירת השמורה של ${isolate(name)} — לעולם לא בתמונה אמיתית. התמונות נוצרות בבינה מלאכותית ומסומנות בסימן מים של מקור.`
            : `Comics use ${isolate(name)}'s saved cartoon hero — never a real photo. Images are AI-made and provenance-watermarked.`}
        </span>
      </div>
    </RegisterShell>
  );
}
