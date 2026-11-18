import React, { useState, type CSSProperties } from "react";
import { Icon } from "../ui/Icon";
import { ArborMascot } from "../ui/ArborMascot";
import { bookString } from "../../lib/library/bookStrings";
import { kidsStoriesText } from "../../lib/i18nElevation/kidsStories";
import { isolate } from "../../lib/i18n";
import { storyArtSrcSet, type StoryPlateArt } from "../../lib/storyPlateArt";
import "./storyArtwork.css";

/** Static art for one authored scene, with the child's existing approved
 * portrait. Errors keep the hero and words; retry only remounts this image.
 * The keyed inner component prevents an old page's late error from marking
 * the next page unavailable. No image/generation API is involved. */
export function StoryArtwork(props: {
  art: StoryPlateArt;
  lang: "en" | "he";
  heroUrl?: string;
  heroName?: string;
  decision?: boolean;
}) {
  return <StoryArtworkImage key={props.art.src} {...props} />;
}

function StoryArtworkImage({ art, lang, heroUrl, heroName, decision = false }: Parameters<typeof StoryArtwork>[0]) {
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failedHero, setFailedHero] = useState<string | null>(null);
  const unavailable = failedAttempt === attempt;
  const retrySuffix = attempt ? `?picture-retry=${attempt}` : "";
  const currentArt = { ...art, src: art.src + retrySuffix, src480: art.src480 + retrySuffix };
  const heroLabel = heroName
    ? kidsStoriesText("journey.heroAlt", lang, { name: isolate(heroName, lang) })
    : kidsStoriesText("journey.heroAltUnnamed", lang);
  return <div
    className="story-artwork"
    data-story-artwork={art.id}
    data-story-picture-unavailable={unavailable ? "" : undefined}
    style={{ "--story-art-position": art.objectPosition } as CSSProperties}
  >
    {!unavailable && <img
      key={attempt}
      src={currentArt.src}
      srcSet={storyArtSrcSet(currentArt)}
      // A 3:2 page loses roughly half its width in the portrait window.
      // Select for the uncropped width, so 480w never becomes a blurry
      // 240-pixel picture stretched across a 375-pixel reading frame.
      sizes={art.width > art.height
        ? (decision ? "(min-width: 640px) 120vh, 33vh" : "(min-width: 640px) 120vh, 200vw")
        : "(min-width: 640px) min(60vw, 60vh), 100vw"}
      width={art.width}
      height={art.height}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      data-story-art-image={art.id}
      className="story-artwork-picture"
      style={{ objectPosition: art.objectPosition }}
      onError={() => setFailedAttempt(attempt)}
    />}
    <div
      className="story-artwork-portrait"
      data-story-own-hero={heroUrl && failedHero !== heroUrl ? "approved" : "mascot"}
      style={{ left: `${art.heroSlot.centerX * 100}%`, bottom: `${(1 - art.heroSlot.bottom) * 100}%`, height: `${art.heroSlot.height * 100}%` }}
    >
      {heroUrl && failedHero !== heroUrl
        ? <img src={heroUrl} alt={heroLabel} className="story-artwork-hero" onError={() => setFailedHero(heroUrl)} draggable={false} referrerPolicy="no-referrer" />
        : <ArborMascot size={120} mood="wave" animate={false} className="story-artwork-hero" />}
    </div>
    {unavailable && <div className="story-artwork-recovery" data-story-picture-recovery="">
      <p role="status">{bookString("picture.unavailable", lang)}</p>
      <button type="button" data-story-picture-retry="" aria-label={bookString("picture.retry", lang)} onClick={() => setAttempt(value => value + 1)}>
        <Icon name="replay" size={22} /><span>{bookString("picture.retry", lang)}</span>
      </button>
    </div>}
  </div>;
}
