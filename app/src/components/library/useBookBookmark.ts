import { useCallback, useEffect, useRef, useState } from "react";
import { useChildCollection } from "../../hooks/useChildCollection";
import { heroSheetOwnerKey, subscribeHeroSheetOwner } from "../../lib/heroSheetStore";
import { bookmarkFor, resumeBook, type BookBookmark, type BookProgressPosition } from "../../lib/library/bookBookmarks";
import { initialBookFlow, type BookFlowState } from "../../lib/library/bookFlow";
import type { AnyBook } from "../../lib/library/types";

/** One minimal private row per book. Reading survives unavailable bookmark
 * storage; only a safe, owned read may supply the initial position. */
export function useBookBookmark(childId: string, book: AnyBook, edition: string, owner: string) {
  const bookmarks = useChildCollection<BookBookmark>(childId, "bookBookmarks", { trackConfirmation: true });
  const scope = JSON.stringify([owner, childId, book.id, edition]);
  const lifetime = useRef({ scope, revision: 0 });
  if (lifetime.current.scope !== scope) lifetime.current = { scope, revision: lifetime.current.revision + 1 };
  const revision = lifetime.current.revision;
  const mounted = useRef(true);
  const retired = useRef(false);
  const latest = useRef(bookmarks);
  latest.current = bookmarks;
  const [initial, setInitial] = useState<{ scope: string; state: BookFlowState } | null>(null);
  const [pending, setPending] = useState<{ row: BookBookmark; revision: number } | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);
  const failed = useRef<typeof pending>(null);
  const current = useCallback(() => mounted.current && !retired.current && lifetime.current.revision === revision && owner !== "signed-out" && heroSheetOwnerKey() === owner, [owner, revision]);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeHeroSheetOwner(() => { if (heroSheetOwnerKey() !== owner) retired.current = true; });
    return () => { mounted.current = false; unsubscribe(); };
  }, [owner]);

  useEffect(() => {
    if (!bookmarks.loaded || !current() || initial?.scope === scope) return;
    // Remote cache snapshots belong to this owner even offline. Error fallback
    // rows and unreadable sandbox storage do not; start safely at the cover.
    const safe = bookmarks.remote ? !bookmarks.error : bookmarks.isCurrent();
    const row = safe ? bookmarks.items.find(row => row && typeof row === "object" && row.id === book.id) : undefined;
    setInitial({ scope, state: row ? resumeBook(book, edition, row) : initialBookFlow() });
    if (!safe) setStatus("error");
  }, [bookmarks, book, current, edition, initial, scope]);

  const save = useCallback((position: BookProgressPosition) => {
    if (!current()) return;
    const row = bookmarkFor(book, edition, position);
    failed.current = null;
    setPending({ row, revision });
    setStatus("saving");
  }, [book, edition, current, revision]);

  useEffect(() => {
    if (!pending || pending.revision !== revision || busy.current || failed.current === pending || !current()) return;
    const store = latest.current;
    if (!store.loaded || !store.isCurrent()) {
      if (store.loaded) setStatus("error");
      return;
    }
    busy.current = true;
    setStatus("saving");
    void store.upsert(pending.row, { requireAcknowledgement: true }).then(() => {
      if (!current()) return;
      setPending(value => value === pending ? null : value);
      setStatus("saved");
    }).catch(() => {
      if (!current()) return;
      failed.current = pending;
      setStatus("error");
    }).finally(() => {
      busy.current = false;
      if (current()) setAttempt(n => n + 1);
    });
  }, [pending, attempt, bookmarks, current, revision]);

  const retry = useCallback(() => { failed.current = null; setAttempt(n => n + 1); }, []);
  return { initialState: initial?.scope === scope ? initial.state : null, save, current, status, retry };
}
