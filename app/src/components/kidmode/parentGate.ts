/**
 * AP-048 + E10: Parent gate — pure logic helpers, no DOM dependency.
 *
 * The gate is a friction barrier, not a security boundary.
 * Two layers now (E10 hardening):
 *   1. Hold-to-exit: the parent must hold a button for HOLD_MS milliseconds —
 *      this SUMMONS the challenge (it no longer exits by itself).
 *   2. Parent challenge: a 2-digit addition question (deterministic from the
 *      date + attempt, regenerated on a wrong answer) OR an optional 4-digit
 *      parent PIN stored in localStorage under PARENT_PIN_KEY.
 *
 * NO child data, NO Firestore, NO network. The PIN is a device-local
 * convenience secret only. Timer/challenge state lives in component useState.
 */

/** Duration (ms) the parent must hold the exit button. */
export const HOLD_MS = 3000;

/**
 * Returns 0–100 progress percentage given elapsed hold time.
 * Clamped to [0, 100].
 */
export function holdProgress(elapsedMs: number): number {
  return Math.min(100, Math.max(0, (elapsedMs / HOLD_MS) * 100));
}

/**
 * Returns true when the hold is complete.
 */
export function holdComplete(elapsedMs: number): boolean {
  return elapsedMs >= HOLD_MS;
}

/** A press released under this many ms reads as a tap → show the hold hint. */
export const TAP_HINT_MS = 400;

/** What a pointer release means, resolved from wall-clock time (F-07). */
export type HoldOutcome = "complete" | "tap" | "cancelled";

/**
 * F-07: frame-independent release resolution. rAF ticks can freeze (hidden
 * tab, throttled frame loop), so completion is judged on wall-clock elapsed
 * time at release — never on how many frames rendered:
 *  - held ≥ HOLD_MS      → "complete" (summon the parent challenge)
 *  - released < TAP_HINT_MS → "tap" (show the hold-to-exit hint)
 *  - anything between     → "cancelled" (reset quietly)
 */
export function resolveHoldOutcome(startMs: number, nowMs: number): HoldOutcome {
  const elapsed = nowMs - startMs;
  if (holdComplete(elapsed)) return "complete";
  if (elapsed < TAP_HINT_MS) return "tap";
  return "cancelled";
}

/* ── E10: parent challenge (math question + optional device-local PIN) ─────── */

/** localStorage key for the optional 4-digit parent PIN (device-local only). */
export const PARENT_PIN_KEY = "arbor.parentPin";

/** A 2-digit addition challenge: `a + b = ?`. */
export interface GateChallenge {
  a: number;
  b: number;
}

/** Local calendar-date seed, e.g. "2026-07-09" (deterministic per day). */
export function dateSeedKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * KID-21: a per-SESSION nonce mixed into the challenge seed.
 *
 * `dateSeedKey()` alone made the question sequence a function of the calendar
 * date: the same first question, the same second question after a wrong
 * answer, for every device on that day, all day. A child who watches the
 * grown-up answer once in the morning can answer it themselves in the
 * afternoon — and the seed being global means the sequence is guessable
 * without ever seeing this device. The nonce is minted once per mounted
 * challenge, so the sums are fresh every time the gate is summoned and fresh
 * again on every wrong answer, while a re-render inside one attempt still
 * shows the SAME question (which is why it is a nonce and not Math.random()
 * inline in the render).
 *
 * `rand` is injectable so the guard can prove the nonce actually varies.
 */
export function newGateNonce(rand: () => number = Math.random): string {
  return Math.floor(rand() * 0xffffffff).toString(36);
}

/**
 * Deterministic 2-digit addition question from (seedKey, attempt).
 * Same day + same attempt → same question; a wrong answer bumps `attempt`
 * so the question regenerates. Both operands are always 2-digit (10–99).
 */
