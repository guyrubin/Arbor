import { useLanguage } from '../../../../../../context/LanguageContext';
import { STITCH_GARDEN_COPY } from './stitchGardenCopy';
import { TEXTILE_COLUMNS, type TextileCreation } from './stitchGardenRules';

const CLOTH = { linen: 'color-mix(in srgb, var(--studio-canvas) 88%, var(--studio-ink-soft))', indigo: 'color-mix(in srgb, var(--arbor-sky-ink) 80%, var(--studio-deep-ink))', sage: 'color-mix(in srgb, var(--arbor-sage) 30%, var(--studio-canvas))' } as const;
const THREAD = ['var(--studio-action-gold)', 'color-mix(in srgb, var(--arbor-pink) 70%, var(--arbor-peach))', 'var(--studio-canvas-soft)', 'color-mix(in srgb, var(--arbor-sky) 60%, var(--studio-canvas))', 'var(--arbor-lav)'] as const;
/** The saved cloth, in the result card and the gallery. Placeholder: one dot
 * per stitched flower in its cell and thread. Replaced by the builder. */
export default function StitchGardenPreview({ creation }: { creation: TextileCreation }) {
  const { uiLang } = useLanguage();
  return <svg viewBox="0 0 200 150" style={{ width: '100%', maxWidth: 240, height: 'auto', display: 'block', marginInline: 'auto' }} role="img" aria-label={STITCH_GARDEN_COPY[uiLang === 'he' ? 'he' : 'en'].keep} data-cloth={creation.cloth}>
    <rect x="4" y="4" width="192" height="142" rx="12" fill={CLOTH[creation.cloth]} />
    {creation.motifs.map(motif => <circle key={motif.cell} data-flower={motif.flower} cx={29 + (motif.cell % TEXTILE_COLUMNS) * 47} cy={29 + Math.floor(motif.cell / TEXTILE_COLUMNS) * 46} r="13" fill={THREAD[motif.thread]} />)}
  </svg>;
}
