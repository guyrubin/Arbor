/**
 * AP-048: Parent gate — pure logic helpers, no DOM dependency.
 *
 * The gate is a friction barrier, not a security boundary.
 * Hold-to-exit: the parent must hold a button for HOLD_MS milliseconds.
 *
 * No PIN, no password, no child-data write, no stored secret.
 * The timer state lives entirely in the overlay component's useState.
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
