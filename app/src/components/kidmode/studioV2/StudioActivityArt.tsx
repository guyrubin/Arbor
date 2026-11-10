import './studioActivityArt.css';
import { Icon } from '../../ui/Icon';
import { useKidTheme } from '../../../hooks/useKidTheme';
import { kidArt, kidArtSrcSet, type KidArtKey } from '../../../lib/kidThemeManifest';
import { studioActivity, type StudioActivityId } from './studioCatalog';

const glyphs = { 'river-rescue': 'water', 'feelings-forest': 'mood', 'rhythm-garden': 'graphic_eq', memory: 'psychology', pattern: 'category', puzzle: 'extension', 'calm-builder': 'weekend', sneak: 'route' };
/** Distinct game landmarks, with profile identity kept out of shared imagery. */
export function StudioActivityArt({ id }: { id: StudioActivityId }) {
  const theme = useKidTheme();
  const activity = studioActivity(id);
  const key = id === 'sneak' ? 'studio.portal.playbank' : `world.${id}.tile`;
  const candidate = kidArt(theme, key as KidArtKey) ?? (activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null);
  const fallback = activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null;
  const art = candidate && !candidate.hasHero ? candidate : fallback && !fallback.hasHero ? fallback : null;
  const glyph = glyphs[id as keyof typeof glyphs] ?? 'category';
  return <span className="studio-activity-picture" data-activity-art={id} aria-hidden="true">
    {art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 640px) 40vw, 280px" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
    <span className="studio-activity-picture__symbol"><Icon name={glyph} size={21} weight={400} /></span>
  </span>;
}
