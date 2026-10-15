import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ url: null as string | null, character: false }));
vi.mock('./useStudioHero', () => ({ useStudioHero: () => ({ url: h.url, sheet: h.character ? { poses: { idle: { url: 'approved-full-body' } } } : null }) }));
vi.mock('../../ui/HeroAvatar', () => ({ HeroAvatar: () => <span data-mascot="" /> }));
vi.mock('../hero/HeroFigure', () => ({ HeroFigure: ({ pose, sheet, kick }: { pose: string; sheet: {poses: {idle: {url: string}}}; kick: number }) => <span data-figure={sheet.poses.idle.url} data-pose={pose} data-kick={kick} /> }));
import { StudioPlayHero } from './StudioPlayHero';
describe('full character rendering', () => {
 it('uses existing poses and real action beats, with celebration precedence', () => {
  h.url = 'approved-avatar'; h.character = true;
  const html = renderToStaticMarkup(<StudioPlayHero pose="hold-up" kick={4} />);
  expect(html).toContain('data-figure="approved-full-body"'); expect(html).toContain('data-pose="hold-up"'); expect(html).toContain('data-kick="4"');
  expect(renderToStaticMarkup(<StudioPlayHero pose="hold-up" celebrate />)).toContain('data-pose="cheer"');
 });
 it('preserves exact profile pixels when no character sheet exists, without a frame', () => {
  h.url = 'approved-avatar'; h.character = false;
  const html = renderToStaticMarkup(<StudioPlayHero />);
  expect(html).toContain('data-figure="approved-avatar"'); expect(html).not.toContain('hero-portal');
 });
 it('keeps Sprout when no selected profile or character exists', () => {
  h.url = null; h.character = false;
  expect(renderToStaticMarkup(<StudioPlayHero />)).toContain('data-game-hero-source="mascot"');
 });
});
