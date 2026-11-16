import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../makerPalette.css';
import { StillContent, TINT_STYLE } from './BottleArt';
import { refractionMap } from './bottleRefraction';

const STICKERS = [{ art: 'star', slot: 0 }, { art: 'leaf', slot: 4 }, { art: 'heart', slot: 11 }] as const;

/** Bottle Lab cover: the tile art, the book row, the intro/result window and
 * the round sticker. One scene for every size: a sea-glass round bottle with
 * three stickers on the cream table, the wall's bands bending through it.
 * The crop keeps the bottle whole from a square tile to a tall book-row
 * cover to a wide card; the lamp shows only where there is room for it. */
export default function BottleLabCover({ size = 'tile' }: { size?: 'tile' | 'card' }) {
  const uid = useId();
  // The cover is drawn in many places, some outside the language provider:
  // it reads the reading direction from the page around it.
  const box = useRef<SVGSVGElement>(null);
  const [rtl, setRtl] = useState(false);
  useLayoutEffect(() => { setRtl(box.current?.closest('[dir]')?.getAttribute('dir') === 'rtl'); }, []);
  const map = useMemo(() => refractionMap('round'), []);
  // A tile is square-ish and a book cover tall: the bottle in the middle. A
  // card window is wide and the Studio stands the guide at its reading end:
  // the bottle sits to the other side, with the whole lamp arc in view.
  return <svg ref={box} viewBox={size !== 'card' ? '-40 40 440 420' : rtl ? '-240 46 660 372' : '-60 46 660 372'} preserveAspectRatio="xMidYMid slice" style={{ ...TINT_STYLE.sea, width: '100%', height: '100%', display: 'block' }} data-size={size} aria-hidden="true" focusable="false">
    <StillContent uid={`c${uid}`} shape="round" finish="gloss" stickers={STICKERS} rotation={-28} lamp={-38} map={map} showLamp={size === 'card'} />
  </svg>;
}
