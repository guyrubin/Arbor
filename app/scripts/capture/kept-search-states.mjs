/** Real mounted controls and destinations. Fixture writes are labeled separately. */
import { KEPT_SEARCH_NOW } from './kept-search-contract.mjs';
import { installConfirmedDate, changeConfirmedDate, observeConfirmedClock, restoreConfirmedDate } from './confirmed-date-clock.mjs';
import { waitConfirmedFrame } from './confirmed-frame.mjs';
import { collectKeptCaptureStates } from './kept-capture-states.mjs';
import { collectNormalizedSearchStates } from './normalized-search-states.mjs';

export async function collectKeptSearchStates(helpers) {
  const { page, fixture, viewport, load: loadRoute, screen, check, byId, captureDiagnostics = () => null } = helpers;
  let sequence = 0;
  const load = async route => {
    await loadRoute(route);
    await waitConfirmedFrame(page, null, { routeName: route.split('?')[0], childId: fixture.childId }, 'kept-search-route', captureDiagnostics);
  };
  const run = (route, state, action) => screen(route, state, async cell => {
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
  });
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
    const shared = { ...helpers, load, run, reset, frame, close, storage, sink, childSwitch, nextDate };
    await collectKeptCaptureStates(shared);
    await collectNormalizedSearchStates(shared);
  } finally { await page.evaluate(restoreConfirmedDate).catch(() => null); }
}
