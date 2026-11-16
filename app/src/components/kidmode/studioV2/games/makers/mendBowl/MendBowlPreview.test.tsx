/** The saved bowl is drawn from {glaze, pattern, seams} alone: the same
 * creation always renders the same picture, its gold lies on the pattern's
 * seams, and the Cover shows one mended bowl with no text. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: 'he' }) }));
import MendBowlPreview from './MendBowlPreview';
import MendBowlCover from './MendBowlCover';
import { BOWL_SEAM_COUNTS, type BowlCreation } from './mendBowlRules';
import { BOWL_PATTERNS, polyD } from './mendBowlPatterns';
import { MEND_BOWL_COPY } from './mendBowlCopy';

const bowl = (over: Partial<BowlCreation> = {}): BowlCreation => ({ kind: 'bowl', glaze: 'indigo', pattern: 2, seams: [5, 4, 3, 2, 1, 0], ...over });
const ids = (html: string) => html.replace(/_r_[0-9a-z]+_|«r[0-9a-z]+»|:r[0-9a-z]+:|r[0-9a-z]+_?/g, 'ID');

describe('mend-bowl: the saved preview', () => {
  it('reopens identical from the saved creation alone', () => {
    expect(ids(renderToStaticMarkup(<MendBowlPreview creation={bowl()} />))).toBe(ids(renderToStaticMarkup(<MendBowlPreview creation={bowl()} />)));
  });
  it('draws the glaze and gold on every seam of its pattern, named in the child’s language', () => {
    for (const pattern of [0, 1, 2] as const) {
      const html = renderToStaticMarkup(<MendBowlPreview creation={bowl({ pattern, glaze: 'rose', seams: Array.from({ length: BOWL_SEAM_COUNTS[pattern] }, (_, i) => i) })} />);
      expect(html).toContain('data-bowl-glaze="rose"');
      for (const seam of BOWL_PATTERNS[pattern].seams) expect(html).toContain(`d="${polyD(seam.points)}"`);
      expect(html).toContain(`aria-label="${MEND_BOWL_COPY.he.keep}"`);
    }
  });
  it('differs when the glaze or the pattern differs', () => {
    const a = ids(renderToStaticMarkup(<MendBowlPreview creation={bowl()} />));
    expect(ids(renderToStaticMarkup(<MendBowlPreview creation={bowl({ glaze: 'cream' })} />))).not.toBe(a);
    expect(ids(renderToStaticMarkup(<MendBowlPreview creation={bowl({ pattern: 1, seams: [0, 1, 2, 3, 4] })} />))).not.toBe(a);
  });
  it('carries no colour literal', () => {
    const html = renderToStaticMarkup(<MendBowlPreview creation={bowl()} />) + renderToStaticMarkup(<MendBowlCover size="card" />);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });
});

describe('mend-bowl: the cover', () => {
  it('fills its box, is decorative, and has no text', () => {
    for (const size of ['tile', 'card'] as const) {
      const html = renderToStaticMarkup(<MendBowlCover size={size} />);
      expect(html).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toMatch(/<text/);
      expect(html).toContain('data-bowl-glaze="celadon"');
    }
  });
});
