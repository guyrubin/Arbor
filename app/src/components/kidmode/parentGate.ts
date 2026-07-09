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
