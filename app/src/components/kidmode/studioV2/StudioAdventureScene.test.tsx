import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('../../../hooks/useKidTheme', () => ({ useKidTheme: () => 'film3d' }));
import { StudioAdventureScene } from './StudioAdventureScene';
describe('adventure scenery cannot redraw the child', () => {
 it('renders each original neutral environment', () => {
  for (const activityId of ['river-rescue','feelings-forest','rhythm-garden'] as const) {
   const html = renderToStaticMarkup(<StudioAdventureScene activityId={activityId} />);
   expect(html).toContain('/visuals/studio-v2/adventures/'); expect(html).toContain('alt=""');
  }
 });
 it('does not send an approved avatar to scene generation from game or portal artwork', () => {
  for (const file of ['StudioAdventureScene.tsx','StudioHome.tsx']) {
   const source = readFileSync(new URL(file, import.meta.url), 'utf8');
   expect(source).not.toMatch(/WorldScene|generateScene|imagePrompt/);
  }
 });
});
