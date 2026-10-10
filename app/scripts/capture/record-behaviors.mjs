/** Bounded accepted Behaviors -> shared capture -> Journal regressions. */
export const BEHAVIOR_RECORD_STATES = Object.freeze([
  ...['behaviors-capture-door', 'hard-starters', 'hard-review', 'hard-review-cancel', 'hard-confirm'].map(state => ({ route: 'behaviors', state })),
  ...['journal-hard-arrival', 'journal-context-expanded', 'journal-context-last-entry', 'journal-detail-edit', 'journal-filter-combination', 'journal-collision-first', 'journal-collision-second', 'journal-empty-first-fold'].map(state => ({ route: 'journal', state })),
]);
// Existing local timeline ledgers only; the empty child has no mock-server memory.
export const JOURNAL_EMPTY_SOURCES = Object.freeze(['behaviorLogs', 'milestones', 'actionPlans', 'playLogs', 'actionLoops', 'insights', 'practiceEvents', 'speechAttempts', 'mimicSessions', 'adventureResults', 'missionRecords', 'heroRuns', 'keepsakes', 'langObs']);
/** A first-fold claim must be measured before any capture-owned scrolling. */
export function journalControlAtFirstFold(frame) {
  const values = [frame?.row?.top, frame?.row?.bottom, frame?.row?.left, frame?.row?.right, frame?.main?.top, frame?.main?.bottom, frame?.rail?.top, frame?.rail?.bottom, frame?.width, frame?.height, frame?.bottomLimit, frame?.scrollTop];
  return values.every(Number.isFinite) && Math.abs(frame.scrollTop) <= 1 && frame.hit === true
    && frame.row.top >= Math.max(0, frame.main.top) && frame.row.bottom <= Math.min(frame.height, frame.main.bottom, frame.bottomLimit, frame.rail.top, frame.nav?.top ?? frame.height)
    // DOMRect edges can be separately rounded after a translated frame (the
    // observed 44px control measured 43.9999694824). Permit <1/1024 CSS px
    // only in this size subtraction, never in viewport/rail/occlusion bounds.
    && frame.row.bottom - frame.row.top + 1 / 1024 >= 44 && frame.row.left >= 0 && frame.row.right <= frame.width && frame.row.right > frame.row.left;
}
/** The empty CTA's actual contract focuses the first compose tile. Its source
 * order is voice/photo/text; observing voice focus does not start recording. */
