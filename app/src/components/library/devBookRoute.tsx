/**
 * devBookRoute — B-BOOK-05: the DEV-ONLY review route for the new book reader.
 * main.tsx mounts it instead of the app ONLY when `import.meta.env.DEV` and the
 * URL carries `?book=` — so it needs no sign-in, no Firebase and no seeded
 * family, and the production build never contains it (the branch is
 * constant-folded away with its dynamic import).
 *
 *   /?book=five-smooth-stones&hero=dylan-v2&lang=he&gender=f&name=Noa&prints=0&costume=tunic
 *
 * - book   : a library or fixture book id (unknown / empty → the default
 *            review book, "five-smooth-stones").
 * - hero   : the DEV hero sheet at public/_dev/hero-sheets/<hero>/<pose>.webp
 *            (default dylan-v2; `none` = no hero).
 * - lang   : en | he (sets <html lang dir> for the kid fonts and RTL).
 * - gender : m | f (the Hebrew text variant).
 * - name   : the child's display name (default Noa).
 * - narration : probe (default) | off — probe tries
 *            public/_dev/narration/<book>/<hero or child>/<en|he-m|he-f>/<page>[.<choice>].mp3
 * - prints : 0 = show the live composite on every page (default: the sheet's
 *            printed pages where it has them).
 * - costume: tunic = the p5 A/B (BR5): p5 shows `worried-tunic`.
 * - voice  : the narration set (folder under /_dev/narration/<book>/), default
 *            the hero sheet id (dylan-v2) — e.g. dylan-v2-expressive, to
 *            compare a performed reading without replacing files.
 * The hero sheet's manifest.json is read before the reader mounts.
 *
 * Wrapped in `.arbor-play` so the kid tokens apply. Closing the book returns
 * to its cover (the route has nowhere else to go).
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookReader } from "./BookReader";
import { DEFAULT_REVIEW_BOOK, getLibraryBook } from "../../lib/library/books";
import { closeKidAudio, setKidAudioChild } from "../kidmode/audio/kidAudio";
import { installKidVoiceUnlock } from "../../lib/kidVoicePlayer";
import { loadHeroSheet, type HeroSheet } from "../../lib/library/heroSheet";
import type { BookLang, BookReaderChild } from "../../lib/library/types";

export interface DevBookParams {
  bookId: string;
  lang: BookLang;
  child: BookReaderChild;
  narration: "probe" | "off";
  prints: boolean;
  costume: string | null;
  /** The narration set (folder), or null = the hero sheet id. */
  voiceSet: string | null;
}

const SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

/** Parse the review URL (pure; tested). */
export function parseDevBookParams(search: string): DevBookParams {
  const q = new URLSearchParams(search);
  const asked = q.get("book") ?? "";
  const bookId = SEGMENT.test(asked) && getLibraryBook(asked) ? asked : DEFAULT_REVIEW_BOOK;
  const lang: BookLang = q.get("lang") === "he" ? "he" : "en";
  const gender = q.get("gender") === "f" ? "girl" : "boy";
  const heroAsked = q.get("hero") ?? "dylan-v2";
  const heroSheetId = heroAsked === "none" || !SEGMENT.test(heroAsked) ? null : heroAsked;
  const name = (q.get("name") ?? "Noa").trim().slice(0, 40) || "Noa";
  return {
    bookId,
    lang,
    child: { id: "dev-review-child", name, gender, heroSheetId },
    narration: q.get("narration") === "off" ? "off" : "probe",
    prints: q.get("prints") !== "0",
    costume: q.get("costume") === "tunic" ? "tunic" : null,
    voiceSet: SEGMENT.test(q.get("voice") ?? "") ? q.get("voice") : null,
  };
}

export function DevBookRoute({ params }: { params: DevBookParams }) {
  const book = getLibraryBook(params.bookId)!;
  const [opening, setOpening] = useState(0);
  const [sheet, setSheet] = useState<HeroSheet | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadHeroSheet(params.child, { dev: true }).then((s) => live && setSheet(s));
    return () => {
      live = false;
    };
  }, [params.child]);
  useEffect(() => {
    const html = document.documentElement;
    html.lang = params.lang;
    html.dir = params.lang === "he" ? "rtl" : "ltr";
    document.title = `${book.title[params.lang]} (DEV review)`;
    // The kid audio bus: page-turn and tap cues play for this child; Sound
    // is the same per-child mute the kid shell uses.
    setKidAudioChild(params.child.id);
    const uninstallVoiceUnlock = installKidVoiceUnlock();
    return () => {
      uninstallVoiceUnlock();
      closeKidAudio();
    };
  }, [params, book]);
  return (
    <div className="arbor-play" data-dev-book-route="">
      {sheet !== undefined && (
        <BookReader
          key={opening}
          book={book}
          lang={params.lang}
          child={params.child}
          narration={params.narration}
          voiceSet={params.voiceSet}
          sheet={sheet}
          prints={params.prints}
          costume={params.costume}
          dev
          onClose={() => setOpening((n) => n + 1)}
        />
      )}
    </div>
  );
}

export function mountDevBookRoute(root: HTMLElement): void {
  createRoot(root).render(<DevBookRoute params={parseDevBookParams(window.location.search)} />);
}
