import { useState } from "react";
import { useHeroAvatar } from "../../ui/HeroAvatar";
import { ArborMascot } from "../../ui/ArborMascot";

/** Always the current approved image; never a raw upload or a generic child. */
export function StudioPortrait({ className = "", label = "", fallback = true }: { className?: string; label?: string; fallback?: boolean }) {
  const hero = useHeroAvatar();
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={className}>{hero.url && failed !== hero.url ? <img key={hero.url} src={hero.url} alt={label} onError={() => setFailed(hero.url)} draggable={false} referrerPolicy="no-referrer" /> : fallback ? <ArborMascot size={90} mood="wave" animate={false} /> : null}</span>;
}
