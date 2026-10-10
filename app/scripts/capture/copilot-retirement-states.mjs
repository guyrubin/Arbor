/** Actual source controls, existing synthetic storage and egress boundaries only. */
import { COPILOT_RETIREMENT_NOW, COPILOT_RETIREMENT_EXPIRED, expectedCopilotSummary, validCopilotTargetHeading } from './copilot-retirement-contract.mjs';
import { installConfirmedDate, changeConfirmedDate } from './confirmed-date-clock.mjs';
import { waitConfirmedFrame } from './confirmed-frame.mjs';

export async function collectCopilotRetirementStates({ page, fixture, viewport, load, screen, check, byId, captureDiagnostics }) {
  const he = viewport.lang === 'he';
  const summary = () => byId('consult-practice-summary');
  const opener = () => summary().locator('summary');
  const preview = () => byId('consult-practice-preview');
  const copy = () => byId('consult-practice-copy');
  const slp = () => byId('consult-audience-row').getByRole('radio', { name: he ? 'קלינאי/ת תקשורת' : 'Speech therapist', exact: true });
  const keepsakes = () => byId('portrait-keepsakes');
  const history = () => byId('saved-milestone-history');
  const historyTab = () => keepsakes().getByRole('button', { name: he ? 'היסטוריה שבועית' : 'Weekly history', exact: true });
  const sink = () => page.evaluate(() => [...window.__arborCopilotClipboard.calls]);
  const storage = (childId, name) => page.evaluate(({ childId, name }) => localStorage.getItem(`arbor.${name}.${childId}`), { childId, name });
  const put = (childId, name, rows) => page.evaluate(({ childId, name, rows }) => localStorage.setItem(`arbor.${name}.${childId}`, JSON.stringify(rows)), { childId, name, rows });
  const hash = value => page.goto(`${page.url().split('#')[0]}#/${value}`, { waitUntil: 'domcontentloaded' });
  const expected = options => expectedCopilotSummary(fixture, options);
  const waitRoute = (cell, routeName, childId = fixture.childId) => waitConfirmedFrame(page, cell, { routeName, childId }, 'copilot-settled-route', captureDiagnostics);
  const control = async (cell, target) => {
    await target.scrollIntoViewIfNeeded();
    const element = await target.elementHandle();
    try { cell.frame = await waitConfirmedFrame(page, cell, { element }, 'copilot-target-frame', captureDiagnostics); }
    finally { await element?.dispose(); }
    cell.controlFrame = await target.evaluate(el => {
      const box = el.getBoundingClientRect(), main = el.closest('#main')?.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2, hit = document.elementFromPoint(x, y);
      return { width: box.width, height: box.height, reachable: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight
        && (!main || (box.top >= main.top - 1 && box.bottom <= main.bottom + 1)) && !!hit && (hit === el || el.contains(hit)) };
    });
    check(cell, 'CONTROL_REACHABLE_44PX', cell.controlFrame.reachable && cell.controlFrame.width >= 44 && cell.controlFrame.height >= 44, cell.controlFrame);
  };
  const run = (state, action, target) => screen(state.startsWith('consult-') ? 'consult' : 'development', state, async cell => {
    cell.evidenceBoundary = 'synthetic-local-source-and-real-controls';
    await action(cell);
    const routeName = state.startsWith('consult-') ? 'consult' : 'development';
    const childId = await page.evaluate(() => localStorage.getItem('arbor.activeChildId'));
    await waitRoute(cell, routeName, childId);
    await control(cell, target ? target() : page.locator('#main [data-primary-move]').first());
    const layout = await page.evaluate(() => {
      const root = document.documentElement, main = document.querySelector('#main');
      return { lang: root.lang, dir: root.dir, width: innerWidth, documentWidth: root.scrollWidth, mainWidth: main?.clientWidth, mainScrollWidth: main?.scrollWidth };
    });
    cell.rootDirection = layout.dir;
    check(cell, 'ROOT_LOCALE_DIRECTION', layout.lang === viewport.lang && layout.dir === (he ? 'rtl' : 'ltr'), layout);
    check(cell, 'NO_HORIZONTAL_OVERFLOW', layout.documentWidth <= layout.width + 1 && layout.mainScrollWidth <= layout.mainWidth + 1, layout);
  });
  const reset = async (route = 'consult', changes = {}) => {
    await page.evaluate(({ fixture, changes }) => {
      for (const [childId, rows] of [[fixture.childId, { ...fixture.collections, ...changes }], [fixture.siblingId, fixture.siblingCollections]]) {
        for (const [name, values] of Object.entries(rows)) localStorage.setItem(`arbor.${name}.${childId}`, JSON.stringify(values));
      }
      localStorage.setItem('arbor.activeChildId', fixture.childId);
      localStorage.setItem('arbor.consultExportAudience', 'slp');
    }, { fixture, changes });
    await load(route);
    await waitRoute(null, route.split('?')[0]);
  };
  const openSummary = async (keyboard = false) => {
    await summary().waitFor({ state: 'visible' });
    if (!await summary().evaluate(el => el.open)) {
      if (keyboard) { await opener().focus(); await opener().press('Enter'); }
      else await opener().click();
    }
    await preview().waitFor({ state: 'visible' });
  };
  const exactPreview = async (cell, id, options = {}) => {
    await page.waitForFunction(text => document.querySelector('[data-testid="consult-practice-preview"]')?.textContent === text, expected({ ...options, preview: true }));
    check(cell, id, await preview().textContent() === expected({ ...options, preview: true }));
    check(cell, 'ENGLISH_LTR_PREVIEW', await preview().getAttribute('dir') === 'ltr' && await preview().evaluate(el => getComputedStyle(el).direction === 'ltr'));
  };
  const exactCopy = async (cell, id, options = {}) => {
    const before = (await sink()).length;
    await copy().click();
    const calls = await sink();
    cell.clipboardEvidence = { before, after: calls.length, actual: calls.at(-1), expected: expected(options), syntheticOnly: true };
    check(cell, id, calls.length === before + 1 && calls.at(-1) === expected(options), cell.clipboardEvidence);
  };
  const oldElementBlocked = async (cell, id, old) => {
    let rejected = false;
    try { await old.click({ timeout: 500 }); } catch { rejected = true; }
    check(cell, id, rejected);
  };
  const record = async cell => {
    await byId('child-portrait').waitFor({ state: 'visible' });
    check(cell, 'SINGLE_SUPPORTED_RECORD', await byId('child-portrait').count() === 1 && await page.locator('#main [data-primary-move="explore-child-record"]').count() === 1
      && await page.locator('#main [data-route="copilot"], #main [data-testid="copilot-root"]').count() === 0
      && !/Full Picture|Development Dashboard/.test(await byId('child-portrait').innerText()));
  };
  const switchChild = async (cell, child) => {
    const outgoing = await page.locator('#main [data-route]').elementHandle();
    try {
      await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
      await page.getByRole('listbox').getByRole('option').filter({ hasText: child.name }).click();
      await waitConfirmedFrame(page, cell, { outgoing, routeName: cell.route, childId: child.id }, 'actual-child-switch', captureDiagnostics);
    } finally { await outgoing?.dispose(); }
  };
  const openHistory = async () => {
    if (!await keepsakes().evaluate(el => el.open)) await keepsakes().locator('summary').click();
    await historyTab().click(); await history().waitFor({ state: 'visible' });
  };
  await page.addInitScript(installConfirmedDate, Date.parse(COPILOT_RETIREMENT_NOW));
  await load('overview'); // supported demo hydrator runs before fixture updates
  await run('legacy-arrival', async cell => { await load('copilot'); await record(cell); check(cell, 'LEGACY_HASH_REPLACED', new URL(page.url()).hash === '#/development'); });
  await run('stored-arrival', async cell => {
    await page.evaluate(() => localStorage.setItem('arbor.activeTab', 'copilot'));
    await page.goto(`${page.url().split('?')[0]}?capture=copilot-stored`, { waitUntil: 'domcontentloaded' });
    await record(cell);
    check(cell, 'STORED_COPILOT_CORRECTED', new URL(page.url()).hash === '#/development' && await page.evaluate(() => localStorage.getItem('arbor.activeTab')) === 'development');
  });
  for (const [state, route, id] of [['alias-full-picture', 'The-Full-Picture', 'FULL_PICTURE_ALIAS_REPLACED'], ['alias-dashboard', 'development-dashboard', 'DASHBOARD_ALIAS_REPLACED'], ['uppercase-trailing', 'COPILOT/', 'UPPERCASE_TRAILING_REPLACED']]) await run(state, async cell => { await load(route); await record(cell); check(cell, id, new URL(page.url()).hash === '#/development'); });
  await run('query-arrival', async cell => { await load('copilot/?view=domain&note=%D7%A9%20x'); await record(cell); check(cell, 'LEGACY_QUERY_BYTES_PRESERVED', new URL(page.url()).hash === '#/development?view=domain&note=%D7%A9%20x'); });
  await run('reload-arrival', async cell => { await page.reload({ waitUntil: 'domcontentloaded' }); await record(cell); check(cell, 'REAL_RELOAD_STAYS_RECORD', new URL(page.url()).hash === '#/development?view=domain&note=%D7%A9%20x'); });
  await run('back-forward', async cell => {
    await hash('consult'); await waitRoute(cell, 'consult');
    await hash('copilot'); await record(cell); await waitRoute(cell, 'development');
    await page.goBack(); await waitRoute(cell, 'consult'); const back = new URL(page.url()).hash;
    await page.goForward(); await record(cell);
    check(cell, 'ACTUAL_BACK_FORWARD_RETIRES_LEGACY', back === '#/consult' && new URL(page.url()).hash === '#/development');
  });
  await run('consult-closed', async cell => {
    await reset(); await summary().waitFor({ state: 'visible' });
    check(cell, 'SECONDARY_SUMMARY_AFTER_PACKET_CLOSED', !await summary().evaluate(el => el.open) && await summary().evaluate(el => !!el.previousElementSibling && !el.querySelector('[data-primary-move]')));
    check(cell, 'ONE_CONSULT_PRIMARY', await page.locator('#main [data-primary-move]').count() === 1);
  }, opener);
  await run('consult-open-pointer', async cell => { await openSummary(); await exactPreview(cell, 'POINTER_OPENS_EXACT_PREVIEW'); }, opener);
  await run('consult-open-keyboard', async cell => { await opener().click(); await openSummary(true); await exactPreview(cell, 'KEYBOARD_OPENS_EXACT_PREVIEW'); }, opener);
  await run('consult-copy', async cell => { await exactCopy(cell, 'EXACT_SYNTHETIC_CLIPBOARD_PAYLOAD'); check(cell, 'STREAK_EXPORT_ONLY', !(await preview().textContent()).includes('Streak:') && (await sink()).at(-1).includes('Streak: 2 days.')); }, copy);
  await run('consult-close-reopen', async cell => { const before = (await sink()).length; await opener().click(); const closed = !await summary().evaluate(el => el.open); await openSummary(); check(cell, 'REAL_DISCLOSURE_CLOSE_REOPEN', closed && await summary().evaluate(el => el.open)); check(cell, 'NO_IMPLICIT_COPY', (await sink()).length === before); }, opener);
  let audienceCopy;
  await run('consult-teacher', async cell => {
    audienceCopy = await copy().elementHandle(); const before = (await sink()).length;
    await byId('consult-audience-row').getByRole('radio', { name: he ? 'גננת או מורה' : 'Teacher or gan', exact: true }).click();
    await byId('consult-teacher-branch').waitFor({ state: 'visible' });
    check(cell, 'TEACHER_REMOVES_SUMMARY', await summary().count() === 0 && (await sink()).length === before);
    await oldElementBlocked(cell, 'RETIRED_COPY_ELEMENT_UNCLICKABLE', audienceCopy);
  }, () => byId('consult-audience-row').getByRole('radio', { name: he ? 'גננת או מורה' : 'Teacher or gan', exact: true }));
  await audienceCopy?.dispose();
  await run('consult-clinician-return', async cell => { const before = (await sink()).length; await slp().click(); await summary().waitFor({ state: 'visible' }); check(cell, 'CLINICIAN_RETURN_CLOSED', !await summary().evaluate(el => el.open)); check(cell, 'NO_AUDIENCE_CHANGE_COPY', (await sink()).length === before); }, opener);
  await run('consult-blocked', async cell => {
    await reset('consult', { speechAttempts: [{ ...fixture.collections.speechAttempts[0], sound: 'riskLevel' }] }); await openSummary();
    check(cell, 'FORBIDDEN_SOURCE_BLOCKS_PREVIEW_AND_COPY', await copy().isDisabled() && !(await preview().textContent()).includes('riskLevel') && !(await preview().textContent()).includes('ARBOR PRACTICE SUMMARY'));
    check(cell, 'NO_BLOCKED_COPY', (await sink()).length === 0);
  }, opener);
  await run('consult-recovered', async cell => { await reset(); await openSummary(); await exactPreview(cell, 'FRESH_SAFE_SOURCE_RECOVERS'); await exactCopy(cell, 'EXACT_RECOVERED_COPY'); }, copy);
  const changedStories = [...fixture.collections.adventureResults, { id: 'capture-story-new', timestamp: '2026-10-09T09:00:00.000Z' }];
  await run('consult-source-retired', async cell => {
    const before = (await sink()).length; await put(fixture.childId, 'adventureResults', changedStories); await copy().click();
    check(cell, 'SAME_DOCUMENT_SOURCE_CHANGE_BLOCKS_COPY', (await sink()).length === before);
    check(cell, 'VISIBLE_OLD_PREVIEW_NOT_EGRESS_PROOF', await preview().textContent() === expected({ preview: true }) && await storage(fixture.childId, 'adventureResults') === JSON.stringify(changedStories));
    cell.sourceBoundary = 'same-document-localStorage-read-receipt-no-synthetic-storage-event';
  }, copy);
  await run('consult-source-fresh', async cell => { await load('consult'); await openSummary(); await exactPreview(cell, 'FRESH_READ_USES_CHANGED_SOURCE', { changed: true }); await exactCopy(cell, 'EXACT_CHANGED_SOURCE_COPY', { changed: true }); }, copy);
  await run('consult-current-child', async cell => {
    const old = await copy().elementHandle(); const before = (await sink()).length;
    try { await switchChild(cell, fixture.sibling); await summary().waitFor({ state: 'visible' }); const closed = !await summary().evaluate(el => el.open); await openSummary(); check(cell, 'ACTUAL_CHILD_SWITCH_RETIRES_COPY', closed && !await old.evaluate(el => el.isConnected) && (await sink()).length === before); await exactPreview(cell, 'CURRENT_CHILD_PREVIEW', { sibling: true }); await exactCopy(cell, 'EXACT_CURRENT_CHILD_COPY', { sibling: true }); }
    finally { await old?.dispose(); }
  }, copy);
  await run('consult-target-current', async cell => {
    await reset(`consult?appointment=${fixture.visit.id}`, { appointments: [fixture.visit] }); await openSummary();
    cell.targetEvidence = { heading: await byId('consult-h1').textContent(), appointment: new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('appointment'), selectedSlp: await slp().getAttribute('aria-checked') === 'true', unavailableCount: await byId('consult-visit-unavailable').count(), secondaryLineCount: await byId('consult-visit-line').count() };
    check(cell, 'REAL_TARGET_SUMMARY_CURRENT', validCopilotTargetHeading(cell.targetEvidence, viewport.lang), cell.targetEvidence);
    await exactCopy(cell, 'EXACT_TARGET_COPY');
  }, copy);
  let targetCopy; let targetCalls;
  await run('consult-target-expired', async cell => {
    targetCopy = await copy().elementHandle(); targetCalls = (await sink()).length;
    await page.evaluate(changeConfirmedDate, Date.parse(COPILOT_RETIREMENT_EXPIRED)); await hash(`consult?appointment=${fixture.visit.id}&captureEligibility=expired`);
    await byId('consult-visit-unavailable').waitFor({ state: 'visible' });
    check(cell, 'TARGET_EXPIRY_HIDES_AND_INERTS_SUMMARY', !await summary().isVisible() && await targetCopy.evaluate(el => !!el.closest('[hidden][inert]')) && (await sink()).length === targetCalls);
    await oldElementBlocked(cell, 'EXPIRED_COPY_ELEMENT_UNCLICKABLE', targetCopy);
  }, () => byId('consult-visit-unavailable').locator('button'));
  await run('consult-target-recovered', async cell => {
    await page.evaluate(changeConfirmedDate, Date.parse(COPILOT_RETIREMENT_NOW)); await hash(`consult?appointment=${fixture.visit.id}&captureEligibility=recovered`); await summary().waitFor({ state: 'visible' });
    check(cell, 'TARGET_RECOVERY_NO_IMPLICIT_COPY', (await sink()).length === targetCalls);
    await opener().click(); await openSummary(); await exactCopy(cell, 'TARGET_RECOVERY_FRESH_COPY');
  }, copy);
  await targetCopy?.dispose();
  await run('consult-target-replaced', async cell => {
    const old = await copy().elementHandle(); const before = (await sink()).length;
    try { await hash('consult?appointment=capture-missing-target'); await byId('consult-visit-unavailable').waitFor({ state: 'visible' }); check(cell, 'MISSING_REPLACEMENT_TARGET_BLOCKED', await summary().count() === 0 && (await sink()).length === before); await oldElementBlocked(cell, 'REPLACED_COPY_ELEMENT_UNCLICKABLE', old); }
    finally { await old?.dispose(); }
  }, () => byId('consult-visit-unavailable').locator('button'));
  await run('consult-away-return', async cell => {
    await reset(); await openSummary(); const old = await copy().elementHandle();
    try { await hash('development'); await waitRoute(cell, 'development'); await hash('consult'); await summary().waitFor({ state: 'visible' }); check(cell, 'NAVIGATION_RETURN_SUMMARY_CLOSED', !await summary().evaluate(el => el.open) && (await sink()).length === 0); check(cell, 'OLD_ROUTE_COPY_ELEMENT_RETIRED', !await old.evaluate(el => el.isConnected)); }
    finally { await old?.dispose(); }
  }, opener);
  await run('history-valid', async cell => {
    await reset('development'); await openHistory();
    const text = await history().innerText(); const dates = await history().locator('time').evaluateAll(nodes => nodes.map(node => node.dateTime));
    check(cell, 'EXACT_SAVED_NUMERATORS_AND_DATES', /\b17\b/.test(text) && /\b0\b/.test(text) && /\b3\b/.test(text) && JSON.stringify(dates) === JSON.stringify(['2026-10-05', '2026-09-28']));
    check(cell, 'NO_HISTORY_GRADE_OR_DENOMINATOR', !/strong|emerging|developing|\b99\b|\b80\b|\d\s*[/％%]|\d+ of \d+|elev\./i.test(text));
  }, historyTab);
  await run('history-missing', async cell => {
    await reset('development', { bandSnapshots: [{ id: '2026-W40', date: '2026-10-05', bands: [{ domain: 'language' }, { domain: 'social', reached: -1 }] }, { id: '2026-W39', date: '2026-09-28', bands: [] }] }); await openHistory();
    const unknown = he ? 'לא נשמרו ספירות לתמונה השבועית הזאת.' : 'No saved counts for this snapshot.';
    check(cell, 'MISSING_COUNTS_REMAIN_UNKNOWN', (await history().innerText()).split(unknown).length - 1 === 3);
    check(cell, 'NO_CURRENT_COUNT_FALLBACK', !/\b1\b|\b17\b|\b0\b/.test(await history().locator('li').allTextContents().then(values => values.join(' '))));
  }, historyTab);
  await run('history-empty', async cell => {
    await reset('development', { bandSnapshots: [] }); await openHistory();
    check(cell, 'CONFIRMED_EMPTY_HISTORY_EXPLICIT', (await history().innerText()).includes(he ? 'אין תמונות שבועיות שמורות.' : 'No saved weekly snapshots.'));
    check(cell, 'NO_FABRICATED_HISTORY_ROWS', await history().locator('article').count() === 0);
  }, historyTab);
  await run('history-child-switch', async cell => {
    await reset('development'); await openHistory(); const old = await history().elementHandle();
    try { await switchChild(cell, fixture.sibling); await openHistory(); check(cell, 'ACTUAL_CHILD_SWITCH_RETIRES_HISTORY', !await old.evaluate(el => el.isConnected)); const text = await history().innerText(); check(cell, 'SIBLING_SAVED_COUNT_ONLY', /\b9\b/.test(text) && !/\b17\b|2026-W40|2026-W39/.test(text) && await history().locator('time').getAttribute('datetime') === '2026-09-21'); }
    finally { await old?.dispose(); }
  }, historyTab);
  await run('history-tabs-reachable', async cell => {
    await reset('development'); await openHistory(); const before = await storage(fixture.childId, 'bandSnapshots');
    const tabs = keepsakes().locator('.portrait-views button'); const checks = [];
    for (const index of [0, 1, 3, 2]) { const tab = tabs.nth(index); await tab.click(); await control(cell, tab); checks.push(await tab.getAttribute('aria-pressed') === 'true' && cell.controlFrame.reachable && cell.controlFrame.width >= 44 && cell.controlFrame.height >= 44); }
    check(cell, 'ALL_FOUR_EXISTING_TABS_REACHABLE', await tabs.count() === 4 && checks.length === 4 && checks.every(Boolean));
    check(cell, 'HISTORY_STORAGE_UNCHANGED', await storage(fixture.childId, 'bandSnapshots') === before);
  }, historyTab);
}
