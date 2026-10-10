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
import { selectFocusGoal, type ActiveGoal } from "../practice/goalBuilder";
import { CLEARABLE_PROFILE_FIELDS, RETIRED_PROFILE_FIELDS } from "../lib/childAge";

const LS_PROFILES = "arbor.children";
const LS_ACTIVE = "arbor.activeChildId";

export type NewChildInput = Omit<ChildProfile, "id">;
export type ProfileWriteOptions = { isCurrent?: () => boolean; onPersisted?: () => void };
type FirstCreateReservation = { child: ChildProfile; write: Promise<void>; status: "pending" | "acknowledged" | "rejected"; installed: boolean; adopter: object };


export type GoalAttempt = { status: "pending" | "failed"; goal: Omit<ActiveGoal, "addedAt">; basis: string };
export type GoalSelection = { goals: ActiveGoal[]; attempt?: GoalAttempt };
export type GoalSaveResult = "saved" | "failed" | "pending" | "changed" | "obsolete";

type ProfileContextValue = {
  /** All child profiles for the signed-in parent. */
  profiles: ChildProfile[];
  /** The currently selected child (always defined once loaded). */
  activeChild: ChildProfile;
  loading: boolean;
  /** Signed-in profile reads fail closed; Retry never imports another device-local family. */
  loadError: boolean;
  retryProfiles: () => void;
  /** Read-only owner lifetime fence for multi-write first-run continuations. */
  isCurrentSession: () => boolean;
  captureOnboardingLifetime: (childId: string | null) => () => boolean;
  /** True for a new authenticated account with no children yet. */
  needsOnboarding: boolean;
  setActiveChild: (id: string) => void;
  addChild: (input: NewChildInput, options?: ProfileWriteOptions) => Promise<ChildProfile>;
  /** Applies the patch locally and remotely. Resolves FALSE when the remote
   *  write failed (M4): the caller raises a parent-visible error rather than
   *  letting a lost save look like a saved one. */
  updateChild: (id: string, patch: Partial<ChildProfile>, options?: ProfileWriteOptions) => Promise<boolean>;
  /** Goal-only session state survives picker/route/child unmounts. */
  goalSession: object;
  getGoalSelection: (id: string) => GoalSelection | undefined;
  saveChildGoal: (id: string, goal: Omit<ActiveGoal, "addedAt">, basis: string) => Promise<GoalSaveResult>;
  cancelGoalAttempt: (id: string) => void;
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
  // A selection is a lifetime, not only an ID: A→B→A must not revive a save.
  const selectedChildRef = useRef({ id: activeChildId });
  if (selectedChildRef.current.id !== activeChildId) selectedChildRef.current = { id: activeChildId };
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

  const isCurrentSession = useCallback(
    () => liveProfileScope(ownerScope, writeScope.current, writeScopeKey),
    [ownerScope, writeScopeKey]
  );

  const captureOnboardingLifetime = useCallback((childId: string | null) => {
    const scope = ownerScope, selected = selectedChildRef.current;
    // A brand-new child selects itself only after persistence. Existing-child
    // operations retain this exact selection lease through their final write.
    return () => liveProfileScope(scope, writeScope.current, writeScopeKey)
      && (childId === null || selectedChildRef.current === selected);
  }, [ownerScope, writeScopeKey]);
  // Survives OnboardingFlow close/reopen. It is not a cross-tab transaction.
  // Never discard an uncertain issued write merely because its UI retired.
  const firstCreates = useRef(new Map<string, FirstCreateReservation>());

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

  const setActiveChild = useCallback((id: string) => {
    // Retire callbacks before React renders, including two rapid selections.
    if (selectedChildRef.current.id !== id) selectedChildRef.current = { id };
    setActiveChildId(id);
  }, []);

  const addChild = useCallback(
    async (input: NewChildInput, options?: ProfileWriteOptions): Promise<ChildProfile> => {
      const scope = ownerScope, selected = selectedChildRef.current;
      const ownerCurrent = () => liveProfileScope(scope, writeScope.current, writeScopeKey);
      const callerCurrent = () => ownerCurrent() && options?.isCurrent?.() !== false;
      const onboarding = input.onboardingComplete === false;
      let reservation: FirstCreateReservation | undefined;
      const adopter = {};
      const current = () => callerCurrent() && (!onboarding || (selectedChildRef.current === selected && reservation?.adopter === adopter));
      if (!callerCurrent()) throw new Error("The profile session changed");
      let newChild: ChildProfile;
      if (onboarding) {
        reservation = firstCreates.current.get(writeScopeKey);
        if (!reservation) {
          reservation = { child: { ...input, id: `child-${Date.now()}` }, write: Promise.resolve(), status: "rejected", installed: false, adopter };
          firstCreates.current.set(writeScopeKey, reservation);
        }
        reservation.adopter = adopter;
        const reserved = reservation;
        const issue = (child: ChildProfile) => {
          reserved.child = child; reserved.status = "pending";
          reserved.write = useFirestore && db ? setDoc(doc(db, profilesPath, child.id), child) : Promise.resolve();
          // Observe settlement without installing anything for an obsolete UI.
          void reserved.write.then(() => { reserved.status = "acknowledged"; }, () => { reserved.status = "rejected"; });
        };
        if (reserved.status === "rejected") issue({ ...input, id: reserved.child.id });
        await reserved.write;
        if (!current()) throw new Error("The profile session changed");
        newChild = { ...input, id: reserved.child.id };
        // A reopened parent may have corrected the form. Persist those exact
        // reviewed fields on the same reserved child, never a second identity.
        if (JSON.stringify(newChild) !== JSON.stringify(reserved.child)) {
          issue(newChild); await reserved.write;
          if (!current()) throw new Error("The profile session changed");
        }
        if (reserved.installed) return newChild;
      } else {
        newChild = { ...input, id: `child-${Date.now()}` };
        if (useFirestore && db) {
          try { await setDoc(doc(db, profilesPath, newChild.id), newChild); }
          catch { /* existing add-child paths retain their local fallback */ }
        }
        if (!current()) throw new Error("The profile session changed");
      }
      if (!current()) throw new Error("The profile session changed");
      if (useFirestore && db) {
        // Admit provisioning only for the live acknowledged adopter. Once
        // admitted, the provider owns this child's existing owner-scoped work;
        // closing its UI must not strand an installed child's ownership.
        void ensureOwnership(newChild);
      }
      if (!current()) throw new Error("The profile session changed");
      let count = 0;
      setProfiles((prev) => {
        if (!callerCurrent()) return prev;
        if (reservation) reservation.installed = true;
        if (prev.some(child => child.id === newChild.id)) return prev;
        count = prev.length + 1; return [...prev, newChild];
      });
      setActiveChildId(newChild.id);
      try { trackProfileCreated(count, bandForAge(newChild.age).id); } catch { /* noop */ }
      return newChild;
    },
    [useFirestore, profilesPath, ensureOwnership, writeScopeKey, ownerScope]
  );

  const updateChild = useCallback(
    async (id: string, patch: Partial<ChildProfile>, options?: ProfileWriteOptions): Promise<boolean> => {
      const scope = ownerScope;
      const selected = selectedChildRef.current;
      const onboarding = Object.prototype.hasOwnProperty.call(patch, "onboardingDraft") || patch.onboardingComplete === true;
      const current = () => liveProfileScope(scope, writeScope.current, writeScopeKey)
        && (!onboarding || selectedChildRef.current === selected) && options?.isCurrent?.() !== false;
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
      // B-SHELL-36: keep the setup gate open until completion really persists.
      if (!persisted && onboarding) return false;
      if (persisted && patch.onboardingComplete === true && firstCreates.current.get(writeScopeKey)?.child.id === id) {
        firstCreates.current.delete(writeScopeKey);
      }
      if (persisted && options?.onPersisted) {
        // Finish navigation after acknowledgement but before ProfileGate can
        // unmount the flow when the completed profile becomes visible.
        options.onPersisted();
        setProfiles(prev => liveProfileScope(scope, writeScope.current, writeScopeKey)
          ? prev.map(p => p.id === id ? applyLocal(p) : p) : prev);
      } else setProfiles((prev) => current() ? prev.map((p) => (p.id === id ? applyLocal(p) : p)) : prev);
      return persisted;
    },
    [useFirestore, profilesPath, writeScopeKey, ownerScope]
  );

  // B-GROWTH-40: the goal writer owns its full-array basis and its pending /
  // retry state at the owner-session + child lifetime, not at a dialog lifetime.
  // Only this seam changes goal choices. Generic profile edits keep their M4
  // behavior; an unacknowledged goal is never installed as the current choice.
  const [, setGoalVersion] = useState(0);
  const goalSessionRef = useRef({ scope: ownerScope, children: new Map<string, GoalSelection & { observed: ChildProfile["activeGoals"] }>() });
  if (goalSessionRef.current.scope !== ownerScope) {
    goalSessionRef.current = { scope: ownerScope, children: new Map() };
  }
  const goalSession = goalSessionRef.current;
  if (loadedScope === ownerScope) {
    for (const profile of profiles) {
      const previous = goalSession.children.get(profile.id);
      if (!previous || previous.observed !== profile.activeGoals) {
        goalSession.children.set(profile.id, { ...previous, observed: profile.activeGoals, goals: profile.activeGoals ?? [] });
      }
    }
    for (const id of goalSession.children.keys()) {
      if (!profiles.some(profile => profile.id === id)) goalSession.children.delete(id);
    }
  }
  const getGoalSelection = useCallback((id: string): GoalSelection | undefined => {
    if (!liveProfileScope(ownerScope, writeScope.current, writeScopeKey)) return undefined;
    return goalSession.children.get(id);
  }, [goalSession, ownerScope, writeScopeKey]);
  const cancelGoalAttempt = useCallback((id: string) => {
    const state = getGoalSelection(id);
    if (state?.attempt?.status === "failed") {
      delete state.attempt;
      setGoalVersion(version => version + 1);
    }
  }, [getGoalSelection]);
  const saveChildGoal = useCallback(async (id: string, goal: Omit<ActiveGoal, "addedAt">, basis: string): Promise<GoalSaveResult> => {
    const current = () => liveProfileScope(ownerScope, writeScope.current, writeScopeKey)
      && goalSessionRef.current === goalSession && goalSession.children.has(id);
    const state = getGoalSelection(id);
    if (!current() || !state) return "obsolete";
    if (state.attempt?.status === "pending") return "pending";
    // Replacing a changed source always requires a newly rendered question.
    if (JSON.stringify(state.goals) !== basis) return "changed";
    const merged = selectFocusGoal(state.goals, goal, new Date().toISOString());
    const attempt: GoalAttempt = { status: "pending", goal, basis };
    state.attempt = attempt;
    setGoalVersion(version => version + 1);
    try {
      if (useFirestore && db) await updateDoc(doc(db, profilesPath, id), { activeGoals: merged });
      if (!current()) return "obsolete";
      // Advance the admission basis before React renders the acknowledgement.
      // `observed` still points at the previous rendered array until that render.
      const latest = goalSession.children.get(id)!;
      latest.goals = merged;
      delete latest.attempt;
      setProfiles(previous => current() ? previous.map(profile => profile.id === id ? { ...profile, activeGoals: merged } : profile) : previous);
      setGoalVersion(version => version + 1);
      return "saved";
    } catch {
      if (!current()) return "obsolete";
      goalSession.children.get(id)!.attempt = { ...attempt, status: "failed" };
      setGoalVersion(version => version + 1);
      return "failed";
    }
  }, [getGoalSelection, goalSession, ownerScope, writeScopeKey, useFirestore, profilesPath]);

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
    isCurrentSession,
    captureOnboardingLifetime,
    needsOnboarding,
    setActiveChild,
    addChild,
    updateChild,
    goalSession,
    getGoalSelection,
    saveChildGoal,
    cancelGoalAttempt,
    deleteChild,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
