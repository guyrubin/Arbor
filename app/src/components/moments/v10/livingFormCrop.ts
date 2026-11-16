import type { ParentArt } from "../../../lib/parentArt";

/**
 * The boards place a square Living Form inside a smaller frame, zoomed a
 * little past the frame and centred, so the satin ribbon fills it. One rule
 * for every area and shelf form on the My child screens.
 */
export function squareCrop(frame: number, height: number) {
  const size = Math.round(frame * 1.25 * 10) / 10;
  return { w: size, h: size, x: -Math.round(((size - frame) / 2) * 10) / 10, y: -Math.round(((size - height) / 2) * 10) / 10 };
}

/** A wide (16:9) guide picture, its right-hand ribbon framed (the rail's objects). */
export function wideCrop(frame: number, height: number) {
  const w = Math.round(frame * 2.38 * 10) / 10;
  const h = Math.round(w * 0.5625 * 10) / 10;
  return { w, h, x: -Math.round(w * 0.54 * 10) / 10, y: -Math.round(((h - height) / 2) * 10) / 10 };
}

/** A guide picture shipped beside the area forms (public/visuals/guides). */
export function guideArt(name: string): ParentArt {
  return { src: `/visuals/guides/${name}-480.webp`, srcSet: `/visuals/guides/${name}-480.webp 1x, /visuals/guides/${name}-960.webp 2x`, width: 480, height: 270 };
}
