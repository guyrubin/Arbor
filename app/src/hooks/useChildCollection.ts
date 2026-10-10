import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { collection, deleteDoc, doc, limit as fbLimit, onSnapshot, orderBy, query, setDoc, writeBatch, type QuerySnapshot } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { clearSyncError, getSyncSnapshot, reportSyncError, subscribeSyncStatus } from "../lib/syncStore";
import { settleOrQueue } from "../lib/firestoreWrite";
import { sameLocalHistoryRows } from "../lib/historyWindow";

type WithId = { id: string };

export interface ChildCollection<T extends WithId> {
  items: T[];
  loaded: boolean;
  /** Opt-in receipt gate: false for cache/pending/error snapshots. */
  confirmed: boolean;
  /** Revalidate this rendered read at an egress seam, including pre-render changes. */
  isCurrent: () => boolean;
  /**
   * W0.5: true while the live Firestore listener is in error state — `items`
   * then holds the localStorage fallback (possibly stale), NOT confirmed-empty
   * data. Cleared by the next successful snapshot. Screens may render a subtle
   * hint off this, but the global SyncStatusBanner is the canonical surface.
   */
  error: boolean;
  /** True when backed by Firestore (vs localStorage sandbox). */
  remote: boolean;
  /** Create or replace a single item. */
  upsert: (item: T, options?: { awaitServer?: boolean; requireAcknowledgement?: boolean }) => Promise<void>;
  /** Delete an item by id. */
  remove: (id: string) => Promise<void>;
  /** Replace the whole collection in one shot (sandbox: state; remote: batch). */
  replaceAll: (next: T[]) => Promise<void>;
}

/**
 * A child-scoped collection that persists to Firestore (real-time via onSnapshot)
 * when authenticated, and falls back to localStorage keyed by child in sandbox mode.
 *
 * `seed` is written to Firestore once if the collection is empty (e.g. the milestone
 * template). `sandboxSeed` is the initial value used in localStorage mode (e.g. demo
 * data) when nothing is stored yet.
 */
