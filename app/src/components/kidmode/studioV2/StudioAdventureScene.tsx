import { useKidTheme } from '../../../hooks/useKidTheme';
import { kidArt, kidArtSrcSet } from '../../../lib/kidThemeManifest';
import './studioAdventureScene.css';

export type StudioAdventureId = 'river-rescue' | 'feelings-forest' | 'rhythm-garden';
export function isStudioAdventure(id: string): id is StudioAdventureId {
  return id === 'river-rescue' || id === 'feelings-forest' || id === 'rhythm-garden';
}

/** Neutral scenery only. The accepted profile image / reviewed actor is a
 * separate immutable identity layer; scene generation must not redraw it. */
export function StudioAdventureScene({ activityId }: { activityId: StudioAdventureId }) {
  const theme = useKidTheme();
  const art = kidArt(theme, `world.${activityId}.tile`);
  return <div className="studio-adventure-scene" data-adventure-scene={activityId} aria-hidden="true">
    {art && !art.hasHero && <img src={art.src} srcSet={kidArtSrcSet(art)} sizes="(max-width: 700px) 100vw, 720px" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
  </div>;
}
