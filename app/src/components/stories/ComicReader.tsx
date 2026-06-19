import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Download, Share2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { ComicPage, PlayButton, PlayPanel, ProgressPips, Celebrate, usePrefersReducedMotion } from "../ui/playkit";
import { HeroAvatar } from "../ui/HeroAvatar";
import { track } from "../../lib/analytics";
import { trackShareInitiated, trackShareCompleted } from "../../lib/loopEvents";
import { getStorySpec } from "../../lib/heroJourneys";
import {
  type Adventure,
  type ComicLang,
  type ComicPageData,
  type HeroComic,
  buildComicBook,
  generatePage,
  planPages,
  adventureTitle,
  nextPageIndex,
  prevPageIndex,
  swipeToDelta,
  tapToDelta,
} from "../../lib/heroComics";

/**
 * ComicReader (p1-comic-reader) — a real, re-openable comic BOOK starring the
 * child's saved stylized hero. Cover renders instantly; beat pages stream in.
 * Swipe / tap-zones / on-screen buttons / arrow keys turn pages (RTL-aware);
 * the flip collapses to a cross-fade under prefers-reduced-motion. One smudged
 * page shows a per-page redraw tile without blocking the rest. Finishing the
 * book celebrates and offers Save / Share / Make-another — the viral artifact.
 *
 * On Android, the host wires the hardware Back button to `onBack` (turn a page
 * back; close at the cover) via the prop below.
 */
