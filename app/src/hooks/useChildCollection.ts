import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { collection, deleteDoc, doc, limit as fbLimit, onSnapshot, orderBy, query, setDoc, writeBatch } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { clearSyncError, getSyncSnapshot, reportSyncError, subscribeSyncStatus } from "../lib/syncStore";

type WithId = { id: string };

export interface ChildCollection<T extends WithId> {
  items: T[];
  loaded: boolean;
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
  upsert: (item: T) => Promise<void>;
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
  opts?: { seed?: T[]; sandboxSeed?: T[]; orderByField?: string; orderDir?: "asc" | "desc"; max?: number }
): ChildCollection<T> {
  const { user } = useAuth();
  const remote = firebaseEnabled && !!user && user.uid !== "local-sandbox" && !!db;
  const uid = user?.uid;

  const [items, setItems] = useState<T[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
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
        if (raw) return JSON.parse(raw) as T[];
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
    seededRef.current = false;
    setLoaded(false);
    setError(false);

    if (remote && db && uid) {
      const colRef = collection(db, `users/${uid}/children/${childId}/${name}`);
      // Bound large collections with orderBy + limit (pagination guardrail).
      const q = opts?.orderByField
        ? query(colRef, orderBy(opts.orderByField, opts.orderDir || "desc"), fbLimit(opts.max || 300))
        : colRef;
      const unsub = onSnapshot(
        q,
        (snap) => {
          if (snap.empty && opts?.seed && opts.seed.length > 0 && !seededRef.current) {
            seededRef.current = true;
            const batch = writeBatch(db!);
            opts.seed.forEach((it) => batch.set(doc(colRef, it.id), it as Record<string, unknown>));
            batch.commit().catch(() => {});
            return; // snapshot fires again once seeded
          }
          setItems(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id })) as T[]);
          setLoaded(true);
          // W0.5: a successful snapshot clears the error state (additive — the
          // two lines above are byte-identical to the pre-W0.5 happy path).
          setError(false);
          clearSyncError(name, childId);
        },
        () => {
          // Permission/network error → degrade to local (unchanged), but no
          // longer silently: W0.5 surfaces it. The local fallback KEEPS
          // rendering; error just says "this may be stale, not empty", and the
          // store registration lets ONE global banner report it app-wide.
          setItems(readLocal());
          setLoaded(true);
          setError(true);
          reportSyncError(name, childId);
        }
      );
      return () => {
        unsub();
        // Leaving the screen (or switching child) retires this listener's
        // banner registration — a stale entry must not outlive its listener.
        clearSyncError(name, childId);
      };
    }

    setItems(readLocal(opts?.sandboxSeed));
    setLoaded(true);
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
    async (item: T) => {
      if (remote && db && uid) {
        await setDoc(doc(db, `users/${uid}/children/${childId}/${name}`, item.id), item as Record<string, unknown>);
      } else {
        setItems((prev) => {
          const idx = prev.findIndex((p) => p.id === item.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = item;
            return copy;
          }
          return [item, ...prev];
        });
      }
    },
    [remote, uid, childId, name]
  );

  const remove = useCallback(
    async (id: string) => {
      if (remote && db && uid) {
        await deleteDoc(doc(db, `users/${uid}/children/${childId}/${name}`, id));
      } else {
        setItems((prev) => prev.filter((p) => p.id !== id));
      }
    },
    [remote, uid, childId, name]
  );

  const replaceAll = useCallback(
    async (next: T[]) => {
      if (remote && db && uid) {
        const colRef = collection(db, `users/${uid}/children/${childId}/${name}`);
        const batch = writeBatch(db);
        next.forEach((it) => batch.set(doc(colRef, it.id), it as Record<string, unknown>));
        await batch.commit();
      } else {
        setItems(next);
      }
    },
    [remote, uid, childId, name]
  );

  return { items, loaded, error, remote, upsert, remove, replaceAll };
}
