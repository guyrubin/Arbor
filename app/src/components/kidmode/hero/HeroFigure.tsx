/**
 * HeroFigure — B-GAME-05 (lane B §D, ruling G4): the child's hero as a
 * character that plays.
 *
 * - Every pose is an <img> sprite placed by its FOOT anchor, so a pose swap
 *   never moves the feet. All poses of the sheet are mounted (decoded once)
 *   and only the current one is visible: a pose change is a HARD CUT, hidden
 *   under a ~60 ms squash (scale 1.06 / 0.94 at the feet) — never a
 *   cross-fade (two non-identical renders ghost into a double image).
 * - `kick` (a counter) plays a lurch squash when it changes: the game's
 *   stepwise travel lands on it.
 * - Idle breathes (scaleY 1 -> 1.015, origin at the feet, 3.2 s).
 * - B-GAME-07f: the tumble (`oops`) LANDS — a deep squash and rebound at the
 *   feet; a held statue wobbles +/- 1 deg over 1.2 s.
 * - Contact shadow: a radial ellipse at the feet that shrinks with `lift`.
 * - prefers-reduced-motion: no squash, no breathe (the cut still happens).
 * - Missing pose -> heroSheet FALLBACK; never renders empty.
 * Decorative (aria-hidden): the game says what the hero does.
 * Motion is transform/opacity only (Web Animations, no new runtime).
 */
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { HERO_POSES, carryPoint, poseFactor, readStoredHeroSheet, referenceSprite, resolvePose, type HeroPoseId, type HeroSheet } from "./heroSheet";
import { devPlaceholderSheet } from "./devPlaceholderSheet";

export interface HeroFigureProps {
  pose: HeroPoseId;
  /** Full-figure height of the reference (idle) pose, in the parent's units. */
  height: number;
  sheet: HeroSheet;
  /** Feet position in the parent's coordinate space. */
  x: number;
  y: number;
  /** Changes -> one lurch squash. */
  kick?: number;
  /** Height above the ground (parent units): lifts the figure, shrinks the shadow. */
  lift?: number;
  /** A tiny statue wobble (+/- 1 deg, 1.2 s) while true; "tremble" = the held
   *  breath while the watcher looks (+/- 0.6 deg, quicker). */
  wobble?: boolean | "tremble";
  zIndex?: number;
  /** Transition for x/y moves (stepwise travel), e.g. "transform 180ms ease-out". */
  travel?: string;
  /** A prize held up in the hands (hold-up only): drawn at the midpoint of
   *  the hand anchors (else above the head), inside the squash. `size` is in
   *  parent units. */
  carry?: { url: string; size: number } | null;
}

