import React from "react";
import { LivingForm } from "../../design/primitives";
import type { ParentArt } from "../../lib/parentArt";

/**
 * A square Living Form cropped into a wide frame the way the For you and
 * Library boards crop them: the picture a little larger than the frame,
 * centred across, its top quarter cut. Decorative only (aria-hidden), never
 * evidence about a child.
 */
export function AreaForm({ art, width, ratio = 0.62, zoom = 1.2, className }: { art: ParentArt; width: number; ratio?: number; zoom?: number; className?: string }) {
  const w = Math.round(width * zoom * 10) / 10;
  const h = Math.round((w * art.height) / art.width * 10) / 10;
  const frameH = Math.round(width * ratio * 10) / 10;
  return (
    <LivingForm
      src={art.src}
      srcSet={art.srcSet}
      width={width}
      height={frameH}
      className={className}
      crop={{ w, h, x: -Math.round(((w - width) / 2) * 10) / 10, y: -Math.round(Math.max(0, h - frameH) * 0.45 * 10) / 10 }}
    />
  );
}
