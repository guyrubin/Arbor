import React, { useEffect, useMemo, useRef, useState } from "react";
import { resolveHeroUrl } from "../ui/HeroAvatar";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import type { ChildProfile } from "../../types";
import {
  avatarHash,
  getAdventure,
  isStrictComicImageDataUrl,
  readSavedMetaCoverFromStore,
  rehydrateSavedMetaPagesFromStore,
  savedBookTitle,
  savedMetaPagesAvailable,
  savedMetaPageTotal,
  type SavedComicMeta,
} from "../../lib/heroComics";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { PlayButton, PlayPanel } from "../ui/playkit";
import { HeroAvatar } from "../ui/HeroAvatar";
import SavedComicReader, { type SavedComicPage } from "../stories/SavedComicReader";
import { KidStageFallback } from "./KidStageFallback";

type ShelfState = "checking" | "available" | "unavailable";
type OpenBook = {
  partitionKey: string;
  fingerprint: string;
  meta: SavedComicMeta;
  pages: SavedComicPage[];
};

const metaFingerprint = (meta: SavedComicMeta): string =>
  JSON.stringify([meta.id, meta.adventureId, meta.lang, meta.createdAt, meta.pageCount, meta.identityVersion, meta.pageKeys]);

async function imageDecodes(dataUrl: string): Promise<boolean> {
  if (!isStrictComicImageDataUrl(dataUrl)) return false;
  if (typeof Image === "undefined") return true;
  const image = new Image();
  image.src = dataUrl;
  if (typeof image.decode === "function") {
    try {
      await image.decode();
      return image.naturalWidth > 0 && image.naturalHeight > 0;
    } catch {
      return false;
    }
  }
  return new Promise((resolve) => {
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
  });
}

