/**
 * The courtyard's life — B-GAME-07f. Small, pooled, decorative pieces that
 * make the place breathe between actions and make the tag a moment:
 *
 *   CourtyardPetals  bougainvillea petals drifting down from the top: at most
 *                    PETALS (8) elements, slow, each with its own sway.
 *   LanternGlint     the lantern's glass catching the light every few seconds.
 *   TagBurst         24 petals and sparkles bursting from behind the hero at
 *                    a tag (900 ms), mounted once and re-fired (pooled).
 *   DustPuff         a small puff at the hero's feet when he tumbles.
 *
 * Design units, inside the art group (mirrored with the art in right-to-left).
 * Motion is transform / opacity only (Web Animations). Under reduced motion
 * nothing here moves or shows. Never an attention cue: the hand glyph is the
 * only one. aria-hidden throughout.
 */
import React, { useLayoutEffect, useRef } from "react";
import type { FieldOrientation } from "../../game/fieldLayout";
import { prefersReducedMotion } from "../../hero/HeroFigure";

/** The most petals ever on screen at once. */
export const PETALS = 8;
/** The tag burst's pieces. */
export const BURST = 24;
export const BURST_MS = 900;

/** A fixed pseudo-random in [0, 1) per (i, k): the same sway every visit. */
export function jitter(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Where the bougainvillea hangs in each plate (design units), and how far a petal falls. */
const BLOOM: Readonly<Record<FieldOrientation, { x0: number; x1: number; y0: number; y1: number; fall: number; size: number }>> = {
  landscape: { x0: 400, x1: 820, y0: 70, y1: 220, fall: 520, size: 20 },
  portrait: { x0: 50, x1: 470, y0: 260, y1: 440, fall: 620, size: 26 },
};

const PETAL_FILL = "color-mix(in srgb, var(--arbor-pink) 78%, var(--arbor-pink-ink))";
const SPARK_FILL = "color-mix(in srgb, var(--arbor-yellow) 80%, var(--arbor-paper-elevated))";
const STAR = "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)";

export function CourtyardPetals({ orientation }: { orientation: FieldOrientation }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const b = BLOOM[orientation];
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const anims = (Array.from(el.children) as HTMLElement[]).map((c, i) => {
      if (typeof c.animate !== "function") return null;
      const sway = 30 + jitter(i, 1) * 40;
      const fall = b.fall * (0.8 + jitter(i, 2) * 0.4);
      const spin = (jitter(i, 3) < 0.5 ? -1 : 1) * (240 + jitter(i, 4) * 240);
      return c.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 0 },
          { opacity: 0.95, offset: 0.08 },
          { transform: `translate(${sway}px, ${fall * 0.34}px) rotate(${spin * 0.34}deg)`, offset: 0.34 },
          { transform: `translate(${-sway * 0.7}px, ${fall * 0.68}px) rotate(${spin * 0.68}deg)`, offset: 0.68 },
          { opacity: 0.85, offset: 0.9 },
          { transform: `translate(${sway * 0.4}px, ${fall}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 8000 + jitter(i, 5) * 5000, delay: i * 1400 + jitter(i, 6) * 900, iterations: Infinity, easing: "linear", fill: "backwards" },
      );
    });
    return () => anims.forEach((a) => a?.cancel());
  }, [orientation, b.fall]);
  if (prefersReducedMotion()) return null;
  return (
    <div ref={ref} aria-hidden="true" data-sneak-petals="" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {Array.from({ length: PETALS }).map((_, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: b.x0 + (b.x1 - b.x0) * jitter(i, 7),
            top: b.y0 + (b.y1 - b.y0) * jitter(i, 8),
            width: b.size,
            height: b.size * 0.68,
            borderRadius: "70% 30% 70% 30%",
            background: PETAL_FILL,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

/** A soft glint on the lantern's glass (`x`, `y` = the glass centre, `size` its glow). */
export function LanternGlint({ x, y, size, zIndex }: { x: number; y: number; size: number; zIndex: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const a = el.animate(
      [
        { opacity: 0, transform: "scale(0.7)" },
        { opacity: 0, transform: "scale(0.7)", offset: 0.55 },
        { opacity: 0.9, transform: "scale(1.1)", offset: 0.64 },
        { opacity: 0, transform: "scale(0.9)", offset: 0.8 },
        { opacity: 0, transform: "scale(0.7)" },
      ],
      { duration: 4600, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => a.cancel();
  }, []);
  if (prefersReducedMotion()) return null;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-sneak-glint=""
      style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: "50%", background: `radial-gradient(closest-side, ${SPARK_FILL}, transparent)`, mixBlendMode: "screen", opacity: 0, zIndex, pointerEvents: "none" }}
    />
  );
}

/** Fires on every rising edge of `active`: 24 pieces burst out of (x, y). */
export function TagBurst({ active, x, y, radius, zIndex }: { active: boolean; x: number; y: number; radius: number; zIndex: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const was = useRef(active);
  const running = useRef<(Animation | null)[]>([]);
  useLayoutEffect(() => () => running.current.forEach((a) => a?.cancel()), []);
  useLayoutEffect(() => {
    const el = ref.current;
    const rising = active && !was.current;
    was.current = active;
    if (!rising || !el || prefersReducedMotion()) return;
    running.current.forEach((a) => a?.cancel());
    running.current = (Array.from(el.children) as HTMLElement[]).map((c, i) => {
      if (typeof c.animate !== "function") return null;
      const ang = (i / BURST) * Math.PI * 2 + jitter(i, 9) * 0.4;
      const d = radius * (0.55 + jitter(i, 10) * 0.55);
      const dx = Math.cos(ang) * d;
      const dy = Math.sin(ang) * d * 0.85 - radius * 0.18;
      const spin = (jitter(i, 11) - 0.5) * 540;
      return c.animate(
        [
          { transform: "translate(0, 0) scale(0.3) rotate(0deg)", opacity: 0 },
          { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(1) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.18 },
          { transform: `translate(${dx}px, ${dy + radius * 0.12}px) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: BURST_MS, delay: (i % 4) * 18, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
      );
    });
  }, [active, radius]);
  const piece = radius * 0.09;
  return (
    <div ref={ref} aria-hidden="true" data-sneak-burst={BURST} style={{ position: "absolute", left: x, top: y, width: 0, height: 0, zIndex, pointerEvents: "none" }}>
      {Array.from({ length: BURST }).map((_, i) => {
        const spark = i % 3 === 0;
        const s = spark ? piece * 1.15 : piece;
        return (
          <span
            key={i}
            style={{ position: "absolute", left: -s / 2, top: -s / 2, width: s, height: spark ? s : s * 0.68, borderRadius: spark ? 0 : "70% 30% 70% 30%", clipPath: spark ? STAR : undefined, background: spark ? SPARK_FILL : PETAL_FILL, opacity: 0 }}
          />
        );
      })}
    </div>
  );
}

