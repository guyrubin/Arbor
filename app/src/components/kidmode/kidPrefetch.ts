import { cachedModule, scheduleModulePreload } from '../../lib/modulePreload';
import type { StudioActivityId } from './studioV2/studioCatalog';

/** One loader authority for both lazy rendering and selected-game warm-up.
 * These factories do not fetch or evaluate a game until called. */
export const STUDIO_ACTIVITY_LOADERS = {
  'river-rescue': cachedModule(() => import('./studioV2/games/adventures/RiverRescue')),
  'feelings-forest': cachedModule(() => import('./studioV2/games/adventures/FeelingsForest')),
  'rhythm-garden': cachedModule(() => import('./studioV2/games/adventures/RhythmGarden')),
  memory: cachedModule(() => import('../practice/MindVaultWorld')),
  feelings: cachedModule(() => import('../practice/FeelingsLabTab')),
  pattern: cachedModule(() => import('../practice/PatternPowerWorld')),
  beat: cachedModule(() => import('../practice/BeatKeeperWorld')),
  sneak: cachedModule(() => import('./games/sneakFreeze/SneakFreeze')),
  'calm-builder': cachedModule(() => import('./studioV2/games/CalmBuilder')),
  puzzle: cachedModule(() => import('./studioV2/games/PuzzlePlanet')),
  'sound-explorer': cachedModule(() => import('./studioV2/games/SoundExplorer')),
};

/** Home prepares only navigation shells, not eighteen unrelated activities. */
export const KID_SURFACE_CHUNKS: readonly (() => Promise<unknown>)[] = [
  cachedModule(() => import('./studioV2/StudioWorld')),
  cachedModule(() => import('./studioV2/StudioGame')),
];

/** The caller owns cancellation. Repeated mounts reuse the module promises. */
export function prefetchKidSurfaces(): () => void {
  return scheduleModulePreload(KID_SURFACE_CHUNKS);
}

/** A selected, eligible game's intro prepares the exact lazy component before
 * Play. No model calls, profile writes, microphone, or camera activation. */
export function preloadStudioActivity(id: StudioActivityId): Promise<unknown> {
  const loader = Object.hasOwn(STUDIO_ACTIVITY_LOADERS, id)
    ? STUDIO_ACTIVITY_LOADERS[id as keyof typeof STUDIO_ACTIVITY_LOADERS] : undefined;
  return loader ? loader() : Promise.resolve();
}
