/** Actual bounded UI flows against synthetic storage. No app component is mocked. */
import { RETIRED_MONTH_IDS, SEARCH_ROUTES, recordVariant, recordQuoteProjection, recordFiltersFit } from './record-contract.mjs';
import { captureRecordPrint } from './record-print.mjs';
import { observeRecordChildFrame, observeRecordDestinationFrame, observeRecordKeepsakeEditor } from './record-child-frame.mjs';

export async function collectRecordStates({ page, context, fixture, viewport, output, sourceSha, sourceTreeSha, apiState, load, screen, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const reader = () => byId('kept-reader');
  const disclosure = () => byId('portrait-keepsakes');
  const filters = () => reader().locator('.kept-filters button');
  const rows = () => reader().locator('[data-testid="kept-item"]');
  const sendSheet = () => byId('send-sheet');
  const review = () => page.locator('#send-sheet-text');
  const dialog = () => page.getByRole('dialog').filter({ has: sendSheet() });
  const sink = () => page.evaluate(() => ({ ...window.__arborRecordShareSink }));
  const quoteProjection = (cell, id, text) => {
    const observed = recordQuoteProjection(text, fixture);
    check(cell, id, observed.genuinePresent && observed.generatedAbsent && observed.negativeFixtureIntact, observed);
  };
  const noRetired = async cell => {
    for (const id of RETIRED_MONTH_IDS) check(cell, `RETIRED_${id.toUpperCase().replaceAll('-', '_')}_ABSENT`, await byId(id).count() === 0);
  };
  const expose = async locator => { await locator.scrollIntoViewIfNeeded(); };
  const reachable = async (cell, id, locator) => {
    await expose(locator);
    const data = await locator.evaluate(el => {
      const box = el.getBoundingClientRect(); const main = document.querySelector('#main')?.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { visible: box.width > 0 && box.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
        inMain: !main || !el.closest('#main') || (y >= main.top && y <= main.bottom), hit: !!hit && (hit === el || el.contains(hit)), enabled: !el.disabled };
    });
    check(cell, id, data.visible && data.inMain && data.hit && data.enabled, data);
  };
  const reset = async (variant = 'complete', route = 'development') => {
    const collections = recordVariant(fixture, variant);
    await page.evaluate(({ id, collections }) => {
      for (const [name, values] of Object.entries(collections)) localStorage.setItem(`arbor.${name}.${id}`, JSON.stringify(values));
      localStorage.setItem('arbor.activeChildId', id);
    }, { id: fixture.childId, collections });
    await load(route);
  };
  const open = async () => {
    await disclosure().waitFor({ state: 'visible' });
    if (!await disclosure().evaluate(el => el.open)) await disclosure().locator('summary').click();
    await reader().waitFor({ state: 'visible' });
  };
  const count = async expected => page.waitForFunction(expected => document.querySelectorAll('[data-testid="kept-reader"] [data-testid="kept-item"]').length === expected, expected);
  const filterBounds = async cell => {
    const frame = await filters().evaluateAll(buttons => {
      const reader = buttons[0]?.closest('[data-testid="kept-reader"]')?.getBoundingClientRect();
      return { width: innerWidth, reader: reader ? { left: reader.left, right: reader.right } : null, buttons: buttons.map(button => {
        const box = button.getBoundingClientRect(); const style = getComputedStyle(button);
        let clipLeft = 0, clipRight = innerWidth;
        for (let node = button.parentElement; node; node = node.parentElement) {
          if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(node).overflowX)) {
            const clip = node.getBoundingClientRect(); clipLeft = Math.max(clipLeft, clip.left + node.clientLeft); clipRight = Math.min(clipRight, clip.left + node.clientLeft + node.clientWidth);
          }
        }
        const focusVisible = button.matches(':focus-visible');
        const outline = focusVisible && style.outlineStyle !== 'none' ? Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)) : 0;
        return { text: button.textContent, left: box.left, right: box.right, top: box.top, bottom: box.bottom, clipLeft, clipRight, focusVisible, outline };
      }) };
    });
    cell.filterBounds = frame;
    check(cell, 'ALL_FILTER_LABELS_AND_FOCUS_OUTLINES_UNCLIPPED', recordFiltersFit(frame), frame);
  };
  const closeReview = async () => {
    await dialog().getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
    await sendSheet().waitFor({ state: 'detached' });
  };
  const checkRows = async (cell, expected, expectedTexts) => {
    await count(expected);
    const texts = await rows().locator('.kept-words bdi').allTextContents();
    check(cell, 'EXACT_ELIGIBLE_ROW_COUNT', texts.length === expected, texts.length);
    if (expectedTexts) check(cell, 'EXACT_ELIGIBLE_TEXT_SET', JSON.stringify(texts.slice().sort()) === JSON.stringify(expectedTexts.slice().sort()));
    check(cell, 'NO_INCIDENT_AI_PRACTICE_COPARENT_PROMOTION', fixture.text.forbidden.every(value => !texts.includes(value)));
  };

  await screen('development', 'kept-closed', async cell => {
    await load('development');
    check(cell, 'DISCLOSURE_INITIALLY_CLOSED', !await disclosure().evaluate(el => el.open));
    await reachable(cell, 'KEPT_DISCLOSURE_REACHABLE', disclosure().locator('summary'));
    await noRetired(cell);
  });
  await screen('development', 'kept-reader', async cell => {
    await open();
    await checkRows(cell, fixture.expected.all, [fixture.text.boundary, ...fixture.expected.octoberText]);
    check(cell, 'UTC_BOUNDARY_TWO_MONTHS', await byId('kept-month').count() === 2);
    check(cell, 'FOUR_COUNT_FREE_FILTERS', await filters().count() === 4 && (await filters().allTextContents()).every(text => !/\d/.test(text)));
    check(cell, 'BIDI_PARENT_WORDS', await rows().locator('bdi[dir="auto"]').count() === fixture.expected.all);
    await reachable(cell, 'MONTH_PRINT_REACHABLE', byId('kept-month-print').first());
    await filterBounds(cell);
    cell.fixture = 'synthetic-confirmed-local-history-no-remote-metadata';
  });
  for (const [index, state, expected, expectedTexts] of [
    [1, 'filter-said', 3, [fixture.text.boundary, fixture.text.word, fixture.text.quote]],
    [2, 'filter-firsts', 1, [fixture.text.first]],
    [3, 'filter-independent', 1, [fixture.text.alone]],
  ]) await screen('development', state, async cell => {
    await filters().nth(index).click(); await checkRows(cell, expected, expectedTexts);
    check(cell, 'FILTER_SELECTED', await filters().nth(index).getAttribute('aria-pressed') === 'true');
    await expose(filters().nth(index));
    await filterBounds(cell);
  });
  await screen('development', 'filter-keyboard-all', async cell => {
    await filters().first().focus(); await page.keyboard.press('Enter'); await count(fixture.expected.all);
    check(cell, 'ALL_SELECTED_BY_KEYBOARD', await filters().first().getAttribute('aria-pressed') === 'true');
    await checkRows(cell, fixture.expected.all);
    await filterBounds(cell);
  });
  let itemText;
  await screen('development', 'item-review', async cell => {
    itemText = await rows().first().locator('.kept-words bdi').textContent();
    await byId('kept-item-send').first().click(); await visible(cell, 'ACTUAL_SEND_SHEET', sendSheet());
    const text = await review().inputValue();
    check(cell, 'OWN_WORDS_AND_NAME_IN_EDITABLE_TEXT', text.includes(itemText) && text.includes(fixture.childName) && await review().isEditable());
    check(cell, 'NO_GENERATED_URL_OR_IMAGE', !/https?:\/\//.test(text) && await sendSheet().locator('img').count() === 0);
    check(cell, 'NOT_SENT_BEFORE_REVIEW', (await sink()).calls === 0);
  });
  await screen('development', 'item-close-focus', async cell => {
    await closeReview();
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'kept-item-send');
    await reachable(cell, 'CLOSE_RETURNS_TO_VISIBLE_SEND', byId('kept-item-send').first());
    check(cell, 'FOCUS_RETURNED_TO_INVOKER', await byId('kept-item-send').first().evaluate(el => document.activeElement === el));
    check(cell, 'CLOSE_DID_NOT_SHARE', (await sink()).calls === 0);
  });
  await screen('development', 'item-repeat-review', async cell => {
    for (let n = 0; n < 2; n++) {
      await byId('kept-item-send').first().click(); await sendSheet().waitFor({ state: 'visible' });
      check(cell, `REOPEN_${n}_ONE_REVIEW`, await sendSheet().count() === 1);
      if (n === 0) await closeReview();
    }
    check(cell, 'REPEATED_OPEN_DOES_NOT_SEND', (await sink()).calls === 0);
  });
  await screen('development', 'reviewed-send-sandbox', async cell => {
    const edited = he ? 'מילים מומצאות שנבדקו לצילום בלבד' : 'Invented words reviewed for capture only';
    await review().fill(edited); await byId('send-sheet-send').click(); await sendSheet().waitFor({ state: 'detached' });
    const observed = await sink();
    check(cell, 'REVIEWED_EDIT_REACHED_ONLY_SANDBOX_SINK', observed.calls === 1 && observed.lastText === edited && JSON.stringify(observed.keys) === '["text"]');
    check(cell, 'NO_CLIPBOARD_WRITE', observed.clipboardCalls === 0);
    cell.fixture = 'synthetic-browser-share-sink-not-an-external-send';
    cell.shareSink = { kind: observed.kind, calls: observed.calls, clipboardCalls: observed.clipboardCalls, payloadKeys: observed.keys };
  });
  await screen('development', 'month-review-unfiltered', async cell => {
    await filters().nth(1).click(); await count(fixture.expected.said); await byId('kept-month-send').first().click();
    await sendSheet().waitFor({ state: 'visible' }); const text = await review().inputValue();
    check(cell, 'FILTERED_READER_SENDS_FULL_REVIEWABLE_MONTH', fixture.expected.octoberText.every(value => text.includes(value)) && !text.includes(fixture.text.boundary));
    check(cell, 'CHRONOLOGICAL_FULL_MONTH', fixture.expected.octoberText.every((value, index, values) => index === 0 || text.indexOf(values[index - 1]) < text.indexOf(value)));
    check(cell, 'MONTH_REVIEW_NOT_AUTO_SENT', (await sink()).calls === 1);
  });
  await screen('development', 'month-print', async cell => {
    await closeReview();
    const receipt = await captureRecordPrint({ page, context, trigger: byId('kept-month-print').first(), output, fixture, viewport, sourceSha, sourceTreeSha, apiState, cell });
    check(cell, 'ACTUAL_DELIVERY_PRINT_HTML_AND_PIXELS', receipt.passed);
    await expose(byId('kept-month-print').first());
  });
  await screen('development', 'stale-final-send', async cell => {
    await reset(); await open(); await byId('kept-month-send').first().click(); await sendSheet().waitFor({ state: 'visible' });
    await page.evaluate(id => localStorage.setItem(`arbor.keepsakes.${id}`, '[]'), fixture.childId);
    await byId('send-sheet-send').click(); await sendSheet().waitFor({ state: 'detached' });
    check(cell, 'STALE_FINAL_SEND_NEVER_REACHES_SINK', (await sink()).calls === 0 && (await sink()).clipboardCalls === 0);
    check(cell, 'REFRESH_NOTICE_AFTER_SOURCE_DELETION', (await reader().locator('[role="status"]').allTextContents()).some(text => text.includes(he ? 'לרענן' : 'Refresh')));
    await expose(reader().locator('[role="status"]').first());
  });
  await screen('development', 'stale-open-repeat', async cell => {
    await reset(); await open();
    await page.evaluate(id => localStorage.setItem(`arbor.behaviorLogs.${id}`, '[]'), fixture.childId);
    for (let n = 0; n < 2; n++) {
      await byId('kept-item-send').first().click();
      await reader().locator('[role="status"]').first().waitFor({ state: 'visible' });
      check(cell, `STALE_CONTEXT_ATTEMPT_${n}_NO_REVIEW`, await sendSheet().count() === 0);
    }
    check(cell, 'REPEATED_STALE_ATTEMPTS_NO_EGRESS', (await sink()).calls === 0 && (await sink()).clipboardCalls === 0);
    cell.fixture = 'same-document-storage-deletion-existing-context-retained-until-refresh';
  });
  const switchChild = async (name, childId, cell) => {
    const outgoing = await page.locator('#main [data-route="development"]').elementHandle();
    if (!outgoing) throw new Error('OUTGOING_CHILD_FRAME_MISSING');
    cell.childTransition = { before: await page.evaluate(observeRecordChildFrame, { outgoing, childId }) };
    const control = page.locator('button[aria-haspopup="listbox"]:visible').first();
    try {
      await control.click();
      await page.getByRole('listbox').getByRole('option').filter({ hasText: name }).click();
      const settled = await page.waitForFunction(observeRecordChildFrame, { outgoing, childId, waitUntilReady: true }, { timeout: 10000 });
      try { cell.childTransition.after = await settled.jsonValue(); } finally { await settled.dispose(); }
      check(cell, 'CHILD_KEYED_REPLACEMENT_FRAME_SETTLED', cell.childTransition.after.ready);
    } catch (error) {
      cell.childTransition.lastObserved = await page.evaluate(observeRecordChildFrame, { outgoing, childId }).catch(() => ({ unavailable: true }));
      throw error;
    } finally { await outgoing.dispose(); }
  };
  await screen('development', 'child-switch', async cell => {
    await reset(); await open(); await filters().nth(1).click(); await count(fixture.expected.said);
    await byId('kept-item-send').first().click(); await closeReview();
    await switchChild(fixture.siblingName, fixture.siblingId, cell); await open(); await count(0);
    check(cell, 'ACTUAL_SWITCHER_CHANGED_CHILD', await page.evaluate(() => localStorage.getItem('arbor.activeChildId')) === fixture.siblingId);
    check(cell, 'OLD_CHILD_WORDS_ABSENT', !await reader().textContent().then(text => text.includes(fixture.text.quote)));
    check(cell, 'CHILD_SWITCH_RESETS_FILTER_AND_REVIEW', await filters().first().getAttribute('aria-pressed') === 'true' && await sendSheet().count() === 0);
    await expose(reader());
  });
  await screen('development', 'child-return', async cell => {
    await switchChild(fixture.childName, fixture.childId, cell); await open(); await checkRows(cell, fixture.expected.all);
    check(cell, 'RETURN_RESETS_FILTER', await filters().first().getAttribute('aria-pressed') === 'true');
    check(cell, 'RETURN_HAS_NO_STALE_REVIEW', await sendSheet().count() === 0);
    await expose(reader().locator('h2'));
  });
  await screen('development', 'kept-empty', async cell => {
    await reset('empty'); await open(); await count(0);
    check(cell, 'HONEST_EMPTY_MESSAGE', await reader().locator('.kept-reader-status').count() === 1);
    check(cell, 'NO_EMPTY_EXPORT_CONTROLS', await byId('kept-month-print').count() === 0 && await byId('kept-item-send').count() === 0);
    await expose(reader());
  });
  await screen('development', 'kept-error', async cell => {
    await reset();
    await page.evaluate(id => localStorage.setItem(`arbor.keepsakes.${id}`, '{invalid-synthetic-json'), fixture.childId);
    await load('development'); await open();
    await visible(cell, 'REAL_LOCAL_PARSE_ERROR_RETRY', reader().getByRole('button', { name: he ? 'לנסות שוב' : 'Try again', exact: true }));
    check(cell, 'NO_PARTIAL_ERROR_MONTH_EXPORT', await byId('kept-month-print').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.disabled)));
    check(cell, 'NO_ERROR_ITEM_EXPORT', await byId('kept-item-send').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.disabled)));
    cell.fixture = 'malformed-synthetic-keepsakes-local-storage-not-remote-failure';
  });
  await screen('development', 'kept-retry', async cell => {
    await page.evaluate(({ id, rows }) => localStorage.setItem(`arbor.keepsakes.${id}`, JSON.stringify(rows)), { id: fixture.childId, rows: fixture.collections.keepsakes });
    await reader().getByRole('button', { name: he ? 'לנסות שוב' : 'Try again', exact: true }).click(); await count(fixture.expected.all);
    check(cell, 'RETRY_RECOVERS_REAL_LOCAL_HISTORY', await byId('kept-month-print').first().isEnabled());
    await expose(reader().locator('h2'));
  });
  await screen('development', 'kept-incomplete', async cell => {
    await reset('incomplete'); await open(); await count(203);
    check(cell, 'PARTIAL_MONTH_PRINT_DISABLED', await byId('kept-month-print').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.disabled)));
    check(cell, 'PARTIAL_MONTH_SEND_DISABLED', await byId('kept-month-send').evaluateAll(nodes => nodes.length > 0 && nodes.every(node => node.disabled)));
    check(cell, 'CONFIRMED_INDIVIDUAL_STILL_REVIEWABLE', await byId('kept-item-send').first().isEnabled());
    await reachable(cell, 'EXPLICIT_LOAD_MORE_REACHABLE', reader().getByRole('button', { name: he ? 'לטעינת דברים נוספים ששמרתם' : 'Load more saved things', exact: true }));
    // Return to the disabled month header for the required app-font PNG. The
    // bounded exact-font sampler deliberately does not walk 200 full row DOMs.
    await expose(reader().locator('h2'));
    cell.fixture = '201-synthetic-language-rows-real-200-row-history-window';
  });
  await screen('development', 'kept-load-more', async cell => {
    await reader().getByRole('button', { name: he ? 'לטעינת דברים נוספים ששמרתם' : 'Load more saved things', exact: true }).click(); await count(204);
    check(cell, 'COMPLETE_MONTH_EXPORT_UNLOCKED', await byId('kept-month-print').first().isEnabled() && await byId('kept-month-send').first().isEnabled());
    check(cell, 'LOAD_MORE_RETIRED_AT_END', await reader().getByRole('button', { name: he ? 'לטעינת דברים נוספים ששמרתם' : 'Load more saved things', exact: true }).count() === 0);
    await expose(reader().locator('h2'));
  });
  await screen('development', 'preserved-firsts', async cell => {
    await reset(); await open(); const tabs = disclosure().locator('.portrait-views button');
    await tabs.nth(1).click();
    // This bounded fixture has no current-age score confidence. The real
    // Firsts card intentionally shows its empty picture, without a CDC footer.
    // The heading's span includes Material Symbols own text, so exact
    // getByText(label) is not its accessible/rendered content boundary.
    const card = disclosure().locator('.portrait-keepsakes-body > section');
    const observed = { selected: await tabs.nth(1).getAttribute('aria-pressed') === 'true', keptReaders: await reader().count(),
      cardCount: await card.count(), cardVisible: await card.isVisible(), label: (await card.innerText()).includes(he ? 'תמונת ההתפתחות' : 'Growth picture'),
      child: (await card.innerText()).includes(fixture.childName) };
    check(cell, 'FIRSTS_CONTROL_AND_ACTUAL_CONTENT', observed.selected && observed.keptReaders === 0 && observed.cardCount === 1 && observed.cardVisible && observed.label && observed.child, observed);
    cell.fixture = 'existing-firsts-empty-picture-no-current-age-score-confidence';
    await expose(tabs.nth(1));
  });
  await screen('development', 'preserved-tree', async cell => {
    await disclosure().locator('.portrait-views button').nth(2).click(); await visible(cell, 'EXISTING_TREE_VISIBLE', byId('growth-arbor-tree'));
    check(cell, 'NOTICED_FIRST_STILL_HAS_TREE_LEAF', await byId('growth-arbor-tree-leaf').count() > 0);
    await expose(byId('growth-arbor-tree'));
  });
  await screen('development', 'retired-development', async cell => { await noRetired(cell); check(cell, 'THREE_PRESERVED_DISCLOSURE_VIEWS', await disclosure().locator('.portrait-views button').count() === 3); });
  await screen('timeline', 'preserved-timeline-months', async cell => {
    await load('timeline'); await byId('timeline-months-disclosure').locator('summary').click();
    check(cell, 'TIMELINE_MONTHS_STILL_OPEN', await byId('timeline-months-disclosure').evaluate(el => el.open));
    check(cell, 'TIMELINE_MONTH_NODES_PRESENT', await byId('timeline-months-disclosure').locator('h4').count() > 0);
    await expose(byId('timeline-months-disclosure').locator('summary'));
  });
  await screen('language', 'preserved-said-page', async cell => {
    await load('language');
    const negativeStored = await page.evaluate(id => JSON.parse(localStorage.getItem(`arbor.keepsakes.${id}`) || '[]').find(row => row.id === 'capture-record-ai'), fixture.childId);
    check(cell, 'REAL_GENERATED_NEGATIVE_STILL_STORED', negativeStored?.source === 'ai_proposed_parent_confirmed' && negativeStored?.note === fixture.text.forbidden[1]);
    quoteProjection(cell, 'LANGUAGE_LIST_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', await byId('said-list').innerText());
    await byId('said-page-door').click();
    await page.waitForURL(url => url.hash.includes('view=said')); check(cell, 'EXISTING_SAID_PAGE_ROUTE', new URL(page.url()).hash === '#/language?view=said');
    await visible(cell, 'EXISTING_SAID_PAGE', byId('said-page'));
    quoteProjection(cell, 'SAID_PAGE_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', await byId('said-sheet').innerText());
    check(cell, 'EXACT_ONE_PARENT_QUOTE_IN_SAID_MONTH', await byId('said-month').locator('li').count() === 1);
    const before = await sink();
    await byId('said-send').click(); await sendSheet().waitFor({ state: 'visible' });
    const reviewedText = await review().inputValue();
    quoteProjection(cell, 'SAID_REVIEW_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', reviewedText);
    await byId('send-sheet-send').click(); await sendSheet().waitFor({ state: 'detached' });
    const sent = await sink();
    quoteProjection(cell, 'SAID_SANDBOX_EXPORT_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', sent.lastText);
    check(cell, 'SAID_REVIEW_SENT_ONLY_TO_SANDBOX', sent.calls === before.calls + 1 && sent.lastText === reviewedText
      && sent.clipboardCalls === before.clipboardCalls && JSON.stringify(sent.keys) === '["text"]');
    cell.quoteExport = { kind: sent.kind, destination: 'synthetic-browser-share-sink', reviewedText, payloadKeys: sent.keys };
    await expose(byId('said-sheet'));
  });
  await screen('milestones', 'preserved-milestone-editor', async cell => {
    await load('milestones'); await visible(cell, 'EXISTING_MILESTONE_MAP', byId('ms-shelf-map'));
    const headerText = await byId('ms-header').innerText();
    const quoteState = recordQuoteProjection(headerText, fixture);
    check(cell, 'MILESTONE_CONTEXT_EXCLUDES_GENERATED_QUOTE', quoteState.generatedAbsent && quoteState.negativeFixtureIntact, quoteState);
    check(cell, 'MILESTONE_CONTEXT_RETAINS_GENUINE_PARENT_WORDS', headerText.includes(fixture.text.first) || quoteState.genuinePresent);
    const doors = byId('ms-shelf-door');
    for (let n = 0; n < Math.min(8, await doors.count()) && await byId('ms-keepsake').count() === 0; n++) await doors.nth(n).click();
    const note = byId('ms-keepsake').filter({ hasText: fixture.text.first });
    // The copied catalogue row retains its honest age/citation. Traverse the
    // existing Earlier disclosure instead of changing that fixture metadata.
    const band = byId('ms-shelf-band').filter({ has: note });
    if (await band.count() === 1 && await band.evaluate(el => el.tagName === 'DETAILS' && !el.open)) await band.locator(':scope > summary').click();
    await visible(cell, 'EXISTING_PARENT_NOTE_ROW', note);
    await note.getByRole('button').click();
    await visible(cell, 'EXISTING_KEEPSAKE_EDITOR', byId('first-keepsake-sheet'));
    const expected = { expectedNote: fixture.text.first, expectedDate: '2026-10-04' };
    cell.keepsakeEditor = { before: await page.evaluate(observeRecordKeepsakeEditor, expected) };
    let ready;
    try {
      ready = await page.waitForFunction(observeRecordKeepsakeEditor, { ...expected, waitUntilReady: true }, { timeout: 8000 });
      cell.keepsakeEditor.after = await ready.jsonValue();
      check(cell, 'EXISTING_NOTE_AND_DATE_PRESERVED', cell.keepsakeEditor.after.ready, cell.keepsakeEditor.after);
    } catch (error) {
      cell.keepsakeEditor.lastObserved = await page.evaluate(observeRecordKeepsakeEditor, expected).catch(() => ({ observationFailed: true }));
      throw error;
    } finally { await ready?.dispose(); }
    check(cell, 'EXISTING_OPTIONAL_PHOTO_CONTROL_RETAINED', await byId('first-keepsake-sheet').locator('input[type="file"][accept="image/*"]').count() === 1);
    cell.boundary = 'Existing editor/note/photo path is read-only; no file chooser, upload or child record mutation is exercised here.';
  });
  await screen('consult', 'professional-quote-record', async cell => {
    // Existing profession intake deep-link; the actual app builds its own
    // scoped packet and preview. No packet builder or source state is replaced.
    await load('consult?intake=slp');
    check(cell, 'REAL_SLP_INTAKE_ROUTE', new URL(page.url()).hash === '#/consult?intake=slp');
    await byId('consult-build').click();
    const all = byId('consult-preview-all');
    if (await all.isVisible()) await all.click();
    await visible(cell, 'ACTUAL_PROFESSIONAL_RECORD_PREVIEW', byId('consult-export-preview'));
    quoteProjection(cell, 'PROFESSIONAL_PREVIEW_PRESERVES_PARENT_QUOTE_EXCLUDES_GENERATED', await byId('consult-export-preview').innerText());
    const quote = byId('consult-export-preview').locator('p').filter({ hasText: fixture.text.quote });
    check(cell, 'EXACT_ONE_PARENT_QUOTE_IN_PROFESSIONAL_PREVIEW', await quote.count() === 1);
    await reachable(cell, 'PROFESSIONAL_PARENT_QUOTE_VISIBLE', quote);
    cell.boundary = 'Actual SLP intake preview only; no professional recipient, copy, PDF or send is triggered.';
  });
  for (const route of ['overview', 'memory']) await screen(route, `retired-${route}`, async cell => { await load(route); await noRetired(cell); check(cell, 'CURRENT_ROUTE_STILL_MOUNTED', new URL(page.url()).hash === `#/${route}`); });

  for (const entry of SEARCH_ROUTES) {
    const label = entry[viewport.lang];
    const searchSurface = () => viewport.w < 1024 ? page.getByRole('dialog') : page.locator('#topbar-search-results');
    // Catalogue results can repeat this text as a subtitle. Require the real
    // route's My child subtitle too, rather than choosing an arbitrary first.
    const result = () => searchSurface().getByRole(viewport.w < 1024 ? 'button' : 'option')
      .filter({ has: page.getByText(label, { exact: true }) })
      .filter({ has: page.getByText(he ? 'הילד שלי' : 'My child', { exact: true }) });
    await screen('shell', `search-${entry.route}-label`, async cell => {
      await load('overview');
      if (viewport.w < 1024) { await page.keyboard.press('Control+k'); await page.getByRole('dialog').locator('input').fill(label); }
      else await page.locator('input[aria-controls="topbar-search-results"]').fill(label);
      await result().waitFor({ state: 'visible' });
      check(cell, 'EXACTLY_ONE_CURRENT_ROUTE_RESULT', await result().count() === 1);
      check(cell, 'CURRENT_MY_CHILD_PLACE_LABEL', (await result().innerText()).includes(he ? 'הילד שלי' : 'My child'));
      check(cell, 'NO_LEGACY_HUB_SUBTITLE', !/Growth|Journal & Memories|צמיחה|יומן וזיכרונות/.test(await result().innerText()));
      await reachable(cell, 'SEARCH_RESULT_REACHABLE', result());
      cell.search = { route: entry.route, surface: viewport.w < 1024 ? 'mobile-search-modal' : 'desktop-topbar-search', expectedPlace: 'child' };
    });
    await screen(entry.route, `search-${entry.route}-arrived`, async cell => {
      const outgoing = await page.locator('#main [data-route="overview"]').elementHandle();
      if (!outgoing) throw new Error('SEARCH_OUTGOING_FRAME_MISSING');
      const args = { outgoing, childId: fixture.childId, routeName: entry.route, contentSelector: entry.contentSelector };
      cell.searchTransition = { before: await page.evaluate(observeRecordDestinationFrame, args) };
      let ready;
      try {
        await result().click(); await page.waitForURL(url => url.hash === `#/${entry.route}`);
        ready = await page.waitForFunction(observeRecordDestinationFrame, { ...args, waitUntilReady: true }, { timeout: 10000 });
        cell.searchTransition.after = await ready.jsonValue();
        check(cell, 'SEARCH_REAL_SETTLED_DESTINATION_REACHED', cell.searchTransition.after.ready, cell.searchTransition.after);
      } catch (error) {
        cell.searchTransition.lastObserved = await page.evaluate(observeRecordDestinationFrame, args).catch(() => ({ observationFailed: true }));
        throw error;
      } finally { await ready?.dispose(); await outgoing.dispose(); }
    });
  }
}
