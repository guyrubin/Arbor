/* Mimic Studio face-match scoring (on-device MediaPipe). We score the GEOMETRY of
 * an expression — "did the face make this shape" — never an inference about the
 * child's inner emotion or ability (mimic, not diagnose). Pure + unit-testable;
 * the camera/model layer lives separately and only ever feeds blendshape numbers
 * in. No image or video leaves the device — only the resulting star rating persists. */

/** A target expression expressed as MediaPipe/ARKit blendshape coefficients (0–1). */
export interface MimicFace {
  id: string;
  emoji: string;
  label: string;
  cue: string;
  /** Blendshape name → minimum coefficient that counts as "making the shape". */
  targets: Record<string, number>;
}

/** Kid-clear expressions with unambiguous geometry. Names match MediaPipe blendshapes. */
export const MIMIC_FACES: MimicFace[] = [
  { id: "big-smile", emoji: "😁", label: "Giant smile", cue: "Show me your biggest smile!", targets: { mouthSmileLeft: 0.55, mouthSmileRight: 0.55 } },
  { id: "open-wide", emoji: "🦁", label: "Lion roar", cue: "Open wide and roar!", targets: { jawOpen: 0.5 } },
  { id: "surprise", emoji: "😮", label: "Big surprise", cue: "Ooooh — surprised face! Eyebrows up, mouth open.", targets: { jawOpen: 0.4, browInnerUp: 0.4 } },
  { id: "fish-kiss", emoji: "😗", label: "Fish kiss", cue: "Tiny kiss lips, like a fish!", targets: { mouthPucker: 0.5 } },
  { id: "puff-cheeks", emoji: "🐡", label: "Puffer cheeks", cue: "Puff your cheeks full of air!", targets: { cheekPuff: 0.35 } },
];

/**
 * How well the observed blendshapes match the target shape, 0–1. Averages each
 * target channel's fill ratio (clamped) — lenient on purpose: this is encouraging
 * play, not assessment. Channels absent from `observed` count as 0.
 */
export function scoreFaceMatch(observed: Record<string, number>, target: Record<string, number>): number {
  const keys = Object.keys(target);
  if (keys.length === 0) return 0;
  let sum = 0;
  for (const k of keys) {
    const need = target[k];
    const have = observed[k] ?? 0;
    sum += need > 0 ? Math.max(0, Math.min(1, have / need)) : 0;
  }
  return sum / keys.length;
}

/** Map a 0–1 match to the 3-star MimicSession rating (1 tried · 2 close · 3 nailed). */
export function matchToStars(score: number): 1 | 2 | 3 {
  if (score >= 0.8) return 3;
  if (score >= 0.5) return 2;
  return 1;
}

/** Convenience: turn a MediaPipe blendshape category list into a name→score map. */
export function blendshapesToMap(categories: { categoryName: string; score: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of categories) out[c.categoryName] = c.score;
  return out;
}
