/**
 * v3 F-FORYOU-1 — the one-shot hand-off from #/learn to the library on
 * For you, the parent.
 *
 * #/learn is a reader only. A link that lands there without a read (the
 * sidebar's "Learn Library", an old bookmark, a shelf request) is sent on to
 * #/masterclasses, and the parent should arrive at "Courses by area", not at
 * the top of the hub. LearnLibrary queues the scroll; the hub takes it once on
 * mount. A module flag, not router state: nothing else reads it, and a reload
 * starts clean.
 */
let pending = false;

/** Ask the next For you mount to bring the library into view. */
export function queueLibraryScroll(): void {
  pending = true;
}

/** True once per queued request: the caller scrolls, the flag clears. */
export function takeLibraryScroll(): boolean {
  const was = pending;
  pending = false;
  return was;
}
