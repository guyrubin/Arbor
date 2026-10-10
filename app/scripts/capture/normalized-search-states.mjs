/** Current search surfaces: no new routes, filters, model or Kids actions. */
import { KEPT_SEARCH_QUERIES as Q, KEPT_SEARCH_LEARN } from './kept-search-contract.mjs';
import { waitConfirmedFrame } from './confirmed-frame.mjs';
export async function collectNormalizedSearchStates(h) {
  const { page, fixture, viewport, load, run, reset, frame, check, byId, captureDiagnostics = () => null } = h;
  const he = viewport.lang === 'he', mobile = viewport.w < 1024;
  const surface = () => mobile ? page.getByRole('dialog') : page.locator('#topbar-search-results');
  const globalInput = () => mobile ? surface().locator('input') : page.locator('input[aria-controls="topbar-search-results"]');
  const results = () => mobile ? surface().locator('button.group') : surface().getByRole('option');
  const privateResult = () => results().filter({ has: page.getByText(fixture.words.search, { exact: true }) });
  const openGlobal = async query => {
    await load('overview');
    if (mobile) await page.keyboard.press('Control+k');
    await globalInput().fill(query);
    await surface().waitFor({ state: 'visible' });
  };
  const currentResult = label => results().filter({ has: page.getByText(label, { exact: true }) }).filter({ has: page.getByText(he ? 'הילד שלי' : 'My child', { exact: true }) });
  const arrive = async (cell, target, route) => {
    const outgoing = await page.locator('#main [data-route]').first().elementHandle();
    try {
      await target.click(); await page.waitForURL(url => url.hash === `#/${route}`);
      const settled = await waitConfirmedFrame(page, cell, { outgoing, routeName: route, childId: fixture.childId }, 'normalized-search-destination', captureDiagnostics);
      check(cell, 'ACTUAL_SEARCH_DESTINATION_SETTLED', settled.ready && new URL(page.url()).hash === `#/${route}`, settled);
    } finally { await outgoing?.dispose(); }
  };

  await run('journal', 'journal-normalized-search', async cell => {
    await reset();
    const search = byId('journal-search');
    for (const query of [Q.hebrew, Q.latin, Q.punctuation, Q.bidi]) {
      await search.fill(query);
      await page.locator('[id="journal-signal-moment-capture-search-private"]').waitFor({ state: 'visible' });
      check(cell, 'LOCAL_JOURNAL_NORMALIZED_EXACT_RECORD', await byId('journal-record-row').count() === 1 && (await byId('journal-record-row').innerText()).includes(fixture.words.search), { query });
    }
    for (const query of [Q.punctuationNegative, Q.bidiNegative]) {
      await search.fill(query); await byId('journal-filter-empty').waitFor({ state: 'visible' });
      check(cell, 'LOCAL_JOURNAL_PRESERVES_PUNCTUATION_BIDI', await byId('journal-record-row').count() === 0, { query });
    }
    await search.fill(Q.empty);
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="journal-record-row"]').length === 4);
    check(cell, 'JOURNAL_MARKS_ONLY_RETAINS_EXISTING_UNFILTERED_SEMANTICS', await byId('journal-record-row').count() === fixture.collections.behaviorLogs.length);
    await search.fill(Q.hebrew); await frame(cell, 'LOCAL_JOURNAL_SEARCH_44PX', search);
    check(cell, 'LOCAL_JOURNAL_SEARCH_ACCESSIBLE_AUTO_DIRECTION', await search.getAttribute('dir') === 'auto' && !!await search.getAttribute('aria-label'));
  });
  await run('shell', 'search-private-normalized', async cell => {
    await openGlobal(Q.hebrew);
    await privateResult().waitFor({ state: 'visible' });
    check(cell, 'GLOBAL_HEBREW_MARKS_AND_FINALS_FIND_EXACT_PRIVATE_ROW', await privateResult().count() === 1);
    await globalInput().fill(Q.latin); await privateResult().waitFor({ state: 'visible' });
    check(cell, 'GLOBAL_LATIN_ACCENT_CASE_MATCH_SAME_ROW', await privateResult().count() === 1);
    await frame(cell, 'GLOBAL_PRIVATE_RESULT_44PX', privateResult());
    cell.searchSurface = mobile ? 'existing-search-modal' : 'existing-desktop-topbar';
  });
  await run('journal', 'search-private-arrival', async cell => {
    await arrive(cell, privateResult(), 'journal');
    const row = page.locator('[id="journal-signal-moment-capture-search-private"]');
    await frame(cell, 'ACTUAL_PRIVATE_JOURNAL_DESTINATION', row); await row.click();
    check(cell, 'PRIVATE_RESULT_OPENS_EXISTING_RECORD_DETAIL', await byId('journal-entry-content-source').isVisible() && (await page.getByRole('dialog').innerText()).includes(fixture.words.search));
  });
  await run('shell', 'search-punctuation-bidi', async cell => {
    await openGlobal(Q.punctuation);
    for (const query of [Q.punctuation, Q.bidi]) {
      await globalInput().fill(query); await privateResult().waitFor({ state: 'visible' });
      check(cell, 'GLOBAL_PRESERVED_PUNCTUATION_BIDI_MATCH', await privateResult().count() === 1, { query });
    }
    for (const query of [Q.punctuationNegative, Q.bidiNegative]) {
      await globalInput().fill(query); await privateResult().waitFor({ state: 'hidden' });
      check(cell, 'GLOBAL_DOES_NOT_ERASE_MEANINGFUL_PUNCTUATION_BIDI', await privateResult().count() === 0, { query });
    }
    await globalInput().fill(Q.punctuation); await privateResult().waitFor({ state: 'visible' });
    await frame(cell, 'PUNCTUATION_RESULT_44PX', privateResult());
  });
  await run('shell', 'search-normalized-empty', async cell => {
    await openGlobal(Q.hebrew); await privateResult().waitFor({ state: 'visible' });
    await globalInput().fill(Q.empty); await privateResult().waitFor({ state: 'hidden' });
    const text = await surface().innerText();
    check(cell, 'MARKS_ONLY_NEVER_ENUMERATES_SYNTHETIC_PRIVATE_ROWS', fixture.collections.behaviorLogs.every(row => !text.includes(row.trigger)));
    check(cell, 'MARKS_ONLY_HAS_NO_CATALOGUE_FALLBACK_ENUMERATION', await results().count() === 1 && await byId('search-ask-row').count() === 1);
    // The existing Ask row is inspected but never invoked or sent.
    cell.normalizedEmptyBoundary = 'global-private-record-non-enumeration; existing-Ask-prefill-row-not-activated';
    await globalInput().fill('');
    await results().filter({ has: page.getByText(he ? 'פגישות' : 'Appointments', { exact: true }) }).waitFor({ state: 'visible' });
    const publicText = await surface().innerText();
    check(cell, 'TRUE_EMPTY_PUBLIC_COMMANDS_KEEP_THREE_PLACES', (he ? ['עכשיו', 'הילד שלי', 'ביחד'] : ['Now', 'My child', 'Together']).every(label => publicText.includes(label)) && fixture.collections.behaviorLogs.every(row => !publicText.includes(row.trigger)));
    check(cell, 'NO_RETIRED_HUB_LABELS_IN_PUBLIC_COMMANDS', !/Journal & Memories|יומן וזיכרונות/.test(publicText));
    await globalInput().fill(Q.empty); await frame(cell, 'MARKS_ONLY_QUERY_INPUT_REACHABLE', globalInput());
  });
  for (const [kind, query, label, route] of [
    ['visit', he ? 'בִּיקוּרִימ' : 'VÍSIT', he ? 'פגישות' : 'Appointments', 'appointments'],
    ['prepare', he ? 'מִתְכּוֹנְנִים לַפְּגִישָׁה' : 'PRÉPARE FOR A VISIT', he ? 'התייעצות' : 'Consult', 'consult'],
  ]) {
    await run('shell', `search-${kind}-current`, async cell => {
      await openGlobal(query); const row = currentResult(label); await row.waitFor({ state: 'visible' });
      check(cell, 'EXACT_ONE_CURRENT_THREE_PLACE_ROUTE_RESULT', await row.count() === 1 && (await row.innerText()).includes(he ? 'הילד שלי' : 'My child'));
      check(cell, 'EXACT_INTENT_PROMOTES_CURRENT_ROUTE_FIRST', await results().first().innerText() === await row.innerText());
      await frame(cell, 'CURRENT_INTENT_ROUTE_44PX', row);
      cell.destination = { query, currentRoute: route, currentLabel: label, place: 'child', surface: mobile ? 'modal' : 'desktop' };
    });
    await run(route, `search-${kind}-arrival`, async cell => {
      await arrive(cell, currentResult(label), route);
      check(cell, 'CURRENT_ROUTE_CONTENT_EXISTS', await page.locator(`#main [data-route="${route}"]`).isVisible());
      if (route === 'consult') check(cell, 'ACTUAL_PREPARATION_HEADING', await byId('consult-h1').innerText() === (he ? 'מתכוננים לפגישה' : 'Prepare for a visit'));
    });
  }
  await run('academy', 'learn-normalized-search', async cell => {
    await load('academy');
    const search = page.locator('#main input').first(); const spec = KEPT_SEARCH_LEARN[viewport.lang];
    await search.fill(spec.query);
    const title = page.getByRole('heading', { name: spec.title, exact: true });
    await title.waitFor({ state: 'visible' });
    check(cell, 'REAL_LOCAL_LEARN_MATCH_USES_NORMALIZED_QUERY', await title.count() === 1 && await search.inputValue() === spec.query);
    await frame(cell, 'LOCAL_LEARN_SEARCH_44PX', search);
    await search.fill(Q.empty);
    check(cell, 'LEARN_NORMALIZED_EMPTY_KEEPS_EXISTING_PUBLIC_LIBRARY', await page.locator('#main h3').count() > 1);
    await search.fill(spec.query); await title.waitFor({ state: 'visible' });
    await frame(cell, 'REAL_LEARN_MATCH_CARD_44PX', page.locator('#main button').filter({ has: title }));
  });
  await run('academy', 'learn-normalized-arrival', async cell => {
    const spec = KEPT_SEARCH_LEARN[viewport.lang];
    await page.locator('#main button').filter({ has: page.getByRole('heading', { name: spec.title, exact: true }) }).click();
    await byId('learn-reader-heading').waitFor({ state: 'visible' });
    check(cell, 'REAL_LEARN_READER_AND_EXISTING_HISTORY_DESTINATION', await byId('learn-reader-heading').innerText() === spec.title && await page.evaluate(() => history.state?.arborLearnCard) === 'executive-function' && new URL(page.url()).hash === '#/academy');
    await byId('learn-reader-heading').scrollIntoViewIfNeeded();
  });
}