export function observeJournalCaptureFocus({ waitUntilReady = false } = {}) {
  const tiles = [...document.querySelectorAll('#main [data-module="journal-compose"] [data-capture-bar] button')];
  const active = document.activeElement;
  const frame = { tileCount: tiles.length, firstMode: tiles[0]?.getAttribute('data-capture-tile') ?? null,
    activeMode: active?.getAttribute('data-capture-tile') ?? null, activeTestId: active?.getAttribute('data-testid') ?? null,
    ready: tiles.length === 3 && active === tiles[0] };
  return waitUntilReady && !frame.ready ? false : frame;
}
export function collisionFixture() {
  const first = { id: 'capture-collision-first', timestamp: '2026-10-06T10:00:10Z', behaviorType: 'Transition Refusal', trigger: 'CAPTURE SAME MINUTE SHOES', response: 'CAPTURE FIRST RESPONSE', notes: 'CAPTURE FIRST NOTE', intensity: 3, durationMinutes: 5, context: 'Home', resolved: false };
  return [first, { ...first, id: 'capture-collision-second', timestamp: '2026-10-06T10:00:20Z', response: 'CAPTURE SECOND RESPONSE', notes: 'CAPTURE SECOND NOTE', resolved: true }];
}
export async function collectBehaviorRecordStates({ page, fixture, viewport, load, screen, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const closeLabel = he ? 'סגור' : 'Close';
  const trigger = he ? 'נעלי דוגמה' : 'Capture shoes';
  const response = he ? 'חיכינו יחד' : 'Waited together';
  const notes = he ? 'פרטים מומצאים לצילום' : 'Invented capture details';
  const contextQuery = 'CAPTURE SAME MINUTE SHOES';
  const records = [...fixture.collections.behaviorLogs, ...collisionFixture()];
  const logs = () => page.evaluate(id => JSON.parse(localStorage.getItem(`arbor.behaviorLogs.${id}`) || '[]'), fixture.childId);
  const openHard = async () => {
    await page.locator('[data-testid="behaviors-capture-card"] [data-capture-tile="text"]').click();
    await byId('quicklog-moment-form').waitFor({ state: 'visible' });
    await page.getByRole('dialog').locator('input[type="checkbox"]').check();
    await page.locator('#quick-log-trigger').waitFor({ state: 'visible' });
  };
  const fillHard = async () => {
    await page.locator('#quick-log-type').selectOption('Transition Refusal');
    await page.locator('#quick-log-trigger').fill(trigger); await page.locator('#quick-log-response').fill(response);
    const details = page.getByRole('dialog').locator('details');
    if (!await details.evaluate(el => el.open)) await details.locator('summary').click();
    await page.locator('#quick-log-notes').fill(notes); await page.locator('#quick-log-duration').fill('5');
    await page.locator('#quick-log-context').selectOption('Home');
  };
  const submit = () => page.getByRole('dialog').locator('form button[type="submit"]').click();
  const reviewButton = () => page.getByRole('dialog').getByRole('button', { name: he ? 'אישור ושמירה ברשומה' : 'Confirm and save to record', exact: true });
  const closeDialog = async () => { await page.getByRole('dialog').getByRole('button', { name: closeLabel, exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'detached' }); };
  const firstFoldFrame = async locator => {
    await page.waitForFunction(() => Math.abs(document.querySelector('#main')?.scrollTop ?? -10) <= 1);
    return locator.evaluate(el => {
      const bounds = node => { const rect = node.getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }; };
      const main = document.querySelector('#main'); const row = bounds(el);
      const dock = [...document.querySelectorAll('nav')].find(node => getComputedStyle(node).position === 'fixed' && node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().bottom >= innerHeight - 1);
      const launcher = document.querySelector('[data-testid="companion-launcher-rail"]');
      const rail = launcher && launcher.getBoundingClientRect().height > 0 && getComputedStyle(launcher).visibility !== 'hidden' ? bounds(launcher) : null;
      const nav = dock ? bounds(dock) : null;
      const hit = document.elementFromPoint((row.left + row.right) / 2, (row.top + row.bottom) / 2);
      return { row, main: bounds(main), rail, nav, width: innerWidth, height: innerHeight, bottomLimit: Math.min(rail?.top ?? innerHeight, nav?.top ?? innerHeight),
        scrollTop: main.scrollTop, hit: !!hit && (hit === el || el.contains(hit)), firstId: el.id || el.getAttribute('data-testid') };
    });
  };
  let savedId;
  await screen('behaviors', 'behaviors-capture-door', async cell => {
    await page.evaluate(({ id, rows }) => localStorage.setItem(`arbor.behaviorLogs.${id}`, JSON.stringify(rows)), { id: fixture.childId, rows: records });
    await load('behaviors');
    await visible(cell, 'CURRENT_CAPTURE_DOOR', byId('behaviors-capture-card'));
    check(cell, 'ALL_EXISTING_MODALITY_DOORS_PRESENT', await byId('behaviors-capture-card').locator('[data-capture-tile="text"], [data-capture-tile="voice"], [data-capture-tile="photo"]').count() === 3);
    await openHard(); check(cell, 'SHARED_CAPTURE_OPENS_IN_PLACE', new URL(page.url()).hash === '#/behaviors');
    check(cell, 'NO_WRITE_ON_OPEN', (await logs()).length === records.length);
  });
  await screen('behaviors', 'hard-starters', async cell => {
    await fillHard();
    const original = { trigger: await page.locator('#quick-log-trigger').inputValue(), response: await page.locator('#quick-log-response').inputValue(), notes: await page.locator('#quick-log-notes').inputValue(), duration: await page.locator('#quick-log-duration').inputValue(), intensity: await page.locator('#quick-log-intensity').inputValue() };
    for (const [starter, type] of [['screen', 'Screentime Dispute'], ['sibling', 'Sibling Conflict'], ['morning', 'Transition Refusal']]) {
      await page.locator(`[data-log-starter="${starter}"]`).click();
      check(cell, `STARTER_${starter.toUpperCase()}_SETS_ONLY_TYPE`, await page.locator('#quick-log-type').inputValue() === type
        && await page.locator('#quick-log-trigger').inputValue() === original.trigger && await page.locator('#quick-log-response').inputValue() === original.response
        && await page.locator('#quick-log-notes').inputValue() === original.notes && await page.locator('#quick-log-duration').inputValue() === original.duration
        && await page.locator('#quick-log-intensity').inputValue() === original.intensity);
    }
    await byId('quicklog-starters').scrollIntoViewIfNeeded();
  });
  await screen('behaviors', 'hard-review', async cell => {
    await submit(); await visible(cell, 'REAL_SHARED_REVIEW', reviewButton());
    const text = await page.getByRole('dialog').innerText();
    check(cell, 'REVIEW_PRESERVES_TYPED_FIELDS', [trigger, response, notes].every(value => text.includes(value)));
    check(cell, 'REVIEW_IS_NOT_A_WRITE', (await logs()).length === records.length);
  });
  await screen('behaviors', 'hard-review-cancel', async cell => {
    await page.getByRole('dialog').getByRole('button', { name: he ? 'מחיקה' : 'Discard', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    check(cell, 'DISCARD_WRITES_NOTHING', (await logs()).length === records.length);
    check(cell, 'DISCARD_STAYS_ON_BEHAVIORS', new URL(page.url()).hash === '#/behaviors');
  });
  await screen('behaviors', 'hard-confirm', async cell => {
    await openHard(); await fillHard(); await submit(); await reviewButton().click();
    await visible(cell, 'REAL_CAPTURE_REPLY_AFTER_COMMIT', byId('quicklog-reply'));
    const stored = await logs(); const matches = stored.filter(row => row.trigger === trigger);
    savedId = matches[0]?.id;
    check(cell, 'CONFIRM_COMMITS_EXACTLY_ONE_LOCAL_LOG', stored.length === records.length + 1 && matches.length === 1);
    check(cell, 'CONFIRMED_FIELDS_PRESERVED', matches[0]?.response === response && matches[0]?.notes === notes && matches[0]?.durationMinutes === 5 && matches[0]?.behaviorType === 'Transition Refusal');
    cell.fixture = 'reviewed-synthetic-local-record-write-no-provider';
  });
  await screen('journal', 'journal-hard-arrival', async cell => {
    await byId('quicklog-reply-done').click(); await page.getByRole('dialog').waitFor({ state: 'detached' });
    await byId('behaviors-journal-link').click(); await page.waitForURL(url => url.hash === '#/journal');
    check(cell, 'REAL_RECORD_LINK_APPLIES_HARD_FILTER', await byId('journal-filter-hard').getAttribute('aria-pressed') === 'true');
    await visible(cell, 'NEW_CONFIRMED_ROW_REACHABLE', page.locator(`#journal-signal-moment-${savedId}`));
    check(cell, 'COLLIDING_IDENTITIES_BOTH_PRESENT', await page.locator('#journal-signal-moment-capture-collision-first, #journal-signal-moment-capture-collision-second').count() === 2);
    check(cell, 'MEANINGFUL_CONTEXT_INITIALLY_COLLAPSED', await byId('journal-last-context').evaluate(el => el.tagName === 'DETAILS' && !el.open));
    const firstFrame = await firstFoldFrame(byId('journal-record-row').first());
    check(cell, 'FIRST_RECORD_IS_NEW_CONFIRMED_LOG', firstFrame.firstId === `journal-signal-moment-${savedId}`);
    check(cell, 'FIRST_RECORD_VISIBLE_AND_HITTABLE_BEFORE_SCROLL', journalControlAtFirstFold(firstFrame), firstFrame);
    cell.firstFold = { ...firstFrame, captureOwnedScroll: false };
  });
  await screen('journal', 'journal-context-expanded', async cell => {
    await byId('journal-search').fill(contextQuery);
    await page.locator('#journal-signal-moment-capture-collision-first').waitFor({ state: 'visible' });
    check(cell, 'QUERY_HIDES_LATEST_OVERALL_PARENT_RECORD', await page.locator(`#journal-signal-moment-${savedId}`).count() === 0);
    const summary = byId('journal-last-context-toggle');
    check(cell, 'NATIVE_CONTEXT_SUMMARY_NAMED', await summary.evaluate(el => el.tagName === 'SUMMARY' && !!el.textContent?.trim()));
    await summary.focus(); await page.keyboard.press('Enter');
    check(cell, 'CONTEXT_KEYBOARD_EXPANDS', await byId('journal-last-context').evaluate(el => el.open));
    await visible(cell, 'CONTEXT_LAST_ENTRY_ACTION_VISIBLE', byId('journal-last-words'));
    check(cell, 'CONTEXT_RETAINS_LAST_PARENT_WORDS', (await byId('journal-last-context').innerText()).includes(trigger));
    check(cell, 'CONTEXT_DOES_NOT_CHANGE_HARD_FILTER', await byId('journal-filter-hard').getAttribute('aria-pressed') === 'true');
  });
  await screen('journal', 'journal-context-last-entry', async cell => {
    const hash = new URL(page.url()).hash;
    await byId('journal-last-words').click(); await visible(cell, 'CONTEXT_OPENS_REAL_ENTRY_DETAILS', byId('journal-entry-edit'));
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'journal-last-words');
    check(cell, 'ESCAPE_RETURNS_FOCUS_TO_REAL_CONTEXT_ACTION', await byId('journal-last-words').evaluate(el => document.activeElement === el));
    check(cell, 'ESCAPE_PRESERVES_QUERY_AND_FILTER', await byId('journal-search').inputValue() === contextQuery && await byId('journal-filter-hard').getAttribute('aria-pressed') === 'true');
    await byId('journal-last-words').click(); await byId('journal-entry-edit').waitFor({ state: 'visible' });
    check(cell, 'REPEATED_CONTEXT_OPEN_HAS_ONE_DETAIL_SHEET', await page.getByRole('dialog').count() === 1);
    const text = await page.getByRole('dialog').innerText();
    check(cell, 'CONTEXT_OPENS_EXACT_LAST_PARENT_RECORD', [trigger, response, notes].every(value => text.includes(value)));
    check(cell, 'LAST_ENTRY_PRESERVES_HASH_QUERY_AND_FILTER', new URL(page.url()).hash === hash && await byId('journal-search').inputValue() === contextQuery && await byId('journal-filter-hard').getAttribute('aria-pressed') === 'true');
    check(cell, 'LAST_ENTRY_READ_DOES_NOT_WRITE', (await logs()).length === records.length + 1);
  });
  await screen('journal', 'journal-detail-edit', async cell => {
    if (await page.getByRole('dialog').count()) await closeDialog();
    if (await byId('journal-last-context').evaluate(el => el.open)) { await byId('journal-last-context-toggle').focus(); await page.keyboard.press('Space'); }
    check(cell, 'CONTEXT_KEYBOARD_CLOSE_HIDES_DETAILS', !await byId('journal-last-context').evaluate(el => el.open) && !await byId('journal-last-words').isVisible());
    await byId('journal-search').fill('');
    await page.locator(`#journal-signal-moment-${savedId}`).click();
    await visible(cell, 'DETAIL_EXISTING_EDIT_CONTROL', byId('journal-entry-edit'));
    const detail = await page.getByRole('dialog').innerText();
    check(cell, 'DETAIL_EXACT_TYPED_FIELDS', [trigger, response, notes].every(value => detail.includes(value)));
    const detailHash = new URL(page.url()).hash;
    await byId('journal-entry-edit').click(); await page.locator('#quick-log-trigger').waitFor({ state: 'visible' });
    check(cell, 'EDIT_REUSES_SHARED_SHEET_IN_PLACE', detailHash.split('?')[0] === '#/journal' && new URL(page.url()).hash === detailHash && await page.locator('#quick-log-trigger').inputValue() === trigger);
    check(cell, 'EDIT_OPEN_DOES_NOT_APPEND', (await logs()).length === records.length + 1);
  });
  await screen('journal', 'journal-filter-combination', async cell => {
    await closeDialog();
    await byId('journal-record-filters').locator('summary').click();
    await byId('journal-type-filter').selectOption('Transition Refusal'); await byId('journal-intensity-filter').selectOption('3'); await byId('journal-status-filter').selectOption('resolved');
    await byId('journal-search').fill('CAPTURE SECOND NOTE');
    await page.locator('#journal-signal-moment-capture-collision-second').waitFor({ state: 'visible' });
    check(cell, 'TYPE_INTENSITY_STATUS_NOTES_FILTER_INTERSECT', await page.locator('[id^="journal-signal-"]').count() === 1 && await page.locator('#journal-signal-moment-capture-collision-first').count() === 0);
    await byId('journal-record-filters').scrollIntoViewIfNeeded();
  });
  for (const which of ['first', 'second']) await screen('journal', `journal-collision-${which}`, async cell => {
    if (await page.getByRole('dialog').count()) await closeDialog();
    await byId('journal-search').fill(''); await byId('journal-status-filter').selectOption('all');
    await page.locator(`#journal-signal-moment-capture-collision-${which}`).click();
    await byId('journal-entry-edit').waitFor({ state: 'visible' });
    const text = await page.getByRole('dialog').innerText();
    check(cell, 'DISTINCT_SAME_MINUTE_IDENTITY_OWN_DETAILS', text.includes(`CAPTURE ${which.toUpperCase()} RESPONSE`) && text.includes(`CAPTURE ${which.toUpperCase()} NOTE`) && !text.includes(`CAPTURE ${which === 'first' ? 'SECOND' : 'FIRST'} RESPONSE`));
    check(cell, 'DETAIL_HAS_EXISTING_RECORD_ACTIONS', await byId('journal-entry-resolve').isVisible() && await byId('journal-entry-delete').isVisible());
    // Capture the detail before close; the next state closes it on entry.
    if (which === 'first') cell.keepDialogForNextState = true;
  });
  await screen('journal', 'journal-empty-first-fold', async cell => {
    if (await page.getByRole('dialog').count()) await closeDialog();
    // Only the already declared synthetic sibling is emptied; no user child,
    // hook, backend response or source confirmation is replaced.
    const sibling = (fixture.parsed.locales?.[viewport.lang] ?? fixture.parsed).siblings.find(item => item.child.id === fixture.siblingId && item.child.demo === true);
    if (!sibling) throw new Error('SYNTHETIC_EMPTY_SIBLING_REQUIRED');
    await page.evaluate(({ id, names }) => { for (const name of names) localStorage.setItem(`arbor.${name}.${id}`, '[]'); }, { id: fixture.siblingId, names: JOURNAL_EMPTY_SOURCES });
    await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
    await page.getByRole('listbox').getByRole('option').filter({ hasText: fixture.siblingName }).click();
    // The feed is the existing query-addressable subroute; plain #/journal
    // deliberately opens shelves. This is a real full feed deep-link load.
    await load('journal?view=all'); await visible(cell, 'REAL_EMPTY_ACTION_VISIBLE', byId('journal-empty-cta'));
    check(cell, 'REAL_EMPTY_FEED_SUBROUTE', new URL(page.url()).hash === '#/journal?view=all');
    check(cell, 'EMPTY_CHILD_HAS_NO_RENDERED_RECORDS', await byId('journal-record-row').count() === 0);
    const frame = await firstFoldFrame(byId('journal-empty-cta'));
    check(cell, 'EMPTY_ACTION_VISIBLE_AND_HITTABLE_BEFORE_SCROLL', journalControlAtFirstFold(frame), frame);
    await byId('journal-empty-cta').focus();
    check(cell, 'VISIBLE_EMPTY_ACTION_CAN_RECEIVE_FOCUS', await byId('journal-empty-cta').evaluate(el => document.activeElement === el && !el.disabled));
    check(cell, 'EMPTY_CHILD_RETIRES_PRIOR_CONTEXT', await byId('journal-last-context').count() === 0 && await page.getByRole('dialog').count() === 0);
    cell.firstFold = { ...frame, captureOwnedScroll: false };
    cell.fixture = 'declared-synthetic-empty-sibling-existing-local-ledgers';
  }, async cell => {
    // Save the unscrolled PNG first. Then exercise the CTA's real destination:
    // focus the compose tile, open its actual capture form, and cancel cleanly.
    cell.shotPhase = 'unscrolled-empty-before-activation';
    cell.emptyActivation = { phase: 'before-cta', destination: 'journal-compose-first-tile-then-explicit-text', afterInitialScreenshot: true,
      before: await page.evaluate(observeJournalCaptureFocus) };
    let ready;
    try {
      await byId('journal-empty-cta').click(); cell.emptyActivation.phase = 'cta-clicked';
      ready = await page.waitForFunction(observeJournalCaptureFocus, { waitUntilReady: true }, { timeout: 8000 });
      cell.emptyActivation.after = await ready.jsonValue();
      check(cell, 'EMPTY_CTA_FOCUSES_REAL_CAPTURE_TILE', cell.emptyActivation.after.ready && cell.emptyActivation.after.firstMode === 'voice', cell.emptyActivation.after);
    } catch (error) {
      cell.emptyActivation.lastObserved = await page.evaluate(observeJournalCaptureFocus).catch(() => ({ observationFailed: true }));
      throw error;
    } finally { await ready?.dispose(); }
    // Choose the existing text option explicitly. Do not activate the focused
    // voice tile or substitute focus/DOM events for the real CTA behavior.
    const tile = page.locator('#main [data-capture-bar] [data-capture-tile="text"]');
    await tile.click(); await visible(cell, 'EMPTY_CTA_DESTINATION_OPENS_REAL_CAPTURE', byId('quicklog-moment-form'));
    cell.emptyActivation.phase = 'text-capture-open';
    check(cell, 'EMPTY_CAPTURE_RETAINS_CHILD_AND_FEED', new URL(page.url()).hash === '#/journal?view=all'
      && await page.evaluate(() => localStorage.getItem('arbor.activeChildId')) === fixture.siblingId);
    check(cell, 'EMPTY_CAPTURE_STARTS_WITHOUT_INVENTED_TEXT', await page.locator('#quick-log-moment').inputValue() === '');
    await page.keyboard.press('Escape'); await page.getByRole('dialog').waitFor({ state: 'detached' });
    const empty = await page.evaluate(({ id, names }) => names.every(name => JSON.parse(localStorage.getItem(`arbor.${name}.${id}`) || '[]').length === 0), { id: fixture.siblingId, names: JOURNAL_EMPTY_SOURCES });
    check(cell, 'EMPTY_CAPTURE_CANCEL_WRITES_NOTHING', empty && await byId('journal-record-row').count() === 0);
    Object.assign(cell.emptyActivation, { phase: 'canceled', opened: true, canceled: true, wroteRecords: !empty });
  });
}
