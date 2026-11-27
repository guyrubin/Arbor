import { useEffect, useRef } from "react";
import type { BookFlowState } from "../../lib/library/bookFlow";
import type { BookProgressPosition } from "../../lib/library/bookBookmarks";
import type { AnyBook } from "../../lib/library/types";
import { trueEndingGate } from "../../lib/bookReads";

/** Observe meaningful navigation only. Mounting a saved END is not finishing
 * a book, and selecting cards / tapping repairs never writes progress.
 * B-BOOK-51: `onComplete` fires only when the ONE true-ending rule
 * (lib/bookReads trueEndingGate) says this opening just finished the book —
 * at most once per opening, never from a resumed END. */
export function useBookProgress(book: AnyBook, state: BookFlowState, onProgress?: (position: BookProgressPosition) => void, onComplete?: () => void): void {
  const previous = useRef({ book, state, finish: trueEndingGate(state) });
  useEffect(() => {
    const before = previous.current;
    previous.current = { book, state, finish: before.book === book ? before.finish : trueEndingGate(state) };
    if (before.book !== book || (before.state.at === state.at && before.state.choiceId === state.choiceId)) return;
    onProgress?.({ at: state.at, choiceId: state.choiceId });
    if (before.finish(book, before.state, state)) onComplete?.();
  }, [book, state, onProgress, onComplete]);
}
