import { useCallback, useEffect, useRef, useState } from "react";
import { collection, documentId, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { db, firebaseEnabled } from "../lib/firebase";
import { historyWindow, nextHistoryWindow } from "../lib/historyWindow";

/** Read-only historical view. Every expansion is an explicit bounded live query.
 * A one-row lookahead distinguishes a full page from the end of a collection.
 * Re-reading the expanded window also removes deleted rows and avoids gaps when
 * a new record moves the boundary. It never writes a partial view to localStorage.
 */
export function useChildHistory<T extends { id: string }>(
  childId: string,
  name: string,
  dateField?: string,
  sandboxItems?: readonly T[],
) {
  const { user } = useAuth();
  const remote = firebaseEnabled && !!db && !!user && user.uid !== "local-sandbox";
  const scope = `${remote ? user?.uid : "local"}:${childId}:${name}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const [window, setWindow] = useState({ scope, size: 200, retry: 0 });
  const size = window.scope === scope ? window.size : 200;
  const retry = window.scope === scope ? window.retry : 0;
  const [snapshot, setSnapshot] = useState<{ scope: string; size: number; rows: T[]; more: boolean; confirmed: boolean; error: boolean } | null>(null);
  if (window.scope !== scope) {
    // Retire the previous scope even on A → B → A; an earlier expanded
    // window or cached rows must not be revived before a fresh read.
    setWindow({ scope, size: 200, retry: 0 });
    setSnapshot(null);
  }

  useEffect(() => {
    if (!childId) return;
    let active = true;
    const accept = (rows: T[], confirmed: boolean, error = false) => {
      if (!active || scopeRef.current !== scope) return;
      const page = historyWindow(rows, size);
      setSnapshot({ scope, size, rows: page.rows, more: page.more, confirmed, error });
    };
    if (remote && db && user) {
      const ref = collection(db, `users/${user.uid}/children/${childId}/${name}`);
      // documentId adds stable ordering for equal timestamps; undated sources
      // (milestones, keepsakes, checks) are read by id so no record is skipped.
      const sort = dateField ? [orderBy(dateField, "desc"), orderBy(documentId(), "desc")] : [orderBy(documentId())];
      const stop = onSnapshot(query(ref, ...sort, limit(size + 1)), { includeMetadataChanges: true }, snap => {
        accept(snap.docs.map(row => ({ ...row.data(), id: row.id }) as T), !snap.metadata.fromCache);
      }, () => {
        if (!active || scopeRef.current !== scope) return;
        setSnapshot(previous => ({ scope, size, rows: previous?.scope === scope ? previous.rows : [], more: previous?.scope === scope ? previous.more : false, confirmed: false, error: true }));
      });
      return () => { active = false; stop(); };
    }
    try {
      const value: unknown = JSON.parse(localStorage.getItem(`arbor.${name}.${childId}`) || "[]");
      const rows = Array.isArray(value) ? value as T[] : [];
      if (dateField) rows.sort((a, b) => String((b as Record<string, unknown>)[dateField] ?? "").localeCompare(String((a as Record<string, unknown>)[dateField] ?? "")) || b.id.localeCompare(a.id));
      accept(rows, true);
    } catch { accept([], false, true); }
    return () => { active = false; };
  }, [scope, remote, user?.uid, childId, name, dateField, size, retry]);

  const current = window.scope === scope && snapshot?.scope === scope ? snapshot : null;
  // The shared sandbox context owns live edits for these collections. A
  // second local read must not hide a new moment or resurrect an undone one.
  const local = !remote && sandboxItems ? historyWindow(sandboxItems, size) : null;
  const loading = !local && (!current || current.size !== size);
  const error = !local && !!current?.error;
  const confirmed = !!local || !!current?.confirmed;
  const more = local?.more ?? current?.more ?? false;
  const loadMore = useCallback(() => {
    if (scopeRef.current !== scope || loading || error || !more) return;
    setWindow(previous => ({ scope, size: nextHistoryWindow(previous.scope === scope ? previous.size : 200), retry: previous.scope === scope ? previous.retry : 0 }));
  }, [scope, loading, error, more]);
  const reload = useCallback(() => {
    if (scopeRef.current !== scope) return;
    setWindow(previous => ({ scope, size: previous.scope === scope ? previous.size : 200, retry: (previous.scope === scope ? previous.retry : 0) + 1 }));
  }, [scope]);
  return { items: local?.rows ?? current?.rows ?? [], loading, error, more, confirmed, loadMore, reload };
}
