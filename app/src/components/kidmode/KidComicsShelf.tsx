import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useChildCollection } from "../../hooks/useChildCollection";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import type { ChildProfile } from "../../types";
import {
  adventureTitle,
  avatarHash,
  bookPageCount,
  getAdventure,
  isStrictComicImageDataUrl,
  rehydrateSavedMetaPagesFromStore,
  savedMetaPagesAvailable,
  type SavedComicMeta,
} from "../../lib/heroComics";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { PlayButton, PlayPanel } from "../ui/playkit";
import { HeroAvatar } from "../ui/HeroAvatar";
import SavedComicReader, { type SavedComicPage } from "../stories/SavedComicReader";

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
}: {
  childProfile: ChildProfile;
  authKey?: string;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const { aiLang } = useLanguage();
  const saved = useChildCollection<SavedComicMeta>(childProfile.id, "savedComics");
  const partitionKey = `${authKey ?? user?.uid ?? "anon"}|${childProfile.id}`;
  const avatarToken = childProfile.photoUrl?.startsWith("data:") ? childProfile.photoUrl : "no-hero";
  const requestRef = useRef(0);
  const partitionRef = useRef(partitionKey);
  partitionRef.current = partitionKey;
  const [confirmedPartition, setConfirmedPartition] = useState(partitionKey);
  const [availability, setAvailability] = useState<{ scope: string; values: Record<string, ShelfState> }>({ scope: "", values: {} });
  const [open, setOpen] = useState<OpenBook | null>(null);
  const [unavailableId, setUnavailableId] = useState<string | null>(null);

  const books = useMemo(() => saved.items
    .map((meta) => ({ meta, adventure: getAdventure(meta.adventureId) }))
    .filter((item): item is { meta: SavedComicMeta; adventure: NonNullable<ReturnType<typeof getAdventure>> } => Boolean(item.adventure))
    .sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt)), [saved.items]);
  const booksFingerprint = books.map(({ meta }) => metaFingerprint(meta)).join(";");
  const scopeKey = `${partitionKey}|${avatarToken === "no-hero" ? avatarToken : avatarHash(avatarToken)}|${booksFingerprint}`;
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const partitionReady = confirmedPartition === partitionKey;
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
    void (async () => {
      const next: Record<string, ShelfState> = {};
      for (const { meta } of books) {
        try {
          next[meta.id] = await savedMetaPagesAvailable(childProfile.id, meta, avatarToken) ? "available" : "unavailable";
        } catch {
          next[meta.id] = "unavailable";
        }
      }
      if (request === requestRef.current && scopeRef.current === scopeKey) {
        setAvailability({ scope: scopeKey, values: next });
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
    const expectedCount = meta.pageKeys?.length ?? bookPageCount(meta.adventureId);
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
    const pages = urls.map((dataUrl, index) => ({
      dataUrl,
      title: index === 0 ? meta.title : `${adventureTitle(adventure, meta.lang)} · ${index}`,
    }));
    setOpen({ partitionKey, fingerprint: metaFingerprint(meta), meta, pages });
    setUnavailableId(null);
  };

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

      {!partitionReady || !saved.loaded ? (
        <PlayPanel tone="lav" className="text-center">{kidsStoriesText("shelf.loading", aiLang)}</PlayPanel>
      ) : books.length === 0 ? (
        <PlayPanel tone="lav" className="text-center">
          <div className="mx-auto mb-3 w-fit"><HeroAvatar size={88} mood="think" animate={false} /></div>
          <p className="font-black" style={{ color: "var(--arbor-ink)" }}>{kidsStoriesText("shelf.empty", aiLang)}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.emptyHint", aiLang)}</p>
        </PlayPanel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {books.map(({ meta, adventure }) => {
            const state = availability.scope === scopeKey ? availability.values[meta.id] ?? "checking" : "checking";
            const unavailable = state === "unavailable";
            return (
              <PlayPanel key={meta.id} tone="lav" className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl" style={{ background: "var(--arbor-yellow)", border: "2px solid var(--comic-ink)" }}>
                    <BookOpen className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black leading-tight" dir="auto">{meta.title || adventureTitle(adventure, meta.lang)}</h3>
                    {unavailable && <p className="mt-1 text-xs" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.unavailable", aiLang)}</p>}
                  </div>
                </div>
                <PlayButton tone="clay" disabled={state !== "available"} onClick={() => void openBook(meta)}>
                  {state === "checking" ? kidsStoriesText("shelf.loading", aiLang) : unavailable ? kidsStoriesText("shelf.unavailableShort", aiLang) : kidsStoriesText("shelf.read", aiLang)}
                </PlayButton>
                {unavailableId === meta.id && !unavailable && <p role="status" className="text-xs" style={{ color: "var(--arbor-muted)" }}>{kidsStoriesText("shelf.unavailable", aiLang)}</p>}
              </PlayPanel>
            );
          })}
        </div>
      )}
    </section>
  );
}