/** The proof sheet for this child, else the dev placeholder. Read once per child. */
export function useHeroSheet(childId: string): HeroSheet {
  return useMemo(() => readStoredHeroSheet(childId) ?? devPlaceholderSheet(), [childId]);
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Sprite box in parent units for `pose`, positioned so its foot sits at (0, 0). */
export function spriteBox(sheet: HeroSheet, pose: HeroPoseId, height: number): { pose: HeroPoseId; url: string; left: number; top: number; width: number; height: number } | null {
  const r = resolvePose(sheet, pose);
  const ref = referenceSprite(sheet);
  if (!r || !ref) return null;
  const k = poseFactor(sheet, r.sprite, height);
  return { pose: r.pose, url: r.sprite.url, left: -r.sprite.foot.x * k, top: -r.sprite.foot.y * k, width: r.sprite.w * k, height: r.sprite.h * k };
}

export function HeroFigure({ pose, height, sheet, x, y, kick = 0, lift = 0, wobble = false, zIndex, travel, carry }: HeroFigureProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const breatheRef = useRef<HTMLDivElement | null>(null);
  const shown = resolvePose(sheet, pose)?.pose ?? "idle";
  const lastShown = useRef(shown);
  const lastKick = useRef(kick);

  // The hard cut, under a squash (and a lurch squash on a kick).
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const changed = lastShown.current !== shown;
    const kicked = lastKick.current !== kick;
    lastShown.current = shown;
    lastKick.current = kick;
    if (!el || (!changed && !kicked) || prefersReducedMotion() || typeof el.animate !== "function") return;
    if (changed && shown === "oops") {
      // The tumble lands: squash flat, rebound, settle.
      el.animate([{ transform: "scale(1.22, 0.76)" }, { transform: "scale(0.94, 1.07)", offset: 0.45 }, { transform: "scale(1.03, 0.97)", offset: 0.75 }, { transform: "scale(1, 1)" }], { duration: 320, easing: "ease-out" });
      return;
    }
    const squash = kicked ? "scale(1.08, 0.9)" : "scale(1.06, 0.94)";
    el.animate([{ transform: squash }, { transform: squash, offset: 0.45 }, { transform: "scale(1, 1)" }], { duration: kicked ? 150 : 110, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
  }, [shown, kick]);

  // Idle breathes; a held statue wobbles. Nothing else idles.
  useLayoutEffect(() => {
    const el = breatheRef.current;
    if (!el || prefersReducedMotion() || typeof el.animate !== "function") return;
    if (shown === "idle") {
      const a = el.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(1.015)" }, { transform: "scaleY(1)" }], { duration: 3200, iterations: Infinity, easing: "ease-in-out" });
      return () => a.cancel();
    }
    if (wobble) {
      const deg = wobble === "tremble" ? 0.6 : 1;
      const a = el.animate([{ transform: `rotate(${-deg}deg)` }, { transform: `rotate(${deg}deg)` }, { transform: `rotate(${-deg}deg)` }], { duration: wobble === "tremble" ? 700 : 1200, iterations: Infinity, easing: "ease-in-out" });
      return () => a.cancel();
    }
    return undefined;
  }, [shown, wobble]);

  const shownSprite = sheet.poses[shown];
  const held = carry && pose === "hold-up" && shownSprite
    ? (() => { const at = carryPoint(shownSprite, poseFactor(sheet, shownSprite, height), carry.size); return { ...carry, x: at.x, y: at.y }; })()
    : null;
  const liftClamped = Math.max(0, lift);
  const shadowScale = Math.max(0.45, 1 - liftClamped / Math.max(1, height));
  // B-GAME-07d: soft, a little to the right of the feet (the key light is
  // upper left; RTL mirrors it with the art group).
  const shadowW = height * 0.46;
  const shadowH = Math.max(6, height * 0.06);
  const shadowDx = height * 0.05;

  return (
    <div
      aria-hidden="true"
      data-hero-figure={shown}
      style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, zIndex, transform: `translate(${x}px, ${y}px)`, transition: travel, willChange: travel ? "transform" : undefined }}
    >
      {/* Contact shadow at the feet (shrinks as the hero leaves the ground). */}
      <span
        data-hero-shadow=""
        style={{
          position: "absolute",
          left: -shadowW / 2 + shadowDx,
          top: -shadowH / 2,
          width: shadowW,
          height: shadowH,
          borderRadius: "50%",
          background: "radial-gradient(closest-side, color-mix(in srgb, var(--arbor-ink) 32%, transparent), transparent)",
          transform: `scale(${shadowScale})`,
        }}
      />
      <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: liftClamped ? `translateY(${-liftClamped}px)` : undefined }}>
      <div ref={bodyRef} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0" }}>
        <div ref={breatheRef} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transformOrigin: "0 0" }}>
          {HERO_POSES.map((p) => {
            const sprite = sheet.poses[p];
            if (!sprite) return null;
            const k = poseFactor(sheet, sprite, height);
            return (
              <img
                key={p}
                src={sprite.url}
                alt=""
                draggable={false}
                decoding="async"
                data-hero-pose={p}
                style={{
                  position: "absolute",
                  left: -sprite.foot.x * k,
                  top: -sprite.foot.y * k,
                  width: sprite.w * k,
                  height: sprite.h * k,
                  maxWidth: "none",
                  opacity: p === shown ? 1 : 0,
                  pointerEvents: "none",
                }}
              />
            );
          })}
          {held && (
            <img
              src={held.url}
              alt=""
              draggable={false}
              data-hero-carry=""
              style={{ position: "absolute", left: held.x - held.size / 2, top: held.y - held.size / 2, width: held.size, height: held.size, maxWidth: "none", pointerEvents: "none" }}
            />
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default HeroFigure;
