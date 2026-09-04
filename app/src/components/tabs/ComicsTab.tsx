import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "../ui/Icon";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { useChildCollection } from "../../hooks/useChildCollection";
import { PlayShell, PlayHeader, PlayButton, PlayPanel } from "../ui/playkit";
import { EmptyState, GhostBlock } from "../ui/EmptyState";
import { statesText } from "../../lib/i18nElevation/states";
import { HeroAvatar, useHeroAvatar } from "../ui/HeroAvatar";
import { ComicReader } from "../stories/ComicReader";
import {
  ADVENTURES,
  adventureTitle,
  comicKey,
  getAdventure,
  rehydrateSavedPagesFromStore,
  savedPagesAvailable,
  toSavedComicMeta,
  type HeroComic,
  type SavedComicMeta,
} from "../../lib/heroComics";
import { getScene } from "../../lib/sceneCache";
import { isolate } from "../../lib/i18n";
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

/**
 * ComicsTab (p1-comic-reader) — the bookshelf host for the `comics` route.
 * The shelf lists every canon ADVENTURE as a comic BOOK: saved books re-open
 * instantly from their cached pages ("Read again"), unread adventures invite
 * a fresh build ("Make this comic"). Opening a book mounts ComicReader, which
 * owns the whole multi-page experience (cover-first streaming build, RTL page
 * turns, per-page retry, save/share).
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
};

export default function ComicsTab() {
  const { childProfile, setActiveTab, openPaywall, milestones, behaviorLogs, playLogs } = useArbor();
  const { aiLang } = useLanguage();
  const { url: heroUrl, hasHero, name } = useHeroAvatar();

  // The durable shelf: one metadata doc per saved adventure (doc id = adventureId).
  const savedCol = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const savedByAdventure = useMemo(
    () => Object.fromEntries(savedCol.items.map((m) => [m.adventureId, m])) as Record<string, SavedComicMeta>,
    [savedCol.items]
  );
  // The adventure currently open in the reader (null = bookshelf). AIX-S5:
  // opening a saved book first rehydrates its pages (memory cache → the
  // device-local IndexedDB store) so the reader mounts with the art in hand —
  // fully cached books re-open with ZERO /generate-comic calls.
  const [openBook, setOpenBook] = useState<{ id: string; pages: string[] } | null>(null);

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
  const savedCount = savedCol.items.length;

  // TJB-28 — the close half. Before the closing hour this is a no-op, and it
  // writes at most once a day; the shelf itself never renders the hook.
  useEffect(() => {
    const now = Date.now();
    const startOfToday = new Date(now).setHours(0, 0, 0, 0);
    closeDay(childProfile.id, now, {
      ritualDue: ritualOfTheMoment(now, readRitualRecord()) !== null,
      watchFocus: resolveWatchFocus(childProfile.id, milestones) != null,
      unopenedStory: savedCount < ADVENTURES.length,
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
  const [fullyCached, setFullyCached] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const map: Record<string, boolean> = {};
      for (const m of savedCol.items) {
        try {
          map[m.adventureId] = await savedPagesAvailable(childProfile.id, m.adventureId, aiLang, avatarKeyToken);
        } catch {
          map[m.adventureId] = false;
        }
      }
      if (alive) setFullyCached(map);
    })();
    return () => { alive = false; };
    // Re-probe when the shelf, language, avatar or open book changes (a fresh
    // build persists pages, so returning from the reader can flip a badge).
  }, [savedCol.items, aiLang, avatarKeyToken, childProfile.id, openBook]);

  const openComic = (id: string) => {
    if (!savedByAdventure[id]) {
      setOpenBook({ id, pages: [] });
      return;
    }
    // Saved book: rehydrate (all-or-nothing) before mounting the reader.
    void rehydrateSavedPagesFromStore(childProfile.id, id, aiLang, avatarKeyToken)
      .then((pages) => setOpenBook({ id, pages }))
      .catch(() => setOpenBook({ id, pages: [] }));
  };

  // No hero yet → invite the parent to create one (cross-domain entry point).
  // AIX-S7: the entry-gate bookend follows the file's he? pattern — Hebrew
  // families must not hit English exactly where register matters most.
  if (!hasHero) {
    return (
      <PlayShell>
        <PlayHeader
          title="Hero Comics"
          say={he ? `הפכו את ${name} לכוכב של ספר קומיקס משלו.` : `Turn ${name} into the star of their own comic book.`}
          mood="cheer"
        />
        <PlayPanel tone="lav" className="text-center">
          <p className="text-[1.3rem] font-extrabold mb-2" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
            {he ? `קודם כול, צרו את הגיבור של ${isolate(name)}` : `First, create ${isolate(name)}'s hero`}
          </p>
          <p className="text-sm mb-5 max-w-md mx-auto" style={{ color: "var(--arbor-muted)" }} dir="auto">
            {he
              ? `הפכו את ${name} לגיבור־על מצויר משלו — ומשם הוא מככב בכל סיפור, קומיקס והרפתקה באקדמיה של ארבור.`
              : `Make ${name} into their own comic superhero — then they star in every Academy story, comic and adventure across Arbor.`}
          </p>
          <PlayButton tone="clay" onClick={() => setActiveTab("profile")}>
            <Icon name="auto_awesome" size={16} /> {he ? `צרו את הגיבור של ${isolate(name)}` : `Create ${isolate(name)}'s hero`}
          </PlayButton>
        </PlayPanel>
      </PlayShell>
    );
  }

  // ── Reader view — one open book ────────────────────────────────────────────
  const openAdventure = openBook ? getAdventure(openBook.id) : undefined;
  if (openBook && openAdventure) {
    // Re-open a saved book in the CURRENT language: the pages were rehydrated
    // in openComic (memory cache → device-local IndexedDB store) — a fully
    // available book mounts with zero /generate-comic calls; any miss hands
    // ComicReader an empty pageUrls so it falls back to a fresh build (whose
    // pages then persist through the store). `createdAt` carries over so
    // re-saving upserts the same shelf slot.
    const meta = savedByAdventure[openAdventure.id];
    const savedBook: HeroComic | undefined = meta
      ? {
          id: meta.id,
          adventureId: meta.adventureId,
          title: adventureTitle(openAdventure, aiLang),
          lang: aiLang,
          pageUrls: openBook.pages,
          createdAt: meta.createdAt,
        }
      : undefined;
    return (
      <PlayShell>
        <ComicReader
          adventure={openAdventure}
          lang={aiLang}
          heroName={name}
          heroDataUrl={heroDataUrl}
          saved={savedBook}
          childId={childProfile.id}
          onSave={(comic) => { void savedCol.upsert(toSavedComicMeta(comic)); }}
          onClose={() => setOpenBook(null)}
          // Paywall stop: open the upgrade sheet and return to the shelf — the
          // stopped build would otherwise leave un-generated pages spinning.
          onPaywall={(err) => {
            setOpenBook(null);
            openPaywall(err.feature || "heroComic", err.plan);
          }}
        />
      </PlayShell>
    );
  }

  // ── Bookshelf view ─────────────────────────────────────────────────────────
  // W0.7 — per-adventure age fit from the canon story spec it was built from.
  // Saved books always show (the child's own shelf); unsaved out-of-band books
  // sit behind the "Show all ages" door with an age chip explaining why.
  const adventureFit = (id: string) =>
    classifyAgeFit(windowFromRange(getStorySpec(id)?.ageRange), childMonths);
  const shelfAdventures = showAllAges
    ? ADVENTURES
    : ADVENTURES.filter((a) => !!savedByAdventure[a.id] || adventureFit(a.id) !== "out");
  const hiddenAdventures = ADVENTURES.length - shelfAdventures.length;
  const hiddenSpecs = ADVENTURES
    .filter((a) => !shelfAdventures.includes(a))
    .map((a) => getStorySpec(a.id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  return (
    <PlayShell>
      <PlayHeader
        title="Hero Comics"
        say={he ? `כל הרפתקה היא ספר קומיקס שלם — בכיכוב ${name}!` : `Every adventure is a whole comic book — starring ${name}!`}
        mood="cheer"
      />

      {/* Shelf summary */}
      <PlayPanel tone="clay">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="min-w-0">
            <p className="text-[1.05rem] font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
              {he ? `מדף הקומיקס של ${isolate(name)}` : `${isolate(name)}'s comic bookshelf`}
            </p>
            <p className="text-[12.5px] mt-0.5" style={{ color: "var(--arbor-muted)" }} dir="auto">
              {he ? `${savedCount} מתוך ${ADVENTURES.length} ספרים על המדף` : `${savedCount} of ${ADVENTURES.length} books on the shelf`}
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

      {/* Book grid — every canon adventure as a multi-page comic book */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {shelfAdventures.map((a) => {
          const w = PACK_WORLD[a.pack];
          const emoji = STORY_EMOJI[a.id] ?? "⭐";
          const saved = savedByAdventure[a.id];
          // In-session cover thumbnail (memory cache): current lang first, then
          // the lang the book was saved in; else the hero card.
          const coverThumb = saved
            ? getScene(comicKey(avatarKeyToken, a.id, aiLang, 0)) ?? getScene(comicKey(avatarKeyToken, a.id, saved.lang, 0))
            : undefined;
          const title = adventureTitle(a, aiLang);
          // AIX-S5 honesty: "Read again" ONLY when every page is available on
          // this device (memory or IndexedDB) — a cold state (new device, or
          // pages evicted) says "Rebuild this book" instead of promising an
          // instant re-read that actually re-pays a full build.
          const readAgain = !!saved && fullyCached[a.id] === true;
          const badgeLabel = readAgain
            ? (he ? "לקרוא שוב" : "Read again")
            : saved
            ? (he ? "לבנות את הספר מחדש" : "Rebuild this book")
            : (he ? "צרו את הקומיקס" : "Make this comic");
          return (
            <div key={a.id} className="comic-panel overflow-hidden">
              {/* Book cover: the saved cover art, or the hero waiting in this world */}
              <div className="relative" style={{ aspectRatio: "3 / 2", borderBottom: "var(--comic-line)" }}>
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
                  {coverThumb ? (
                    <img src={coverThumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
                    <Icon name={readAgain ? "menu_book" : "auto_awesome"} size={14} /> {badgeLabel}
                  </span>
                </button>
              </div>

              {/* Caption */}
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-black text-[15px] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }} dir="auto">
                    {title}
                  </span>
                  <span className="ms-auto inline-flex items-center gap-1.5">
                    {/* W0.7 age chip — only on out-of-band books (a catalog
                        fact about the story, never a claim about the child). */}
                    {adventureFit(a.id) === "out" && getStorySpec(a.id) && (
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-full" dir="auto" style={{ background: "#fff", border: "2px solid var(--comic-ink)", color: "var(--arbor-ink)" }}>
                        {agefilterText("elev.agefilter.chip", he, {
                          min: getStorySpec(a.id)!.ageRange[0],
                          max: getStorySpec(a.id)!.ageRange[1],
                        })}
                      </span>
                    )}
                    <span className="inline-block text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ border: "2px solid var(--comic-ink)", color: w.ink }}>
                      {he ? w.labelHe : w.label}
                    </span>
                  </span>
                </div>
                {saved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black mt-2" style={{ color: "var(--arbor-green-ink)" }}>
                    <Icon name="check" size={14} /> {he ? "על המדף" : "On the shelf"}
                  </span>
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
    </PlayShell>
  );
}
