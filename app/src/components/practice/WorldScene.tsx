import React, { useEffect, useRef, useState } from "react";
import { api, type AvatarStyle } from "../../lib/api";
import { dedupeScene, getScene } from "../../lib/sceneCache";
import { worldArtwork } from "./worldArtwork";
import { runInstrumented } from "../../hooks/useAsyncAction";

/* WorldScene — one visual identity for every child world.
   The generated comic hero is the consistency reference: the same child identity
   travels through stories, feelings and every Playbank world. Generation stays
   lazy + memory-only cached; static comic art supplied by the caller remains the
   first-paint fallback, so a world is never blank and unseen cards cost nothing.
   All callers use noninteractive decorative art slots; the surrounding destination
   label supplies meaning, so covered fallback avatars are also hidden from AT. */

const shortHash = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

/* The generators want the avatar as a data URL reference. If the stored hero is
   an https Storage URL, fetch + convert it once (memoized across all cards so a
   whole grid shares a single fetch). Data URLs pass straight through. */
const avatarDataCache = new Map<string, Promise<string>>();
function toAvatarDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  const cached = avatarDataCache.get(url);
  if (cached) return cached;
  const p = fetch(url)
    .then((r) => r.blob())
    .then((blob) => new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    }));
  avatarDataCache.set(url, p);
  return p;
}

const ARBOR_COMIC_BIBLE = [
  "premium contemporary children's graphic-novel illustration",
  "keep the supplied child unmistakably the same comic hero — preserve face, hair, age and defining features",
  "expressive clean ink linework with softly painted detail, not 3D animation and not flat vector art",
  "rich storybook environment with clear foreground, midground and background depth",
  "warm cinematic child-safe lighting, sophisticated saturated color and subtle paper-and-ink texture",
  "the hero is actively interacting with this world rather than posing for a portrait",
  "composition must still read clearly as a game or story card crop at small size",
  "no text, no UI, no logos, no photorealism",
].join("; ");

export default function WorldScene({
  worldId,
  imagePrompt,
  heroUrl,
  heroStyle,
  children,
  sizes = "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 240px",
}: {
  worldId: string;
  imagePrompt: string;
  heroUrl?: string;
  heroStyle?: AvatarStyle;
  children: React.ReactNode;
  sizes?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const key = heroUrl ? `world-v2|${worldId}|${shortHash(heroUrl)}` : null;
  const [resolved, setResolved] = useState<{ key: string; url: string } | null>(() => {
    const url = key ? getScene(key) : undefined;
    return key && url ? { key, url } : null;
  });
  const [failedGenerated, setFailedGenerated] = useState<{ key: string | null; url: string } | null>(null);
  const [failedStatic, setFailedStatic] = useState<string | null>(null);
  // A previous key's result is never displayed, even before effect cleanup runs.
  const art = key ? (resolved?.key === key ? resolved.url : getScene(key)) : undefined;
  const generated = art && !(failedGenerated?.key === key && failedGenerated.url === art) ? art : undefined;
  const fallback = worldArtwork(worldId);

  useEffect(() => {
    if (!heroUrl || !key) return;
    // v2 intentionally invalidates the older mixed-style cache once. From here
    // on, each child/world pair remains stable and cost-guarded.
    const cached = getScene(key);
    if (cached) { setResolved({ key, url: cached }); return; }

    const el = ref.current;
    if (!el) return;
    let active = true;

    let started = false;
    const generate = () => {
      if (started || !active) return;
      started = true;
      dedupeScene(key, () =>
        toAvatarDataUrl(heroUrl).then((ref) =>
          runInstrumented("world_scene", () =>
            api.generateScene({
              imagePrompt: `${imagePrompt}. Art direction: ${ARBOR_COMIC_BIBLE}`,
              avatar: { dataUrl: ref },
              style: heroStyle ?? "comichero",
            }),
          ).then((r) => r.dataUrl),
        ),
      )
        .then((url) => { if (active) setResolved({ key, url }); })
        .catch(() => { /* graceful: keep the supplied static comic fallback */ });
    };

    if (typeof IntersectionObserver === "undefined") { generate(); return () => { active = false; }; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); generate(); }
    }, { rootMargin: "160px" });
    obs.observe(el);
    return () => { active = false; obs.disconnect(); };
  }, [key, imagePrompt, heroUrl, heroStyle]);

  return (
    <div ref={ref} aria-hidden="true" className="absolute inset-0">
      <div className="w-full h-full grid place-items-center">{children}</div>
      {generated ? (
        <img key={generated} src={generated} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" onError={() => setFailedGenerated({ key, url: generated })} />
      ) : fallback && failedStatic !== fallback.src ? (
        <img key={fallback.src} src={fallback.src} srcSet={fallback.srcSet} sizes={sizes} width={960} height={640} alt="" aria-hidden="true" loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: fallback.objectPosition }} onError={() => setFailedStatic(fallback.src)} />
      ) : null}
    </div>
  );
}
