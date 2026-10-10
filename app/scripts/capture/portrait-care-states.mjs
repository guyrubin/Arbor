/** Current real controls; no forced navigation, CSS edits or runtime repairs. */
import { installConfirmedDate, restoreConfirmedDate } from './confirmed-date-clock.mjs';
import { waitConfirmedFrame } from './confirmed-frame.mjs';
import { observeKeptPixelTarget } from './kept-search-states.mjs';
import { observePortraitCareSurface, validPortraitCareClick } from './portrait-care-contract.mjs';

/** Passive listener on the actual target; Playwright emits the trusted click. */
export async function clickPortraitCareControl(page, target, control) {
  await target.evaluate((el, control) => {
    const state = { evidence: null, listener: null };
    state.listener = event => {
      if (!event.composedPath().includes(el)) return;
      const matches = control === 'portrait-care-cta' ? el.matches('.portrait-care button') : el.matches('[data-testid="secondary-place-back"]');
      state.evidence = { sampledAt: 'captured-click', trusted: event.isTrusted, control: matches ? control : 'unexpected',
        hash: location.hash, insideMain: !!el.closest('#main'), targetConnected: el.isConnected };
      document.removeEventListener('click', state.listener, true);
    };
    window.__arborPortraitCareClick = state;
    document.addEventListener('click', state.listener, { capture: true, passive: true });
  }, control);
  try { await target.click(); return await page.evaluate(() => window.__arborPortraitCareClick?.evidence ?? null); }
  finally {
    await page.evaluate(() => { const state = window.__arborPortraitCareClick; if (state?.listener) document.removeEventListener('click', state.listener, true); delete window.__arborPortraitCareClick; });
  }
}

