/**
 * BookPage — B-BOOK-04/08: the art layers of one book page, positioned from
 * the ONE pure layout (lib/library/bookPageLayout). Bottom to top (lane B
 * §6.1, matching the art agent's compose.py):
 *   plate → under-overlays (+ their contact shadows) → hero contact shadow
 *   (sole core + soft cast away from the light) → hero sprite (graded a little
 *   toward the plate's colour: 12 % hue pull, 7 % desaturation) → plate
 *   occluders (a patch of the plate redrawn over the hero: p8's water) → fg →
 *   over-overlays → repair tap targets.
 * - A PRINT replaces plate + shadow + sprite with one image in the same rect
 *   (overlays still draw over it).
 * - The plate keeps its aspect: wide = the whole plate; stacked = the 3:4
 *   window (the plate image is wider and clipped by the window).
 * - The hero sprite fills its box (the box IS the sprite when the sheet's
 *   manifest measured it; else contain, bottom centre), flipped by facing; it
 *   breathes (scale 1 → 1.012, 3.2 s) and enters in 280 ms; static under
 *   reduced motion (bookReader.css).
 * - A missing sprite or plate never crashes: plates fall back through their
 *   sources (real → DEV placeholder), a missing sprite is hidden with one
 *   console warning.
 * - The art is NOT mirrored in Hebrew (v1).
 */
import { useEffect, useState, type CSSProperties } from "react";
import type { BookPageLayout, Rect, ShadowEllipse } from "../../lib/library/bookPageLayout";
import type { PageOverlay, PlateOccluder } from "../../lib/library/types";

export interface BookPageItem {
  id: string;
  x: number;
  y: number;
  done: boolean;
  label: string;
}

export type BookPageOverlay = PageOverlay & { srcs: readonly string[]; hidden?: boolean; hop?: boolean };

export interface BookPageProps {
  layout: BookPageLayout;
  /** Plate sources to try in order (or the print, when one replaces the art). */
  plateSrcs: readonly string[];
  /** True when plateSrcs is a print: no sprite, no shadow. */
  printed?: boolean;
  /** Foreground occluder (alpha), drawn over the hero. */
  fgSrc?: string;
  heroSrc: string | null;
  /** Changes when the page or pose changes (re-runs the enter motion). */
  heroKey: string;
  /** The plate's mean colour under the hero (grade). */
  tint?: readonly [number, number, number];
  overlays?: readonly BookPageOverlay[];
  occluders?: readonly PlateOccluder[];
  items?: readonly BookPageItem[];
  onItem?: (id: string) => void;
  onArtTap?: () => void;
  pictureLabel: string;
}

const px = (n: number) => `${Math.round(n * 10) / 10}px`;

function rel(r: Rect, art: Rect): CSSProperties {
  return { left: px(r.x - art.x), top: px(r.y - art.y), width: px(r.w), height: px(r.h) };
}