export default function KidComicsShelf({
  childProfile,
  authKey,
  onBack,
  onOpenStories,
  variant = "shelf",
  onReadingChange,
}: {
  childProfile: ChildProfile;
  authKey?: string;
  onBack?: () => void;
  /** B-KID-38: the empty shelf's door to the story catalogue. */
  onOpenStories?: () => void;
  /** B-KID-85: "madeBefore" = the saved comics as the tail of the kid "My
   *  books" grid — no back, no title of its own, no empty or loading panel
   *  (nothing renders until a book is proved openable), chrome in the UI
   *  language, portrait covers like the books above it. */
  variant?: "shelf" | "madeBefore";
  /** B-KID-85: tells the library a saved comic is open (it hides its grid). */
  onReadingChange?: (reading: boolean) => void;
}) {
  const { user } = useAuth();
  const { aiLang: storyAiLang, uiLang } = useLanguage();
  // B-KID-85: inside the library the chrome follows the UI language (KB-12).
  const aiLang: "en" | "he" = variant === "madeBefore" ? (uiLang === "he" ? "he" : "en") : storyAiLang;
  const saved = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const partitionKey = `${authKey ?? user?.uid ?? "anon"}|${childProfile.id}`;
  const heroUrl = resolveHeroUrl(childProfile);
  // Must match ComicsTab's avatarKeyToken so parent-saved books resolve here.
  const avatarToken = heroUrl?.startsWith("data:") ? heroUrl : "no-hero";
  const requestRef = useRef(0);
  const partitionRef = useRef(partitionKey);
  partitionRef.current = partitionKey;
  const [confirmedPartition, setConfirmedPartition] = useState(partitionKey);
  const [availability, setAvailability] = useState<{ scope: string; values: Record<string, ShelfState> }>({ scope: "", values: {} });
  // The cover (page 0) of every openable book, read from the same device store
  // as the pages — the shelf card shows the book, not a generic icon.
  const [covers, setCovers] = useState<{ scope: string; values: Record<string, string> }>({ scope: "", values: {} });
  const [open, setOpen] = useState<OpenBook | null>(null);
  const [unavailableId, setUnavailableId] = useState<string | null>(null);

  // UX26-30 (22 Sep 2026): the child shelf considers only books saved with
  // frozen page keys. Metadata-only entries (the onboarding wow seed, legacy
  // comic3 saves) belong to the parent shelf, which can rebuild them; here
  // they could never open. What survives the device-store probe below is what
  // the child actually sees.
  const books = useMemo(() => saved.items
    .filter((meta) => (meta.pageKeys?.length ?? 0) > 0)
    .map((meta) => ({ meta, adventure: getAdventure(meta.adventureId) }))
    .filter((item): item is { meta: SavedComicMeta; adventure: NonNullable<ReturnType<typeof getAdventure>> } => Boolean(item.adventure))
    .sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt)), [saved.items]);
  const booksFingerprint = books.map(({ meta }) => metaFingerprint(meta)).join(";");
  const scopeKey = `${partitionKey}|${avatarToken === "no-hero" ? avatarToken : avatarHash(avatarToken)}|${booksFingerprint}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const partitionReady = confirmedPartition === partitionKey;
  // UX26-30 + M3 round 2: the child shelf shows ONLY books that open. A book
  // whose pages are not on this device is not a disabled card the child can
  // press — it is not on the shelf at all, and the loading panel holds the
  // surface until every book has been checked.
  const probeReady = availability.scope === scopeKey
    && books.every(({ meta }) => (availability.values[meta.id] ?? "checking") !== "checking");
  const openableBooks = probeReady
    ? books.filter(({ meta }) => availability.values[meta.id] === "available")
    : [];
  const visibleOpen = open
    && open.partitionKey === partitionKey
    && books.some(({ meta }) => meta.id === open.meta.id && metaFingerprint(meta) === open.fingerprint)
    ? open
    : null;

  useEffect(() => {
    const request = ++requestRef.current;
    setConfirmedPartition(partitionKey);
    setOpen(null);
    setUnavailableId(null);
    setAvailability({ scope: scopeKey, values: Object.fromEntries(books.map(({ meta }) => [meta.id, "checking"])) });
    setCovers({ scope: "", values: {} });
    void (async () => {
      const next: Record<string, ShelfState> = {};
      const nextCovers: Record<string, string> = {};
      for (const { meta } of books) {
        try {
          next[meta.id] = await savedMetaPagesAvailable(childProfile.id, meta, avatarToken) ? "available" : "unavailable";
          if (next[meta.id] === "available") {
            const cover = await readSavedMetaCoverFromStore(childProfile.id, meta, avatarToken);
            if (cover && isStrictComicImageDataUrl(cover)) nextCovers[meta.id] = cover;
          }
        } catch {
          next[meta.id] = "unavailable";
        }
      }
      if (request === requestRef.current && scopeRef.current === scopeKey) {
        setAvailability({ scope: scopeKey, values: next });
        setCovers({ scope: scopeKey, values: nextCovers });
      }
    })();
    return () => { requestRef.current += 1; };
  }, [partitionKey, scopeKey, avatarToken, books]);

  const openBook = async (meta: SavedComicMeta) => {
    if (!partitionReady || availability.scope !== scopeKey || availability.values[meta.id] !== "available") {
      setUnavailableId(meta.id);
      return;
    }
    const request = ++requestRef.current;
    const startedPartition = partitionKey;
    const startedScope = scopeKey;
    const urls = await rehydrateSavedMetaPagesFromStore(childProfile.id, meta, avatarToken).catch(() => []);
    if (request !== requestRef.current || partitionRef.current !== startedPartition || scopeRef.current !== startedScope) return;
    const adventure = getAdventure(meta.adventureId);
    // The saved record carries its own length (a read-along comic is cover +
    // every beat, which is not the authored book plan).
    const expectedCount = savedMetaPageTotal(meta);
    const validBytes = adventure
      && expectedCount > 0
      && urls.length === expectedCount
      && urls.every(isStrictComicImageDataUrl)
      && (await Promise.all(urls.map(imageDecodes))).every(Boolean);
    if (request !== requestRef.current || partitionRef.current !== startedPartition || scopeRef.current !== startedScope) return;
    if (!validBytes || !adventure) {
      setAvailability((state) => state.scope === scopeKey
        ? { ...state, values: { ...state.values, [meta.id]: "unavailable" } }
        : state);
      setUnavailableId(meta.id);
      return;
    }
    const readerTitle = savedBookTitle(meta, meta.lang, adventure);
    const pages = urls.map((dataUrl, index) => ({
      dataUrl,
      title: index === 0 ? readerTitle : `${readerTitle} · ${index}`,
    }));
    setOpen({ partitionKey, fingerprint: metaFingerprint(meta), meta, pages });
    setUnavailableId(null);
  };

  const reading = Boolean(visibleOpen);
  useEffect(() => {
    onReadingChange?.(reading);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  if (visibleOpen) {
    const markUnavailable = () => {
      setOpen(null);
      setAvailability((state) => state.scope === scopeKey
        ? { ...state, values: { ...state.values, [visibleOpen.meta.id]: "unavailable" } }
        : state);
      setUnavailableId(visibleOpen.meta.id);
    };
    return (
      <SavedComicReader
        key={`${partitionKey}|${visibleOpen.fingerprint}`}
        title={visibleOpen.meta.title}
        lang={visibleOpen.meta.lang}
        pages={visibleOpen.pages}
        onBack={() => setOpen(null)}
        onUnavailable={markUnavailable}
      />
    );
  }

  if (variant === "madeBefore") {
    // Only books proved openable on this device; nothing while probing.
    if (!partitionReady || !saved.loaded || !probeReady || openableBooks.length === 0) return null;
    return (
      <section className="space-y-3" aria-labelledby="kid-made-before-title" data-testid="kid-made-before">
        <h2 id="kid-made-before-title" className="font-black" style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--arbor-ink)" }}>
          {kidsStoriesText("kidBooks.madeBefore", aiLang)}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {openableBooks.map(({ meta, adventure }) => {
            const cover = covers.scope === scopeKey ? covers.values[meta.id] : undefined;
            const title = savedBookTitle(meta, aiLang, adventure);
            return (
              <button
                key={meta.id}
                type="button"
                onClick={() => void openBook(meta)}
                data-testid={`kid-comic-card-${meta.id}`}
                className="play-pressable flex flex-col gap-1.5 text-start"
                style={{ appearance: "none", background: "transparent", border: "none", padding: 0, cursor: "pointer", minBlockSize: 44 }}
              >
                <span className="world-tile relative block w-full overflow-hidden" style={{ aspectRatio: "3 / 4", background: "var(--arbor-yellow-soft)" }}>
                  {cover ? (
                    <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center"><HeroAvatar size={74} ring animate={false} decorative /></span>
                  )}
                </span>
                <span dir="auto" className="font-black leading-tight line-clamp-2" style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--arbor-ink)" }}>{title}</span>
              </button>
            );
          })}
        </div>
        {unavailableId && (
          <p role="status" className="text-sm" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.unavailable", aiLang)}</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="kid-comics-title" data-testid="kid-comics-shelf">
      <div className="flex items-center gap-3">
        {onBack && (
          <PlayButton variant="ghost" tone="clay" size="md" onClick={onBack}>
            {aiLang === "he" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />} {kidsStoriesText("shelf.back", aiLang)}
          </PlayButton>
        )}
        <div>
          <h2 id="kid-comics-title" className="text-xl font-black" style={{ color: "var(--arbor-ink)" }}>{kidsStoriesText("shelf.title", aiLang)}</h2>
          <p className="text-sm" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.subtitle", aiLang)}</p>
        </div>
      </div>

      {!partitionReady || !saved.loaded || (books.length > 0 && !probeReady) ? (
        // B-KID-79: the one kid loading state (stage + idle hero), not a text panel.
        <KidStageFallback />
      ) : openableBooks.length === 0 ? (
        <PlayPanel tone="lav" className="text-center">
          <div className="mx-auto mb-3 w-fit"><HeroAvatar size={88} mood="think" animate={false} /></div>
          {/* B-KID-38 (KB-06, truth): a child with no hero never gets a comic
              shelved (the reader shelves only with a hero), so "your comic
              appears here" was a promise that could not come true. */}
          {heroUrl ? (
            <>
              <p className="font-black" style={{ color: "var(--arbor-ink)" }}>{kidsStoriesText("shelf.empty", aiLang)}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.emptyHint", aiLang)}</p>
            </>
          ) : (
            <p className="font-black" style={{ color: "var(--arbor-ink)" }}>{kidsStoriesText("shelf.emptyNoHero", aiLang)}</p>
          )}
          {onOpenStories && (
            <div className="mt-4 flex justify-center">
              <PlayButton tone="clay" onClick={onOpenStories}>{kidsStoriesText("shelf.openStories", aiLang)}</PlayButton>
            </div>
          )}
        </PlayPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {openableBooks.map(({ meta, adventure }) => {
            const cover = covers.scope === scopeKey ? covers.values[meta.id] : undefined;
            const title = savedBookTitle(meta, aiLang, adventure);
            return (
              /* Cover-led card (benchmark: the art is the book). The whole card
                 is ONE big control — the same 3:2 comic-panel cover box the
                 parent shelf uses, object-cover so a square page fills it
                 instead of pillarboxing, title underneath. */
              <button
                key={meta.id}
                type="button"
                onClick={() => void openBook(meta)}
                aria-label={`${kidsStoriesText("shelf.read", aiLang)}: ${title}`}
                data-testid={`kid-comic-card-${meta.id}`}
                className="comic-panel play-pressable w-full overflow-hidden text-start"
              >
                <div className="relative w-full" style={{ aspectRatio: "3 / 2", borderBottom: "var(--comic-line)" }}>
                  {cover ? (
                    <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="comic-halftone absolute inset-0 grid place-items-center" style={{ background: "var(--arbor-yellow)" }}>
                      <HeroAvatar size={74} ring animate={false} decorative />
                    </div>
                  )}
                  <span
                    className="absolute bottom-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-black"
                    style={{ insetInlineStart: 8, background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", color: "var(--arbor-ink)" }}
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" /> {kidsStoriesText("shelf.read", aiLang)}
                  </span>
                </div>
                <h3 className="p-3.5 text-[15px] font-black leading-tight" dir="auto" style={{ color: "var(--arbor-ink)" }}>{title}</h3>
              </button>
            );
          })}
        </div>
      )}
      {unavailableId && (
        <p role="status" className="text-sm" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.unavailable", aiLang)}</p>
      )}
    </section>
  );
}
