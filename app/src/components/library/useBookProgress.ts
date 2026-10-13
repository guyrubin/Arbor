import { useEffect, useRef } from "react";
import { END, isEnding, type BookFlowState } from "../../lib/library/bookFlow";
import type { BookProgressPosition } from "../../lib/library/bookBookmarks";
import type { Book } from "../../lib/library/types";

/** Observe meaningful navigation only. Mounting a saved END is not finishing
 * a book, and selecting cards / tapping repairs never writes progress. */
export function useBookProgress(book: Book, state: BookFlowState, onProgress?: (position: BookProgressPosition) => void, onComplete?: () => void): void {
  const previous = useRef({ book, state });
  useEffect(() => {
    const before = previous.current;
    previous.current = { book, state };
    if (before.book !== book || (before.state.at === state.at && before.state.choiceId === state.choiceId)) return;
    onProgress?.({ at: state.at, choiceId: state.choiceId });
    if (state.at === END && before.state.at !== END && isEnding(book, before.state)) onComplete?.();
  }, [book, state, onProgress, onComplete]);
}
