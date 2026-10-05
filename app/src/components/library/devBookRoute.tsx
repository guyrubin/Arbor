/**
 * devBookRoute — B-BOOK-05: the DEV-ONLY review route for the new book reader.
 * main.tsx mounts it instead of the app ONLY when `import.meta.env.DEV` and the
 * URL carries `?book=` — so it needs no sign-in, no Firebase and no seeded
 * family, and the production build never contains it (the branch is
 * constant-folded away with its dynamic import).
 *
 *   /?book=five-smooth-stones&hero=dylan-v2&lang=he&gender=f&name=Noa
 *
 * - book   : a library or fixture book id (unknown / empty → the default
 *            review book, "five-smooth-stones").
 * - hero   : the DEV hero sheet at public/_dev/hero-sheets/<hero>/<pose>.webp
 *            (default dylan-v2; `none` = no hero).
 * - lang   : en | he (sets <html lang dir> for the kid fonts and RTL).
 * - gender : m | f (the Hebrew text variant).
 * - name   : the child's display name (default Noa).
 * - narration : probe (default) | off — probe tries
 *            public/_dev/narration/<book>/<hero or child>/<en|he-m|he-f>/<page>[.<choice>].m4a
 *
 * Wrapped in `.arbor-play` so the kid tokens apply. Closing the book returns
 * to its cover (the route has nowhere else to go).
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BookReader } from "./BookReader";
import { DEFAULT_REVIEW_BOOK, getLibraryBook } from "../../lib/library/books";
import { closeKidAudio, setKidAudioChild } from "../kidmode/audio/kidAudio";
import type { BookLang, BookReaderChild } from "../../lib/library/types";

export interface DevBookParams {
  bookId: string;
  lang: BookLang;
  child: BookReaderChild;
  narration: "probe" | "off";
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
  };
}

export function DevBookRoute({ params }: { params: DevBookParams }) {
  const book = getLibraryBook(params.bookId)!;
  const [opening, setOpening] = useState(0);
  useEffect(() => {
    const html = document.documentElement;
    html.lang = params.lang;
    html.dir = params.lang === "he" ? "rtl" : "ltr";
    document.title = `${book.title[params.lang]} (DEV review)`;
    // The kid audio bus: page-turn and tap cues play for this child; Sound
    // is the same per-child mute the kid shell uses.
    setKidAudioChild(params.child.id);
    return () => closeKidAudio();
  }, [params, book]);
  return (
    <div className="arbor-play" data-dev-book-route="">
      <BookReader key={opening} book={book} lang={params.lang} child={params.child} narration={params.narration} dev onClose={() => setOpening((n) => n + 1)} />
    </div>
  );
}

export function mountDevBookRoute(root: HTMLElement): void {
  createRoot(root).render(<DevBookRoute params={parseDevBookParams(window.location.search)} />);
}
