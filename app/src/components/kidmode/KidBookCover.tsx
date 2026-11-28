/**
 * KidBookCover — B-KID-88 / B-KID-85: ONE book cover for the kid register. The
 * "My books" row on the kid home and the library grid both draw it.
 *
 * - A story with a cover in the child's ONE theme (kidThemeManifest) shows that
 *   cover, portrait, edge to edge.
 * - A story with no hero-free cover in the theme (B-KID-172) gets the kit's
 *   honest fallback: the Studio's reading room picture with the book's title
 *   on a frosted plate and a cloth spine. No emoji, never another theme's
 *   file, never blank paper.
 * - A finished book carries a small "read" mark (a tick in a disc) — never a
 *   count, a star or a score.
 * The title is printed under the cover; it is the button's accessible name.
 * Zero model calls: the art is static and the card is CSS.
 */
import React, { useState } from "react";
import type { HeroPackId } from "../../types";
import { kidArtSrcSet, sharedKidArt, storyCoverArt, type KidArt, type KidThemeId } from "../../lib/kidThemeManifest";
import { storyBookArt } from "../../lib/storyPlateArt";
import "./kidBookCover.css";

/** Legacy pack colours remain available to catalogue callers. The shared
 *  title card itself uses the Studio's paper and cloth materials. */
export const KID_BOOK_TINT: Record<HeroPackId, { page: string; spine: string }> = {
  courage: { page: "var(--arbor-peach-soft)", spine: "var(--arbor-pack-courage)" },
  responsibility: { page: "var(--arbor-yellow-soft)", spine: "var(--arbor-pack-responsibility)" },
  growth: { page: "var(--arbor-clay-soft)", spine: "var(--arbor-pack-growth)" },
  wisdom: { page: "var(--arbor-sky-soft)", spine: "var(--arbor-pack-wisdom)" },
  truth: { page: "var(--arbor-lav-soft)", spine: "var(--arbor-pack-truth)" },
};

/** Row cover width at 390 px: 3.5 covers in view with the 12 px gap. */
export const KID_BOOK_ROW_WIDTH = 116;
export const KID_BOOK_ASPECT = "3 / 4";
/** B-KID-122: covers in the first row (home shelf: 3.5 in view at 390 px;
 *  library: the first row of the grid) load eagerly. */
export const KID_BOOK_EAGER_COUNT = 4;

export interface KidBookCoverProps {
  storyId: string;
  title: string;
  pack: HeroPackId;
  theme: KidThemeId;
  /** The child finished this book (small read mark). */
  read?: boolean;
  /** Accessible label of the read mark (keyed EN + HE by the caller). */
  readLabel: string;
  onOpen: () => void;
  /** "row" = fixed width for the home shelf; "grid" = fills its column. */
  layout: "row" | "grid";
  /** B-KID-122: a cover in the first row loads eagerly (no blank card for
   *  seconds on first paint); the rest stay lazy. */
  eager?: boolean;
  /** B-BOOK-26: the child's OWN approved portrait (the caller's HeroAvatar),
   *  shown on a title card — a book whose shared cover painted another child
   *  (B-BOOK-31) still shows this child on it. Absent for a hero-less child. */
  hero?: React.ReactNode;
}

/** B-KID-172: the kit picture a book without its own hero-free cover stands
 *  on — the Stories reading room (the Studio's own world door, a companion with
 *  an open book, no child), the same honest fallback a Studio game tile uses.
 *  Never another child's painted cover, never another theme's file. */
export function kidBookFallbackArt(theme: KidThemeId | undefined): KidArt | null {
  return theme ? sharedKidArt(theme, "studio.portal.stories") : null;
}

/**
 * The designed title card. B-BOOK-26: with `hero` (the child's OWN approved
 * portrait, badge-less), the card carries it as a disc — ONE composition for
 * the shelf tile and, scaled by `heroSize`, the reader's cover page. Without it
 * (a hero-less child) the card is the complete book.
 * B-KID-172: with `theme`, the card is a picture, not blank paper: the kit's
 * reading room fills it and the title sits on a frosted plate at its foot
 * (the portrait moves to the top corner). Without `theme` (the loading
 * placeholder under a real cover) it stays the pearl paper card.
 */
