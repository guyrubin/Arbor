import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEVICE_VIEWPORTS, RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const repo = path.resolve(__dirname, '..', '..');
const read = (file: string) => readFileSync(path.join(repo, file), 'utf8');

// CoS AR-REL-2: one matrix of record. Every other surface points here and restates no sizes.
describe('device matrix of record', () => {
  it('holds the real phone boxes, the release cells and wide desktop, each in EN and HE', () => {
    const sizes = new Set(DEVICE_VIEWPORTS.map((vp: any) => `${vp.w}x${vp.h}`));
    for (const box of ['375x667', '390x664', '430x740', '844x390', '375x812', '1280x800', '1920x1080']) expect(sizes.has(box)).toBe(true);
    expect(new Set(DEVICE_VIEWPORTS.map((vp: any) => vp.id)).size).toBe(DEVICE_VIEWPORTS.length);
    for (const size of sizes) {
      const langs = DEVICE_VIEWPORTS.filter((vp: any) => `${vp.w}x${vp.h}` === size).map((vp: any) => vp.lang).sort();
      expect(langs).toEqual(['en', 'he']);
    }
  });

  it('keeps the automated release cells as a subset with unchanged ids and order', () => {
    expect(RELEASE_VIEWPORTS.map((vp: any) => vp.id)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    for (const vp of RELEASE_VIEWPORTS) expect(DEVICE_VIEWPORTS).toContain(vp);
  });

  it('lets the sweep run the whole matrix and leaves no size restated in the definition of done', () => {
    const sweep = read('app/scripts/rendered-sweep.mjs');
    expect(sweep).toContain('out.matrix === "device" ? DEVICE_VIEWPORTS : VIEWPORTS');
    expect(sweep).toContain('DEVICE_VIEWPORTS.find((vp) => vp.id === id)');
    const dod = read('ARBOR_NEXT.md').split('## 9. Definition of Done')[1].split('## 10.')[0];
    expect(dod).toContain('DEVICE_VIEWPORTS');
    expect(dod).not.toMatch(/\b\d{3,4}px\b/);
  });
});
