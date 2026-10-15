import { useArbor } from '../../../context/ArborContext';
import { HeroAvatar, useHeroAvatar } from '../../ui/HeroAvatar';
import { HeroFigure } from '../hero/HeroFigure';
import { useHeroSheetState } from '../hero/useHeroSheet';

/** Exactly the Studio home's identity rule: current matching approved sheet,
 * otherwise the same canonical portrait; Sprout when no hero exists. */
export function StudioPlayHero({ size = 92, celebrate = false, className = '' }: { size?: number; celebrate?: boolean; className?: string }) {
  const { childProfile } = useArbor();
  const hero = useHeroAvatar();
  const state = useHeroSheetState(childProfile);
  const hasPose = !!hero.url && state.from === 'child';
  return <span className={`studio-play-hero ${className}`} data-game-hero-source={hasPose ? 'current-sheet' : hero.url ? 'current-portrait' : 'mascot'} style={{ width: size, height: size }} aria-hidden="true">
    {hasPose ? <HeroFigure sheet={state.sheet} pose={celebrate ? 'cheer' : 'idle'} height={size} x={size / 2} y={size} /> : <HeroAvatar size={size} mood={celebrate ? 'cheer' : 'wave'} animate={false} ring={false} decorative />}
  </span>;
}
