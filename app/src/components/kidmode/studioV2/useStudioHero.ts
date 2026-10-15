import { useArbor } from '../../../context/ArborContext';
import { useHeroAvatar } from '../../ui/HeroAvatar';
import { useHeroSheetState } from '../hero/useHeroSheet';

/** One character authority across Studio and Sneak & Freeze. The shared chain
 * scopes sprites to the owner, child and current avatar, and retires stale art.
 * Reuse existing poses; opening a game never generates or redraws the child. */
export function useStudioHero() {
  const { childProfile } = useArbor();
  const hero = useHeroAvatar();
  const character = useHeroSheetState(childProfile);
  const sheet = character.from === 'avatar' || character.from === 'placeholder' ? null : character.sheet;
  return { ...hero, sheet, character };
}
