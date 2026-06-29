import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { ChildProfile, DeletionReceipt } from "../types";
import { defaultChildProfile } from "../initialData";
import { eraseEverything } from "../lib/childData";
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
    [useFirestore, profilesPath]
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
