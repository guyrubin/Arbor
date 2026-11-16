import { useLanguage } from '../../../../../../context/LanguageContext';
import { STITCH_GARDEN_COPY } from './stitchGardenCopy';
import { storyLines, type TextileCreation } from './stitchGardenRules';
import { TextileScene } from './StitchArt';

/** The kept hoop, in the result card and the gallery: the same drawing the
 * game ends on (the hoop set down, finished), built from `{cloth, motifs}`
 * with the same stitch generator on the same linen, so every stitch is where
 * the child saw it and the hem carries the same last line of that cloth's
 * poem. */
export default function StitchGardenPreview({ creation }: { creation: TextileCreation }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en';
  const w = STITCH_GARDEN_COPY[lang];
  const lines = storyLines(w.stories[creation.cloth] ?? w.story, creation.motifs.length);
  const last = lines.length - 1;
  return <div role="img" aria-label={[w.keep, ...lines].join('. ')} data-cloth={creation.cloth} data-motifs={creation.motifs.length} style={{ width: '100%', maxWidth: 260, aspectRatio: '440 / 450', marginInline: 'auto', position: 'relative' }}>
    <TextileScene cloth={creation.cloth} motifs={creation.motifs.map(motif => ({ motif }))} view="keptHoop" held={2} lang={lang} story={last >= 0 ? [{ text: lines[last], key: `${creation.cloth}${last}` }] : []} />
  </div>;
}
