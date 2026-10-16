import { HeroAvatar } from '../../ui/HeroAvatar';
import type { HeroPoseId } from '../hero/heroSheet';
import { HeroFigure } from '../hero/HeroFigure';
import { avatarFallbackSheet } from '../hero/useHeroSheet';
import { useStudioHero } from './useStudioHero';

/** The same full character and pose renderer as Sneak & Freeze. Never draw a
 * new face, crop a sprite into a badge, or put the player behind a frame. */
export function StudioPlayHero({ size = 92, celebrate = false, className = '', pose = 'idle', kick = 0 }: { size?: number; celebrate?: boolean; className?: string; pose?: HeroPoseId; kick?: number }) {
  const hero = useStudioHero();
  const sheet = hero.sheet ?? (hero.url ? avatarFallbackSheet(hero.url) : null);
  return <span className={`studio-play-hero ${className}`} data-game-hero-source={hero.sheet ? 'current-character' : hero.url ? 'current-portrait' : 'mascot'} style={{ width: size, height: size }} aria-hidden="true">
    {sheet ? <HeroFigure sheet={sheet} pose={celebrate ? 'cheer' : pose} height={size} x={size / 2} y={size} kick={kick} /> : <HeroAvatar size={size} mood={celebrate ? 'cheer' : 'wave'} animate={false} ring={false} decorative />}
  </span>;
}
