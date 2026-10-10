/** Bounded accepted Behaviors -> shared capture -> Journal regressions. */
export const BEHAVIOR_RECORD_STATES = Object.freeze([
  ...['behaviors-capture-door', 'hard-starters', 'hard-review', 'hard-review-cancel', 'hard-confirm'].map(state => ({ route: 'behaviors', state })),
  ...['journal-hard-arrival', 'journal-detail-edit', 'journal-filter-combination', 'journal-collision-first', 'journal-collision-second'].map(state => ({ route: 'journal', state })),
]);
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
    await byId('journal-filters').scrollIntoViewIfNeeded();
  });
  await screen('journal', 'journal-detail-edit', async cell => {
    await page.locator(`#journal-signal-moment-${savedId}`).click();
    await visible(cell, 'DETAIL_EXISTING_EDIT_CONTROL', byId('journal-entry-edit'));
    const detail = await page.getByRole('dialog').innerText();
    check(cell, 'DETAIL_EXACT_TYPED_FIELDS', [trigger, response, notes].every(value => detail.includes(value)));
    await byId('journal-entry-edit').click(); await page.locator('#quick-log-trigger').waitFor({ state: 'visible' });
    check(cell, 'EDIT_REUSES_SHARED_SHEET_IN_PLACE', new URL(page.url()).hash === '#/journal' && await page.locator('#quick-log-trigger').inputValue() === trigger);
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
}
