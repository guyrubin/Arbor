/**
 * BookPage — B-BOOK-04: the art layers of one book page, positioned from the
 * ONE pure layout (lib/library/bookPageLayout). Bottom to top (lane B §6.1):
 *   plate → contact shadow → under-overlays → hero sprite → fg occluder →
 *   over-overlays → repair tap targets.
 * - The plate keeps its aspect: wide = the whole plate; stacked = the 3:4
 *   window (the plate image is wider and clipped by the window).
 * - The hero sprite is feet-anchored in its slot box (contain, bottom
 *   centre), flipped by facing; it breathes (scale 1 → 1.012, 3.2 s) and
 *   enters in 280 ms; static under reduced motion (bookReader.css).
 * - A missing sprite or plate never crashes: the plate falls back through its
 *   sources (real → DEV placeholder), a missing sprite is hidden with one
 *   console warning.
 * - The art is NOT mirrored in Hebrew (v1).
 */
import { useEffect, useState, type CSSProperties } from "react";
import type { BookPageLayout, Rect } from "../../lib/library/bookPageLayout";
import type { PageOverlay } from "../../lib/library/types";

export interface BookPageItem {
  id: string;
  x: number;
  y: number;
  to?: { x: number; y: number };
  done: boolean;
  label: string;
  overlay?: string;
}

export interface BookPageProps {
  layout: BookPageLayout;
  /** Plate sources to try in order. */
  plateSrcs: readonly string[];
  /** Foreground occluder (alpha), drawn over the hero. */
  fgSrc?: string;
  heroSrc: string | null;
  /** Changes when the page or pose changes (re-runs the enter motion). */
  heroKey: string;
  overlays?: readonly (PageOverlay & { srcs: readonly string[]; hidden?: boolean; at?: { x: number; y: number } })[];
  items?: readonly BookPageItem[];
  onItem?: (id: string) => void;
  onArtTap?: () => void;
  pictureLabel: string;
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

function rel(r: Rect, art: Rect): CSSProperties {
  return { left: px(r.x - art.x), top: px(r.y - art.y), width: px(r.w), height: px(r.h) };
}

/** An <img> that walks a list of sources on error; renders nothing when all fail. */
function FallbackImg({ srcs, className, style, onAllFailed }: { srcs: readonly string[]; className?: string; style?: CSSProperties; onAllFailed?: () => void }) {
  const [i, setI] = useState(0);
  const key = srcs.join("|");
  useEffect(() => setI(0), [key]);
  if (i >= srcs.length) return null;
  return (
    <img
      key={srcs[i]}
      src={srcs[i]}
      alt=""
      draggable={false}
      decoding="async"
      className={className}
      style={style}
      onError={() => {
        if (i + 1 >= srcs.length) onAllFailed?.();
        setI(i + 1);
      }}
    />
  );
}

const warned = new Set<string>();

export function BookPage({ layout, plateSrcs, fgSrc, heroSrc, heroKey, overlays = [], items = [], onItem, onArtTap, pictureLabel }: BookPageProps) {
  const { art, plate, hero, shadow } = layout;
  const [heroMissing, setHeroMissing] = useState(false);
  useEffect(() => setHeroMissing(false), [heroSrc]);
  const overlayBox = (o: { x: number; y: number; scale: number; aspect?: number }, at?: { x: number; y: number }): Rect => {
    const h = o.scale * plate.h;
    const w = h * (o.aspect ?? 1);
    const p = at ?? o;
    return { x: plate.x + p.x * plate.w - w / 2, y: plate.y + p.y * plate.h - h, w, h };
  };
  const renderOverlay = (o: NonNullable<BookPageProps["overlays"]>[number]) => (
    <div key={o.id} className="bk-overlay" data-book-overlay={o.id} data-hidden={o.hidden ? "" : undefined} style={rel(overlayBox(o, o.at), art)}>
      <FallbackImg srcs={o.srcs} className="bk-fill-contain" />
    </div>
  );
  return (
    <div
      className="bk-art"
      data-book-art=""
      onClick={onArtTap}
      style={{ left: px(art.x), top: px(art.y), width: px(art.w), height: px(art.h) }}
    >
      <div className="bk-plate" data-book-plate="" role="img" aria-label={pictureLabel} style={rel(plate, art)}>
        <FallbackImg srcs={plateSrcs} className="bk-fill" />
      </div>
      {shadow && hero && !heroMissing && heroSrc && (
        <div
          className="bk-shadow"
          aria-hidden="true"
          style={{
            left: px(shadow.cx - shadow.rx - art.x),
            top: px(shadow.cy - shadow.ry - art.y),
            width: px(shadow.rx * 2),
            height: px(shadow.ry * 2),
            opacity: shadow.opacity * 2.4,
          }}
        />
      )}
      {overlays.filter((o) => o.z === "under").map(renderOverlay)}
      {hero && heroSrc && !heroMissing && (
        <div className="bk-hero" data-book-hero="" style={rel(hero, art)}>
          <div key={heroKey} className="bk-hero-enter">
            <div className="bk-hero-breathe">
              <img
                key={heroSrc}
                src={heroSrc}
                alt=""
                draggable={false}
                className="bk-hero-img"
                style={hero.flip ? { transform: "scaleX(-1)" } : undefined}
                onError={() => {
                  if (!warned.has(heroSrc)) {
                    warned.add(heroSrc);
                    console.warn(`[book] hero sprite missing: ${heroSrc} — the page renders without the hero`);
                  }
                  setHeroMissing(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
      {fgSrc && (
        <div className="bk-plate" style={rel(plate, art)} aria-hidden="true">
          <FallbackImg srcs={[fgSrc]} className="bk-fill" />
        </div>
      )}
      {overlays.filter((o) => o.z !== "under").map(renderOverlay)}
      {items.map((it) => {
        const at = { x: plate.x + it.x * plate.w - art.x, y: plate.y + it.y * plate.h - art.y };
        return (
          <button
            key={it.id}
            type="button"
            className="bk-item"
            data-book-item={it.id}
            data-done={it.done ? "" : undefined}
            aria-label={it.label}
            aria-pressed={it.done}
            disabled={it.done}
            onClick={(e) => {
              e.stopPropagation();
              onItem?.(it.id);
            }}
            style={{ left: px(at.x), top: px(at.y) }}
          >
            <span className="bk-item-ring" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

export default BookPage;
