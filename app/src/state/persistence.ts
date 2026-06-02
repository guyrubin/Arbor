import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Local-first persistence for the private beta.
 *
 * Child-scoped state (plans, tracking prompts, outcomes, feedback, profiles)
 * is kept in localStorage so it survives refreshes without standing up a
 * backend for every object. This is honest for a local/demo deployment and is
 * the seam where a Firestore-backed store can later be swapped in.
 *
 * All reads are defensive: corrupt or absent storage falls back to the initial
 * value rather than throwing.
 */

const PREFIX = "arbor:v1:";

const hasStorage = (): boolean => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

export const loadJSON = <T>(key: string, fallback: T): T => {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const saveJSON = <T>(key: string, value: T): void => {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota or serialization failure — non-fatal for a local cache */
  }
};

export const removeKey = (key: string): void => {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* non-fatal */
  }
};

/**
 * A useState that transparently persists to localStorage under a stable key.
 * The initial value is read from storage on first mount (lazy), and every
 * change is written back.
 */
export const usePersistentState = <T>(
  key: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] => {
  const [value, setValue] = useState<T>(() => loadJSON(key, initial));

  // Track the active key so switching keys (e.g. child switch) reloads state.
  const keyRef = useRef(key);
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(loadJSON(key, initial));
    }
    // initial is intentionally not a dependency: it is a default, not a source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);

  return [value, setValue];
};

/** Build a child-scoped storage key so each child's data is isolated. */
export const childKey = (childId: string, bucket: string): string => `child:${childId}:${bucket}`;

/** List all child ids that currently have persisted data of any bucket. */
export const listPersistedChildIds = (): string[] => {
  if (!hasStorage()) return [];
  const ids = new Set<string>();
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const raw = window.localStorage.key(i);
      if (!raw || !raw.startsWith(`${PREFIX}child:`)) continue;
      const id = raw.slice(`${PREFIX}child:`.length).split(":")[0];
      if (id) ids.add(id);
    }
  } catch {
    return [];
  }
  return [...ids];
};

/** Hard-delete every persisted key for a child (GDPR right-to-be-forgotten, local tier). */
export const purgeChild = (childId: string): void => {
  if (!hasStorage()) return;
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const raw = window.localStorage.key(i);
      if (raw && raw.startsWith(`${PREFIX}child:${childId}:`)) toRemove.push(raw);
    }
    toRemove.forEach((raw) => window.localStorage.removeItem(raw));
  } catch {
    /* non-fatal */
  }
};
