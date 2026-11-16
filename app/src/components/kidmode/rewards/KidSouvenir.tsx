/**
 * KidSouvenir — B-KID-94 + B-KID-96 v1: ONE finish moment and the sticker
 * the child keeps.
 *
 * - `KidSouvenirSticker`: the world's card / the book's cover from the theme
 *   manifest, cut round (CSS mask) on a token die-cut border.
 * - `KidFinishHero`: the ONE hero resolver — the child's generated hero
 *   (resolveHeroUrl via HeroAvatar), else the clearly separate mascot
 *   Sprout; no independent stock child is substituted.
 *   Never a real photo (HeroAvatar's G1 rule).
 * - `KidFinishMoment`: hero + the souvenir; awards it once (lifetime set,
 *   never a count, no streak) and says "A new sticker!" the first time.
 *
 * Kid register only (`.arbor-play`); tokens only; logical properties.
 */
import React, { useEffect, useRef, useState } from "react";
import { HeroAvatar } from "../../ui/HeroAvatar";
import { useKidTheme } from "../../../hooks/useKidTheme";
import { Sticker } from "lucide-react";
import { kidArtSrcSet, studioNextCover } from "../../../lib/kidThemeManifest";
import { kidsStoriesText } from "../../../lib/i18nElevation/kidsStories";
import { souvenirArt, souvenirStrip, type KidSouvenir, type SouvenirKind } from "./kidSouvenirs";
import { useKidSouvenirs } from "./useKidSouvenirs";
import { isStudioMakerId } from "../studioV2/studioCatalog";
import { StudioMakerCover } from "../studioV2/StudioMakerArt";

export const STICKER_MASK = "radial-gradient(closest-side, var(--arbor-ink) 97%, transparent 100%)";

export function KidSouvenirSticker({ kind, refId, size = 96 }: { kind: SouvenirKind; refId: string; size?: number }) {
  const theme = useKidTheme();
  const candidate = souvenirArt({ kind, refId }, theme);
  const art = kind === "world" && candidate?.hasHero ? null : candidate;
  // Next Studio games: a host tile's sticker is the cover of the game it opens.
  // A cover never shows a person, so it needs no hero check.
  const cover = kind === "world" ? studioNextCover(refId) : null;
  // A Studio maker has no raster art: its sticker is its own drawn cover.
  const maker = kind === "world" && isStudioMakerId(refId) ? refId : null;
  const picture = cover ? { src480: cover.src480, srcSet: cover.srcSet, objectPosition: "50% 50%" }
    : art ? { src480: art.src480, srcSet: kidArtSrcSet(art), objectPosition: art.objectPosition } : null;
  return (
    <span
      aria-hidden="true"
      data-kid-sticker={`${kind}:${refId}`}
      style={{
        display: "inline-grid",
        // One definite cell, so a portrait picture fills the circle instead of growing the row to its own height.
        gridTemplate: "minmax(0, 1fr) / minmax(0, 1fr)",
        placeItems: "center",
        inlineSize: size,
        blockSize: size,
        borderRadius: 999,
        padding: Math.max(3, Math.round(size * 0.05)),
        // A Studio screen sets the --kid-sticker-* tokens (studioTokens.css): a white die-cut edge and a soft shadow.
        background: "var(--kid-sticker-face, var(--arbor-paper-elevated))",
        // The plain sticker mark is drawn in the border's ink, whatever text colour surrounds it.
        color: "var(--kid-sticker-ink, var(--comic-ink))",
        border: "2px solid var(--kid-sticker-line, var(--comic-ink))",
        boxShadow: "var(--kid-sticker-shadow, var(--comic-pop))",
        flexShrink: 0,
      }}
    >
      {maker ? (
        <span style={{ display: "block", inlineSize: "100%", blockSize: "100%", borderRadius: 999, overflow: "hidden", maskImage: STICKER_MASK, WebkitMaskImage: STICKER_MASK }}><StudioMakerCover id={maker} /></span>
      ) : picture ? (
        <img
          src={picture.src480}
          srcSet={picture.srcSet}
          sizes={`${size}px`}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ display: "block", inlineSize: "100%", blockSize: "100%", minInlineSize: 0, minBlockSize: 0, objectFit: "cover", objectPosition: picture.objectPosition, borderRadius: 999, maskImage: STICKER_MASK, WebkitMaskImage: STICKER_MASK }}
        />
      ) : (
        <Sticker data-kid-sticker-icon="" size={Math.round(size * 0.58)} aria-hidden="true" />
      )}
    </span>
  );
}

/** The one hero resolver for a finish moment (see file header). */
export function KidFinishHero({ size = 132 }: { size?: number }) {
  return <HeroAvatar size={size} mood="cheer" animate decorative />;
}

/** Award once on mount (Kid Mode, a known child); returns true when this
 *  ending earned a NEW souvenir. Earned once each, never removed. */
export function useAwardSouvenir(childId: string, kind: SouvenirKind, refId: string | undefined, enabled: boolean): boolean {
  const { loaded, scopeKey, awardOnce } = useKidSouvenirs(childId);
  const identity = `${scopeKey}:${kind}:${refId ?? ""}`;
  const current = useRef({ identity, revision: 0 });
  if (current.current.identity !== identity) current.current = { identity, revision: current.current.revision + 1 };
  const mounted = useRef(false);
  const [awarded, setAwarded] = useState<{ identity: string; revision: number } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current.revision++; }; }, []);
  useEffect(() => {
    if (!enabled || !loaded || !refId) return;
    const revision = current.current.revision;
    void awardOnce(kind, refId).then(isNew => {
      if (mounted.current && current.current.revision === revision && isNew) setAwarded({ identity, revision });
    }).catch(() => { /* Failed persistence never claims a new keepsake. */ });
  }, [identity, enabled, loaded, awardOnce, kind, refId]);
  return enabled && awarded?.identity === identity && awarded.revision === current.current.revision;
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
