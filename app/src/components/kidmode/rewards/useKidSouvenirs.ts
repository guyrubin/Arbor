import { useCallback, useRef } from "react";
import { useChildCollection } from "../../../hooks/useChildCollection";
import { useAuth } from "../../../context/AuthContext";
import { firebaseEnabled } from "../../../lib/firebase";
import { souvenirToAward, type KidSouvenir, type SouvenirKind } from "./kidSouvenirs";

/** Existing offline-capable ledger. Deterministic ids prevent duplicate rows;
 * concurrent devices may update the first timestamp, but never lose an award
 * merely because a server-only transaction cannot run offline. */
export function useKidSouvenirs(childId: string) {
  const store = useChildCollection<KidSouvenir>(childId, "kidSouvenirs");
  const { user } = useAuth();
  // The unauthenticated hosted app is NOT the local sandbox. A sign-out must
  // never expose device-local demo progress or allow a new keepsake write.
  // A configured Firebase client without a usable remote store also fails closed.
  const canAccess = !firebaseEnabled || (!!user && user.uid !== "local-sandbox" && store.remote);
  const scopeKey = `${canAccess ? user?.uid ?? "local" : "signed-out"}:${childId}`;
  const lifetime = useRef({ scopeKey, revision: 0 });
  if (lifetime.current.scopeKey !== scopeKey) lifetime.current = { scopeKey, revision: lifetime.current.revision + 1 };
  const revision = lifetime.current.revision;
  const pending = useRef(new Set<string>());
  const awardOnce = useCallback(async (kind: SouvenirKind, refId: string): Promise<boolean> => {
    const current = () => canAccess && lifetime.current.revision === revision && store.isCurrent();
    if (!store.loaded || !current()) return false;
    const item = souvenirToAward(store.items, kind, refId, new Date());
    if (!item) return false;
    const key = `${scopeKey}:${revision}:${item.id}`;
    if (pending.current.has(key)) return false;
    pending.current.add(key);
    try { await store.upsert(item); return lifetime.current.revision === revision; }
    finally { pending.current.delete(key); }
  }, [canAccess, scopeKey, revision, store.loaded, store.items, store.isCurrent, store.upsert]);
  // Do not render a cached sandbox collection while a hosted visitor is signed
  // out. This is a Kids-only egress guard; Parent and explicit local demo flows
  // retain their existing collection semantics.
  return {
    ...store,
    items: canAccess ? store.items : [],
    loaded: canAccess && store.loaded,
    confirmed: canAccess && store.confirmed,
    isCurrent: () => canAccess && store.isCurrent(),
    scopeKey,
    awardOnce,
  };
}
