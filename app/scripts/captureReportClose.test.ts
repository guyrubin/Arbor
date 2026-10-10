import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { observeReportCloseDestination, waitForReportCloseDestination } from './capture/report-close-frame.mjs';
import { releaseMatrix, releaseCell, captureDeadlineMs } from './capture/release-config.mjs';
import { expectedReleaseInteractionStates } from './capture/release-interactions.mjs';

const source = readFileSync(new URL('./capture/release-report-states.mjs', import.meta.url), 'utf8');

function fixture() {
  const rect = (top: number, height: number) => ({ left: 16, right: 359, top, bottom: top + height, width: 343, height });
  const motion: any = { parentElement: null, style: { opacity: '1' } };
  const heading: any = { parentElement: motion, getBoundingClientRect: () => rect(128, 27), contains: (el: unknown) => el === heading };
  const lead: any = { parentElement: motion, getBoundingClientRect: () => rect(167, 300), contains: (el: unknown) => el === lead };
  const page: any = { querySelector: vi.fn((selector: string) => selector.includes('h1') ? heading : lead) };
  const route = { querySelector: vi.fn(() => page) };
  const main = { scrollTop: 0, getBoundingClientRect: () => rect(76, 600), querySelector: vi.fn(() => route) };
  const document = {
    querySelector: vi.fn((selector: string) => selector === '#main' ? main : null),
    elementFromPoint: vi.fn((_x: number, y: number) => y < 167 ? heading : lead),
    activeElement: { matches: vi.fn(() => true) },
  };
  const location = { hash: '#/overview' };
  vi.stubGlobal('document', document); vi.stubGlobal('location', location);
  vi.stubGlobal('innerWidth', 375); vi.stubGlobal('innerHeight', 812);
  vi.stubGlobal('getComputedStyle', (el: any) => ({ display: 'block', visibility: 'visible', opacity: '1', ...el.style }));
  return { document, location, main, route, page, heading, lead, motion };
}

afterEach(() => vi.unstubAllGlobals());

describe('Close-return captures settled Now, never an empty transition', () => {
  it('requires actual Now heading and lead, opacity-settled ancestors and unoccluded pixels', () => {
    fixture();
    expect(observeReportCloseDestination(true)).toMatchObject({ ready: true, routeIsNow: true, nowMounted: true, focusOnLauncher: true });
    for (const change of [
      (f: any) => f.main.querySelector.mockReturnValue(null),
      (f: any) => f.route.querySelector.mockReturnValue(null),
      (f: any) => f.page.querySelector.mockReturnValue(null),
      (f: any) => { f.motion.style.opacity = '0'; },
      (f: any) => { f.motion.style.opacity = '0.5'; },
      (f: any) => { f.motion.style.visibility = 'hidden'; },
      (f: any) => f.document.elementFromPoint.mockReturnValue({}),
      (f: any) => { f.location.hash = '#/coach'; },
      (f: any) => f.document.querySelector.mockImplementation((s: string) => s === '#main' ? f.main : {}),
    ]) {
      const f = fixture(); change(f);
      expect(observeReportCloseDestination().ready).toBe(false);
      expect(observeReportCloseDestination(true)).toBe(false);
    }
  });

  it('waits with a bounded timeout and records only geometry/status before screenshot', async () => {
    fixture();
    const frame = observeReportCloseDestination();
    const handle = { jsonValue: vi.fn(async () => frame), dispose: vi.fn(async () => {}) };
    const page = { waitForFunction: vi.fn(async () => handle), goto: vi.fn(), reload: vi.fn() };
    const cell: any = {}, check = vi.fn();
    await waitForReportCloseDestination(page, cell, { check });
    expect(page.waitForFunction).toHaveBeenCalledWith(observeReportCloseDestination, true, { timeout: 10000 });
    expect(handle.dispose).toHaveBeenCalledOnce();
    expect(check.mock.calls).toHaveLength(5);
    expect(check.mock.calls.every(call => call[2] === true)).toBe(true);
    expect(JSON.stringify(cell)).not.toMatch(/Dylan|book|text|childId/);
    expect(page.goto).not.toHaveBeenCalled(); expect(page.reload).not.toHaveBeenCalled();
    const close = source.slice(source.indexOf("await screen('shell', 'report-close-return'"));
    expect(close.indexOf('await closeConversation()')).toBeLessThan(close.indexOf('await waitForReportCloseDestination'));
    expect(close).toContain('REPORT_CLOSE_FOCUS_RETURNS_TO_LAUNCHER');
    expect(close).toContain('REPORT_PANEL_CLOSED');
    expect(close).not.toMatch(/load\(|openConversation\(|goto\(|reload\(|scrollTo\(/);
  });

  it('retains failure on a persistent blank and rechecks settled focus and scroll', async () => {
    const page = { waitForFunction: vi.fn(async () => { throw new Error('timeout'); }) };
    const check = vi.fn();
    await expect(waitForReportCloseDestination(page, {}, { check })).rejects.toThrow('timeout');
    expect(check).not.toHaveBeenCalled();
    const f = fixture(); f.main.scrollTop = 20; f.document.activeElement.matches.mockReturnValue(false);
    const frame = observeReportCloseDestination();
    const cell: any = {};
    await waitForReportCloseDestination({ waitForFunction: async () => ({ jsonValue: async () => frame, dispose: async () => {} }) }, cell, { check });
    expect(check).toHaveBeenCalledWith(cell, 'REPORT_CLOSE_NOW_SCROLL_RESET', false);
    expect(check).toHaveBeenCalledWith(cell, 'REPORT_CLOSE_SETTLED_FOCUS_REMAINS_ON_LAUNCHER', false);
  });

  it('replays only text-only report to actual Close across four viewport/language variants', () => {
    const matrix = releaseMatrix('report-close-only');
    expect(matrix.map(item => item.viewport)).toEqual(['mobile-en', 'mobile-he', 'desktop-en', 'desktop-he']);
    for (const spec of matrix) {
      const cell = releaseCell(spec);
      expect(captureDeadlineMs(cell)).toBe(240000);
      expect(expectedReleaseInteractionStates(spec.group, cell.viewport).map(item => item.state)).toEqual(['report-text-only', 'report-close-return']);
    }
    expect(releaseMatrix()).toHaveLength(8);
    expect(releaseMatrix('ask-diagnostic')).toHaveLength(1);
  });
});