export function KidBookTitleCard({ title, pack, hero, heroSize = 44, titleSize = 17, theme }: { title: string; pack: HeroPackId; hero?: React.ReactNode; heroSize?: number; titleSize?: number; theme?: KidThemeId }) {
  const art = kidBookFallbackArt(theme);
  const inset = Math.round(heroSize * 0.09);
  return (
    <span aria-hidden="true" data-kid-studio="" data-kid-book-titlecard="" data-kid-book-fallback-art={art ? "" : undefined} data-pack={pack} style={{ position: "absolute", inset: 0, display: "block", background: "var(--studio-pearl)" }}>
      {art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 639px) 50vw, 360px" alt="" draggable={false} decoding="async" loading="lazy" data-kid-book-fallback-img="" style={{ position: "absolute", inset: 0, inlineSize: "100%", blockSize: "100%", objectFit: "cover", objectPosition: "66% 70%" }} />}
      <span className="kid-book-cover__spine" />
      {art ? (
        <span data-kid-book-title-plate="" style={{ position: "absolute", insetBlockEnd: 8, insetInlineStart: 16, insetInlineEnd: 8, padding: "8px 10px", background: "var(--studio-frost)", border: "1px solid var(--studio-surface)", borderRadius: 12, boxShadow: "0 6px 16px var(--studio-shade)", backdropFilter: "blur(6px)" }}>
          <span data-kid-book-card-title="" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", textAlign: "center", fontFamily: "var(--studio-font)", fontWeight: 800, fontSize: titleSize, lineHeight: 1.15, color: "var(--studio-graphite)" }}>
            {title}
          </span>
        </span>
      ) : (
        <span style={{ position: "absolute", insetBlock: 10, insetInlineStart: 18, insetInlineEnd: 8, display: "grid", placeItems: "center", padding: 10, background: "var(--studio-surface)", border: "1px solid var(--studio-line)", borderRadius: 10 }}>
          <span data-kid-book-card-title="" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden", textAlign: "center", fontFamily: "var(--studio-font)", fontWeight: 800, fontSize: titleSize, lineHeight: 1.15, color: "var(--studio-graphite)" }}>
            {title}
          </span>
        </span>
      )}
      {hero && (
        <span data-kid-book-own-hero="" style={{ position: "absolute", ...(art ? { insetBlockStart: inset + 4, insetInlineStart: 16 + inset } : { insetBlockEnd: inset, insetInlineEnd: inset }), inlineSize: heroSize, blockSize: heroSize, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 999, background: "var(--studio-surface)", border: "1px solid var(--studio-line)" }}>
          {hero}
        </span>
      )}
    </span>
  );
}

/** Only the actual artwork URL that finished loading may fade in. A recycled
 * tile for another book or theme must start on its honest title-card fallback. */
export function isKidCoverLoaded(currentArtSrc: string | null, loadedArtSrc: string | null): boolean {
  return currentArtSrc !== null && currentArtSrc === loadedArtSrc;
}

export function KidBookCover({ storyId, title, pack, theme, read, readLabel, onOpen, layout, eager = false, hero }: KidBookCoverProps) {
  const art = storyCoverArt(theme, storyId);
  const portraitSlot = storyBookArt(theme, storyId)?.cover.heroSlot;
  // B-KID-122: until the picture has loaded the slot shows the book's own
  // title card (Studio paper + title, tokens only), and the picture fades in over
  // it (no fade under reduced motion). The slot's 3:4 box never changes size.
  const [loadedArt, setLoadedArt] = useState<string | null>(null);
  const loaded = isKidCoverLoaded(art?.src480 ?? null, loadedArt);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-kid-book={storyId}
      data-kid-book-layout={layout}
      data-kid-studio=""
      className="play-pressable"
      style={{
        appearance: "none",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "start",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        flexShrink: 0,
        inlineSize: layout === "row" ? KID_BOOK_ROW_WIDTH : "100%",
        minBlockSize: 44,
      }}
    >
      <span className="kid-book-cover__object" style={{ position: "relative", display: "block", overflow: "hidden", inlineSize: "100%", aspectRatio: KID_BOOK_ASPECT, background: "var(--studio-pearl)" }}>
        {art ? (
          <>
          <KidBookTitleCard title={title} pack={pack} />
          <img
            src={art.src480}
            srcSet={kidArtSrcSet(art)}
            sizes={layout === "row" ? `${KID_BOOK_ROW_WIDTH}px` : "(max-width: 639px) 50vw, 220px"}
            width={art.width}
            height={Math.round((art.width * 4) / 3)}
            alt=""
            aria-hidden="true"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            data-kid-book-img={loaded ? "loaded" : "pending"}
            ref={(el) => { if (el && el.complete && el.naturalWidth > 0 && !loaded) setLoadedArt(art.src480); }}
            onLoad={() => setLoadedArt(art.src480)}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none"
            style={{ objectPosition: art.objectPosition, opacity: loaded ? 1 : 0 }}
          />
          {/* B-BOOK-83: the reviewed plate is child-free. Keep the SAME own
              portrait the caller already supplied on the old title card. */}
          {portraitSlot && hero && <span data-kid-book-own-hero="" style={{ position: "absolute", left: `${portraitSlot.centerX * 100}%`, bottom: `${(1 - portraitSlot.bottom) * 100}%`, transform: "translateX(-50%)", inlineSize: layout === "row" ? 34 : 44, blockSize: layout === "row" ? 34 : 44, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: 999, background: "var(--studio-surface)", border: "1px solid var(--studio-line)" }}>{hero}</span>}
          </>
        ) : (
          <KidBookTitleCard title={title} pack={pack} hero={hero} heroSize={layout === "row" ? 34 : 44} titleSize={layout === "row" ? 13 : 16} theme={theme} />
        )}
        {read && (
          <span
            role="img"
            aria-label={readLabel}
            data-kid-book-read=""
            style={{ position: "absolute", insetBlockStart: 6, insetInlineEnd: 6, inlineSize: 26, blockSize: 26, display: "grid", placeItems: "center", borderRadius: 999, background: "var(--studio-surface)", border: "1px solid var(--studio-line)", color: "var(--studio-teal-ink)" }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </span>
      <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", fontFamily: "var(--studio-font)", fontWeight: 800, fontSize: "var(--kid-t-label)", lineHeight: 1.2, color: "var(--studio-graphite)" }}>
        {title}
      </span>
    </button>
  );
}
