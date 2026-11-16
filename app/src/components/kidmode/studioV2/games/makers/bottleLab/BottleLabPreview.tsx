import { useLanguage } from '../../../../../../context/LanguageContext';
import { BOTTLE_LAB_COPY } from './bottleLabCopy';
import type { BottleCreation } from './bottleLabRules';

const TINT = { clear: 'var(--studio-canvas-soft)', sea: 'color-mix(in srgb, var(--arbor-sage) 35%, var(--studio-canvas))', amber: 'color-mix(in srgb, var(--studio-action-gold) 12%, var(--studio-canvas))', rose: 'color-mix(in srgb, var(--arbor-pink) 35%, var(--studio-canvas))' } as const;
const SHAPE = { round: 'M88 20h24v18c22 8 34 26 34 48 0 24-18 40-46 40s-46-16-46-40c0-22 12-40 34-48z', tall: 'M90 14h20v26c12 6 16 16 16 30v52c0 10-8 16-26 16s-26-6-26-16V70c0-14 4-24 16-30z', flask: 'M90 16h20v40l34 58c4 8-2 16-12 16H68c-10 0-16-8-12-16l34-58z' } as const;
/** The saved bottle, in the result card and the gallery. Placeholder: the
 * shape in its tint and one gold dot per sticker slot. Replaced by the builder. */
export default function BottleLabPreview({ creation }: { creation: BottleCreation }) {
  const { uiLang } = useLanguage();
  return <svg viewBox="0 0 200 140" style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', marginInline: 'auto' }} role="img" aria-label={BOTTLE_LAB_COPY[uiLang === 'he' ? 'he' : 'en'].keep} data-shape={creation.shape} data-tint={creation.tint} data-finish={creation.finish}>
    <path d={SHAPE[creation.shape]} fill={TINT[creation.tint]} opacity={creation.finish === 'frost' ? .75 : 1} />
    {creation.stickers.map(sticker => <circle key={sticker.slot} data-art={sticker.art} cx={70 + (sticker.slot % 4) * 20} cy={66 + Math.floor(sticker.slot / 4) * 18} r="6" style={{ fill: 'var(--studio-action-gold)' }} />)}
  </svg>;
}
