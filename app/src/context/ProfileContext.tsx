import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { collection, deleteField, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, firebaseEnabled } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "./AuthContext";
import { ChildProfile, DeletionReceipt } from "../types";
import { defaultChildProfile } from "../initialData";
import { eraseEverything } from "../lib/childData";
import { clearChildLocalState } from "../lib/childLocalState";
import { authHeaders } from "../lib/api";
import { trackProfileCreated } from "../lib/loopEvents";
import { bandForAge } from "../lib/screening";
import { computeNeedsOnboarding } from "../lib/onboardingGate";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

const LS_PROFILES = "arbor.children";
const LS_ACTIVE = "arbor.activeChildId";

export type NewChildInput = Omit<ChildProfile, "id">;

type ProfileContextValue = {
  /** All child profiles for the signed-in parent. */
  profiles: ChildProfile[];
  /** The currently selected child (always defined once loaded). */
  activeChild: ChildProfile;
  loading: boolean;
  /** Signed-in profile reads fail closed; Retry never imports another device-local family. */
  loadError: boolean;
  retryProfiles: () => void;
  /** True for a new authenticated account with no children yet. */
  needsOnboarding: boolean;
  setActiveChild: (id: string) => void;
  addChild: (input: NewChildInput) => Promise<ChildProfile>;
  /** Applies the patch locally and remotely. Resolves FALSE when the remote
   *  write failed (M4): the caller raises a parent-visible error rather than
   *  letting a lost save look like a saved one. */
  updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<boolean>;
  /** Permanently delete a child and all of their data (GDPR/COPPA). Returns a
   *  provable deletion receipt from the server when available. */
  deleteChild: (id: string) => Promise<DeletionReceipt | null>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

type ProfileScope = { retry: number; key: string; active: boolean; changed: boolean; owner: NonNullable<typeof auth>["currentUser"] | null; remote: boolean };
function liveProfileScope(scope: ProfileScope, latest: ProfileScope, key: string): boolean {
  return scope === latest && scope.key === key && scope.active && !scope.changed
    && (!scope.remote || (!!scope.owner && scope.key === `remote:${scope.owner.uid}` && auth?.currentUser === scope.owner));
}

const readLocalProfiles = (): ChildProfile[] => {
  try {
    const raw = localStorage.getItem(LS_PROFILES);
    if (raw) {
      const parsed = JSON.parse(raw) as ChildProfile[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return [defaultChildProfile];
};

const writeLocalProfiles = (profiles: ChildProfile[]) => {
  try {
    localStorage.setItem(LS_PROFILES, JSON.stringify(profiles));
  } catch {
    /* ignore quota / unavailable storage */
  }
};

/**
 * OWN-1: server-side ownership provisioning. The families/{familyId}/members
 * docs that the server's requireChildOwnership authorizes against are created
 * ONLY by this endpoint — without it every child-scoped route (memory review,
 * privacy export/erase) 403s in production. Identity is SERVER-derived: only
 * the childId + profile travel; familyId/userId come from the authenticated
 * uid on the server (client-supplied values are ignored there). Idempotent —
 * calling it per loaded profile backfills accounts created before it was wired.
 * Best-effort: a failure is retried on the next session (the sessionStorage
 * guard is only set on success).
 */
const OWNERSHIP_GUARD_PREFIX = "arbor.ownershipProvisioned.";
async function provisionOwnership(childId: string, childProfile: Partial<ChildProfile> | undefined, current: () => boolean): Promise<boolean> {
  try {
    if (!current()) return false;
    const headers = await authHeaders();
    if (!current()) return false;
    const res = await fetch("/api/onboarding/family-child", {
      method: "POST",
      headers,
      body: JSON.stringify({ childId, childProfile }),
    });
    return current() && res.ok;
  } catch {
    return false;
  }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, firebaseEnabled: authEnabled } = useAuth();
  const useFirestore = firebaseEnabled && authEnabled && !!user && user.uid !== "local-sandbox";

  const [profiles, setProfiles] = useState<ChildProfile[]>([]);
  const [activeChildId, setActiveChildId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LS_ACTIVE);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [loadedScope, setLoadedScope] = useState<ProfileScope | null>(null);
  const [loadErrorScope, setLoadErrorScope] = useState<ProfileScope | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);
  const retryProfiles = useCallback(() => setLoadVersion(version => version + 1), []);

  // ProfileProvider survives the keyed owner subtree. Async callbacks must
  // never install a previous owner's result into the next owner's state.
  const writeScopeKey = `${useFirestore ? "remote" : "local"}:${user?.uid ?? "local-sandbox"}`;
  const [, setAuthVersion] = useState(0);
  const actualOwner = useFirestore ? auth?.currentUser ?? null : null;
  const writeScope = useRef<ProfileScope>({ retry: loadVersion, key: writeScopeKey, owner: actualOwner, remote: useFirestore, active: true, changed: false });
  if (writeScope.current.key !== writeScopeKey || writeScope.current.owner !== actualOwner || (writeScope.current.changed && writeScope.current.retry !== loadVersion)) {
    writeScope.current = { retry: loadVersion, key: writeScopeKey, owner: actualOwner, remote: useFirestore, active: true, changed: false };
  }
  const ownerScope = writeScope.current;
  useEffect(() => {
    const scope = ownerScope; scope.active = true;
    const unsubscribe = useFirestore && auth ? onAuthStateChanged(auth, current => {
      // Latch even A→B→the original A object before React commits another render.
      if (current !== scope.owner) { scope.changed = true; setAuthVersion(version => version + 1); }
    }) : () => {};
    return () => { scope.active = false; unsubscribe(); };
  }, [ownerScope]);


  // OWN-1: once-per-session-per-child guard for the ownership backfill —
  // in-memory ref first, sessionStorage second (survives remounts, resets on a
  // new session so a transient failure retries on the next sign-in).
  const provisionedChildren = useRef<Set<string>>(new Set());
  const ownershipAttempts = useRef(new Map<string, { scope: ProfileScope }>());
  const ensureOwnership = useCallback(
    async (child: Pick<ChildProfile, "id"> & Partial<ChildProfile>) => {
      const scope = ownerScope;
      const current = () => liveProfileScope(scope, writeScope.current, writeScopeKey);
      if (!current()) return;
      const guard = `${scope.key}:${child.id}`;
      if (provisionedChildren.current.has(guard)) return;
      try {
        if (sessionStorage.getItem(`${OWNERSHIP_GUARD_PREFIX}${guard}`)) {
          provisionedChildren.current.add(guard);
          return;
        }
      } catch { /* storage blocked: the scoped in-memory guard still holds */ }
      if (!current()) return;
      if (ownershipAttempts.current.get(guard)?.scope === scope) return;
      const attempt = { scope };
      ownershipAttempts.current.set(guard, attempt);
      try {
        const ok = await provisionOwnership(child.id, child, current);
        if (!current()) return;
        if (ok) {
          provisionedChildren.current.add(guard);
          try { sessionStorage.setItem(`${OWNERSHIP_GUARD_PREFIX}${guard}`, new Date().toISOString()); } catch { /* ignore */ }
        }
      } finally {
        // An obsolete A attempt must not delete a newer A→B→A attempt.
        if (ownershipAttempts.current.get(guard) === attempt) ownershipAttempts.current.delete(guard);
      }
    },
    [writeScopeKey, ownerScope]
  );

  const profilesPath = user ? `users/${user.uid}/children` : "";
  // Load profiles on mount / owner change / explicit retry. Signed-in failure
  // never reads the unowned sandbox cache or turns an unknown result into empty.
  useEffect(() => {
    let cancelled = false;
    const scope = ownerScope;
    const current = () => !cancelled && liveProfileScope(scope, writeScope.current, writeScopeKey);
    const load = async () => {
      if (!current()) return;
      setLoading(true); setLoadErrorScope(null); setLoadedScope(null); setProfiles([]);
      try {
        if (useFirestore && db && user) {
          const snap = await getDocs(collection(db, profilesPath));
          if (!current()) return;
          // Only a confirmed empty remote result may start new-account onboarding.
          const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChildProfile, "id">) }));
          setProfiles(loaded); setLoadedScope(scope);
          for (const child of loaded) {
            if (!current()) return;
            void ensureOwnership(child);
          }
        } else {
          if (!current()) return;
          setProfiles(readLocalProfiles()); setLoadedScope(scope);
        }
      } catch {
        if (current()) setLoadErrorScope(scope);
      } finally {
        if (current()) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [useFirestore, user?.uid, writeScopeKey, ownerScope, loadVersion]);

  // Mirror sandbox profiles to localStorage.
  useEffect(() => {
    if (!useFirestore && loadedScope === ownerScope && profiles.length > 0) writeLocalProfiles(profiles);
  }, [profiles, useFirestore, loadedScope, ownerScope]);

  // Keep the active child id valid and persisted.
  useEffect(() => {
    if (profiles.length === 0) return;
    const valid = activeChildId && profiles.some((p) => p.id === activeChildId);
    const nextId = valid ? activeChildId! : profiles[0].id;
    if (nextId !== activeChildId) setActiveChildId(nextId);
    try {
      localStorage.setItem(LS_ACTIVE, nextId);
    } catch {
      /* ignore */
    }
  }, [profiles, activeChildId]);

  const setActiveChild = useCallback((id: string) => setActiveChildId(id), []);

  const addChild = useCallback(
    async (input: NewChildInput): Promise<ChildProfile> => {
      const scope = ownerScope;
      const current = () => liveProfileScope(scope, writeScope.current, writeScopeKey);
      if (!current()) throw new Error("The profile session changed");
      const newChild: ChildProfile = { ...input, id: `child-${Date.now()}` };
      if (useFirestore && db) {
        try {
          await setDoc(doc(db, profilesPath, newChild.id), newChild);
        } catch {
          /* fall through to local state update */
        }
        if (!current()) throw new Error("The profile session changed");
        // OWN-1: provision the server-side ownership docs right after the
        // child doc write so the new child's memory/privacy routes work
        // immediately (fire-and-forget; the load-time backfill is the net).
        void ensureOwnership(newChild);
      }
      if (!current()) throw new Error("The profile session changed");
      let count = 0;
      setProfiles((prev) => {
        if (!current()) return prev;
        count = prev.length + 1;
        return [...prev, newChild];
      });
      setActiveChildId(newChild.id);
      // Activation signal — fired outside the updater so React StrictMode's
      // double-invoke in dev doesn't double-count. Carry the child's coarse age
      // band (non-PII) so activation is sliceable by band in the dashboard.
      try { trackProfileCreated(count, bandForAge(newChild.age).id); } catch { /* noop */ }
      return newChild;
    },
    [useFirestore, profilesPath, ensureOwnership, writeScopeKey, ownerScope]
  );

  const updateChild = useCallback(
    async (id: string, patch: Partial<ChildProfile>): Promise<boolean> => {
      const scope = ownerScope;
      const current = () => liveProfileScope(scope, writeScope.current, writeScopeKey);
      if (!current()) return false;
      let persisted = true;
      // B-DATA-03: an own `undefined` on a clearable field (birthDate after a
      // months edit) DELETES the stored value — ignoreUndefinedProperties would
      // otherwise skip it and leave a stale date outranking the new months.
      const clears = CLEARABLE_PROFILE_FIELDS.filter((k) => Object.prototype.hasOwnProperty.call(patch, k) && (patch as Record<string, unknown>)[k] === undefined);
      const firestorePatch: Record<string, unknown> = { ...(patch as Record<string, unknown>) };
      for (const k of clears) firestorePatch[k] = deleteField();
      // B-CAREPRO-34: a retired field leaves the stored record on this write.
      for (const k of RETIRED_PROFILE_FIELDS) firestorePatch[k] = deleteField();
      const applyLocal = (p: ChildProfile): ChildProfile => {
        const next = { ...p, ...patch } as Record<string, unknown>;
        for (const k of clears) delete next[k];
        for (const k of RETIRED_PROFILE_FIELDS) delete next[k];
        return next as unknown as ChildProfile;
      };
      if (useFirestore && db) {
        try {
          await updateDoc(doc(db, profilesPath, id), firestorePatch);
        } catch {
          // M4 write honesty: the local state update still happens (the parent
          // keeps editing what they can see), but the failure is REPORTED —
          // a swallowed write made a lost hero look saved until the next load.
          persisted = false;
        }
      }
      if (!current()) return false;
      setProfiles((prev) => current() ? prev.map((p) => (p.id === id ? applyLocal(p) : p)) : prev);
      return persisted;
    },
    [useFirestore, profilesPath, writeScopeKey, ownerScope]
  );

  const deleteChild = useCallback(
    async (id: string): Promise<DeletionReceipt | null> => {
      // M9: provable erasure — server wipe (memory + shares + consent) + client wipe.
      const receipt = await eraseEverything(user?.uid, id);
      // eraseEverything knows only about the server. Device-local per-child
      // rows (screening draft, watch focus, and any future arbor.<ns>.<childId>
      // store) live in the browser and used to survive the deletion the parent
      // asked for — on the very device they can see. Best-effort, never blocks.
      clearChildLocalState(id);
      setProfiles((prev) => {
        const next = prev.filter((p) => p.id !== id);
        if (id === activeChildId) setActiveChildId(next[0]?.id ?? null);
        return next;
      });
      return receipt;
    },
    [user?.uid, activeChildId]
  );

  const activeChild =
    profiles.find((p) => p.id === activeChildId) || profiles[0] || defaultChildProfile;

  const loadError = loadErrorScope === ownerScope || ownerScope.changed;
  const profileLoading = loading || loadedScope !== ownerScope;
  const needsOnboarding = computeNeedsOnboarding(useFirestore, profileLoading || loadError, profiles);

  const value: ProfileContextValue = {
    profiles,
    activeChild,
    loading: profileLoading,
    loadError,
    retryProfiles,
    needsOnboarding,
    setActiveChild,
    addChild,
    updateChild,
    deleteChild,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
