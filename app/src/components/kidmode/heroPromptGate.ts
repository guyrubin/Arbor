/**
 * heroPromptGate — should the parent see the "Create {name}'s hero" step when
 * they hand the device over? (M4, kids gauntlet 22 Sep 2026.)
 *
 * The rule, in one place so the button stays dumb:
 *  - offer the step ONLY when the active child has no hero (hero-first:
 *    `resolveHeroUrl(child) === null`, evaluated by the caller so this module
 *    never re-implements — or drifts from — that rule);
 *  - offer it ONCE PER SESSION PER CHILD. A parent who chose Sprout (or made a
 *    hero) is not asked again on the next hand-over.
 *
 * SESSION, not persistence: sessionStorage dies with the tab, so this is a
 * nag-suppressor, never a stored decision about a child. No new persistent
 * store, no Firestore field, no network. The storage interface is
 * lib/kidModeGate's `KidModeStorage` — same structural subset, so tests pass a
 * Map-backed fake exactly as the Kid Mode gate's own tests do.
 *
 * The step is PARENT-side by construction: its only caller is the Kid Mode
 * button in the parent shell, before Kid Mode opens. Nothing here is reachable
 * from inside Kid Mode, and the child is never blocked — "Continue with Sprout"
 * is always one tap away.
 */

import type { KidModeStorage } from "../../lib/kidModeGate";

/** sessionStorage key holding the child ids already offered the step. */
export const HERO_STEP_SS_KEY = "arbor.kidmode.heroStepOffered";

/** In-memory mirror so a blocked/partitioned sessionStorage still suppresses the nag. */
let memorySeen: string[] = [];

function defaultSessionStorage(): KidModeStorage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function store(storage?: KidModeStorage | null): KidModeStorage | null {
  return storage !== undefined ? storage : defaultSessionStorage();
}

/** Child ids already offered the step this session. Garbage degrades to none. */
export function readOffered(storage?: KidModeStorage | null): string[] {
  const s = store(storage);
  if (!s) return [...memorySeen];
  try {
    const raw = s.getItem(HERO_STEP_SS_KEY);
    if (!raw) return [...memorySeen];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...memorySeen];
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [...memorySeen];
  }
}

/** Has this child's parent already been offered the step this session? */
export function wasHeroStepOffered(childId: string, storage?: KidModeStorage | null): boolean {
  if (!childId) return false;
  return readOffered(storage).includes(childId) || memorySeen.includes(childId);
}

/** Record the offer. Called when the step is SHOWN — asked once, either way. */
export function markHeroStepOffered(childId: string, storage?: KidModeStorage | null): void {
  if (!childId) return;
  if (!memorySeen.includes(childId)) memorySeen = [...memorySeen, childId];
  const s = store(storage);
  if (!s) return;
  try {
    const next = readOffered(s);
    if (!next.includes(childId)) next.push(childId);
    s.setItem(HERO_STEP_SS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the in-memory mirror still suppresses the nag */
  }
}

/** Test seam: forget the in-memory mirror (a fresh tab, a fresh session). */
export function resetHeroStepMemory(): void {
  memorySeen = [];
}

/**
 * The decision. `hasHero` comes from resolveHeroUrl at the call site — a child
 * WITH a hero is handed straight to Kid Mode, exactly as today.
 */
export function shouldOfferHeroStep(
  input: { childId?: string | null; hasHero: boolean },
  storage?: KidModeStorage | null,
): boolean {
  const childId = input.childId ?? "";
  if (!childId) return false;
  if (input.hasHero) return false;
  return !wasHeroStepOffered(childId, storage);
}
