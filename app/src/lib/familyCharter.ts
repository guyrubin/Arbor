/**
 * LC-22 — the Family Charter store: the values a family is forming around.
 *
 * The charter already shipped, but nothing owned it. The literal key lived in
 * TWO places (`lib/becoming.ts` read it, `components/sections/FamilyFormation`
 * wrote it), the writer parsed storage with a bare `JSON.parse` and fed the
 * result straight to `values.map`, and the write ran from a mount effect that
 * fired with the seeded defaults BEFORE the load effect's state landed. So:
 *
 *  · a value that was not an array of strings — anything a half-written tab, a
 *    schema change or a hand-edited store could leave behind — crashed the one
 *    surface the parent could have used to fix it, permanently;
 *  · the first render of that surface wrote the four English defaults over the
 *    stored charter, and only a second render put the real values back.
 *
 * This module is the single owner: one key, one normaliser, one save. Reads
 * never throw and never return a non-array, so no consumer can be crashed by
 * what is in the store.
 *
 * SCOPE — per FAMILY, not per child. Deliberate, and load-bearing:
 *
 *  · What it holds are the family's own values ("Courage", "Honesty"), not an
 *    observation about a child. Every consumer already treats it that way:
 *    `becoming.loadCharter` takes no child id, and Masterclasses, JourneyTab
 *    and HeroJourneyTab all read one charter for the household.
 *  · Per-child would ask a parent to re-declare the same values for each
 *    sibling and would let one family hold contradictory aims.
 *  · Therefore it MUST NOT be child-scoped: `clearChildLocalState` sweeps every
 *    `arbor.*` key carrying a child id, so a child-shaped charter key would
 *    delete the whole family's values when one of two children was removed.
 *    `isChildScopedKey(FAMILY_CHARTER_KEY, anyChildId)` is false, and
 *    `familyCharter.test.ts` holds that line.
 *  · Full ACCOUNT deletion still covers it: `DeleteAccountModal.wipeDeviceData`
 *    removes every `arbor`-prefixed localStorage key, and this key is
 *    `arbor`-prefixed. That is asserted against the real source, so the charter
 *    cannot quietly survive an account the parent deleted.
 */

/** The one true key. `becoming.ts` holds the same literal; the test pins them. */
export const FAMILY_CHARTER_KEY = "arbor.familyCharter";

/**
 * The starter set offered when a family has never saved a charter. These are a
 * SUGGESTION, not a saved charter — see `hasSavedFamilyCharter`.
 */
export const DEFAULT_CHARTER_VALUES: readonly string[] = Object.freeze([
  "Courage",
  "Honesty",
  "Responsibility",
  "Kindness",
]);

/** Bounds — a charter is a short list of words, not a document. */
export const MAX_CHARTER_VALUES = 12;
export const MAX_CHARTER_VALUE_LENGTH = 48;

/** The slice of `Storage` this module uses — so tests can inject a store. */
export type CharterStore = Pick<Storage, "getItem" | "setItem">;

const getStore = (): CharterStore | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

/**
 * Coerce anything into a charter: trimmed non-empty strings, deduplicated
 * case-insensitively (a parent who types "Kindness" twice meant it once),
 * length-capped, count-capped. Never throws, always returns an array.
 */
export function normalizeCharterValues(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const value = entry.trim().slice(0, MAX_CHARTER_VALUE_LENGTH).trim();
    if (!value) continue;
    const folded = value.toLocaleLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    out.push(value);
    if (out.length >= MAX_CHARTER_VALUES) break;
  }
  return out;
}

/** The family's saved values. `[]` when unset, unreadable or malformed. */
export function loadFamilyCharter(store: CharterStore | null = getStore()): string[] {
  if (!store) return [];
  try {
    const raw = store.getItem(FAMILY_CHARTER_KEY);
    if (!raw) return [];
    return normalizeCharterValues(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/**
 * True once this family has SAVED a charter on this device — including one they
 * deliberately emptied.
 *
 * The seeded defaults cannot answer this on their own, and that mattered: the
 * hero strip renders "Raising {name} toward: …" whenever the charter is
 * non-empty, so persisting the four English starter words on first paint made
 * the app claim an aim the family had never declared.
 */
export function hasSavedFamilyCharter(store: CharterStore | null = getStore()): boolean {
  if (!store) return false;
  try {
    const raw = store.getItem(FAMILY_CHARTER_KEY);
    if (!raw) return false;
    return Array.isArray(JSON.parse(raw) as unknown);
  } catch {
    return false;
  }
}

/**
 * Persist the family's values. Returns the normalised list actually stored, so
 * the caller renders exactly what a reload will show. Never throws — a blocked
 * store means the edit lives for this session only.
 */
export function saveFamilyCharter(
  values: readonly string[],
  store: CharterStore | null = getStore(),
): string[] {
  const next = normalizeCharterValues(values);
  if (store) {
    try {
      store.setItem(FAMILY_CHARTER_KEY, JSON.stringify(next));
    } catch {
      /* private window or a full store — the charter forgets on reload */
    }
  }
  return next;
}

/**
 * What the Family Formation surface should open with: the family's saved
 * charter, or the starter set when they have never saved one. An emptied
 * charter stays empty — it is a choice, not an absence.
 */
export function initialCharterValues(store: CharterStore | null = getStore()): string[] {
  return hasSavedFamilyCharter(store) ? loadFamilyCharter(store) : [...DEFAULT_CHARTER_VALUES];
}
