import { useEffect, useRef } from 'react';
import { Check, Leaf, Sparkles } from 'lucide-react';
import type { Challenge } from './adventureRules';
import type { AdventureWords } from './adventureCopy';
import './adventures.css';
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
export function AdventureHeading({ children, focusKey }: { children: React.ReactNode; focusKey: string | number }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  useEffect(() => { if (mounted.current) ref.current?.focus({ preventScroll: true }); mounted.current = true; }, [focusKey]);
  return <h2 className="adventure-heading" tabIndex={-1} ref={ref}>{children}</h2>;
}
/** Original vector scenery: decorative environment, never a substitute child. */
export function GardenScenery({ night = false }: { night?: boolean }) {
  const theme = useKidTheme();
  const art = kidArt(theme, night ? 'world.rhythm-garden.tile' : 'world.feelings-forest.tile');
  if (art && !art.hasHero) return <img className="adventure-scenery" src={art.src} srcSet={kidArtSrcSet(art)} sizes="(max-width: 700px) 100vw, 1000px" alt="" draggable={false} decoding="async" style={{ objectFit: 'cover', objectPosition: art.objectPosition }} />;
  return <svg className="adventure-scenery" viewBox="0 0 800 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="800" height="460" fill={night ? 'var(--arbor-lav-soft)' : 'var(--arbor-sky-soft)'} />
    <circle cx="650" cy="75" r="44" fill="var(--arbor-peach-soft)" />
    <path d="M0 190Q170 95 330 220T800 150V460H0" fill="var(--arbor-green-soft)" />
    <path d="M0 300Q190 155 400 300T800 230V460H0" fill="var(--arbor-green)" />
    <path d="M0 385Q260 270 470 365T800 320V460H0" fill="var(--arbor-green-ink)" />
    {[45, 110, 718, 770].map((x, i) => <g key={x} transform={`translate(${x} ${235 + i % 2 * 45})`}><path d="M0 145V10" stroke="var(--arbor-ink-soft)" strokeWidth="12" strokeLinecap="round" /><ellipse cy="-10" rx="42" ry="72" fill={i % 2 ? 'var(--arbor-green)' : 'var(--arbor-green-ink)'} /><path d="M0 50l-23-20M0 20l22-22" stroke="var(--arbor-green-soft)" strokeWidth="4" fill="none" strokeLinecap="round" /></g>)}
    {[70, 185, 655, 740].map((x, i) => <g key={x} transform={`translate(${x} ${405 - i % 2 * 24})`}><path d="M0 14V-8" stroke="var(--arbor-green-ink)" strokeWidth="4" /><circle cy="-10" r="10" fill={i % 2 ? 'var(--arbor-pink-soft)' : 'var(--arbor-peach-soft)'} /><circle cy="-10" r="4" fill="var(--arbor-clay-deep)" /></g>)}
  </svg>;
}