export async function collectPortraitCareStates({ page, fixture, viewport, load, screen, check, byId, apiState, captureDiagnostics = () => null }) {
  const childId = fixture.childId;
  const surface = routeName => page.evaluate(observePortraitCareSurface, { routeName, childId });
  const routeNode = routeName => page.locator(`#main [data-route="${routeName}"]`);
  const cta = () => routeNode('development').locator('.portrait-care button');
  const requireState = passed => { if (!passed) throw new Error('DEPENDENT_STATE_UNREACHED'); };
  const settled = async (cell, routeName, outgoing = null, element = null) => {
    const frame = await waitConfirmedFrame(page, cell, { routeName, childId, outgoing, element }, 'portrait-care-current-body', captureDiagnostics);
    check(cell, 'SETTLED_CURRENT_BODY', frame.ready, frame);
    return frame;
  };
  const run = (route, state, action) => screen(route, state, async cell => {
    cell.screenshotAnimations = 'allow';
    cell.entryPath = state === 'sharing-direct-control' ? 'direct-sharing-control-only' : state === 'portrait-care-cta' ? 'direct-my-child-then-real-cta' : 'actual-current-controls';
    try {
      await action(cell);
      cell.surface = await surface(route);
      check(cell, 'CURRENT_ROUTE_IDENTITY', cell.surface.identityReady, cell.surface);
      check(cell, 'SOURCE_LANGUAGE_DIRECTION', cell.surface.direction === (viewport.lang === 'he' ? 'rtl' : 'ltr'));
      check(cell, 'NO_SHARE_OR_MUTATION_DISPATCH', apiState.portraitCareDeniedMutations === 0);
    } catch (error) {
      cell.surface = await surface(route).catch(() => ({ unavailable: true }));
      cell.failureDiagnostics = captureDiagnostics();
      throw error;
    }
  }, async cell => {
    // Read after the exact PNG as well; no state changes or animation repair.
    cell.screenshotSurface = await surface(route);
    check(cell, 'SCREENSHOT_CURRENT_ROUTE_UNCHANGED', cell.screenshotSurface.identityReady && cell.screenshotSurface.hash === cell.surface.hash);
  });
  const pixels = async (cell, target, routeName) => {
    await target.scrollIntoViewIfNeeded();
    const element = await target.elementHandle();
    try { await settled(cell, routeName, null, element); }
    finally { await element?.dispose(); }
    return target.evaluate(observeKeptPixelTarget);
  };
  let navigationClick = null, clickedCare = false;
  const epoch = Date.parse(fixture.parsed.seededAt);
  if (!Number.isFinite(epoch)) throw new Error('SYNTHETIC_FIXTURE_REQUIRED');
  await page.addInitScript(installConfirmedDate, epoch);
  try {
    const portraitReady = await run('development', 'portrait-care-cta', async cell => {
      await load('development');
      await settled(cell, 'development');
      cell.ctaPixels = await pixels(cell, cta(), 'development');
      check(cell, 'CARE_CTA_VISIBLE_AND_HITTABLE', cell.ctaPixels.ready, cell.ctaPixels);
    });
    const careReady = await run('care-team', 'care-arrival', async cell => {
      requireState(portraitReady);
      const outgoing = await routeNode('development').elementHandle();
      try {
        navigationClick = await clickPortraitCareControl(page, cta(), 'portrait-care-cta');
        cell.navigationClick = navigationClick;
        clickedCare = validPortraitCareClick(navigationClick, 'portrait-care-cta', 'development');
        check(cell, 'TRUSTED_CURRENT_CARE_CTA_CLICK', clickedCare, navigationClick);
        await page.waitForURL(url => url.hash === '#/care-team', { timeout: 8000 });
        const frame = await settled(cell, 'care-team', outgoing);
        check(cell, 'OUTGOING_PORTRAIT_RETIRED', frame.outgoingRetired && frame.replacementMounted);
        const first = await surface('care-team');
        check(cell, 'CARE_FIRST_FOLD_AT_TOP', first.headingInMain && first.mainScrollTop === 0, first);
      } finally { await outgoing?.dispose(); }
    });
    await run('care-team', 'care-primary', async cell => {
      requireState(careReady);
      cell.navigationClick = navigationClick;
      check(cell, 'SAME_ACTUAL_CARE_NAVIGATION', validPortraitCareClick(navigationClick, 'portrait-care-cta', 'development'));
      cell.primaryPixels = await pixels(cell, byId('share-week-confirm'), 'care-team');
      check(cell, 'CURRENT_CARE_PRIMARY_VISIBLE_AND_HITTABLE', cell.primaryPixels.ready, cell.primaryPixels);
    });
    await run('development', 'care-back-portrait', async cell => {
      // Even a blank care body may leave its genuine shell Back actionable.
      // Preserve that separate return evidence without fixing the failed entry.
      requireState(clickedCare && new URL(page.url()).hash === '#/care-team');
      const outgoing = await routeNode('care-team').elementHandle();
      try {
        cell.navigationClick = await clickPortraitCareControl(page, byId('secondary-place-back'), 'my-child-back');
        check(cell, 'TRUSTED_MY_CHILD_BACK_CLICK', validPortraitCareClick(cell.navigationClick, 'my-child-back', 'care-team'), cell.navigationClick);
        await page.waitForURL(url => url.hash === '#/development', { timeout: 8000 });
        const frame = await settled(cell, 'development', outgoing);
        check(cell, 'OUTGOING_CARE_RETIRED', !!outgoing && frame.outgoingRetired && frame.replacementMounted);
        const returned = await surface('development');
        check(cell, 'PORTRAIT_BACK_FIRST_FOLD', returned.headingInMain && returned.mainScrollTop === 0, returned);
        cell.focusRestoration = { supportedBySource: false, observation: returned.focus, action: 'none' };
        check(cell, 'BACK_FOCUS_OBSERVED_WITHOUT_REPAIR', returned.focus.connected && !returned.focus.insideInertOrHidden, cell.focusRestoration);
      } finally { await outgoing?.dispose(); }
    });
    await run('sharing', 'sharing-direct-control', async cell => {
      await load('sharing');
      await settled(cell, 'sharing');
      const direct = await surface('sharing');
      check(cell, 'DIRECT_SHARING_CONTROL_ONLY', direct.identityReady && direct.primaryMove === 'grant-share', direct);
      check(cell, 'SHARING_FIRST_FOLD_AT_TOP', direct.headingInMain && direct.mainScrollTop === 0, direct);
    });
  } finally { await page.evaluate(restoreConfirmedDate).catch(() => null); }
}
