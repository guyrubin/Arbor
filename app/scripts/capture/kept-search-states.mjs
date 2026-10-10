/** Real mounted controls and destinations. Fixture writes are labeled separately. */
import { KEPT_SEARCH_NOW } from './kept-search-contract.mjs';
import { installConfirmedDate, changeConfirmedDate, observeConfirmedClock, restoreConfirmedDate } from './confirmed-date-clock.mjs';
import { waitConfirmedFrame } from './confirmed-frame.mjs';
import { collectKeptCaptureStates } from './kept-capture-states.mjs';
import { collectNormalizedSearchStates } from './normalized-search-states.mjs';

/** Passive pixel-stage evidence: no scrolling, DOM changes or synthetic events. */
export function observeKeptPixelTarget(el) {
  const b = el.getBoundingClientRect();
  const clip = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  let opaque = true;
  for (let node = el; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    opaque &&= Number(style.opacity) >= 0.999 && style.visibility !== 'hidden' && style.display !== 'none';
    if (node !== el) {
      const a = node.getBoundingClientRect();
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowX)) { clip.left = Math.max(clip.left, a.left); clip.right = Math.min(clip.right, a.right); }
      if (/^(auto|scroll|hidden|clip)$/.test(style.overflowY)) { clip.top = Math.max(clip.top, a.top); clip.bottom = Math.min(clip.bottom, a.bottom); }
    }
  }
  const x = b.left + b.width / 2, y = b.top + b.height / 2;
  const insetX = Math.min(2, b.width / 4), insetY = Math.min(2, b.height / 4);
  const hits = [[x, y], [x, b.top + insetY], [x, b.bottom - insetY], [b.left + insetX, y], [b.right - insetX, y]].map(([x, y]) => {
    const hit = document.elementFromPoint(x, y); return !!hit && (hit === el || el.contains(hit));
  });
  const result = { connected: el.isConnected, opaque, enabled: !el.disabled,
    width: b.width, height: b.height, rect: { left: b.left, top: b.top, right: b.right, bottom: b.bottom }, clip,
    fullyVisible: b.width > 0 && b.height > 0 && b.left >= clip.left && b.right <= clip.right && b.top >= clip.top && b.bottom <= clip.bottom,
    hits, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth + 1 };
  result.ready = result.connected && result.opaque && result.enabled && result.fullyVisible && hits.every(Boolean) && result.noHorizontalOverflow;
  return result;
}