export function challengeFor(seedKey: string, attempt: number): GateChallenge {
  let h = 0;
  const s = `${seedKey}#${attempt}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const a = 10 + (h % 90);
  const b = 10 + (Math.floor(h / 90) % 90);
  return { a, b };
}

/** True when `input` parses to the exact sum of the challenge. */
export function isChallengeAnswer(c: GateChallenge, input: string): boolean {
  const n = Number.parseInt(input.trim(), 10);
  return Number.isFinite(n) && n === c.a + c.b;
}

/** True when `input` is exactly 4 digits (the PIN shape). */
export function isPinShape(input: string): boolean {
  return /^\d{4}$/.test(input);
}

/** Reads the stored parent PIN; null when unset/invalid/unavailable. */
export function readParentPin(): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const v = window.localStorage.getItem(PARENT_PIN_KEY);
    return v !== null && isPinShape(v) ? v : null;
  } catch {
    return null;
  }
}

/** Stores a 4-digit parent PIN (device-local). Returns false when rejected. */
export function saveParentPin(pin: string): boolean {
  if (!isPinShape(pin)) return false;
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    window.localStorage.setItem(PARENT_PIN_KEY, pin);
    return true;
  } catch {
    return false;
  }
}

/* ── STORE-3: age-hard commerce gating ─────────────────────────────────────
 *
 * The 2-digit math question is kid-exit UX, not a security boundary — a
 * school-age child can add. So an exit earned through the MATH path (no PIN
 * set on this device) marks the browsing session "math-exit": purchases,
 * subscription management, and PIN setup stay LOCKED until the parent PIN is
 * verified or a fresh session starts. A PIN-verified exit carries no
 * restriction, and once a PIN exists the exit gate offers NO math fallback.
 *
 * PIN setup lives ONLY in the authenticated parent Settings surface (never
 * inside the kid-mode challenge card), and changing an existing PIN requires
 * the current one. sessionStorage scoping: a closed tab drops the flag, but a
 * reopened tab rehydrates INTO Kid Mode (kidModeGate LEAK-1 persistence), so
 * the child never lands on an unrestricted parent surface.
 *
 * Storage is injectable (node tests, same pattern as kidModeGate). Emergency
 * `tel:` safety links are deliberately NOT gated — never put friction in
 * front of a crisis number.
 */

/** sessionStorage key marking a math-fallback exit (this browsing session). */
export const MATH_EXIT_KEY = "arbor.gate.mathExit";

/** sessionStorage key: the one PIN nudge for this session has been shown. */
export const PIN_NUDGE_KEY = "arbor.gate.pinNudgeShown";

export interface GateSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const sessionStore = (): GateSessionStorage | null => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** Record that the parent area was reached via the math question (no PIN). */
export function markMathExit(storage: GateSessionStorage | null = sessionStore()): void {
  try {
    storage?.setItem(MATH_EXIT_KEY, "1");
  } catch {
    /* storage unavailable — fail toward unrestricted is wrong; callers treat
       readback truthfully via isMathExitSession */
  }
}

/** Clear the restriction (PIN verified, or a fresh authenticated session). */
export function clearMathExit(storage: GateSessionStorage | null = sessionStore()): void {
  try {
    storage?.removeItem(MATH_EXIT_KEY);
  } catch {
    /* ignore */
  }
}

/** True while this session's parent area was reached via the math fallback. */
export function isMathExitSession(storage: GateSessionStorage | null = sessionStore()): boolean {
  try {
    return storage?.getItem(MATH_EXIT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Commerce / subscription / PIN-setup actions allowed in this session? */
export function commerceAllowed(storage: GateSessionStorage | null = sessionStore()): boolean {
  return !isMathExitSession(storage);
}

/** Verify a PIN attempt against the stored PIN; success lifts the math-exit
 *  restriction for this session. */
export function verifyParentPin(
  input: string,
  storage: GateSessionStorage | null = sessionStore(),
): boolean {
  const stored = readParentPin();
  if (stored === null || input !== stored) return false;
  clearMathExit(storage);
  return true;
}

/* ── KID-21: one nudge, once, after a math exit ────────────────────────────
 *
 * The math question is kid-exit UX, not a boundary — parentGate has said so
 * since STORE-3, and a math exit already restricts commerce for the session.
 * What never happened is the obvious next step: telling the PARENT, once, that
 * a PIN exists and where to set it. Not a modal, not a repeated banner, and
 * never in front of the child — one line on the parent door.
 *
 * Conditions, all three: this session was reached through the math question,
 * no PIN is set on this device (with a PIN there is no math path at all), and
 * the nudge has not already been shown this session.
 */

/** Should the parent door show the one-time "set a PIN" line right now? */
export function shouldNudgeForPin(storage: GateSessionStorage | null = sessionStore()): boolean {
  if (!isMathExitSession(storage)) return false;
  if (readParentPin() !== null) return false;
  try {
    return storage?.getItem(PIN_NUDGE_KEY) !== "1";
  } catch {
    return false;
  }
}

/** Record that the nudge has been shown; it does not come back this session. */
export function markPinNudgeShown(storage: GateSessionStorage | null = sessionStore()): void {
  try {
    storage?.setItem(PIN_NUDGE_KEY, "1");
  } catch {
    /* storage unavailable — the nudge simply shows again next mount */
  }
}
