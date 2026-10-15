import { useEffect, useRef } from 'react';
import { Check, Leaf, Sparkles, Volume2 } from 'lucide-react';
import type { Challenge } from './adventureRules';
import type { AdventureWords } from './adventureCopy';
import './adventures.css';
import { useLanguage } from '../../../../../context/LanguageContext';
import { useKidTheme } from '../../../../../hooks/useKidTheme';
import { kidArt, kidArtSrcSet } from '../../../../../lib/kidThemeManifest';

export function ChallengePicker({ value, onChange, words }: { value: Challenge; onChange: (value: Challenge) => void; words: AdventureWords }) {
  return <div className="adventure-challenge" role="group" aria-label={words.challenge}>
    {(['gentle', 'explore'] as const).map(level => <button type="button" key={level} aria-pressed={value === level} onClick={() => onChange(level)}>
      {level === 'gentle' ? <Leaf size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}{words[level]}
    </button>)}
  </div>;
}
export function AdventureSteps({ done, total = 3 }: { done: number; total?: number }) {
  return <div className="adventure-steps" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} data-done={i < done} data-current={i === done}>{i < done ? <Check size={15} /> : <Leaf size={15} />}</span>)}</div>;
}
export function AdventureHeading({ children, focusKey, onHear, muted = false }: { children: React.ReactNode; focusKey: string | number; onHear?: () => void; muted?: boolean }) {
  const { uiLang } = useLanguage();
  const ref = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current) ref.current?.focus({ preventScroll: true }); mounted.current = true; }, [focusKey]);
  return <div className="adventure-prompt"><h2 className="adventure-heading" tabIndex={-1} ref={ref}>{children}</h2>{onHear && <button type="button" className="adventure-guide-replay" disabled={muted} onClick={onHear} aria-label={uiLang === 'he' ? 'לשמוע את נבט' : 'Hear Sprout'}><Volume2 size={20} aria-hidden="true" /></button>}</div>;
}
/** Neutral authored environment; profile identity is always a separate layer. */
export function AdventureScenery({ world }: { world: 'story-theater' | 'sound-orbit' }) {
  const theme = useKidTheme();
  const art = kidArt(theme, world === 'sound-orbit' ? 'world.rhythm-garden.tile' : 'world.feelings-forest.tile');
  if (art && !art.hasHero) return <img className="adventure-scenery" src={art.src} srcSet={kidArtSrcSet(art)} sizes="(max-width: 700px) 100vw, 1000px" alt="" draggable={false} decoding="async" style={{ objectFit: 'cover', objectPosition: art.objectPosition }} />;
  return <span className="adventure-scenery adventure-scenery--fallback" data-world-scenery={world} aria-hidden="true" />;
}
