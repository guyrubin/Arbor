import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { ChildProfile, DeletionReceipt } from "../types";
import { defaultChildProfile } from "../initialData";
import { eraseEverything } from "../lib/childData";
import { clearChildLocalState } from "../lib/childLocalState";
import { authHeaders } from "../lib/api";
import { trackProfileCreated } from "../lib/loopEvents";
import { bandForAge } from "../lib/screening";
import { computeNeedsOnboarding } from "../lib/onboardingGate";

const LS_PROFILES = "arbor.children";
const LS_ACTIVE = "arbor.activeChildId";

export type NewChildInput = Omit<ChildProfile, "id">;

type ProfileContextValue = {
  /** All child profiles for the signed-in parent. */
  profiles: ChildProfile[];
  /** The currently selected child (always defined once loaded). */
  activeChild: ChildProfile;
  loading: boolean;
  /** True for a new authenticated account with no children yet. */
  needsOnboarding: boolean;
  setActiveChild: (id: string) => void;
  addChild: (input: NewChildInput) => Promise<ChildProfile>;
  updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<void>;
  /** Permanently delete a child and all of their data (GDPR/COPPA). Returns a
   *  provable deletion receipt from the server when available. */
  deleteChild: (id: string) => Promise<DeletionReceipt | null>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

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
async function provisionOwnership(childId: string, childProfile?: Partial<ChildProfile>): Promise<boolean> {
  try {
    const res = await fetch("/api/onboarding/family-child", {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ childId, childProfile }),
    });
    return res.ok;
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

  // OWN-1: once-per-session-per-child guard for the ownership backfill —
  // in-memory ref first, sessionStorage second (survives remounts, resets on a
  // new session so a transient failure retries on the next sign-in).
  const provisionedChildren = useRef<Set<string>>(new Set());
  const ensureOwnership = useCallback(
    async (child: Pick<ChildProfile, "id"> & Partial<ChildProfile>) => {
      if (provisionedChildren.current.has(child.id)) return;
      try {
        if (sessionStorage.getItem(`${OWNERSHIP_GUARD_PREFIX}${child.id}`)) {
          provisionedChildren.current.add(child.id);
          return;
        }
      } catch {
        /* storage blocked — the in-memory ref still guards this session */
      }
      provisionedChildren.current.add(child.id);
      const ok = await provisionOwnership(child.id, child);
      if (ok) {
        try { sessionStorage.setItem(`${OWNERSHIP_GUARD_PREFIX}${child.id}`, new Date().toISOString()); } catch { /* ignore */ }
      } else {
        // Let a later trigger in this session retry (e.g. addChild after a load failure).
        provisionedChildren.current.delete(child.id);
      }
    },
    []
  );

  const profilesPath = user ? `users/${user.uid}/children` : "";

  // Load profiles on mount / when the auth identity changes.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      if (useFirestore && db && user) {
        try {
          const snap = await getDocs(collection(db, profilesPath));
          // Real accounts are NOT seeded with demo data — an empty result means the
          // user is new and onboarding will create their first child.
          const loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChildProfile, "id">) }));
          if (!cancelled) setProfiles(loaded);
          // OWN-1: backfill server ownership docs for every existing child on
          // sign-in (idempotent + session-guarded). Fire-and-forget — profile
          // loading never blocks on it.
          for (const child of loaded) void ensureOwnership(child);
        } catch {
          if (!cancelled) setProfiles(readLocalProfiles());
        }
      } else {
        if (!cancelled) setProfiles(readLocalProfiles());
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useFirestore, user?.uid]);

  // Mirror sandbox profiles to localStorage.
  useEffect(() => {
    if (!useFirestore && profiles.length > 0) writeLocalProfiles(profiles);
  }, [profiles, useFirestore]);

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
      const newChild: ChildProfile = { ...input, id: `child-${Date.now()}` };
      if (useFirestore && db) {
        try {
          await setDoc(doc(db, profilesPath, newChild.id), newChild);
        } catch {
          /* fall through to local state update */
        }
        // OWN-1: provision the server-side ownership docs right after the
        // child doc write so the new child's memory/privacy routes work
        // immediately (fire-and-forget; the load-time backfill is the net).
        void ensureOwnership(newChild);
      }
      let count = 0;
      setProfiles((prev) => {
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
    [useFirestore, profilesPath, ensureOwnership]
  );

  const updateChild = useCallback(
    async (id: string, patch: Partial<ChildProfile>) => {
      if (useFirestore && db) {
        try {
          await updateDoc(doc(db, profilesPath, id), patch as Record<string, unknown>);
        } catch {
          /* fall through to local state update */
        }
      }
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    },
    [useFirestore, profilesPath]
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

  const needsOnboarding = computeNeedsOnboarding(useFirestore, loading, profiles);

  const value: ProfileContextValue = {
    profiles,
    activeChild,
    loading,
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
