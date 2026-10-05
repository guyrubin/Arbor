/**
 * KidBookCover — B-KID-88 / B-KID-85: ONE book cover for the kid register. The
 * "My books" row on the kid home and the library grid both draw it.
 *
 * - A story with a cover in the child's ONE theme (kidThemeManifest) shows that
 *   cover, portrait, edge to edge.
 * - A story with no cover in the theme gets a designed title card drawn from
 *   tokens: the pack's soft tint, a paper page framed by the comic line, the
 *   pack's spine band on the inline-start edge, the title set in the display
 *   face. No emoji, no flat colour block, never another theme's file.
 * - A finished book carries a small "read" mark (a tick in a disc) — never a
 *   count, a star or a score.
 * The title is printed under the cover; it is the button's accessible name.
 * Zero model calls: the art is static and the card is CSS.
 */
import type { HeroPackId } from "../../types";
import { kidArt, kidArtSrcSet, storyCoverKey, type KidThemeId } from "../../lib/kidThemeManifest";

/** The pack's soft tint (page) and full colour (spine) — the same pack tokens
 *  the catalogue uses, so a title card belongs to its pack, never a random hue. */
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
}

export function KidBookTitleCard({ title, pack }: { title: string; pack: HeroPackId }) {
  const tint = KID_BOOK_TINT[pack];
  return (
    <span aria-hidden="true" data-kid-book-titlecard="" style={{ position: "absolute", inset: 0, display: "block", background: tint.page }}>
      <span style={{ position: "absolute", insetBlock: 0, insetInlineStart: 0, inlineSize: 10, background: tint.spine }} />
      <span style={{ position: "absolute", insetBlock: 10, insetInlineStart: 18, insetInlineEnd: 8, display: "grid", placeItems: "center", padding: 10, background: "var(--arbor-paper-elevated)", border: "var(--comic-line)", borderRadius: 12 }}>
        <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 4, overflow: "hidden", textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 900, fontSize: 17, lineHeight: 1.15, color: "var(--arbor-ink)" }}>
          {title}
        </span>
      </span>
    </span>
  );
}

export function KidBookCover({ storyId, title, pack, theme, read, readLabel, onOpen, layout }: KidBookCoverProps) {
  const art = kidArt(theme, storyCoverKey(storyId));
  return (
    <button
      type="button"
      onClick={onOpen}
      data-kid-book={storyId}
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
      <span className="world-tile" style={{ position: "relative", display: "block", overflow: "hidden", inlineSize: "100%", aspectRatio: KID_BOOK_ASPECT, background: KID_BOOK_TINT[pack].page }}>
        {art ? (
          <img
            src={art.src480}
            srcSet={kidArtSrcSet(art)}
            sizes={layout === "row" ? `${KID_BOOK_ROW_WIDTH}px` : "(max-width: 767px) 50vw, 25vw"}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: art.objectPosition }}
          />
        ) : (
          <KidBookTitleCard title={title} pack={pack} />
        )}
        {read && (
          <span
            role="img"
            aria-label={readLabel}
            data-kid-book-read=""
            style={{ position: "absolute", insetBlockStart: 6, insetInlineEnd: 6, inlineSize: 26, blockSize: 26, display: "grid", placeItems: "center", borderRadius: 999, background: "var(--arbor-paper-elevated)", border: "2px solid var(--comic-ink)", color: "var(--arbor-green-ink)" }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
              <path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </span>
      <span style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, lineHeight: 1.2, color: "var(--arbor-ink)" }}>
        {title}
      </span>
    </button>
  );
}
