import type { StudioCreation } from '../../../studioCreations';
import { StudioMakerPreview, isMakerCreation } from '../../../StudioMakerArt';
import { DESK_KIT } from './deskKit';

/** One saved creation at show-step size. The three makers draw their own
 * preview (whatever those components give us, at this size). The older kinds
 * stand as a kit keepsake chosen by what was saved: a tune is the music pad of
 * its first note, a dance is the knit flower band, a cosy world is its cushion
 * (or its sketchbook when it has books). Shipped kit art only. */
const NOTE_PAD = [DESK_KIT.tileYellow, DESK_KIT.tileBlue, DESK_KIT.tilePink] as const;

export function DeskThing({ creation, label }: { creation: StudioCreation; label: string }) {
  if (isMakerCreation(creation)) return <span className="md-thing md-thing--maker" data-thing={creation.kind}><StudioMakerPreview creation={creation} /></span>;
  const art = creation.kind === 'melody' ? NOTE_PAD[creation.notes[0] ?? 0] ?? NOTE_PAD[0]
    : creation.kind === 'dance' ? DESK_KIT.band
    : creation.kind === 'corner' && creation.layout.includes('books') ? DESK_KIT.journal : DESK_KIT.cushion;
  return <span className="md-thing md-thing--kit" data-thing={creation.kind} role="img" aria-label={label}>
    <img src={art.src} alt="" draggable={false} decoding="async" />
  </span>;
}
