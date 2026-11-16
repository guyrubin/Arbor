/** The particle rules behind `PlayFx`: pure, so they are tested without a
 * canvas. Positions and speeds are stage fractions (0..1, per second); sizes
 * are fractions of the stage's shorter side. */
export type FxKind = 'sparkle' | 'dust' | 'petal' | 'drop' | 'glint' | 'chip' | 'confetti' | 'ring';
export type FxShape = 'dot' | 'soft' | 'star' | 'petal' | 'drop' | 'chip' | 'paper' | 'ring';
export interface FxOptions {
  /** Palette token names without the `--mk-` prefix (`'gold-light'`), or Studio tokens as `'studio-teal'`. */
  tones?: readonly string[];
  /** How many, before the cap. */
  count?: number;
  /** Scales the travel (1 = the kind's own). */
  spread?: number;
  /** Scales the size. */
  size?: number;
  /** Launch direction in degrees (0 = right, 90 = down) and its arc width; default is all round. */
  angle?: number;
  arc?: number;
  /** A seed for a repeatable burst (tests); default uses Math.random. */
  seed?: number;
}
export interface FxSpawnOptions extends FxOptions { reduced?: boolean; trail?: boolean; aspect?: number }
export interface FxParticle {
  x: number; y: number; vx: number; vy: number; gravity: number; drag: number;
  size: number; rot: number; spin: number; age: number; life: number; alpha: number;
  shape: FxShape; tone: string;
}
interface FxPlan {
  shape: FxShape; count: number; speed: readonly [number, number]; life: readonly [number, number]; size: readonly [number, number];
  gravity: number; drag: number; alpha: number; spin: number; tones: readonly string[];
}
/** The hard cap on live particles in one layer. */
export const FX_MAX = 140;
/** The most one call may add. */
export const FX_BURST_MAX = 48;
export const FX_PLANS: Readonly<Record<FxKind, FxPlan>> = {
  sparkle: { shape: 'star', count: 12, speed: [0.08, 0.3], life: [0.5, 1], size: [0.012, 0.03], gravity: 0.05, drag: 2.4, alpha: 1, spin: 2, tones: ['gold-light', 'white', 'sun'] },
  dust: { shape: 'soft', count: 9, speed: [0.03, 0.14], life: [0.6, 1.2], size: [0.02, 0.05], gravity: -0.03, drag: 2.8, alpha: 0.5, spin: 0, tones: ['linen', 'paper-shade', 'white'] },
  petal: { shape: 'petal', count: 10, speed: [0.06, 0.24], life: [1.2, 2.2], size: [0.012, 0.022], gravity: 0.16, drag: 1.6, alpha: 0.95, spin: 3, tones: ['blossom', 'rose', 'white'] },
  drop: { shape: 'drop', count: 10, speed: [0.14, 0.4], life: [0.5, 0.9], size: [0.006, 0.012], gravity: 1.1, drag: 0.6, alpha: 0.9, spin: 0, tones: ['sky', 'sea', 'white'] },
  glint: { shape: 'star', count: 3, speed: [0, 0.03], life: [0.4, 0.8], size: [0.03, 0.06], gravity: 0, drag: 3, alpha: 1, spin: 1, tones: ['white', 'gold-light'] },
  chip: { shape: 'chip', count: 8, speed: [0.12, 0.36], life: [0.5, 0.9], size: [0.006, 0.014], gravity: 0.9, drag: 1.2, alpha: 1, spin: 9, tones: ['paper', 'paper-shade', 'white'] },
  confetti: { shape: 'paper', count: 26, speed: [0.2, 0.6], life: [1.3, 2.4], size: [0.008, 0.014], gravity: 0.5, drag: 1.5, alpha: 1, spin: 6, tones: ['studio-teal', 'gold-light', 'rose', 'sky', 'white'] },
  ring: { shape: 'ring', count: 1, speed: [0, 0], life: [0.45, 0.6], size: [0.07, 0.09], gravity: 0, drag: 0, alpha: 0.9, spin: 0, tones: ['white'] },
};
function generator(seed: number | undefined): () => number {
  if (seed == null) return Math.random;
  let state = (Math.floor(seed) >>> 0) || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const between = (random: () => number, [min, max]: readonly [number, number]) => min + (max - min) * random();

/** The particles one `burst` (or `trail`) call adds. Reduced motion: a single
 * still flash of the kind's first tone that only fades. */
export function fxSpawn(x: number, y: number, kind: FxKind, options: FxSpawnOptions = {}): FxParticle[] {
  const plan = FX_PLANS[kind]; if (!plan) return [];
  const random = generator(options.seed), tones = options.tones?.length ? options.tones : plan.tones;
  const scale = Math.max(0.2, Math.min(4, options.size ?? 1)), spread = Math.max(0, Math.min(4, options.spread ?? 1));
  const aspect = options.aspect && Number.isFinite(options.aspect) && options.aspect > 0 ? options.aspect : 1;
  if (options.reduced) {
    if (options.trail) return [];
    return [{ x, y, vx: 0, vy: 0, gravity: 0, drag: 0, size: plan.size[1] * 1.6 * scale, rot: 0, spin: 0, age: 0, life: 0.5, alpha: plan.alpha * 0.8, shape: kind === 'ring' ? 'ring' : 'soft', tone: tones[0] }];
  }
  const wanted = options.trail ? Math.min(2, options.count ?? 1) : options.count ?? plan.count;
  const count = Math.max(0, Math.min(FX_BURST_MAX, Math.round(wanted)));
  const centre = (options.angle ?? 0) * Math.PI / 180, arc = (options.angle == null ? 360 : options.arc ?? 70) * Math.PI / 180;
  const out: FxParticle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = centre + (random() - 0.5) * arc, speed = between(random, plan.speed) * spread * (options.trail ? 0.35 : 1);
    // Speeds are in fractions of the shorter side, so a burst is round on any stage.
    const sx = aspect >= 1 ? 1 / aspect : 1, sy = aspect >= 1 ? 1 : aspect;
    out.push({
      x, y, vx: Math.cos(angle) * speed * sx, vy: Math.sin(angle) * speed * sy, gravity: plan.gravity * sy, drag: plan.drag,
      size: between(random, plan.size) * scale * (options.trail ? 0.7 : 1), rot: random() * Math.PI * 2, spin: (random() - 0.5) * 2 * plan.spin,
      age: 0, life: between(random, plan.life) * (options.trail ? 0.6 : 1), alpha: plan.alpha, shape: plan.shape, tone: tones[Math.floor(random() * tones.length) % tones.length],
    });
  }
  return out;
}
/** Advances every particle by `dt` seconds and drops the finished ones. */
export function fxStep(particles: readonly FxParticle[], dt: number): FxParticle[] {
  const step = Math.max(0, Math.min(0.1, dt)), out: FxParticle[] = [];
  for (const p of particles) {
    const age = p.age + step; if (age >= p.life) continue;
    const slow = Math.max(0, 1 - p.drag * step);
    const vx = p.vx * slow, vy = p.vy * slow + p.gravity * step;
    out.push({ ...p, age, vx, vy, x: p.x + vx * step, y: p.y + vy * step, rot: p.rot + p.spin * step });
  }
  return out;
}
