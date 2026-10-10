/** Actual Milestones row/editor/review actions; no component or metadata substitutions. */
export async function collectConfirmedMilestoneStates({ page, fixture, viewport, load, run, reset, frame, storage, sink, expose, childSwitch, modalClose, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const note = (text = fixture.text.first) => byId('ms-keepsake').filter({ hasText: text });
  const review = () => page.locator('#send-sheet-text');
  const editorShare = () => byId('first-keepsake-sheet').getByRole('button', { name: new RegExp(he ? 'לשתף את הפעם הראשונה' : 'Share this first') });
  const editorReady = async cell => {
    // FirstKeepsakeSheet seeds controlled fields in an effect after it mounts.
    // Observe that actual state; never fill expected values to manufacture readiness.
    const expected = { note: fixture.text.first, date: '2026-10-04' };
    const ready = await page.waitForFunction(({ note, date }) => {
      const sheets = document.querySelectorAll('[data-testid="first-keepsake-sheet"]');
      const actualNote = sheets[0]?.querySelector('[data-testid="first-keepsake-note"]')?.value;
      const actualDate = sheets[0]?.querySelector('[data-testid="first-keepsake-date"]')?.value;
      return sheets.length === 1 && actualNote === note && actualDate === date
        ? { note: actualNote, date: actualDate, sheetCount: sheets.length } : false;
    }, expected, { timeout: 8_000 });
    try { check(cell, 'ACTUAL_EDITOR_FIELDS_SEEDED_BEFORE_INTERACTION', true, await ready.jsonValue()); }
    finally { await ready.dispose(); }
  };
  const reveal = async (text = fixture.text.first) => {
    await byId('ms-shelf-map').waitFor({ state: 'visible' });
    const doors = byId('ms-shelf-door');
    for (let index = 0; index < Math.min(8, await doors.count()) && await note(text).count() === 0; index++) await doors.nth(index).click();
    // Preserve real catalogue age/source; traverse the existing Earlier disclosure.
    const ancestors = note(text).locator('xpath=ancestor::details');
    for (const detail of await ancestors.all()) if (!await detail.evaluate(el => el.open)) await detail.locator(':scope > summary').click();
    await note(text).waitFor({ state: 'visible' }); await expose(note(text));
  };
  const removeSavedNote = () => page.evaluate(id => {
    const key = `arbor.keepsakes.${id}`;
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter(row => row.id !== 'capture-record-first')));
  }, fixture.childId);
  const noEgress = async (cell, id, before) => {
    const after = await sink();
    check(cell, id, after.calls === before.calls && after.clipboardCalls === before.clipboardCalls, { calls: after.calls, clipboardCalls: after.clipboardCalls });
  };
  await run('milestones', 'milestone-kept-parity', async cell => {
    await reset('base', 'milestones'); await reveal();
    check(cell, 'SAME_PARENT_KEPT_ROW_AND_ATTRIBUTION', await note().locator('[data-testid="kept-item"] .kept-words bdi').innerText() === fixture.text.first && (await note().innerText()).includes(he ? 'רשמתם את זה' : 'You noted this'));
    const text = await page.locator('#main').innerText();
    check(cell, 'AI_QUOTE_EXCLUDED_WITH_NEGATIVE_FIXTURE_RETAINED', !text.includes(fixture.text.forbidden[1]) && (await storage('keepsakes')).some(row => row.id === 'capture-record-ai' && row.source === 'ai_proposed_parent_confirmed' && row.note === fixture.text.forbidden[1]));
    await frame(cell, 'ELIGIBLE_SEND_REACHABLE_44PX', note().locator('[data-testid="kept-item-send"]'));
    await frame(cell, 'EXISTING_EDIT_REACHABLE_44PX', note().locator('[data-testid="ms-keepsake-edit"]'));
  });
  await run('milestones', 'milestone-text-review', async cell => {
    await note().locator('[data-testid="kept-item-send"]').click(); await visible(cell, 'ACTUAL_SHARED_TEXT_REVIEW', byId('send-sheet'));
    const text = await review().inputValue();
    check(cell, 'REVIEW_NAMES_CHILD_AND_EXACT_PARENT_WORDS', text.includes(fixture.childName) && text.includes(fixture.text.first) && !text.includes(fixture.text.forbidden[1]) && !/https?:\/\//.test(text));
    await review().fill(fixture.words.edited);
    check(cell, 'REVIEW_EDIT_IS_NOT_A_SOURCE_EDIT', (await storage('keepsakes')).find(row => row.id === 'capture-record-first')?.note === fixture.text.first);
    check(cell, 'NO_SEND_BEFORE_FINAL_REVIEW_ACTION', (await sink()).calls === 0 && (await sink()).clipboardCalls === 0);
    await frame(cell, 'REVIEW_SEND_REACHABLE_44PX', byId('send-sheet-send'));
  });
  await run('milestones', 'milestone-review-cancel', async cell => {
    const before = await sink(); await modalClose('send-sheet');
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'kept-item-send');
    check(cell, 'CANCEL_RETURNS_FOCUS_TO_ORIGINAL_ROW_SEND', await note().locator('[data-testid="kept-item-send"]').evaluate(el => el === document.activeElement));
    await noEgress(cell, 'CANCEL_HAS_NO_EGRESS', before);
    await note().locator('[data-testid="kept-item-send"]').click(); await byId('send-sheet').waitFor({ state: 'visible' });
    check(cell, 'REOPEN_REBUILDS_SOURCE_TEXT_NOT_CANCELLED_DRAFT', (await review().inputValue()).includes(fixture.text.first) && !(await review().inputValue()).includes(fixture.words.edited));
  });
  await run('milestones', 'milestone-reviewed-send', async cell => {
    await review().fill(fixture.words.edited); await byId('send-sheet-send').click(); await byId('send-sheet').waitFor({ state: 'detached' });
    const sent = await sink();
    check(cell, 'REVIEWED_TEXT_ONLY_REACHES_SYNTHETIC_SINK', sent.calls === 1 && sent.lastText === fixture.words.edited && sent.clipboardCalls === 0 && JSON.stringify(sent.keys) === '["text"]', { calls: sent.calls, keys: sent.keys });
    check(cell, 'EXPORT_DID_NOT_EDIT_PARENT_RECORD', (await storage('keepsakes')).find(row => row.id === 'capture-record-first')?.note === fixture.text.first);
    await expose(note());
  });
  await run('milestones', 'milestone-editor-cancel', async cell => {
    await note().locator('[data-testid="ms-keepsake-edit"]').click(); await byId('first-keepsake-sheet').waitFor({ state: 'visible' }); await editorReady(cell);
    check(cell, 'EXISTING_NOTE_DATE_OPTIONAL_PHOTO_REMAIN', await byId('first-keepsake-note').inputValue() === fixture.text.first && await byId('first-keepsake-date').inputValue() === '2026-10-04' && await byId('first-keepsake-sheet').locator('input[type="file"][accept="image/*"]').count() === 1);
    await byId('first-keepsake-note').fill(fixture.words.edited); await modalClose('first-keepsake-sheet');
    check(cell, 'EDITOR_CANCEL_PRESERVES_STORAGE', (await storage('keepsakes')).find(row => row.id === 'capture-record-first')?.note === fixture.text.first);
    await note().locator('[data-testid="ms-keepsake-edit"]').click(); await byId('first-keepsake-sheet').waitFor({ state: 'visible' }); await editorReady(cell);
    check(cell, 'EDITOR_REOPEN_HAS_SAVED_WORDS', await byId('first-keepsake-note').inputValue() === fixture.text.first);
    await frame(cell, 'EDITOR_SAVE_REACHABLE_44PX', byId('first-keepsake-save'));
  });
  await run('milestones', 'milestone-editor-save', async cell => {
    const before = await sink();
    await byId('first-keepsake-note').fill(fixture.words.edited); await byId('first-keepsake-save').click(); await byId('first-keepsake-sheet').waitFor({ state: 'detached' });
    await note(fixture.words.edited).waitFor({ state: 'visible' });
    check(cell, 'REAL_EDITOR_UPDATES_EXACT_LOCAL_NOTE', (await storage('keepsakes')).find(row => row.id === 'capture-record-first')?.note === fixture.words.edited);
    await noEgress(cell, 'EDITOR_SAVE_IS_NOT_SHARE', before);
    await load('milestones'); await reveal(fixture.words.edited);
    await note(fixture.words.edited).locator('[data-testid="kept-item-send"]').click(); await byId('send-sheet').waitFor({ state: 'visible' });
    check(cell, 'RELOADED_HISTORY_EXPORTS_EDITED_WORDS_ONLY', (await review().inputValue()).includes(fixture.words.edited) && !(await review().inputValue()).includes(fixture.text.first));
    await modalClose('send-sheet'); await expose(note(fixture.words.edited));
  });
  await run('milestones', 'milestone-stale-open', async cell => {
    await reset('base', 'milestones'); await reveal(); const before = await sink();
    await removeSavedNote(); await note().locator('[data-testid="kept-item-send"]').click();
    await byId('ms-kept-status').getByRole('status').waitFor({ state: 'visible' });
    check(cell, 'STALE_ROW_CANNOT_OPEN_REVIEW', await byId('send-sheet').count() === 0);
    await noEgress(cell, 'STALE_ROW_NO_EGRESS', before); await expose(byId('ms-kept-status'));
    cell.persistenceBoundary = 'same-document-synthetic-storage-deletion-real-beforeExport-guard';
  });
  await run('milestones', 'milestone-stale-final-send', async cell => {
    await reset('base', 'milestones'); await reveal(); const before = await sink();
    await note().locator('[data-testid="kept-item-send"]').click(); await byId('send-sheet').waitFor({ state: 'visible' });
    await removeSavedNote(); await byId('send-sheet-send').click(); await byId('send-sheet').waitFor({ state: 'detached' });
    await noEgress(cell, 'STALE_REVIEW_CANNOT_SEND', before);
    check(cell, 'STALE_REVIEW_SHOWS_REFRESH_NOTICE', (await byId('ms-kept-status').innerText()).includes(he ? 'לרענן' : 'Refresh'));
    await expose(byId('ms-kept-status'));
  });
  await run('milestones', 'milestone-editor-stale-final-send', async cell => {
    await reset('base', 'milestones'); await reveal(); const before = await sink();
    await note().locator('[data-testid="ms-keepsake-edit"]').click(); await byId('first-keepsake-sheet').waitFor({ state: 'visible' }); await editorReady(cell);
    await editorShare().click(); await byId('send-sheet').waitFor({ state: 'visible' });
    check(cell, 'EDITOR_SHARE_REVIEW_USES_SAVED_PARENT_NOTE', (await review().inputValue()).includes(fixture.text.first));
    await removeSavedNote(); await byId('send-sheet-send').click(); await byId('send-sheet').waitFor({ state: 'detached' });
    await noEgress(cell, 'RETAINED_EDITOR_CANNOT_BYPASS_FINAL_FRESHNESS_GUARD', before);
    check(cell, 'EDITOR_REMAINS_EDITABLE_AFTER_REJECTED_EXPORT', await byId('first-keepsake-note').isEditable());
    await modalClose('first-keepsake-sheet'); await expose(byId('ms-kept-status'));
  });
  await run('milestones', 'milestone-child-return', async cell => {
    await reset('base', 'milestones'); await reveal();
    await note().locator('[data-testid="ms-keepsake-edit"]').click(); await editorReady(cell); await byId('first-keepsake-note').fill(fixture.words.edited);
    // Close with the actual modal control, then use the real child switcher.
    await modalClose('first-keepsake-sheet');
    // Preserve the original close-editor → child-switch interruption opportunity.
    await childSwitch(cell, fixture.siblingId, fixture.siblingName, { settleBefore: false }); await byId('ms-header').waitFor({ state: 'visible' });
    await page.waitForFunction(text => !document.querySelector('#main')?.innerText.includes(text), fixture.text.first);
    check(cell, 'SIBLING_HAS_NO_PARENT_NOTE_OR_STALE_EDITOR', await byId('first-keepsake-sheet').count() === 0 && await note().count() === 0);
    await childSwitch(cell, fixture.childId, fixture.childName); await reveal();
    check(cell, 'CHILD_RETURN_HAS_NO_REOPENED_EDITOR_OR_REVIEW', await byId('first-keepsake-sheet').count() === 0 && await byId('send-sheet').count() === 0);
    await note().locator('[data-testid="ms-keepsake-edit"]').click(); await byId('first-keepsake-sheet').waitFor({ state: 'visible' }); await editorReady(cell);
    check(cell, 'RETURN_EDIT_READS_SAVED_NOTE_NOT_RETIRED_DRAFT', await byId('first-keepsake-note').inputValue() === fixture.text.first);
    await modalClose('first-keepsake-sheet');
    cell.lifecycleBoundary = 'actual-close-then-child-switch-and-return; switching-behind-modal-is-not-forced';
  });
}
