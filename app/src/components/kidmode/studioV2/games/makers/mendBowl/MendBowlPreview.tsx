import { useLanguage } from '../../../../../../context/LanguageContext';
import { MEND_BOWL_COPY } from './mendBowlCopy';
import type { BowlCreation } from './mendBowlRules';

const GLAZE = { celadon: 'color-mix(in srgb, var(--arbor-sage) 35%, var(--studio-canvas))', indigo: 'color-mix(in srgb, var(--arbor-sky-ink) 70%, var(--studio-canvas))', rose: 'color-mix(in srgb, var(--arbor-pink) 35%, var(--studio-canvas))', cream: 'color-mix(in srgb, var(--studio-action-gold) 12%, var(--studio-canvas))' } as const;
/** The saved bowl, in the result card and the gallery. Placeholder: the glaze
 * and one gold line per traced seam. Replaced by the builder. */
export default function MendBowlPreview({ creation }: { creation: BowlCreation }) {
  const { uiLang } = useLanguage();
  return <svg viewBox="0 0 200 120" style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', marginInline: 'auto' }} role="img" aria-label={MEND_BOWL_COPY[uiLang === 'he' ? 'he' : 'en'].keep} data-glaze={creation.glaze} data-pattern={creation.pattern}>
    <path d="M40 40h120c0 40-26 64-60 64S40 80 40 40z" fill={GLAZE[creation.glaze]} />
    {creation.seams.map((seam, index) => <path key={index} d={`M${60 + seam * 16} 40l${6 - index * 2} 40`} strokeWidth="3" strokeLinecap="round" fill="none" style={{ stroke: 'var(--studio-action-gold)' }} />)}
  </svg>;
}
