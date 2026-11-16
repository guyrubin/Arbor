import './studioActivityArt.css';
import './games/makers/makerPalette.css';
import { lazy, Suspense, type ComponentType } from 'react';
import type { StudioMakerId } from './studioCatalog';
import type { BowlCreation } from './games/makers/mendBowl/mendBowlRules';
import type { TextileCreation } from './games/makers/stitchGarden/stitchGardenRules';
import type { BottleCreation } from './games/makers/bottleLab/bottleLabRules';

/** The makers have no raster art: each draws its own SVG Cover (tile, sticker,
 * intro/result window) and the two creation makers a Preview of what was
 * kept. Each is its own small lazy chunk, fetched only where it is shown (a
 * world list, a game card, a keepsake), never by Studio Home; the box keeps
 * its size while the chunk arrives, so nothing shifts. */
type Cover = ComponentType<{ size?: 'tile' | 'card' }>;
const COVERS: Record<StudioMakerId, Cover> = {
  'mend-bowl': lazy(() => import('./games/makers/mendBowl/MendBowlCover')),
  'stitch-garden': lazy(() => import('./games/makers/stitchGarden/StitchGardenCover')),
  'paper-boat': lazy(() => import('./games/makers/paperBoat/PaperBoatCover')),
  'season-dial': lazy(() => import('./games/makers/seasonDial/SeasonDialCover')),
  'crank-works': lazy(() => import('./games/makers/crankWorks/CrankWorksCover')),
  'windup-race': lazy(() => import('./games/makers/windupRace/WindupRaceCover')),
  'clay-theatre': lazy(() => import('./games/makers/clayTheatre/ClayTheatreCover')),
  'bottle-lab': lazy(() => import('./games/makers/bottleLab/BottleLabCover')),
  'ice-age-friend': lazy(() => import('./games/makers/iceAgeFriend/IceAgeFriendCover')),
  'tiny-builders': lazy(() => import('./games/makers/tinyBuilders/TinyBuildersCover')),
  'fox-trail': lazy(() => import('./games/makers/foxTrail/FoxTrailCover')),
  'maker-desk': lazy(() => import('./games/makers/makerDesk/MakerDeskCover')),
};
const BowlPreview = lazy(() => import('./games/makers/mendBowl/MendBowlPreview'));
const TextilePreview = lazy(() => import('./games/makers/stitchGarden/StitchGardenPreview'));
const BottlePreview = lazy(() => import('./games/makers/bottleLab/BottleLabPreview'));
/** The saved kinds a maker draws (StudioCreationResult hands these here). */
export type MakerCreation = BowlCreation | TextileCreation | BottleCreation;
export const isMakerCreation = (c: { kind: string }): c is MakerCreation => c.kind === 'bowl' || c.kind === 'textile' || c.kind === 'bottle';

/** Fills its parent box (the parent sets the size). Decorative. */
export function StudioMakerCover({ id, size = 'tile' }: { id: StudioMakerId; size?: 'tile' | 'card' }) {
  const Art = COVERS[id];
  return <span className="studio-maker-cover" data-maker-cover={id} data-size={size} aria-hidden="true"><Suspense fallback={null}><Art size={size} /></Suspense></span>;
}

export function StudioMakerPreview({ creation }: { creation: MakerCreation }) {
  return <Suspense fallback={<span className="studio-maker-preview-wait" />}>{creation.kind === 'bowl' ? <BowlPreview creation={creation} /> : creation.kind === 'textile' ? <TextilePreview creation={creation} /> : <BottlePreview creation={creation} />}</Suspense>;
}
