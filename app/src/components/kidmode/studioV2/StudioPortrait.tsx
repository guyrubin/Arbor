import { useState } from "react";
import { useHeroAvatar } from "../../ui/HeroAvatar";
import { ArborMascot } from "../../ui/ArborMascot";

/** Always the current approved image; never a raw upload or a generic child. */
export function StudioPortrait({ className = "", label = "", fallback = true }: { className?: string; label?: string; fallback?: boolean }) {
  const hero = useHeroAvatar();
  const [failed, setFailed] = useState<string | null>(null);
  const shown = Boolean(hero.url && failed !== hero.url);
  // Without a picture and without the Sprout fallback there is nothing to frame, so no empty ring is drawn.
  if (!shown && !fallback) return null;
  return <span className={className}>{shown ? <img key={hero.url} src={hero.url!} alt={label} onError={() => setFailed(hero.url)} draggable={false} referrerPolicy="no-referrer" /> : <ArborMascot size={90} mood="wave" animate={false} />}</span>;
}