export function useChildCollection<T extends WithId>(
  childId: string,
  name: string,
  opts?: { seed?: T[]; sandboxSeed?: T[]; orderByField?: string; orderDir?: "asc" | "desc"; max?: number; trackConfirmation?: boolean }
): ChildCollection<T> {
  const { user } = useAuth();
  const remote = firebaseEnabled && !!user && user.uid !== "local-sandbox" && !!db;
  const uid = user?.uid;

  const [storedItems, setItems] = useState<T[]>([]);
  const [storedLoaded, setLoaded] = useState(false);
  const [storedError, setError] = useState(false);
  const [storedConfirmed, setConfirmed] = useState(false);
  const scope = `${remote ? uid : "local"}:${childId}:${name}`;
  const scopeRef = useRef(scope);
  const receiptRef = useRef(0);
  const [storedReceipt, setReceipt] = useState(0);
  if (scopeRef.current !== scope) {
    scopeRef.current = scope;
    receiptRef.current++;
  }
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  // Effects run after render: hide the previous child's rows immediately, and
  // never mirror them under the next child's localStorage key.
  const inScope = loadedScope === scope;
  const items = inScope ? storedItems : [];
  const loaded = inScope && storedLoaded;
  const error = inScope && storedError;
  const confirmed = remote ? loaded && !error && storedConfirmed : loaded && !error;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const lsKey = `arbor.${name}.${childId}`;
  const seededRef = useRef(false);

  // W0.6: the SyncStatusBanner's Retry bumps the store version — having it in
  // the subscribe-effect deps re-mounts the Firestore listener (full retry).
  // On the happy path the version never changes, so behavior is identical.
  const syncVersion = useSyncExternalStore(
    subscribeSyncStatus,
    () => getSyncSnapshot().version,
    () => 0
  );

  const readLocal = useCallback(
    (fallback?: T[]): T[] => {
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw) { const parsed: unknown = JSON.parse(raw); if (Array.isArray(parsed)) return parsed as T[]; }
      } catch {
        /* ignore */
      }
      return fallback ? fallback : [];
    },
    [lsKey]
  );

  // Subscribe / load when the active child (or auth mode) changes.
  useEffect(() => {
    if (!childId) return;
    let active = true;
    receiptRef.current++;
    seededRef.current = false;
    setLoaded(false);
    setError(false);
    setConfirmed(false);

    if (remote && db && uid) {
      const colRef = collection(db, `users/${uid}/children/${childId}/${name}`);
      // Bound large collections with orderBy + limit (pagination guardrail).
      const q = opts?.orderByField
        ? query(colRef, orderBy(opts.orderByField, opts.orderDir || "desc"), fbLimit(opts.max || 300))
        : colRef;
      const onNext: (snap: QuerySnapshot) => void = (snap) => {
        if (!active || scopeRef.current !== scope) return;
        // Retire held export callbacks before React commits the next read.
        setReceipt(++receiptRef.current);
        if (snap.empty && opts?.seed && opts.seed.length > 0 && !seededRef.current) {
          seededRef.current = true;
          const batch = writeBatch(db!);
          opts.seed.forEach((it) => batch.set(doc(colRef, it.id), it as Record<string, unknown>));
          batch.commit().catch(() => {});
          return; // snapshot fires again once seeded
        }
        setConfirmed(!opts?.trackConfirmation || (snap.metadata.fromCache === false && snap.metadata.hasPendingWrites === false));
        setLoadedScope(scope);
        setItems(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })) as T[]);
        setLoaded(true);
        // W0.5: a successful snapshot clears the error state (additive — the
        // two lines above are byte-identical to the pre-W0.5 happy path).
        setError(false);
        clearSyncError(name, childId);
      };
      const onError = () => {
        if (!active || scopeRef.current !== scope) return;
        setReceipt(++receiptRef.current);
        setLoadedScope(scope);
        // Permission/network error → degrade to local (unchanged), but no
        // longer silently: W0.5 surfaces it. The local fallback KEEPS
        // rendering; error just says "this may be stale, not empty", and the
        // store registration lets ONE global banner report it app-wide.
        setItems(readLocal());
        setLoaded(true);
        setError(true);
        setConfirmed(false);
        reportSyncError(name, childId);
      };
      const unsub = opts?.trackConfirmation
        ? onSnapshot(q, { includeMetadataChanges: true }, onNext, onError)
        : onSnapshot(q, onNext, onError);
      return () => {
        active = false;
        receiptRef.current++;
        unsub();
        // Leaving the screen (or switching child) retires this listener's
        // banner registration — a stale entry must not outlive its listener.
        clearSyncError(name, childId);
      };
    }

    setLoadedScope(scope);
    setItems(readLocal(opts?.sandboxSeed));
    setReceipt(++receiptRef.current);
    setLoaded(true);
    return () => { active = false; receiptRef.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, uid, childId, name, syncVersion]);

  // Mirror to localStorage in sandbox mode.
  useEffect(() => {
    if (!remote && loaded) {
      try {
        localStorage.setItem(lsKey, JSON.stringify(items));
      } catch {
        /* ignore */
      }
    }
  }, [items, remote, loaded, lsKey]);

  const upsert = useCallback(
    async (item: T, options?: { awaitServer?: boolean; requireAcknowledgement?: boolean }) => {
      if (scopeRef.current !== scope) throw new Error("The active child changed");
      if (remote && db && uid) {
        const write = setDoc(doc(db, `users/${uid}/children/${childId}/${name}`, item.id), item as Record<string, unknown>);
        // Existing callers retain queued-write semantics. A receipt that claims
        // acknowledgement opts in and stays pending while offline.
        if (options?.awaitServer) await write;
        else await settleOrQueue(write, options);
        if (scopeRef.current !== scope) throw new Error("The active child changed");
      } else {
        const previous = itemsRef.current;
        const next = previous.some(value => value.id === item.id)
          ? previous.map(value => value.id === item.id ? item : value)
          : [item, ...previous];
        // Persist before acknowledging the write. Quota/privacy-mode failures
        // reject the promise; the caller can keep its draft and offer retry.
        localStorage.setItem(lsKey, JSON.stringify(next));
        itemsRef.current = next;
        setReceipt(++receiptRef.current);
        setItems(next);
      }
    },
    [remote, uid, childId, name, scope, lsKey]
  );

  const remove = useCallback(
    async (id: string) => {
      if (scopeRef.current !== scope) throw new Error("The active child changed");
      if (remote && db && uid) {
        await settleOrQueue(deleteDoc(doc(db, `users/${uid}/children/${childId}/${name}`, id)));
      } else {
        const next = itemsRef.current.filter(item => item.id !== id);
        localStorage.setItem(lsKey, JSON.stringify(next));
        itemsRef.current = next;
        setReceipt(++receiptRef.current);
        setItems(next);
      }
    },
    [remote, uid, childId, name, scope, lsKey]
  );

  const replaceAll = useCallback(
    async (next: T[]) => {
      if (scopeRef.current !== scope) throw new Error("The active child changed");
      if (remote && db && uid) {
        const colRef = collection(db, `users/${uid}/children/${childId}/${name}`);
        const batch = writeBatch(db);
        next.forEach((it) => batch.set(doc(colRef, it.id), it as Record<string, unknown>));
        await batch.commit();
      } else {
        localStorage.setItem(lsKey, JSON.stringify(next));
        itemsRef.current = next;
        setReceipt(++receiptRef.current);
        setItems(next);
      }
    },
    [remote, uid, childId, name, scope, lsKey]
  );

  const isCurrent = useCallback(() => {
    if (scopeRef.current !== scope || storedReceipt !== receiptRef.current || !loaded || error || !confirmed) return false;
    if (remote) return true;
    // Same-tab sandbox writes emit no storage event. Check the existing store
    // without accepting malformed data or writing a cached fallback back to it.
    try { return sameLocalHistoryRows(items, localStorage.getItem(lsKey) || "[]"); }
    catch { return false; }
  }, [scope, storedReceipt, loaded, error, confirmed, remote, items, lsKey]);

  return { items, loaded, error, remote, upsert, remove, replaceAll, confirmed, isCurrent };
}
