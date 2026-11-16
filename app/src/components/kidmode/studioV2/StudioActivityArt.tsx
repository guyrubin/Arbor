import './studioActivityArt.css';
import { Icon } from '../../ui/Icon';
import { useKidTheme } from '../../../hooks/useKidTheme';
import { isStudioCoverId, kidArt, kidArtSrcSet, studioNextCover, type KidArtKey } from '../../../lib/kidThemeManifest';
import { isStudioMakerId, studioActivity, type StudioActivityId } from './studioCatalog';
import { StudioMakerCover } from './StudioMakerArt';

const glyphs = { 'river-rescue': 'water', 'feelings-forest': 'mood', 'rhythm-garden': 'graphic_eq', memory: 'psychology', pattern: 'category', puzzle: 'extension', 'calm-builder': 'weekend', sneak: 'route', 'mend-bowl': 'palette', 'stitch-garden': 'spa', 'paper-boat': 'auto_stories', 'season-dial': 'wb_sunny', 'crank-works': 'settings', 'windup-race': 'flag', 'clay-theatre': 'celebration', 'bottle-lab': 'science', 'ice-age-friend': 'landscape', 'tiny-builders': 'domain', 'fox-trail': 'park', 'maker-desk': 'monitor' };
/** Distinct game landmarks, with profile identity kept out of shared imagery. */
export function StudioActivityArt({ id }: { id: StudioActivityId }) {
  const theme = useKidTheme();
  const activity = studioActivity(id);
  // Each Playbank game has its own film cover; the rest show their world's room.
  const key = isStudioCoverId(id) ? `studio.cover.${id}` : `world.${id}.tile`;
  const candidate = kidArt(theme, key as KidArtKey) ?? (activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null);
  const fallback = activity ? kidArt(theme, `studio.portal.${activity.worldId}`) : null;
  const art = candidate && !candidate.hasHero ? candidate : fallback && !fallback.hasHero ? fallback : null;
  // A device that opted in to the next games sees that game's own cover.
  const cover = studioNextCover(id);
  const glyph = cover && id === 'river-rescue' ? 'route' : glyphs[id as keyof typeof glyphs] ?? 'category';
  return <span className="studio-activity-picture" data-activity-art={id} aria-hidden="true">
    {isStudioMakerId(id) ? <StudioMakerCover id={id} /> : cover ? <img src={cover.src480} srcSet={cover.srcSet} sizes="(max-width: 640px) 40vw, 280px" alt="" draggable={false} decoding="async" /> : art && <img src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(max-width: 640px) 40vw, 280px" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
    <span className="studio-activity-picture__symbol"><Icon name={glyph} size={21} weight={400} /></span>
  </span>;
}