function ellipseStyle(e: ShadowEllipse, art: Rect): CSSProperties {
  return {
    left: px(e.cx - e.rx - art.x),
    top: px(e.cy - e.ry - art.y),
    width: px(e.rx * 2),
    height: px(e.ry * 2),
    opacity: e.opacity,
    filter: `blur(${px(e.blur)})`,
  };
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

/** The opaque mask for a feathered rect (sides + bottom `f`, top `ft`, px). */
function featherMask(f: number, ft: number): CSSProperties {
  const solid = "var(--arbor-ink)";
  const v = `linear-gradient(to bottom, transparent 0, ${solid} ${px(ft)}, ${solid} calc(100% - ${px(f)}), transparent 100%)`;
  const h = `linear-gradient(to right, transparent 0, ${solid} ${px(f)}, ${solid} calc(100% - ${px(f)}), transparent 100%)`;
  return { maskImage: `${v}, ${h}`, WebkitMaskImage: `${v}, ${h}`, maskComposite: "intersect", WebkitMaskComposite: "source-in" };
}

export function BookPage({ layout, plateSrcs, printed = false, fgSrc, heroSrc, heroKey, tint, overlays = [], occluders = [], items = [], onItem, onArtTap, pictureLabel }: BookPageProps) {
  const { art, plate, hero, shadow } = layout;
  const [heroMissing, setHeroMissing] = useState(false);
  useEffect(() => setHeroMissing(false), [heroSrc]);
  const showHero = !printed && !!hero && !!heroSrc && !heroMissing;

  const overlayBox = (o: BookPageOverlay): Rect => {
    const h = o.scale * plate.h;
    const w = h * (o.aspect ?? 1);
    const x = plate.x + o.x * plate.w;
    const y = plate.y + o.y * plate.h;
    return o.anchor === "center" ? { x: x - w / 2, y: y - h / 2, w, h } : { x: x - (o.footX ?? 0.5) * w, y: y - h, w, h };
  };
  const renderOverlay = (o: BookPageOverlay) => {
    const b = overlayBox(o);
    const ground = !o.hidden && o.shadow && o.anchor !== "center";
    const fw = b.w * 0.8;
    return (
      <div key={o.id} className="bk-overlay-wrap" data-book-overlay={o.id} data-hidden={o.hidden ? "" : undefined} data-hop={o.hop ? "" : undefined}>
        {ground && (
          <div
            className="bk-shadow"
            aria-hidden="true"
            style={ellipseStyle({ cx: plate.x + o.x * plate.w, cy: plate.y + o.y * plate.h, rx: fw * 0.56, ry: Math.max(2, fw * 0.05), opacity: 0.8 * (o.shadow ?? 0), blur: Math.max(2, fw * 0.04) }, art)}
          />
        )}
        <div className="bk-overlay" style={rel(b, art)}>
          <FallbackImg srcs={o.srcs} className="bk-fill-contain" style={o.rotate ? { transform: `rotate(${o.rotate}deg)` } : undefined} />
        </div>
      </div>
    );
  };

  const tintStyle: CSSProperties | undefined =
    tint && heroSrc
      ? {
          backgroundColor: `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`,
          maskImage: `url("${heroSrc}")`,
          WebkitMaskImage: `url("${heroSrc}")`,
          maskSize: "contain",
          WebkitMaskSize: "contain",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "50% 100%",
          WebkitMaskPosition: "50% 100%",
        }
      : undefined;

  return (
    <div className="bk-art" data-book-art="" data-printed={printed ? "" : undefined} onClick={onArtTap} style={{ left: px(art.x), top: px(art.y), width: px(art.w), height: px(art.h) }}>
      <div className="bk-plate" data-book-plate="" role="img" aria-label={pictureLabel} style={rel(plate, art)}>
        <FallbackImg srcs={plateSrcs} className="bk-fill" />
      </div>
      {overlays.filter((o) => o.z === "under").map(renderOverlay)}
      {showHero && shadow && (
        <>
          <div className="bk-shadow" data-book-shadow="spill" aria-hidden="true" style={ellipseStyle(shadow.cast, art)} />
          <div className="bk-shadow" data-book-shadow="core" aria-hidden="true" style={ellipseStyle(shadow, art)} />
        </>
      )}
      {showHero && hero && heroSrc && (
        <div className="bk-hero" data-book-hero="" style={rel(hero, art)}>
          <div key={heroKey} className="bk-hero-enter">
            <div className="bk-hero-breathe">
              <div className="bk-hero-art" style={hero.flip ? { transform: "scaleX(-1)" } : undefined}>
                <img
                  key={heroSrc}
                  src={heroSrc}
                  alt=""
                  draggable={false}
                  className="bk-hero-img"
                  onError={() => {
                    if (!warned.has(heroSrc)) {
                      warned.add(heroSrc);
                      console.warn(`[book] hero sprite missing: ${heroSrc} — the page renders without the hero`);
                    }
                    setHeroMissing(true);
                  }}
                />
                {tintStyle && <div className="bk-hero-tint" aria-hidden="true" style={tintStyle} />}
              </div>
            </div>
          </div>
        </div>
      )}
      {showHero &&
        occluders.map((o, i) => {
          const r: Rect = { x: plate.x + o.box[0] * plate.w, y: plate.y + o.box[1] * plate.h, w: (o.box[2] - o.box[0]) * plate.w, h: (o.box[3] - o.box[1]) * plate.h };
          return (
            <div
              key={i}
              className="bk-occluder"
              data-book-occluder=""
              aria-hidden="true"
              style={{
                ...rel(r, art),
                opacity: o.opacity,
                backgroundImage: plateSrcs.map((u) => `url("${u}")`).join(", "),
                backgroundSize: plateSrcs.map(() => `${px(plate.w)} ${px(plate.h)}`).join(", "),
                backgroundPosition: plateSrcs.map(() => `${px(-(r.x - plate.x))} ${px(-(r.y - plate.y))}`).join(", "),
                ...featherMask(o.feather * plate.h, o.featherTop * plate.h),
              }}
            />
          );
        })}
      {fgSrc && !printed && (
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
