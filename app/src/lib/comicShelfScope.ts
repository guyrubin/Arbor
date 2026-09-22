export type ComicShelfReadToken = Readonly<{ scope: string; request: number }>;

/** Shared async guard for saved-comic reads. Both values must still match at
 * commit time; a child/account/avatar/book-revision switch invalidates scope. */
export function comicShelfReadIsCurrent(
  started: ComicShelfReadToken,
  current: ComicShelfReadToken,
): boolean {
  return started.scope === current.scope && started.request === current.request;
}

