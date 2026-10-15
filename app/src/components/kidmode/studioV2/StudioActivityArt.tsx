import './studioActivityArt.css';
import { Brain, AudioLines, Theater, Puzzle, Route, Sailboat, Shapes, Sofa } from 'lucide-react';
import { useKidTheme } from '../../../hooks/useKidTheme';
import { kidArt, kidArtSrcSet, type KidArtKey } from '../../../lib/kidThemeManifest';
import { studioActivity, type StudioActivityId } from './studioCatalog';

const glyphs = { 'river-rescue': Sailboat, 'feelings-forest': Theater, 'rhythm-garden': AudioLines, memory: Brain, pattern: Shapes, puzzle: Puzzle, 'calm-builder': Sofa, sneak: Route };
/** Distinct game landmarks, with profile identity kept out of shared imagery. */
export function StudioActivityArt({ id }: { id: StudioActivityId }) {
  const theme = useKidTheme();
  const activity = studioActivity(id);
  const key = id === 'sneak' ? 'studio.portal.playbank' : `world.${id}.tile`;
  const candidate = kidArt(theme, key as KidArtKey) ?? (activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null);
  const fallback = activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null;
  const art = candidate && !candidate.hasHero ? candidate : fallback && !fallback.hasHero ? fallback : null;
  const Glyph = glyphs[id as keyof typeof glyphs] ?? Shapes;
  return <span className="studio-activity-picture" data-activity-art={id} aria-hidden="true">
    {art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 640px) 40vw, 280px" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
    <span className="studio-activity-picture__symbol"><Glyph size={30} strokeWidth={1.7} /></span>
  </span>;
}
