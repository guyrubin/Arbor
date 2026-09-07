import React, { useEffect, useRef, useState } from "react";
import { api, type AvatarStyle } from "../../lib/api";
import { dedupeScene, getScene } from "../../lib/sceneCache";
import { runInstrumented } from "../../hooks/useAsyncAction";

/* WorldScene — one visual identity for every child world.
   The generated comic hero is the consistency reference: the same child identity
   travels through stories, feelings and every Playbank world. Generation stays
   lazy + persistently cached; static comic art supplied by the caller remains the
   first-paint fallback, so a world is never blank and unseen cards cost nothing. */

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
}: {
  worldId: string;
  imagePrompt: string;
  heroUrl?: string;
  heroStyle?: AvatarStyle;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [art, setArt] = useState<string | undefined>(() =>
    heroUrl ? getScene(`world-v2|${worldId}|${shortHash(heroUrl)}`) : undefined,
  );

  useEffect(() => {
    if (!heroUrl || art) return;
    // v2 intentionally invalidates the older mixed-style cache once. From here
    // on, each child/world pair remains stable and cost-guarded.
    const key = `world-v2|${worldId}|${shortHash(heroUrl)}`;
    const cached = getScene(key);
    if (cached) { setArt(cached); return; }

    const el = ref.current;
    if (!el) return;
    let active = true;

    const generate = () => {
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
        .then((url) => { if (active) setArt(url); })
        .catch(() => { /* graceful: keep the supplied static comic fallback */ });
    };

    if (typeof IntersectionObserver === "undefined") { generate(); return () => { active = false; }; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); generate(); }
    }, { rootMargin: "160px" });
    obs.observe(el);
    return () => { active = false; obs.disconnect(); };
  }, [worldId, imagePrompt, heroUrl, heroStyle, art]);

  return (
    <div ref={ref} className="absolute inset-0">
      {art ? (
        <img src={art} alt="" aria-hidden="true" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center">{children}</div>
      )}
    </div>
  );
}
