/**
 * B-KID-87 (KB-29) — "Our books" on #/comics opens a book in the Stories reader.
 *
 * A cover tapped in Our books asks #/stories to open THAT book, once. The
 * request rides a one-shot seam (the same shape as lib/tonightMode), not a
 * hash: ArborContext owns `#/<tab>` and rewrites anything else. Memory first,
 * sessionStorage backs a reload; only a catalogue story id is held, nothing
 * about the child.
 */
const KEY = "arbor.storyOpen";
let pending: string | null = null;

/** Ask the Stories page to open `storyId` on its next mount. */
export function requestStoryOpen(storyId: string): void {
  pending = storyId;
  try { sessionStorage.setItem(KEY, storyId); } catch { /* storage unavailable */ }
}

/** Read and clear the pending request (null when none). */
export function consumeStoryOpen(): string | null {
  let id = pending;
  pending = null;
  try {
    const stored = sessionStorage.getItem(KEY);
    if (!id && stored) id = stored;
    sessionStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
  return id;
}
