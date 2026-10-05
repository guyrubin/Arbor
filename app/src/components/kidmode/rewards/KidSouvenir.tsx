/**
 * KidSouvenir — B-KID-94 + B-KID-96 v1: ONE finish moment and the sticker
 * the child keeps.
 *
 * - `KidSouvenirSticker`: the world's card / the book's cover from the theme
 *   manifest, cut round (CSS mask) on a token die-cut border.
 * - `KidFinishHero`: the ONE hero resolver — the child's generated hero
 *   (resolveHeroUrl via HeroAvatar), else the theme's stock hero portrait
 *   from the manifest (`hero.portrait`, when the theme has one), else Sprout.
 *   Never a real photo (HeroAvatar's G1 rule).
 * - `KidFinishMoment`: hero + the souvenir; awards it once (lifetime set,
 *   never a count, no streak) and says "A new sticker!" the first time.
 *
 * Kid register only (`.arbor-play`); tokens only; logical properties.
 */
import React, { useEffect, useRef } from "react";
import { HeroAvatar, useHeroAvatar } from "../../ui/HeroAvatar";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { kidArt, kidArtSrcSet } from "../../../lib/kidThemeManifest";
import { kidsStoriesText } from "../../../lib/i18nElevation/kidsStories";
import { souvenirArt, souvenirStrip, souvenirToAward, type KidSouvenir, type SouvenirKind } from "./kidSouvenirs";
import { useKidSouvenirs } from "./useKidSouvenirs";

export const STICKER_MASK = "radial-gradient(closest-side, var(--arbor-ink) 97%, transparent 100%)";

export function KidSouvenirSticker({ kind, refId, size = 96 }: { kind: SouvenirKind; refId: string; size?: number }) {
  const theme = useKidTheme();
  const art = souvenirArt({ kind, refId }, theme);
  return (
    <span
      aria-hidden="true"
      data-kid-sticker={`${kind}:${refId}`}
      style={{
        display: "inline-grid",
        placeItems: "center",
        inlineSize: size,
        blockSize: size,
        borderRadius: 999,
        padding: Math.max(3, Math.round(size * 0.05)),
        background: "var(--arbor-paper-elevated)",
        border: "2px solid var(--comic-ink)",
        boxShadow: "var(--comic-pop)",
        flexShrink: 0,
      }}
    >
      {art ? (
        <img
          src={art.src480}
          srcSet={kidArtSrcSet(art)}
          sizes={`${size}px`}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ inlineSize: "100%", blockSize: "100%", objectFit: "cover", objectPosition: art.objectPosition, borderRadius: 999, maskImage: STICKER_MASK, WebkitMaskImage: STICKER_MASK }}
        />
      ) : (
        <span style={{ inlineSize: "100%", blockSize: "100%", borderRadius: 999, background: "var(--arbor-peach-soft)" }} />
      )}
    </span>
  );
}

/** The one hero resolver for a finish moment (see file header). */
export function KidFinishHero({ size = 132 }: { size?: number }) {
  const { url } = useHeroAvatar();
  const theme = useKidTheme();
  const stock = url ? null : kidArt(theme, "hero.portrait");
  if (!stock) return <HeroAvatar size={size} mood="cheer" animate decorative />;
  return (
    <span aria-hidden="true" data-kid-stock-hero="" style={{ display: "inline-block", inlineSize: size, blockSize: size, borderRadius: 999, overflow: "hidden", border: "3px solid var(--comic-ink)" }}>
      <img src={stock.src480} srcSet={kidArtSrcSet(stock)} sizes={`${size}px`} alt="" style={{ inlineSize: "100%", blockSize: "100%", objectFit: "cover", objectPosition: stock.objectPosition }} />
    </span>
  );
}

/** Award once on mount (Kid Mode, a known child); returns true when this
 *  ending earned a NEW souvenir. Earned once each, never removed. */
export function useAwardSouvenir(childId: string, kind: SouvenirKind, refId: string | undefined, enabled: boolean): boolean {
  const { items, loaded, upsert } = useKidSouvenirs(childId);
  const awarded = useRef<string | null>(null);
  const pending = enabled && loaded && !!refId ? souvenirToAward(items, kind, refId, new Date()) : null;
  useEffect(() => {
    if (!pending || awarded.current === pending.id) return;
    awarded.current = pending.id;
    void upsert(pending).catch(() => { /* a failed write never blocks the ending */ });
  }, [pending?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return awarded.current !== null || !!pending;
}

/** The ONE finish moment: the hero cheers; the souvenir sticker under it. */
export function KidFinishMoment({ childId, kind, refId, lang, hero = true }: { childId: string; kind: SouvenirKind; refId?: string; lang: "en" | "he"; /** false when the screen already shows the hero (one hero per screen). */ hero?: boolean }) {
  const isNew = useAwardSouvenir(childId, kind, refId, !!childId);
  return (
    <div data-kid-finish-moment="" className="flex flex-col items-center gap-2">
      {hero && <div className="play-cheer"><KidFinishHero /></div>}
      {refId && (
        <div className="flex flex-col items-center gap-1 play-pop-in">
          <KidSouvenirSticker kind={kind} refId={refId} size={96} />
          {isNew && (
            <p dir="auto" data-kid-sticker-new="" className="kid-type-label" style={{ margin: 0, color: "var(--arbor-ink)" }}>
              {kidsStoriesText("kidReward.newSticker", lang)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** B-KID-96: "My stickers" on the kid home, under Games — every souvenir the
 *  child has earned (newest first), hidden while there are none. A sticker
 *  opens its world / book. No count, no empty slots, no "next one" (law 3). */
export function KidStickerStrip({ items, lang, nameOf, onOpen, heading }: {
  items: readonly KidSouvenir[];
  lang: "en" | "he";
  /** The world's / book's name (the sticker's accessible name). */
  nameOf: (s: KidSouvenir) => string;
  onOpen: (s: KidSouvenir) => void;
  heading: React.ReactNode;
}) {
  const strip = souvenirStrip(items);
  if (strip.length === 0) return null;
  return (
    <section aria-label={kidsStoriesText("kidReward.myStickers", lang)} data-kid-stickers="">
      {heading}
      <ul className="flex flex-wrap gap-3" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {strip.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              aria-label={kidsStoriesText("kidReward.stickerAria", lang, { name: nameOf(s) })}
              className="play-pressable"
              style={{ appearance: "none", background: "transparent", border: 0, padding: 0, cursor: "pointer", minInlineSize: 44, minBlockSize: 44, borderRadius: 999 }}
            >
              <KidSouvenirSticker kind={s.kind} refId={s.refId} size={72} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default KidFinishMoment;
