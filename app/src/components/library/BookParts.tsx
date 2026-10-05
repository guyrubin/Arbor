/**
 * BookParts — B-BOOK-12 (fix round 1): the reader's small pieces.
 * - BookSoundToggle (ruling 7): a 48 px round PAPER toy, visible on the dark
 *   stage, speaker glyph with an on / off state. It is the same per-child kid
 *   mute (audio/kidAudio) every kid surface uses.
 * - PointingHand: the repair hint's glyph (inline SVG — the shipped icon
 *   subset has no hand), so the hint reads as an instruction, not a button.
 * - BookEnd (ruling 6): the end screen on paper — "The End" in the book face,
 *   the frame line, Read again + close, and under a quiet divider the parent
 *   panel collapsed behind "For the grown-up" (parent type scale).
 */
import { Fragment, useState } from "react";
import { KidToy } from "../kidmode/KidToy";
import { setKidReadAloudMuted, useKidReadAloudMuted } from "../kidmode/audio/kidAudio";
import { bookString, type BookStringKey } from "../../lib/library/bookStrings";
import { heroParts, labelFor, lineFor } from "../../lib/library/bookText";
import type { Book, BookLabel, BookLang, HeGender } from "../../lib/library/types";

export function BookSoundToggle({ childId, lang }: { childId: string; lang: BookLang }) {
  const muted = useKidReadAloudMuted(childId);
  return (
    <KidToy
      tone="paper"
      shape="round"
      size="s"
      data-book-sound=""
      data-muted={muted ? "" : undefined}
      aria-pressed={!muted}
      aria-label={bookString(muted ? "sound.off" : "sound.on", lang)}
      onClick={() => setKidReadAloudMuted(childId, !muted)}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false" style={{ display: "block" }}>
        <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
        {muted ? (
          <path d="M16 9.5l5 5M21 9.5l-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </KidToy>
  );
}

export function PointingHand() {
  return (
    <svg className="bk-hand" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false">
      <path
        d="M9 3.5a1.5 1.5 0 0 1 3 0V11l.6-.2a1.5 1.5 0 0 1 1.9 1.1l.1.3.4-.1a1.5 1.5 0 0 1 1.8 1.1l.1.3.3-.1a1.5 1.5 0 0 1 1.8 1.4V17a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 7.3 20l-2.6-4.3a1.4 1.4 0 0 1 2.2-1.7L9 16V3.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function Named({ text, name }: { text: string; name: string }) {
  return (
    <>
      {heroParts(text, name).map((p, i) => (p.hero ? <bdi key={i} data-book-name="">{p.text}</bdi> : <Fragment key={i}>{p.text}</Fragment>))}
    </>
  );
}

/** The parent panel's sections in reading order, with their heading keys:
 *  the v2 panel (knows, whyNow, tomorrow, together) and the v1 one (builds,
 *  why) share one list; a book shows the sections it has. */
export function parentSections(pp: Book["parent"], lang: BookLang, gender: HeGender): [BookStringKey, string][] {
  const out: [BookStringKey, string][] = [];
  const label = (key: BookStringKey, l: BookLabel | undefined) => l && out.push([key, labelFor(l, lang)]);
  label("grownUp.knows", pp.knows);
  label("grownUp.builds", pp.builds);
  label("grownUp.whyNow", pp.whyNow);
  label("grownUp.why", pp.why);
  label("grownUp.tomorrow", pp.tomorrow);
  out.push(["grownUp.ask", lineFor(pp.askAfter, lang, gender)]);
  if (pp.askAfterOptional) out.push(["grownUp.askMore", lineFor(pp.askAfterOptional, lang, gender)]);
  label("grownUp.together", pp.together);
  label("grownUp.source", pp.sourceNote);
  return out;
}

export function BookEnd({
  book,
  lang,
  gender,
  name,
  titlePx,
  typePx,
  onReadAgain,
  onClose,
  initialGrownUp = false,
}: {
  book: Book;
  lang: BookLang;
  gender: HeGender;
  name: string;
  titlePx?: number;
  typePx?: number;
  onReadAgain: () => void;
  onClose: () => void;
  /** Test seam: the grown-up panel starts open. */
  initialGrownUp?: boolean;
}) {
  const [open, setOpen] = useState(initialGrownUp);
  const last = book.pages[book.pages.length - 1];
  const pp = book.parent;
  const toggle = (
    <button type="button" className="bk-grownup-toggle" data-book-grownup="" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {bookString("grownUp", lang)}
      <span aria-hidden="true" className="bk-grownup-caret" data-open={open ? "" : undefined} />
    </button>
  );
  if (open) {
    // the parent panel takes over the paper page (it scrolls inside)
    return (
      <section className="bk-end" data-book-end-screen="" data-grownup="">
        {toggle}
        <dl className="bk-grownup" data-book-grownup-panel="">
          {parentSections(pp, lang, gender).map(([key, text]) => (
            <Fragment key={key}>
              <dt data-grownup-section={key}>{bookString(key, lang)}</dt>
              <dd>
                <Named text={text} name={name} />
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>
    );
  }
  return (
    <section className="bk-end" data-book-end-screen="">
      <div className="bk-end-main">
        <h1 className="bk-end-title" style={titlePx ? { fontSize: `${titlePx}px` } : undefined}>
          {bookString("theEnd", lang)}
        </h1>
        {last?.closing && (
          <p className="bk-end-frame" data-book-frame="" style={typePx ? { fontSize: `${typePx}px` } : undefined}>
            <Named text={lineFor(last.closing, lang, gender)} name={name} />
          </p>
        )}
      </div>
      <div className="bk-end-toys">
        <KidToy tone="go" size="l" glyph="replay" data-book-read-again="" onClick={onReadAgain}>
          {bookString("readAgain", lang)}
        </KidToy>
        <KidToy tone="paper" size="l" glyph="close" data-book-end-close="" onClick={onClose}>
          {bookString("close", lang)}
        </KidToy>
      </div>
      {toggle}
    </section>
  );
}
