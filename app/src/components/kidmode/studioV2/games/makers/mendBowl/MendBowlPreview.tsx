import { useId } from 'react';
import '../makerPalette.css';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import type { BowlCreation } from './mendBowlRules';
import { KitTable, MendedBowl } from './BowlArt';

/** The saved bowl, in the result card and the gallery: drawn from
 * {glaze, pattern, seams} alone with the same art as the end of play (the
 * mended bowl on the workshop table's linen), so it reopens exactly as the
 * child left it. */
export default function MendBowlPreview({ creation }: { creation: BowlCreation }) {
  const { uiLang } = useLanguage();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return <svg viewBox="92 96 256 256" style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block', marginInline: 'auto', borderRadius: 14 }} role="img" aria-label={MEND_BOWL_COPY[uiLang === 'he' ? 'he' : 'en'].keep} data-glaze={creation.glaze} data-pattern={creation.pattern} data-seams={creation.seams.join(' ')}>
    <KitTable />
    <MendedBowl glaze={creation.glaze} pattern={creation.pattern} uid={`${uid}b`} />
  </svg>;
}
