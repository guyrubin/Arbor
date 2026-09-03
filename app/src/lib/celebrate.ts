/* ════════════════════════════════════════════════════════════════════════════
   celebrate — the ONE confetti primitive (Heartwood Law 2 / Law 7: celebration
   caps). Every burst in the app routes through here so the caps live in one
   place and CI can pin them (lib/celebrationCaps.test.ts):

     • ≤ CELEBRATION_MAX_PARTICLES particles (12)
     • ≤ CELEBRATION_MAX_DURATION_MS on screen (800 ms) — `ticks` bounds the
       particle lifetime at 60 fps AND a timed `reset()` hard-stops the canvas
       on slower/faster refresh rates, so the cap holds regardless of frame rate
     • BRAND_CONFETTI token colours (canvas-confetti needs literals, not var())
     • prefers-reduced-motion → no burst at all (a particle storm is pure
       motion; MotionConfig only governs `motion/react`, and CSS cannot reach
       a canvas), belt-and-braces with `disableForReducedMotion`

   This is the only module allowed to import `canvas-confetti`.
   ════════════════════════════════════════════════════════════════════════════ */
import confetti from "canvas-confetti";
import { BRAND_CONFETTI } from "./tokens";
import { prefersReducedMotion } from "./devscore";

/** Hard cap on particles per burst (Law 7). */
export const CELEBRATION_MAX_PARTICLES = 12;
/** Hard cap on how long a burst stays on screen (Law 7). */
export const CELEBRATION_MAX_DURATION_MS = 800;
/** canvas-confetti `ticks` = frames a particle lives; 48 frames ≈ 800 ms at 60 fps. */
const CELEBRATION_TICKS = 48;

/** Which moment is being celebrated — only tunes origin/spread, never the caps. */
export type CelebrationKind =
  /** A fresh milestone "yes" on the parent Map. */
  | "milestone"
  /** A choice made inside a hero story. */
  | "choice"
  /** A hero story completed and saved. */
  | "complete"
  /** A masterclass lesson marked complete. */
  | "lesson"
  /** A kid-register win screen (PlayKit `Celebrate`, practice tracks). */
  | "play";

const SHAPE: Record<CelebrationKind, { originY: number; spread: number }> = {
  milestone: { originY: 0.6, spread: 70 },
  choice: { originY: 0.7, spread: 70 },
  complete: { originY: 0.6, spread: 90 },
  lesson: { originY: 0.7, spread: 75 },
  play: { originY: 0.7, spread: 80 },
};

let stopTimer: number | undefined;

/**
 * Fire ONE short, capped, brand-coloured burst. No-op outside a browser and
 * under prefers-reduced-motion. Safe to call repeatedly: a new burst restarts
 * the single hard-stop timer, so overlapping calls can never extend the total
 * on-screen time past the cap.
 */
export function celebrate({ kind }: { kind: CelebrationKind }): void {
  if (typeof window === "undefined") return;
  if (prefersReducedMotion()) return;
  const shape = SHAPE[kind];
  confetti({
    particleCount: CELEBRATION_MAX_PARTICLES,
    ticks: CELEBRATION_TICKS,
    decay: 0.9,
    startVelocity: 35,
    spread: shape.spread,
    origin: { y: shape.originY },
    colors: [...BRAND_CONFETTI],
    disableForReducedMotion: true,
  });
  if (stopTimer !== undefined) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => {
    stopTimer = undefined;
    confetti.reset();
  }, CELEBRATION_MAX_DURATION_MS);
}
