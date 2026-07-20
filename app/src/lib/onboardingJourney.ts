/**
 * onboardingJourney — the SINGLE owner of the client-side onboarding journey
 * state (IA W6.1). One versioned localStorage key ("arbor.journey") replaces
 * the three uncoordinated legacy stores that used to describe one journey:
 *
 *   arbor.wowPending  → journey.wow        (E0 WowOnboarding visibility)
 *   arbor.firstSteps  → journey.rail       (E11 FirstStepsRail dismissed/clicked)
 *   arbor.coachSeed   → journey.coachSeed  (OnboardingFlow → coach composer handoff)
 *
 * The journey is strictly sequential: OnboardingFlow (Firestore-gated identity
 * + consent capture, pre-Shell) calls markWowPending() at real submit; the wow
 * overlay shows IFF wow === "pending" and marks itself done; the rail nudges
 * from then on. Firestore keeps exactly what it had (onboardingComplete on the
 * child doc) — this module owns only the per-device layer.
 *
 * MIGRATION IS LOAD-BEARING: a device with NO legacy wow flag maps to
 * wow: "done" — mirroring the strict-equality lesson in onboardingGate.ts —
 * so no existing device ever gets a surprise full-screen overlay. Only the
 * explicit legacy "1" (or a fresh markWowPending) yields "pending".
 *
 * Storage-unavailable behaves as DONE (never trap the user in an overlay);
 * an in-memory cache keeps the session self-consistent even when persisting
 * fails, and lets subscribers (the rail) react to writes (the wow marking the
 * comic step clicked) without a reload.
 */

export interface JourneyRailState {
  dismissed?: boolean;
  /** Steps completed by clicking (used where no cheap state signal exists). */
  clicked?: Partial<Record<string, boolean>>;
}

export interface JourneyState {
  v: 1;
  wow: "pending" | "done";
  rail: JourneyRailState;
  coachSeed?: string;
}

const LS_KEY = "arbor.journey";
const LEGACY_WOW_KEY = "arbor.wowPending";
const LEGACY_RAIL_KEY = "arbor.firstSteps";
const LEGACY_SEED_KEY = "arbor.coachSeed";

function getStorage(): Storage | null {
  try {
    const g = globalThis as { localStorage?: Storage };
    return g.localStorage ?? null;
  } catch {
    return null;
  }
}

// ── Change notification (module-local, no React dependency) ────────────────
// The rail stays mounted behind the wow overlay; when the wow marks the comic
// step clicked the rail must reflect it without a remount.

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeJourney(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── Read / write ───────────────────────────────────────────────────────────
// In-memory cache: reads are cheap and the session stays consistent even when
// localStorage is unavailable (writes then simply don't survive a reload).

let cache: JourneyState | null = null;

/** Test-only: forget the in-memory cache so each test sees fresh storage. */
export function __resetJourneyCache(): void {
  cache = null;
}

function parseRail(raw: string | null): JourneyRailState {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as JourneyRailState;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** One-time fold of the three legacy keys into the journey (then remove them). */
function migrate(ls: Storage): JourneyState {
  // LEGACY-ABSENT MUST MAP TO DONE: only the explicit "1" is pending, so no
  // existing device (flag "done" OR never written) gets an unwanted overlay.
  const wow: JourneyState["wow"] = ls.getItem(LEGACY_WOW_KEY) === "1" ? "pending" : "done";
  const rail = parseRail(ls.getItem(LEGACY_RAIL_KEY));
  const coachSeed = ls.getItem(LEGACY_SEED_KEY);
  const journey: JourneyState = { v: 1, wow, rail, ...(coachSeed ? { coachSeed } : {}) };
  ls.setItem(LS_KEY, JSON.stringify(journey));
  ls.removeItem(LEGACY_WOW_KEY);
  ls.removeItem(LEGACY_RAIL_KEY);
  ls.removeItem(LEGACY_SEED_KEY);
  return journey;
}

export function readJourney(): JourneyState {
  if (cache) return cache;
  const ls = getStorage();
  if (!ls) {
    // Storage unavailable → behave as done, never trap. Cached so the session
    // (dismiss clicks etc.) still holds together in memory.
    cache = { v: 1, wow: "done", rail: {} };
    return cache;
  }
  try {
    const raw = ls.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as JourneyState;
      if (parsed && typeof parsed === "object" && parsed.v === 1) {
        cache = { ...parsed, rail: parsed.rail ?? {} };
        return cache;
      }
    }
    cache = migrate(ls);
  } catch {
    cache = { v: 1, wow: "done", rail: {} };
  }
  return cache;
}

function writeJourney(next: JourneyState): void {
  cache = next;
  try {
    getStorage()?.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable — the in-memory cache still carries the session */
  }
  listeners.forEach((fn) => fn());
}

// ── Journey transitions ────────────────────────────────────────────────────

/** OnboardingFlow real submit completed → the wow fires exactly once. */
export function markWowPending(): void {
  writeJourney({ ...readJourney(), wow: "pending" });
}

/** Wow finished (completed OR dismissed). A real comic shown also checks the
 *  rail's comic step — the two surfaces never re-ask for the same thing. */
export function markWowDone(opts: { comicShown: boolean }): void {
  const j = readJourney();
  const rail: JourneyRailState = opts.comicShown
    ? { ...j.rail, clicked: { ...j.rail.clicked, comic: true } }
    : j.rail;
  writeJourney({ ...j, wow: "done", rail });
}

export function setRailDismissed(): void {
  const j = readJourney();
  writeJourney({ ...j, rail: { ...j.rail, dismissed: true } });
}

export function setRailClicked(id: string): void {
  const j = readJourney();
  writeJourney({ ...j, rail: { ...j.rail, clicked: { ...j.rail.clicked, [id]: true } } });
}

/** OnboardingFlow leaves the parent's first concern for the coach composer. */
export function setCoachSeed(seed: string): void {
  writeJourney({ ...readJourney(), coachSeed: seed });
}

/** Read-once-and-clear: the coach composer consumes the seed exactly once. */
export function takeCoachSeed(): string | null {
  const j = readJourney();
  if (!j.coachSeed) return null;
  const { coachSeed, ...rest } = j;
  writeJourney(rest as JourneyState);
  return coachSeed;
}
