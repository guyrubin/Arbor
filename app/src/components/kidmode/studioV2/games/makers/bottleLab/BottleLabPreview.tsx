import { useId, useMemo } from 'react';
import '../makerPalette.css';
import { useLanguage } from '../../../../../../context/LanguageContext';
import { StillContent, TINT_STYLE } from './BottleArt';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import { LAMP_START, bestViewRotation, type BottleCreation } from './bottleLabRules';
import { refractionMap } from './bottleRefraction';

/** The kept bottle, in the result card and the gallery: drawn from the saved
 * creation alone, with the same layers as play, turned to the three-quarter
 * view that shows the most stickers, under the lamp's starting light. */
export default function BottleLabPreview({ creation }: { creation: BottleCreation }) {
  const { uiLang } = useLanguage();
  const uid = useId();
  const map = useMemo(() => refractionMap(creation.shape, creation.finish === 'frost'), [creation.shape, creation.finish]);
  const rotation = bestViewRotation(creation.stickers);
  return <svg viewBox="-50 70 460 345" preserveAspectRatio="xMidYMid slice" style={{ ...TINT_STYLE[creation.tint], width: '100%', maxWidth: 240, height: 'auto', aspectRatio: '4 / 3', display: 'block', marginInline: 'auto', borderRadius: 18 }} role="img" aria-label={BOTTLE_LAB_COPY[uiLang === 'he' ? 'he' : 'en'].keep} data-shape={creation.shape} data-tint={creation.tint} data-finish={creation.finish} data-rotation={rotation}>
    <StillContent uid={`p${uid}`} shape={creation.shape} finish={creation.finish} stickers={creation.stickers} rotation={rotation} lamp={LAMP_START} map={map} showLamp={false} />
  </svg>;
}
