/**
 * Watcher — B-GAME-07b: Savta's cat on its stool, in the foreground.
 *
 * One sprite per state (counting / tell / looking / laughing / sunglasses /
 * waiting), all mounted and decoded once; a state change is a hard cut under
 * a short squash (the spin), never a cross-fade. Code motion only, transform
 * only: a bob on every chant beat, an ear-twitch shake through the tell, a
 * lean-in for the statue inspection. Reduced motion: no bob, shake or lean
 * travel (the cut still happens). Decorative: aria-hidden.
 */
import React, { useLayoutEffect, useRef } from "react";
import { watcherSprite, type SneakArt, type WatcherSlot } from "./sneakArt";
import type { WatcherPose } from "./rules";
import { prefersReducedMotion } from "../../hero/HeroFigure";

export interface WatcherProps {
  art: SneakArt;
  pose: WatcherPose;
  sunglasses: boolean;
  /** Chant beat index (-1 outside the count): each change bobs once. */
  beat: number;
  /** Lean in and squint (the statue inspection). */
  lean: boolean;
  feet: { x: number; y: number };
  /** Display height of the whole sprite (stool + cat), parent units. */
  height: number;
  zIndex?: number;
}

const SLOTS: readonly WatcherSlot[] = ["counting", "tell", "looking", "laughing", "sunglasses", "waiting"];

export function Watcher({ art, pose, sunglasses, beat, lean, feet, height, zIndex }: WatcherProps) {
  const { slot } = watcherSprite(art, pose, sunglasses);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const lastSlot = useRef(slot);
  const lastBeat = useRef(beat);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    const changed = lastSlot.current !== slot;
    const bobbed = lastBeat.current !== beat && beat >= 0;
    lastSlot.current = slot;
    lastBeat.current = beat;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    if (changed) {
      // The spin: a hard cut under a narrow squash.
      el.animate([{ transform: "scale(0.82, 1.04)" }, { transform: "scale(0.82, 1.04)", offset: 0.4 }, { transform: "scale(1, 1)" }], { duration: 160, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    } else if (bobbed) {
      el.animate([{ transform: "translateY(0) scale(1, 1)" }, { transform: `translateY(${-height * 0.025}px) scale(0.98, 1.03)` }, { transform: "translateY(0) scale(1, 1)" }], { duration: 220, easing: "ease-out" });
    }
  }, [slot, beat, height]);

  // The tell: ears twitch — a small shake for as long as it lasts.
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (pose !== "tell" || !el || prefersReducedMotion() || typeof el.animate !== "function") return;
    const a = el.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-2.5deg)" }, { transform: "rotate(2.5deg)" }, { transform: "rotate(0deg)" }], { duration: 180, iterations: Infinity });
    return () => a.cancel();
  }, [pose]);

  const reduced = prefersReducedMotion();
  return (
    <div aria-hidden="true" data-watcher={slot} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, zIndex, transform: `translate(${feet.x}px, ${feet.y}px)` }}>
      <span
        style={{
          position: "absolute",
          left: -height * 0.3,
          top: -height * 0.03,
          width: height * 0.6,
          height: height * 0.06,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--arbor-ink) 34%, transparent), transparent)",
        }}
      />
      <div ref={bodyRef} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0", transform: lean ? "scale(1.06) rotate(-3deg)" : "none", transition: reduced ? undefined : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {SLOTS.map((s) => {
            const sp = art.watcher[s];
            if (!sp) return null;
            const k = height / sp.h;
            return (
              <img
                key={s}
                src={sp.url}
                alt=""
                draggable={false}
                decoding="async"
                data-watcher-slot={s}
                style={{ position: "absolute", left: -sp.anchor.x * k, top: -sp.anchor.y * k, width: sp.w * k, height: sp.h * k, maxWidth: "none", opacity: s === slot ? 1 : 0, pointerEvents: "none" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Watcher;