export async function collectKeptSearchStates(helpers) {
  const { page, fixture, viewport, load: loadRoute, screen, check, byId, captureDiagnostics = () => null } = helpers;
  let sequence = 0;
  const load = async route => {
    await loadRoute(route);
    await waitConfirmedFrame(page, null, { routeName: route.split('?')[0], childId: fixture.childId }, 'kept-search-route', captureDiagnostics);
  };
  const run = (route, state, action, afterCapture) => screen(route, state, async cell => {
    cell.boundary = 'synthetic-preloaded-lineage-and-actual-controls-local-persistence-only';
    try {
      await action(cell);
      const routeName = new URL(page.url()).hash.slice(2).split('?')[0];
      await waitConfirmedFrame(page, cell, { routeName }, 'kept-search-before-screenshot', captureDiagnostics);
      for (const dialog of await page.getByRole('dialog').all()) {
        const element = await dialog.elementHandle();
        try { await waitConfirmedFrame(page, cell, { element }, 'kept-search-dialog-settled', captureDiagnostics); }
        finally { await element?.dispose(); }
      }
      cell.clock = await page.evaluate(observeConfirmedClock);
      check(cell, 'DATE_ONLY_NATIVE_ANIMATION_TIME', cell.clock.fixture?.nativeTimingPreserved === true, cell.clock);
    } catch (error) {
      cell.failureDiagnostics = captureDiagnostics();
      cell.clock = await page.evaluate(observeConfirmedClock).catch(() => ({ unavailable: true }));
      throw error;
    }
  }, afterCapture);
  const storage = (name = 'behaviorLogs', id = fixture.childId) => page.evaluate(({ name, id }) => JSON.parse(localStorage.getItem(`arbor.${name}.${id}`) ?? '[]'), { name, id });
  const sink = () => page.evaluate(() => ({ ...window.__arborRecordShareSink }));
  const reset = async (route = 'journal') => {
    await page.evaluate(({ id, siblingId, collections }) => {
      for (const [name, values] of Object.entries(collections)) {
        localStorage.setItem(`arbor.${name}.${id}`, JSON.stringify(values));
        localStorage.setItem(`arbor.${name}.${siblingId}`, '[]');
      }
      localStorage.setItem('arbor.activeChildId', id);
    }, { id: fixture.childId, siblingId: fixture.siblingId, collections: fixture.collections });
    await load(route);
  };
  const journalFeed = async cell => {
    // Journal's default is the shelf grid. Use its real door to the existing
    // day-grouped feed, rather than asserting that rows exist on the grid.
    if (!await byId('journal-search').isVisible()) await byId('shelf-all-by-date').click();
    await page.waitForURL(url => url.hash === '#/journal?view=all');
    await byId('journal-search').waitFor({ state: 'visible' });
    const settled = await waitConfirmedFrame(page, cell, { routeName: 'journal', childId: fixture.childId }, 'kept-search-journal-feed', captureDiagnostics);
    check(cell, 'ACTUAL_JOURNAL_FEED_DESTINATION', settled.ready && new URL(page.url()).hash === '#/journal?view=all', settled);
  };
  const frame = async (cell, id, target) => {
    await target.scrollIntoViewIfNeeded();
    const element = await target.elementHandle();
    try { await waitConfirmedFrame(page, cell, { element }, id, captureDiagnostics); }
    finally { await element?.dispose(); }
    const observed = await target.evaluate(el => {
      const b = el.getBoundingClientRect(), x = b.x + b.width / 2, y = b.y + b.height / 2, hit = document.elementFromPoint(x, y);
      const main = el.closest('#main')?.getBoundingClientRect();
      return { width: b.width, height: b.height, enabled: !el.disabled, hit: hit === el || el.contains(hit),
        inViewport: b.left >= 0 && b.right <= innerWidth + 1 && y > 0 && y < innerHeight,
        inMain: !main || (y >= main.top && y <= main.bottom), overflow: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    check(cell, id, observed.width >= 44 && observed.height >= 44 && observed.enabled && observed.hit && observed.inViewport && observed.inMain && !observed.overflow, observed);
  };
  const pixels = async (cell, id, target, settle = true) => {
    if (settle) {
      await target.waitFor({ state: 'visible' });
      const element = await target.elementHandle();
      try { await waitConfirmedFrame(page, cell, { element }, id, captureDiagnostics); }
      finally { await element?.dispose(); }
    }
    const observed = await target.count() === 1 ? await target.evaluate(observeKeptPixelTarget) : { ready: false, missingOrAmbiguous: true };
    check(cell, id, observed.ready === true, observed);
    return observed;
  };
  const close = async testId => {
    const content = byId(testId);
    await page.getByRole('dialog').filter({ has: content }).getByRole('button', { name: viewport.lang === 'he' ? 'סגור' : 'Close', exact: true }).click();
    await content.waitFor({ state: 'detached' });
  };
  const childSwitch = async (cell, id, name) => {
    const routeName = await page.locator('#main [data-route]').first().getAttribute('data-route');
    const outgoing = await page.locator('#main [data-route]').first().elementHandle();
    try {
      await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
      await page.getByRole('listbox').getByRole('option').filter({ hasText: name }).click();
      await waitConfirmedFrame(page, cell, { outgoing, routeName, childId: id }, 'kept-search-child-switch', captureDiagnostics);
    } finally { await outgoing?.dispose(); }
    check(cell, 'REAL_CHILD_SWITCH_SELECTED', await page.evaluate(() => localStorage.getItem('arbor.activeChildId')) === id);
  };
  const nextDate = () => page.evaluate(changeConfirmedDate, Date.parse(KEPT_SEARCH_NOW) + (++sequence * 1000));
  await page.addInitScript(installConfirmedDate, Date.parse(KEPT_SEARCH_NOW));
  try {
    await load('journal');
    const shared = { ...helpers, load, run, reset, journalFeed, frame, pixels, close, storage, sink, childSwitch, nextDate };
    await collectKeptCaptureStates(shared);
    await collectNormalizedSearchStates(shared);
  } finally { await page.evaluate(restoreConfirmedDate).catch(() => null); }
}
