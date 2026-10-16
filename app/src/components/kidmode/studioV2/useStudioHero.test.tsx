import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HeroSheetFrom } from '../hero/useHeroSheet';
const h = vi.hoisted(() => ({ child: { id: 'child-a', comicAvatarUrl: 'approved-a' }, requested: null as unknown, from: 'child' as HeroSheetFrom, sheet: { heroId: 'a', poses: { idle: {} } } }));
vi.mock('../../../context/ArborContext', () => ({ useArbor: () => ({ childProfile: h.child }) }));
vi.mock('../../ui/HeroAvatar', () => ({ useHeroAvatar: () => ({ url: h.child.comicAvatarUrl, name: 'Ari' }) }));
vi.mock('../hero/useHeroSheet', () => ({ useHeroSheetState: (child: unknown) => { h.requested = child; return { from: h.from, sheet: h.sheet, ready: true }; } }));
import { useStudioHero } from './useStudioHero';
function Read() { const hero = useStudioHero(); return <span data-reference={hero.url} data-character={hero.sheet?.heroId ?? 'portrait'} />; }
const read = () => renderToStaticMarkup(<Read />);
beforeEach(() => { h.from = 'child'; h.child = { id: 'child-a', comicAvatarUrl: 'approved-a' }; });
describe('one character source across Studio and Sneak & Freeze', () => {
 it.each(['child','proof','device','stock'] as const)('keeps the shared resolver’s %s character unchanged', from => { h.from = from; expect(read()).toContain('data-character="a"'); expect(h.requested).toBe(h.child); });
 it.each(['avatar','placeholder'] as const)('uses exact profile fallback for %s, never an unrelated character', from => { h.from = from; expect(read()).toContain('data-character="portrait"'); expect(read()).toContain('data-reference="approved-a"'); });
 it('passes a changed child and avatar to the shared identity guards immediately', () => { read(); h.child = { id: 'child-b', comicAvatarUrl: 'approved-b' }; h.from = 'avatar'; expect(read()).toContain('data-reference="approved-b"'); expect(h.requested).toBe(h.child); });
});
