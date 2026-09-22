import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { ComicPage, PlayButton, ProgressPips, Celebrate } from "../ui/playkit";
import { nextPageIndex, prevPageIndex, swipeToDelta, tapToDelta, type ComicLang } from "../../lib/heroComics";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { isStrictComicImageDataUrl } from "../../lib/heroComics";

export type SavedComicPage = { dataUrl: string; title: string };

/** Presentation-only child reader. It accepts complete validated bytes and has
 * no generation, save, share, download, purchase, profile or API seam. */
export default function SavedComicReader({
  title,
  lang,
  pages,
  onBack,
  onUnavailable,
}: {
  title: string;
  lang: ComicLang;
  pages: readonly SavedComicPage[];
  onBack: () => void;
  onUnavailable: () => void;
}) {
  const rtl = lang === "he";
  const [pageIndex, setPageIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = pages.length;
  const current = pages[pageIndex];
  const complete = total > 0 && pages.every((page) => isStrictComicImageDataUrl(page.dataUrl));

  const go = useCallback((delta: -1 | 0 | 1) => {
    if (!complete || delta === 0) return;
    setFinished(false);
    setPageIndex((index) => delta > 0 ? nextPageIndex(index, total) : prevPageIndex(index, total));
  }, [complete, total]);
  const advance = useCallback(() => {
    if (pageIndex === total - 1) setFinished(true);
    else go(1);
  }, [go, pageIndex, total]);

  useEffect(() => { headingRef.current?.focus(); }, [pageIndex, finished]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest?.("input, textarea, select, button, [contenteditable='true']")) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(rtl ? -1 : 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(rtl ? 1 : -1); }
      if (event.key === "Escape") { event.preventDefault(); onBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onBack, rtl]);
  useEffect(() => {
    if (!complete) onUnavailable();
  }, [complete, onUnavailable]);

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  if (!complete || !current) return null;
  if (finished) {
    return (
      <Celebrate title={kidsStoriesText("reader.end", lang)} subtitle={kidsStoriesText("reader.endBody", lang)}>
        <PlayButton tone="clay" onClick={() => { setPageIndex(0); setFinished(false); }}>
          <RotateCcw className="h-4 w-4" /> {kidsStoriesText("reader.again", lang)}
        </PlayButton>
        <PlayButton variant="soft" tone="clay" onClick={onBack}>{kidsStoriesText("reader.back", lang)}</PlayButton>
      </Celebrate>
    );
  }
  return (
    <section role="region" aria-roledescription="comic book" aria-label={title} dir={rtl ? "rtl" : "ltr"} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <PlayButton variant="ghost" tone="clay" size="md" onClick={onBack}>
          {rtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />} {kidsStoriesText("reader.back", lang)}
        </PlayButton>
        <ProgressPips total={total} current={pageIndex} />
      </div>
      <p className="sr-only" aria-live="polite">{kidsStoriesText("reader.page", lang, { current: pageIndex + 1, total })}</p>
      <h3 ref={headingRef} tabIndex={-1} className="text-center text-base font-extrabold outline-none" style={{ color: "var(--arbor-ink)" }}>{current.title}</h3>
      <div
        className="relative select-none"
        onPointerDown={(event) => { dragStart.current = { x: event.clientX, y: event.clientY }; }}
        onPointerUp={(event) => {
           const start = dragStart.current; dragStart.current = null; if (!start) return;
           const delta = swipeToDelta(event.clientX - start.x, event.clientY - start.y, rtl);
           if (delta !== 0) {
             suppressClick.current = true;
             window.setTimeout(() => { suppressClick.current = false; }, 0);
           }
           if (delta === 1) advance(); else if (delta === -1) go(-1);
         }}
         onClick={(event) => {
           if (suppressClick.current) { suppressClick.current = false; return; }
          const rect = event.currentTarget.getBoundingClientRect();
          const delta = tapToDelta((event.clientX - rect.left) / rect.width, rtl);
          if (delta === 1) advance(); else if (delta === -1) go(-1);
        }}
      >
        <ComicPage
          src={current.dataUrl}
          alt={current.title}
          pageNumber={pageIndex + 1}
          rtl={rtl}
          contentFit="contain"
          onImageError={onUnavailable}
        />
      </div>
      <div className="play-comic-actions flex justify-between gap-3">
        <PlayButton
          variant="soft"
          tone="clay"
          disabled={pageIndex === 0}
          onClick={() => go(-1)}
          ariaLabel={kidsStoriesText("reader.previous", lang)}
        >
          {rtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </PlayButton>
        <PlayButton tone="clay" onClick={advance}>
          {pageIndex === total - 1 ? kidsStoriesText("reader.end", lang) : kidsStoriesText("reader.page", lang, { current: pageIndex + 2, total })}
        </PlayButton>
      </div>
    </section>
  );
}