export function ComicReader({
  adventure,
  lang,
  heroName,
  heroDataUrl,
  saved,
  onSave,
  onClose,
  registerBack,
}: {
  adventure: Adventure;
  lang: ComicLang;
  heroName: string;
  heroDataUrl?: string;
  /** A previously-saved book to re-open instantly from cache (zero new calls). */
  saved?: HeroComic;
  onSave: (comic: HeroComic) => void;
  onClose: () => void;
  /** Hook for the host to register a back-step handler (Android hardware Back). */
  registerBack?: (handler: () => boolean) => void;
}) {
  const rtl = lang === "he";
  const reduced = usePrefersReducedMotion();

  // Beat prompts (cover = index 0; beats from the story spine, minus the
  // interactive `decision` beat). Memoized so the page plan is stable.
  const { initialPages, beatPrompts } = useMemo(() => {
    const spec = getStorySpec(adventure.id);
    const beats = (spec?.beats || []).filter((b) => b.id !== "decision");
    const beatTitles = beats.map((b) => b.title);
    const prompts: Record<number, string> = {};
    beats.forEach((b, i) => { prompts[i + 1] = b.spine; });
    return { initialPages: planPages(adventure, lang, beatTitles), beatPrompts: prompts };
  }, [adventure, lang]);

  // Hydrate from a saved book (instant, no network) or start a fresh build.
  const [pages, setPages] = useState<ComicPageData[]>(() => {
    if (saved && saved.pageUrls.length) {
      return saved.pageUrls.map((url, i) => ({
        index: i,
        title: i === 0 ? saved.title : (initialPages[i]?.title ?? `Page ${i}`),
        cover: i === 0,
        dataUrl: url,
        status: "ready" as const,
      }));
    }
    return initialPages;
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const [bookError, setBookError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const total = pages.length;
  const current = pages[pageIndex];
  const onLastPage = pageIndex === total - 1;

  // Build the book once when not hydrated from a saved copy.
  useEffect(() => {
    if (saved && saved.pageUrls.length) return;
    let active = true;
    setBookError(false);
    track("hero_comic_generated", { adventure: adventure.id });
    buildComicBook(
      adventure,
      lang,
      heroName,
      heroDataUrl,
      initialPages,
      beatPrompts,
      (page) => {
        if (!active) return;
        setPages((prev) => prev.map((p) => (p.index === page.index ? page : p)));
      },
    )
      .then((finalPages) => {
        if (!active) return;
        // Whole-book failure only if every page errored (e.g. offline).
        if (finalPages.every((p) => p.status === "error")) setBookError(true);
      })
      .catch(() => { if (active) setBookError(true); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventure.id, lang]);

  const go = useCallback(
    (delta: -1 | 0 | 1) => {
      if (delta === 0) return;
      setFinished(false);
      setPageIndex((i) => (delta > 0 ? nextPageIndex(i, total) : prevPageIndex(i, total)));
    },
    [total],
  );

  // Finishing: turning past the last page → celebration overlay.
  const advance = useCallback(() => {
    if (onLastPage) { setFinished(true); return; }
    go(1);
  }, [onLastPage, go]);

  // Move focus + announce on every page turn.
  useEffect(() => {
    headingRef.current?.focus();
  }, [pageIndex]);

  // Keyboard: arrows turn pages (RTL inverts), Home/End jump.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(rtl ? -1 : 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(rtl ? 1 : -1); }
      else if (e.key === "Home") { e.preventDefault(); setFinished(false); setPageIndex(0); }
      else if (e.key === "End") { e.preventDefault(); setFinished(false); setPageIndex(total - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, rtl, total]);

  // Android hardware Back: turn a page back, or close at the cover.
  useEffect(() => {
    if (!registerBack) return;
    registerBack(() => {
      if (finished) { setFinished(false); return true; }
      if (pageIndex > 0) { go(-1); return true; }
      onClose();
      return true;
    });
  }, [registerBack, pageIndex, finished, go, onClose]);

  // Swipe (pointer) — vertical-dominant drags are ignored (preserves iOS edge-back).
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => { dragStart.current = { x: e.clientX, y: e.clientY }; };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = dragStart.current;
    dragStart.current = null;
    if (!s) return;
    const delta = swipeToDelta(e.clientX - s.x, e.clientY - s.y, rtl);
    if (delta === 1) advance();
    else if (delta === -1) go(-1);
  };

  // Tap zones: left/right third turn pages (RTL-aware), middle rests.
  const onTap = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    const delta = tapToDelta(xRatio, rtl);
    if (delta === 1) advance();
    else if (delta === -1) go(-1);
  };

  const retryPage = (index: number) => {
    const page = pages.find((p) => p.index === index);
    if (!page) return;
    setPages((prev) => prev.map((p) => (p.index === index ? { ...p, status: "pending" } : p)));
    generatePage({ adventure, lang, heroName, heroDataUrl, page, beatPrompt: beatPrompts[index] })
      .then((dataUrl) =>
        setPages((prev) => prev.map((p) => (p.index === index ? { ...p, dataUrl, status: "ready" } : p))),
      )
      .catch(() =>
        setPages((prev) => prev.map((p) => (p.index === index ? { ...p, status: "error" } : p))),
      );
  };

  const buildSavedComic = (): HeroComic => ({
    id: `${adventure.id}-${lang}-${saved?.createdAt ?? Date.now()}`,
    adventureId: adventure.id,
    title: adventureTitle(adventure, lang),
    lang,
    coverUrl: pages[0]?.dataUrl,
    pageUrls: pages.map((p) => p.dataUrl || ""),
    createdAt: saved?.createdAt ?? new Date().toISOString(),
  });

  const handleSave = () => {
    const comic = buildSavedComic();
    onSave(comic);
    track("hero_comic_saved", { adventure: adventure.id, pages: total });
    const cover = comic.coverUrl;
    if (cover) {
      const a = document.createElement("a");
      a.href = cover;
      a.download = `${heroName.toLowerCase()}-${adventure.id}-comic.png`;
      a.click();
    }
  };

  const handleShare = async () => {
    const cover = pages[0]?.dataUrl;
    trackShareInitiated("story", "comic-reader");
    try {
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (cover && nav.share) {
        const blob = await (await fetch(cover)).blob();
        const file = new File([blob], `${heroName.toLowerCase()}-comic.png`, { type: blob.type || "image/png" });
        const data: ShareData = { files: [file], title: adventureTitle(adventure, lang), text: `${heroName}'s comic!` };
        if (!nav.canShare || nav.canShare(data)) {
          await nav.share(data);
          trackShareCompleted("story", "web-share");
          return;
        }
      }
      // Fallback: download the cover.
      if (cover) {
        const a = document.createElement("a");
        a.href = cover;
        a.download = `${heroName.toLowerCase()}-comic.png`;
        a.click();
      }
      trackShareCompleted("story", "download");
    } catch {
      // User cancelled or share failed — no completion event.
    }
  };

  // ── Whole-book error (e.g. offline) ──────────────────────────────────────
  if (bookError) {
    return (
      <PlayPanel tone="lav" className="text-center" >
        <div className="mx-auto w-fit mb-3"><HeroAvatar size={96} mood="think" animate /></div>
        <p className="text-[15px] font-extrabold mb-4" style={{ color: "var(--arbor-ink)" }}>
          We couldn&apos;t draw this comic right now. Check your connection and try again.
        </p>
        <div className="flex justify-center gap-2.5">
          <PlayButton tone="clay" onClick={() => { setBookError(false); setPages(initialPages.map((p) => ({ ...p }))); }}>
            <RefreshCw className="w-4 h-4" /> Try again
          </PlayButton>
          <PlayButton variant="soft" tone="clay" onClick={onClose}>Back</PlayButton>
        </div>
      </PlayPanel>
    );
  }

  // ── Completion ───────────────────────────────────────────────────────────
  if (finished) {
    return (
      <Celebrate title="The End!" subtitle={`${heroName} saved the day. Keep it forever or share it.`}>
        <PlayButton tone="clay" onClick={handleSave}><Download className="w-4 h-4" /> Save comic</PlayButton>
        <PlayButton variant="soft" tone="clay" onClick={handleShare}><Share2 className="w-4 h-4" /> Share comic</PlayButton>
        <PlayButton variant="soft" tone="clay" onClick={onClose}><RefreshCw className="w-4 h-4" /> Make another</PlayButton>
      </Celebrate>
    );
  }

  // ── Reader ───────────────────────────────────────────────────────────────
  return (
    <section
      role="region"
      aria-roledescription="comic book"
      aria-label={`${heroName}'s comic`}
      dir={rtl ? "rtl" : "ltr"}
      className="space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <PlayButton variant="ghost" tone="clay" size="md" onClick={onClose}>
          {rtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} Bookshelf
        </PlayButton>
        <ProgressPips total={total} current={pageIndex} />
      </div>

      {/* Live region announces the page change for screen readers. */}
      <p className="sr-only" aria-live="polite">{`Page ${pageIndex + 1} of ${total}`}</p>

      <h3
        ref={headingRef}
        tabIndex={-1}
        className="text-center text-[15px] font-extrabold outline-none"
        style={{ color: "var(--arbor-ink)", fontFamily: current?.cover ? "var(--font-display)" : undefined }}
      >
        {current?.cover ? adventureTitle(adventure, lang) : current?.title}
      </h3>

      {/* The page itself — cover renders the hero large; beats render the panel. */}
      <div
        className="relative select-none cursor-pointer"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onClick={onTap}
      >
        {current?.cover ? (
          <div
            className="relative w-full max-w-3xl mx-auto rounded-[20px] overflow-hidden flex flex-col items-center justify-center text-center gap-3 p-6"
            style={{ aspectRatio: "3 / 2", border: "3px solid var(--arbor-ink)", boxShadow: "0 12px 36px rgba(41,51,63,0.22)", background: "var(--arbor-paper-deep)" }}
          >
            <span className="absolute top-2 left-0 right-0 text-[10px] font-extrabold uppercase tracking-[0.3em]" style={{ color: "var(--arbor-muted)" }}>
              Arbor Comics
            </span>
            {current.dataUrl ? (
              <img src={current.dataUrl} alt={`Cover: ${adventureTitle(adventure, lang)}`} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <>
                <HeroAvatar size={120} mood="cheer" animate={!reduced} />
                <p className="text-[1.4rem] leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--arbor-ink)" }}>
                  {adventureTitle(adventure, lang)}
                </p>
                <p className="text-[13px] font-bold" style={{ color: "var(--arbor-ink-soft)" }}>{heroName}&apos;s Comic</p>
              </>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <ComicPage
              key={pageIndex}
              src={current?.dataUrl}
              alt={`Page ${pageIndex}: ${current?.title ?? ""}`}
              pageNumber={pageIndex}
              loading={current?.status === "pending"}
              error={current?.status === "error"}
              rtl={rtl}
              onRetry={() => current && retryPage(current.index)}
            />
          </AnimatePresence>
        )}
      </div>

      {/* On-screen prev/next (always present for a11y + desktop). */}
      <div className="flex items-center justify-center gap-3">
        <PlayButton variant="soft" tone="clay" onClick={() => go(rtl ? 1 : -1)} disabled={pageIndex === 0}>
          {rtl ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />} Back
        </PlayButton>
        {current?.cover ? (
          <PlayButton tone="clay" onClick={advance}>Read {heroName}&apos;s comic</PlayButton>
        ) : (
          <PlayButton tone="clay" onClick={advance}>
            {onLastPage ? "Finish" : "Next"} {rtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </PlayButton>
        )}
      </div>
    </section>
  );
}

export default ComicReader;
