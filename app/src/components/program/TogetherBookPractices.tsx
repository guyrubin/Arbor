/** Reviewed acts belong to the Parent library, never the child reader. */
import React, { useId, useState } from "react";
import { useArbor } from "../../context/ArborContext";
import { useLanguage } from "../../context/LanguageContext";
import { canonicalBooksPractising } from "../../lib/programs/canonicalBookHandback";
import { reviewedParentBooks, type ParentPracticeBook } from "../../lib/programs/parentBookLibrary";
import { LibraryBookCover } from "../kidmode/LibraryBookCover";
import { useKidModeEntry } from "../kidmode/useKidModeEntry";
import { kidModeOpenFor } from "../../lib/age/playGate";
import { useNowClock } from "../companion/useNowClock";
import { useParentBookLibrary } from "./useParentBookLibrary";
import "./parentBookLibrary.css";

export interface PracticeLibraryLabels { title: string; filter: string; all: string; open: string }

export function TogetherBookPracticesView({ books, lang, labels, renderCover, onOpen }: {
  books: readonly ParentPracticeBook[];
  lang: "en" | "he";
  labels: PracticeLibraryLabels;
  renderCover: (book: ParentPracticeBook) => React.ReactNode;
  onOpen?: (book: ParentPracticeBook) => void;
}) {
  const id = useId();
  const [selected, setSelected] = useState("");
  const practices = [...new Map(books.flatMap(({ object }) => object.practises.map(p => [p.id, p] as const))).values()];
  const active = practices.some(p => p.id === selected) ? selected : "";
  const matching = active ? new Set(canonicalBooksPractising(books.map(b => b.object), active).map(b => b.id)) : null;
  const visible = matching ? books.filter(b => matching.has(b.object.id)) : books;
  if (!books.length) return null;
  return <section className="parent-book-library" data-testid="parent-book-library" aria-labelledby={id} dir={lang === "he" ? "rtl" : "ltr"}>
    <h3 id={id}>{labels.title}</h3>
    <div className="companion-filter-row" role="group" aria-label={labels.filter}>
      <button type="button" className="companion-filter" aria-pressed={!active} onClick={() => setSelected("")}>{labels.all}</button>
      {practices.map(p => <button key={p.id} type="button" className="companion-filter" data-practice={p.id} aria-pressed={active === p.id} onClick={() => setSelected(p.id)}><bdi>{p.act[lang]}</bdi></button>)}
    </div>
    <div className="parent-book-list">
      {visible.map(book => <article key={book.object.id} className="parent-book-card" data-parent-book={book.object.id}>
        <div className="parent-book-cover">{renderCover(book)}</div>
        <div className="parent-book-copy"><h4 dir="auto"><bdi>{book.object.title[lang]}</bdi></h4>
          <p dir="auto"><bdi>{book.object.coverLine[lang]}</bdi></p>
          {book.object.practises.map(p => <p key={p.id} className="companion-caption" dir="auto"><bdi>{p.act[lang]}</bdi></p>)}
          {onOpen && <button type="button" className="companion-text-button" onClick={() => onOpen(book)}>{labels.open}</button>}
        </div>
      </article>)}
    </div>
  </section>;
}

export default function TogetherBookPractices() {
  const { childProfile } = useArbor();
  const { t, uiLang } = useLanguage();
  const now = useNowClock();
  const library = useParentBookLibrary(childProfile.id, now);
  const { request, step } = useKidModeEntry();
  const books = reviewedParentBooks(library.entries);
  if (!books.length) return null;
  return <>
    <TogetherBookPracticesView books={books} lang={uiLang === "he" ? "he" : "en"}
      labels={{ title: t("elev.books.practice.title"), filter: t("elev.books.practice.filter"), all: t("elev.books.practice.all"), open: t("elev.books.practice.open") }}
      renderCover={({ entry }) => <LibraryBookCover childId={childProfile.id} entry={entry} />}
      onOpen={kidModeOpenFor(childProfile) ? ({ entry }) => {
        if (library.isCurrent() && books.some(b => b.entry === entry)) request({ view: "library", book: entry.book.id, together: true });
      } : undefined} />
    {step}
  </>;
}