/** Fires on every rising edge of `active`: a small dust puff at the feet (0, 0), `size` = the hero's height. */
export function DustPuff({ active, size }: { active: boolean; size: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const was = useRef(active);
  const running = useRef<(Animation | null)[]>([]);
  useLayoutEffect(() => () => running.current.forEach((a) => a?.cancel()), []);
  useLayoutEffect(() => {
    const el = ref.current;
    const rising = active && !was.current;
    was.current = active;
    if (!rising || !el || prefersReducedMotion()) return;
    running.current.forEach((a) => a?.cancel());
    running.current = (Array.from(el.children) as HTMLElement[]).map((c, i) => {
      if (typeof c.animate !== "function") return null;
      const side = i % 2 ? 1 : -1;
      const dx = side * size * (0.12 + jitter(i, 12) * 0.18);
      const dy = -size * (0.03 + jitter(i, 13) * 0.07);
      return c.animate(
        [
          { transform: "translate(0, 0) scale(0.4)", opacity: 0.75 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.5)`, opacity: 0 },
        ],
        { duration: 520 + i * 30, delay: 40, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
      );
    });
  }, [active, size]);
  const puff = size * 0.09;
  return (
    <div ref={ref} aria-hidden="true" data-sneak-dust="" style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, pointerEvents: "none" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          style={{ position: "absolute", left: -puff / 2 + (i - 2.5) * puff * 0.3, top: -puff * 0.75, width: puff, height: puff * 0.8, borderRadius: "50%", background: "radial-gradient(closest-side, color-mix(in srgb, var(--arbor-paper-elevated) 70%, var(--arbor-peach)), transparent)", opacity: 0 }}
        />
      ))}
    </div>
  );
}
