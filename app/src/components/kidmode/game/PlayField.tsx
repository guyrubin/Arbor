/**
 * PlayField — B-GAME-06 (lane C §B1, ruling G7): the scene IS the screen.
 *
 * A design-space scene (1600×900 landscape / 900×1600 portrait, picked by the
 * field's aspect) scaled UNIFORMLY to cover the field it is given, so the
 * plate bleeds to every edge and nothing is stretched or letterboxed.
 * Layers, back to front:
 *   plate    the place (drawn PLATE_BLEED beyond the design space),
 *   actors   hero, watcher, cover objects — design units, feet anchors,
 *   effects  one-shot motes, glows — design units,
 *   controls the only layer in screen px: glyphs, toys, any text.
 * Right-to-left mirrors the ART group (plate + actors + effects) with one
 * transform; the controls layer is never mirrored, so text never is.
 * B-GAME-07f: `punch` — when its key changes, the art group punches in
 * (scale 1 -> 1.05 -> 1, 300 ms) around a design point (the hero's face at
 * a tag); never under reduced motion; the plate's bleed covers the edges.
 * Animation inside is transform/opacity only. Pure geometry: fieldLayout.ts.
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../hero/HeroFigure";
import { PLATE_BLEED, fitField, orientationFor, type FieldFit, type FieldOrientation } from "./fieldLayout";

export interface PlayFieldContext {
  fit: FieldFit;
  rtl: boolean;
}

export interface PlayFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  rtl: boolean;
  /** Half-extent (design units, from the centre) that must stay in the safe
   *  area, per orientation (a game's layout `need`). */
  needFor?: (o: FieldOrientation) => { halfW: number; halfH: number } | undefined;
  plate?: (ctx: PlayFieldContext) => React.ReactNode;
  actors?: (ctx: PlayFieldContext) => React.ReactNode;
  effects?: (ctx: PlayFieldContext) => React.ReactNode;
  controls?: (ctx: PlayFieldContext) => React.ReactNode;
  /** The root element (the hold surface), for focus. */
  rootRef?: (el: HTMLDivElement | null) => void;
  /** A punch-in of the art group around a design point (unmirrored design
   *  units), played when `key` changes to a non-null value. */
  punch?: (ctx: PlayFieldContext) => { key: string | number | null; x: number; y: number } | null;
}

function initialSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 375, h: 748 };
  return { w: window.innerWidth || 375, h: Math.max(1, (window.innerHeight || 812) - 64) };
}

/** Art-group transform: design space -> field px, mirrored for RTL. */
export function artTransform(fit: FieldFit, rtl: boolean): string {
  const base = `translate(${fit.offsetX}px, ${fit.offsetY}px) scale(${fit.scale})`;
  return rtl ? `${base} translateX(${fit.design.w}px) scaleX(-1)` : base;
}

export function PlayField({ rtl, needFor, plate, actors, effects, controls, rootRef, punch, style, ...rest }: PlayFieldProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const punchRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(initialSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const orientation = orientationFor(size.w, size.h);
  const fit = fitField(size.w, size.h, needFor?.(orientation), orientation);
  const ctx: PlayFieldContext = { fit, rtl };
  const { w: W, h: H } = fit.design;
  const punchAt = punch?.(ctx) ?? null;
  const punchKey = punchAt?.key ?? null;
  const lastPunch = useRef(punchKey);
  useLayoutEffect(() => {
    const el = punchRef.current;
    const changed = lastPunch.current !== punchKey;
    lastPunch.current = punchKey;
    if (!changed || punchKey === null || !el || prefersReducedMotion() || typeof el.animate !== "function") return;
    el.animate([{ transform: "scale(1)" }, { transform: "scale(1.05)", offset: 0.38 }, { transform: "scale(1)" }], { duration: 300, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  }, [punchKey]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        rootRef?.(el);
      }}
      data-play-field={orientation}
      data-rtl={rtl ? "" : undefined}
      {...rest}
      style={{
        position: "relative",
        inlineSize: "100%",
        blockSize: "100%",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        background: "var(--arbor-ink)",
        ...style,
      }}
    >
      <div
        data-play-art=""
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transformOrigin: "0 0",
          transform: artTransform(fit, rtl),
          pointerEvents: "none",
        }}
      >
        <div ref={punchRef} data-play-punch="" style={{ position: "absolute", inset: 0, transformOrigin: punchAt ? `${punchAt.x}px ${punchAt.y}px` : "50% 50%" }}>
        <div data-play-layer="plate" style={{ position: "absolute", left: -W * PLATE_BLEED, top: -H * PLATE_BLEED, width: W * (1 + 2 * PLATE_BLEED), height: H * (1 + 2 * PLATE_BLEED) }}>
          {plate?.(ctx)}
        </div>
        <div data-play-layer="actors" style={{ position: "absolute", inset: 0 }}>{actors?.(ctx)}</div>
        <div data-play-layer="effects" style={{ position: "absolute", inset: 0 }}>{effects?.(ctx)}</div>
        </div>
      </div>
      <div data-play-layer="controls" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {controls?.(ctx)}
      </div>
    </div>
  );
}

export default PlayField;
