import React, { useEffect, useRef, useState } from "react";
import { api, type AvatarStyle } from "../../lib/api";
import { dedupeScene, getScene } from "../../lib/sceneCache";
import { runInstrumented } from "../../hooks/useAsyncAction";

/* WorldScene (backlog I1) — the illustrated scene for a Hero-Arcade world card.
   When the child has a generated hero, we generate a themed scene that STARS
   their hero (the avatar is the consistency reference) and cache it persistently
   (sceneCache → cost guard). No hero yet, still loading, or a failure → the icon
   fallback (children) keeps the card alive. Generation is lazy: it only fires
   once the card scrolls into view, so off-screen worlds never spend on an image. */

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
  children: React.ReactNode; // icon fallback
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [art, setArt] = useState<string | undefined>(() =>
    heroUrl ? getScene(`world|${worldId}|${shortHash(heroUrl)}`) : undefined,
  );

  useEffect(() => {
    if (!heroUrl || art) return;
    const key = `world|${worldId}|${shortHash(heroUrl)}`;
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
              imagePrompt: `${imagePrompt} — bright, bold kids' comic-book illustration, the child as the cheerful hero`,
              avatar: { dataUrl: ref },
              style: heroStyle ?? "comichero",
            }),
          ).then((r) => r.dataUrl),
        ),
      )
        .then((url) => { if (active) setArt(url); })
        .catch(() => { /* graceful: keep the icon fallback */ });
    };

    // Lazy: only generate when the card is on screen (cost guard for unseen worlds).
    if (typeof IntersectionObserver === "undefined") { generate(); return () => { active = false; }; }
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { obs.disconnect(); generate(); }
    }, { rootMargin: "120px" });
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
