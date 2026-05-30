import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db, firebaseEnabled } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { ChildProfile } from "../types";
import { defaultChildProfile } from "../initialData";

const LS_PROFILES = "arbor.children";
const LS_ACTIVE = "arbor.activeChildId";

export type NewChildInput = Omit<ChildProfile, "id">;

type ProfileContextValue = {
  /** All child profiles for the signed-in parent. */
  profiles: ChildProfile[];
  /** The currently selected child (always defined once loaded). */
  activeChild: ChildProfile;
  loading: boolean;
  setActiveChild: (id: string) => void;
  addChild: (input: NewChildInput) => Promise<ChildProfile>;
  updateChild: (id: string, patch: Partial<ChildProfile>) => Promise<void>;
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
          let loaded = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChildProfile, "id">) }));
          if (loaded.length === 0) {
            // Seed a first profile for new accounts.
            const seed = { ...defaultChildProfile, id: `child-${Date.now()}` };
            await setDoc(doc(db, profilesPath, seed.id), seed);
            loaded = [seed];
          }
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
      setProfiles((prev) => [...prev, newChild]);
      setActiveChildId(newChild.id);
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

  const activeChild =
    profiles.find((p) => p.id === activeChildId) || profiles[0] || defaultChildProfile;

  const value: ProfileContextValue = {
    profiles,
    activeChild,
    loading,
    setActiveChild,
    addChild,
    updateChild,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
