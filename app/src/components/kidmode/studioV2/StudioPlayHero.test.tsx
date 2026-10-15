import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ url: null as string | null, from: 'placeholder' }));
vi.mock('../../../context/ArborContext', () => ({ useArbor: () => ({ childProfile: { id: 'child-a' } }) }));
vi.mock('../../ui/HeroAvatar', () => ({ useHeroAvatar: () => ({ url: h.url }), HeroAvatar: () => <span data-canonical-avatar="" /> }));
vi.mock('../hero/useHeroSheet', () => ({ useHeroSheetState: () => ({ from: h.from, sheet: {} }) }));
vi.mock('../hero/HeroFigure', () => ({ HeroFigure: ({ pose }: { pose: string }) => <span data-matching-figure="" data-pose={pose} /> }));
import { StudioPlayHero } from './StudioPlayHero';
describe('game hero follows the Studio home authority', () => {
  it('only uses a current child sheet when an approved portrait exists', () => {
    h.url = 'approved-avatar'; h.from = 'child'; expect(renderToStaticMarkup(<StudioPlayHero />)).toContain('data-matching-figure');
    for (const from of ['proof', 'stock', 'device', 'avatar']) { h.from = from; const html = renderToStaticMarkup(<StudioPlayHero />); expect(html).toContain('data-canonical-avatar'); expect(html).not.toContain('data-matching-figure'); }
  });
  it('moves through approved poses and gives celebration precedence', () => {
    h.url = 'approved-avatar'; h.from = 'child';
    expect(renderToStaticMarkup(<StudioPlayHero pose="hold-up" />)).toContain('data-pose="hold-up"');
    expect(renderToStaticMarkup(<StudioPlayHero pose="hold-up" celebrate />)).toContain('data-pose="cheer"');
    h.from = 'proof'; expect(renderToStaticMarkup(<StudioPlayHero pose="hold-up" />)).not.toContain('data-pose');
  });
  it('falls back honestly when a profile has no approved avatar', () => {
    h.url = null; h.from = 'child'; const html = renderToStaticMarkup(<StudioPlayHero />); expect(html).toContain('data-game-hero-source="mascot"'); expect(html).not.toContain('data-matching-figure');
  });
});
