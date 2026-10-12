/**
 * v3 F-FORYOU-1 — the one-shot hand-off from #/learn to the library on
 * For you, the parent.
 *
 * #/learn is a reader only. A link that lands there without a read (the
 * sidebar's "Learn Library", an old bookmark, a shelf request) is sent on to
 * #/masterclasses, and the parent should arrive at "Courses by area", not at
 * the top of the hub. A request for the saved reads (ChildMemory's "All saved
 * reads") arrives at the same row with the Saved chip already chosen.
 *
 * LearnLibrary queues the stop; the hub PEEKS it during its mount effect (so
 * a StrictMode double-mount still sees it) and TAKES it in the scroll frame,
 * which runs once. A module flag, not router state: nothing else reads it,
 * and a reload starts clean.
 */
export type LibraryStop = "library" | "saved";

let pending: LibraryStop | null = null;

/** Ask the next For you mount to bring the library (or its saved reads) into view. */
export function queueLibraryScroll(stop: LibraryStop = "library"): void {
  pending = stop;
}

/** The queued stop, left in place. Safe to call from a mount effect. */
export function peekLibraryScroll(): LibraryStop | null {
  return pending;
}

/** The queued stop once: the caller scrolls, the flag clears. */
export function takeLibraryScroll(): LibraryStop | null {
  const was = pending;
  pending = null;
  return was;
}
