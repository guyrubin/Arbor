/** Kept capture/Journal acceptance, using only the existing UI and storage seam. */
export function installKeptCaptureProbe() {
  // Observe trusted browser events only. Do not intercept, dispatch, delay or
  // change the form, the modal, application state, or the persistence seam.
  const probe = { events: [], observed: 0, listener: null };
  probe.listener = event => {
    probe.observed++;
    if (probe.events.length >= 12) return;
    const target = event.target;
    const dialog = document.querySelector('[role="dialog"]');
    const box = dialog?.getBoundingClientRect();
    probe.events.push({ type: event.type, trusted: event.isTrusted, detail: event.detail ?? null,
      target: target?.matches?.('button[type="submit"]') ? 'submit' : target?.getAttribute?.('data-testid') ?? (target?.hasAttribute?.('data-arbor-dialog-layer') ? 'modal-backdrop' : target?.tagName ?? null),
      formPresent: !!document.querySelector('[data-testid="quicklog-moment-form"]'),
      receiptPresent: !!document.querySelector('[data-testid="quicklog-reply"]'),
      dialog: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null });
  };
  window.__arborKeptCaptureProbe = probe;
  document.addEventListener('click', probe.listener, true);
  document.addEventListener('submit', probe.listener, true);
}
export function finishKeptCaptureProbe() {
  const probe = window.__arborKeptCaptureProbe;
  if (!probe) return { unavailable: true };
  document.removeEventListener('click', probe.listener, true);
  document.removeEventListener('submit', probe.listener, true);
  delete window.__arborKeptCaptureProbe;
  return { events: probe.events, observed: probe.observed, omitted: Math.max(0, probe.observed - probe.events.length),
    formPresent: !!document.querySelector('[data-testid="quicklog-moment-form"]'),
    receiptPresent: !!document.querySelector('[data-testid="quicklog-reply"]') };
}
export async function collectKeptCaptureStates(h) {
  const { page, fixture, viewport, load, run, reset, journalFeed, frame, close, storage, sink, childSwitch, nextDate, check, byId } = h;
  const he = viewport.lang === 'he';
  const form = () => byId('quicklog-moment-form');
  const input = () => page.locator('#quick-log-moment');
  const chip = kind => byId('quicklog-keep-as').locator(`[data-kept-kind="${kind}"]`);
  const journalRow = id => page.locator(`[id="journal-signal-moment-${id}"]`);
  const detail = () => page.getByRole('dialog').filter({ has: byId('journal-entry-content-source') });
  const reader = () => byId('kept-reader');
  const review = () => page.locator('#send-sheet-text');
  const openCapture = async () => {
    await nextDate();
    await page.locator('[data-capture-tile="text"]').click();
    await form().waitFor({ state: 'visible' });
  };
  const seededInput = async text => page.waitForFunction(text => document.querySelector('#quick-log-moment')?.value === text, text);
  const save = async cell => {
    cell.captureStage = 'real-repeated-submit';
    await page.evaluate(installKeptCaptureProbe);
    try {
      await form().locator('button[type="submit"]').click({ clickCount: 2 });
      cell.captureStage = 'awaiting-actual-receipt';
      await byId('quicklog-reply').waitFor({ state: 'visible' });
      cell.captureStage = 'actual-receipt-visible';
    } finally { cell.captureEvents = await page.evaluate(finishKeptCaptureProbe); }
  };
  const receiptDone = async cell => {
    cell.captureStage = 'actual-receipt-done';
    await byId('quicklog-reply-done').click();
    await byId('quicklog-reply').waitFor({ state: 'detached' });
    cell.captureStage = 'actual-receipt-closed';
  };
  const openKept = async () => {
    await load('development');
    const disclosure = byId('portrait-keepsakes');
    if (!await disclosure.evaluate(el => el.open)) await disclosure.locator('summary').click();
    await reader().waitFor({ state: 'visible' });
  };
  const noEgress = async (cell, before, id) => {
    const after = await sink();
    check(cell, id, after.calls === before.calls && after.clipboardCalls === before.clipboardCalls, { calls: after.calls, clipboardCalls: after.clipboardCalls });
  };
  const unselected = async () => await byId('quicklog-keep-as').locator('[aria-pressed="true"]').count() === 0;
  const storedOne = async (cell, text, kind) => {
    const rows = (await storage()).filter(row => row.trigger === text);
    check(cell, 'EXACT_ONE_ACTUAL_PERSISTED_MOMENT', rows.length === 1 && rows[0].behaviorType === 'Moment' && rows[0].kept === kind && rows[0].contentSource === undefined && rows[0].intensity === undefined, rows);
    return rows[0];
  };

  await run('journal', 'capture-optional', async cell => {
    await reset(); await openCapture();
    check(cell, 'EMPTY_CAPTURE_HAS_NO_FORCED_KIND', await unselected());
    check(cell, 'THREE_OPTIONAL_CHIPS_DISABLED_UNTIL_PARENT_WORDS', await byId('quicklog-keep-as').locator('button:disabled').count() === 3);
    await input().fill(fixture.words.plain);
    check(cell, 'PLAIN_TYPED_WORDS_ENABLE_WITHOUT_SELECTING', await unselected() && await byId('quicklog-keep-as').locator('button:enabled').count() === 3);
    check(cell, 'INPUT_IS_LABELLED_AUTO_DIRECTION_AND_NO_SEVERITY', await input().evaluate(el => el.labels.length === 1 && el.dir === 'auto') && await page.locator('#quick-log-intensity').count() === 0);
    check(cell, 'OPTIONAL_GROUP_HAS_LOCALIZED_LEGEND', await byId('quicklog-keep-as').locator('legend').innerText() === (he ? 'לשמור בתור (לא חובה)' : 'Keep it as (optional)'));
    await chip('said').focus(); await page.keyboard.press('Tab');
    check(cell, 'KEYBOARD_MOVES_TO_NEXT_REAL_CHIP', await chip('by_herself').evaluate(el => document.activeElement === el));
    for (const kind of ['said', 'by_herself', 'first']) await frame(cell, `CHIP_${kind.toUpperCase()}_44PX`, chip(kind));
  });
  await run('journal', 'capture-plain-saved', async cell => {
    await save(cell); const row = await storedOne(cell, fixture.words.plain, undefined);
    check(cell, 'REPEAT_SUBMIT_RETIRES_FORM', await form().count() === 0);
    cell.captureStage = 'actual-receipt-open-journal';
    await byId('quicklog-reply-open').click();
    await byId('quicklog-reply').waitFor({ state: 'detached' });
    check(cell, 'RECEIPT_OPENS_ACTUAL_JOURNAL', new URL(page.url()).hash === '#/journal');
    await journalFeed(cell);
    await journalRow(row.id).waitFor({ state: 'visible' });
    check(cell, 'RECEIPT_OPENS_ACTUAL_JOURNAL_ROW', new URL(page.url()).hash === '#/journal?view=all' && (await journalRow(row.id).innerText()).includes(fixture.words.plain));
    await frame(cell, 'PERSISTED_JOURNAL_ROW_REACHABLE', journalRow(row.id));
  });
  await run('journal', 'capture-quote-default', async cell => {
    await openCapture(); await input().fill(fixture.words.quote);
    check(cell, 'FRESH_COMPLETE_TYPED_QUOTE_SELECTS_ONLY_SAID', await chip('said').getAttribute('aria-pressed') === 'true' && await byId('quicklog-keep-as').locator('[aria-pressed="true"]').count() === 1);
    await frame(cell, 'QUOTE_DEFAULT_VISIBLE', chip('said'));
  });
  await run('journal', 'capture-manual-choice', async cell => {
    await chip('said').click(); await input().fill(`${fixture.words.quote} `);
    check(cell, 'MANUAL_DESELECTION_SURVIVES_TYPING', await unselected());
    await chip('first').click(); await input().fill(fixture.words.first);
    check(cell, 'EXPLICIT_FIRST_SURVIVES_TEXT_CHANGE', await chip('first').getAttribute('aria-pressed') === 'true' && await chip('said').getAttribute('aria-pressed') === 'false');
    await frame(cell, 'MANUAL_FIRST_REACHABLE', chip('first'));
  });
  await run('development', 'capture-manual-first-saved', async cell => {
    await save(cell); await storedOne(cell, fixture.words.first, 'first'); await receiptDone(cell);
    await openKept();
    const row = reader().locator('[data-testid="kept-item"]').filter({ hasText: fixture.words.first });
    check(cell, 'ACTUAL_KEPT_DESTINATION_CONTAINS_FIRST', await row.count() === 1);
    await frame(cell, 'NEW_FIRST_SEND_REACHABLE', row.locator('[data-testid="kept-item-send"]'));
  });
  await run('development', 'capture-manual-independent-saved', async cell => {
    await load('journal'); await openCapture(); await input().fill(fixture.words.independent); await chip('by_herself').click();
    await save(cell); await storedOne(cell, fixture.words.independent, 'by_herself'); await receiptDone(cell);
    await openKept();
    check(cell, 'ACTUAL_KEPT_DESTINATION_CONTAINS_INDEPENDENT', await reader().locator('[data-testid="kept-item"]').filter({ hasText: fixture.words.independent }).count() === 1);
    await reader().scrollIntoViewIfNeeded();
  });
  await run('journal', 'capture-cancel-repeat', async cell => {
    await reset(); await openCapture(); await input().fill(fixture.words.cancelled); await chip('first').click();
    const before = JSON.stringify(await storage()); await close('quicklog-moment-form');
    check(cell, 'CANCEL_WRITES_NOTHING', JSON.stringify(await storage()) === before);
    await openCapture();
    check(cell, 'REOPEN_NEVER_CARRIES_SELECTED_KIND', await unselected());
    await input().fill(''); await input().fill(fixture.words.quote);
    check(cell, 'CLEAR_THEN_NEW_TYPED_QUOTE_REGAINS_FRESH_DEFAULT', await chip('said').getAttribute('aria-pressed') === 'true');
    await close('quicklog-moment-form');
    check(cell, 'REPEATED_CANCEL_NEVER_PERSISTS', JSON.stringify(await storage()) === before);
    await frame(cell, 'CAPTURE_OPENER_FOCUS_RETURNED_REACHABLE', page.locator('[data-capture-tile="text"]'));
    check(cell, 'CANCEL_RESTORES_OPENER_FOCUS', await page.locator('[data-capture-tile="text"]').evaluate(el => document.activeElement === el));
  });
  await run('journal', 'capture-required-fields', async cell => {
    await reset(); await openCapture(); const before = JSON.stringify(await storage());
    await input().fill('   '); await form().locator('button[type="submit"]').click();
    check(cell, 'BLANK_WORDS_CANNOT_PERSIST_OR_RECEIPT', JSON.stringify(await storage()) === before && await byId('quicklog-reply').count() === 0 && await form().isVisible());
    // Report the source's actual input constraints; do not invent a maxLength cap.
    cell.fieldConstraints = await input().evaluate(el => ({ maxLength: el.maxLength, required: el.required, dir: el.dir, labels: el.labels.length }));
    await input().fill(fixture.words.plain); await page.getByRole('dialog').getByRole('checkbox').check();
    const incident = page.getByRole('dialog').locator('form');
    check(cell, 'INCIDENT_RETIRES_OPTIONAL_KEEP', await byId('quicklog-keep-as').count() === 0);
    await page.locator('#quick-log-response').fill(''); await incident.locator('button[type="submit"]').click();
    check(cell, 'INCIDENT_REQUIRES_RESPONSE_BEFORE_REVIEW', JSON.stringify(await storage()) === before && await page.locator('#quick-log-response').isVisible());
    await page.getByRole('dialog').getByRole('checkbox').uncheck();
    check(cell, 'RETURN_TO_MOMENT_HAS_NO_DORMANT_KEEP', await unselected());
    await close('quicklog-moment-form');
  });

  for (const [key, id, source] of [['parent', 'capture-lineage-parent', undefined], ['ai', 'capture-lineage-ai', 'ai_draft'], ['unverified', 'capture-lineage-unverified', 'unverified']]) {
    await run('journal', `journal-${key}-lineage`, async cell => {
      await reset(); await journalFeed(cell); const row = journalRow(id); const sourceLine = source ? fixture.sourceLabels[source] : null;
      await row.waitFor({ state: 'visible' });
      check(cell, 'FEED_RETAINS_EXACT_WORDS_AND_FACTUAL_SOURCE', (await row.innerText()).includes(fixture.words[key]) && (source ? await row.locator('[data-testid="journal-row-content-source"]').innerText() === sourceLine : await row.locator('[data-testid="journal-row-content-source"]').count() === 0));
      await row.click(); await byId('journal-entry-content-source').waitFor({ state: 'visible' });
      check(cell, 'DETAIL_SOURCE_AND_OWNERSHIP_PRESERVED', (source ? await byId('journal-entry-content-source').innerText() === sourceLine : !(await byId('journal-entry-content-source').innerText()).includes(fixture.sourceLabels.ai_draft)) && await byId('journal-entry-edit').isVisible() && await byId('journal-entry-delete').isVisible());
      await detail().getByRole('button', { name: new RegExp(he ? '^שמרו ככרטיס' : '^Keep as a card') }).click();
      await byId('send-sheet').waitFor({ state: 'visible' });
      const text = await review().inputValue();
      check(cell, 'REAL_REVIEW_CARRIES_WORDS_AND_SOURCE_FIRST_LINE', text.includes(fixture.words[key]) && (source ? text.split('\n')[0] === sourceLine : !Object.values(fixture.sourceLabels).some(label => text.includes(label))) && !/https?:|data:image|base64/.test(text));
      await frame(cell, 'FINAL_TEXT_SEND_44PX', byId('send-sheet-send'));
      await byId('send-sheet-send').click(); await byId('send-sheet').waitFor({ state: 'detached' });
      const sent = await sink();
      check(cell, 'FINAL_SEND_EXACT_TEXT_TO_SYNTHETIC_SINK_ONCE', sent.calls === 1 && sent.lastText === text && sent.clipboardCalls === 0 && JSON.stringify(sent.keys) === '["text"]', { calls: sent.calls, payloadKeys: sent.keys });
      check(cell, 'SEND_PRESERVES_STORED_LINEAGE', JSON.stringify(await storage()) === JSON.stringify(fixture.collections.behaviorLogs));
      cell.lineageEvidence = source ? 'synthetic-preloaded-negative-lineage-not-model-output' : 'preloaded-parent-owned-record';
      await byId('journal-entry-content-source').scrollIntoViewIfNeeded();
    });
  }
  for (const [key, id, source, edited] of [['ai', 'capture-lineage-ai', 'ai_draft', 'editedAi'], ['unverified', 'capture-lineage-unverified', 'unverified', 'editedUnverified']]) {
    await run('journal', `journal-${key}-edit-confirm`, async cell => {
      await reset(); await journalFeed(cell); const original = (await storage()).find(row => row.id === id);
      await journalRow(id).click(); await byId('journal-entry-edit').click(); await form().waitFor({ state: 'visible' }); await seededInput(original.trigger);
      check(cell, 'OLD_ROW_EDIT_DOES_NOT_OFFER_NEW_AUTHORED_CHIPS', await byId('quicklog-keep-as').count() === 0 && await input().inputValue() === original.trigger);
      await input().fill(fixture.words[edited]); await form().locator('button[type="submit"]').click(); await form().waitFor({ state: 'detached' });
      const updated = (await storage()).find(row => row.id === id);
      check(cell, 'CONFIRMED_EDIT_RETAINS_ID_DATE_NEGATIVE_LINEAGE_AND_HISTORY_MARKER', updated?.trigger === fixture.words[edited] && updated.timestamp === original.timestamp && updated.contentSource === source && updated.kept === original.kept && (await storage()).length === fixture.collections.behaviorLogs.length, updated);
      await openKept(); check(cell, 'EDITED_GENERATED_WORDS_CANNOT_ENTER_KEPT_PROJECTION', !(await reader().innerText()).includes(fixture.words[edited]));
      await load('journal'); await journalFeed(cell); await journalRow(id).click();
      check(cell, 'RELOADED_EDITED_DETAIL_RETAINS_SOURCE', await byId('journal-entry-content-source').innerText() === fixture.sourceLabels[source]);
      await byId('journal-entry-content-source').scrollIntoViewIfNeeded();
    });
  }
  await run('journal', 'capture-child-return', async cell => {
    await reset(); await journalFeed(cell); await journalRow('capture-lineage-ai').click(); await byId('journal-entry-edit').click(); await input().fill(fixture.words.cancelled);
    await close('quicklog-moment-form');
    await childSwitch(cell, fixture.siblingId, fixture.siblingName);
    check(cell, 'SIBLING_HAS_NO_OLD_RECORD_EDITOR_OR_REVIEW', await journalRow('capture-lineage-ai').count() === 0 && await form().count() === 0 && await byId('send-sheet').count() === 0 && (await storage('behaviorLogs', fixture.siblingId)).length === 0);
    await childSwitch(cell, fixture.childId, fixture.childName);
    await journalRow('capture-lineage-ai').click(); await byId('journal-entry-edit').click(); await seededInput(fixture.words.ai);
    check(cell, 'CHILD_RETURN_RELOADS_SAVED_WORDS_NOT_CANCELLED_DRAFT', await input().inputValue() === fixture.words.ai && await byId('quicklog-keep-as').count() === 0);
    await close('quicklog-moment-form');
    check(cell, 'CHILD_ROUND_TRIP_PRESERVES_BOTH_STORES', JSON.stringify(await storage()) === JSON.stringify(fixture.collections.behaviorLogs) && (await storage('behaviorLogs', fixture.siblingId)).length === 0);
    cell.lifecycleBoundary = 'actual-close-then-switch-and-return-not-forced-click-behind-modal';
  });
  await run('development', 'kept-projection', async cell => {
    await reset(); await openCapture(); await input().fill(fixture.words.quote); await save(cell); await storedOne(cell, fixture.words.quote, 'said'); await receiptDone(cell);
    await openKept(); const text = await reader().innerText();
    check(cell, 'GENUINE_NEW_QUOTE_AND_OLD_PARENT_WORDS_ONLY', text.includes(fixture.words.quote) && text.includes(fixture.words.parent) && !text.includes(fixture.words.ai) && !text.includes(fixture.words.unverified) && await reader().locator('[data-testid="kept-item"]').count() === 2);
    check(cell, 'NEGATIVE_PRELOADS_STILL_PRESENT_IN_STORAGE', (await storage()).filter(row => row.contentSource).length === 2);
    await reader().scrollIntoViewIfNeeded();
  });
  await run('development', 'kept-review-cancel-repeat', async cell => {
    const row = reader().locator('[data-testid="kept-item"]').filter({ hasText: fixture.words.quote });
    const before = await sink(); await row.locator('[data-testid="kept-item-send"]').click(); await review().fill(fixture.words.cancelled); await close('send-sheet');
    await noEgress(cell, before, 'CANCELLED_REVIEW_HAS_NO_EGRESS');
    await row.locator('[data-testid="kept-item-send"]').click();
    check(cell, 'REPEAT_REVIEW_REBUILDS_REAL_SOURCE', (await review().inputValue()).includes(fixture.words.quote) && !(await review().inputValue()).includes(fixture.words.cancelled));
    await frame(cell, 'KEPT_FINAL_SEND_REACHABLE', byId('send-sheet-send'));
  });
  await run('development', 'kept-stale-final-send', async cell => {
    const before = await sink();
    await page.evaluate(({ id, text }) => {
      const key = `arbor.behaviorLogs.${id}`;
      localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter(row => row.trigger !== text)));
    }, { id: fixture.childId, text: fixture.words.quote });
    await byId('send-sheet-send').click(); await byId('send-sheet').waitFor({ state: 'detached' });
    await noEgress(cell, before, 'ACTUAL_FINAL_GUARD_REJECTS_CHANGED_SOURCE');
    check(cell, 'KEPT_REFRESH_NOTICE_AFTER_FINAL_REJECTION', (await reader().innerText()).includes(he ? 'לרענן' : 'Refresh'));
    cell.persistenceBoundary = 'same-document-synthetic-source-deletion-before-real-final-Send';
    await reader().locator('[role="status"]').first().scrollIntoViewIfNeeded();
  });
  await run('development', 'kept-stale-open-repeat', async cell => {
    await reset('development'); await openKept(); const before = await sink();
    await page.evaluate(id => localStorage.setItem(`arbor.behaviorLogs.${id}`, '[]'), fixture.childId);
    for (let n = 0; n < 2; n++) {
      await byId('kept-item-send').first().click();
      check(cell, `STALE_OPEN_${n}_CANNOT_REVIEW`, await byId('send-sheet').count() === 0);
    }
    await noEgress(cell, before, 'REPEATED_STALE_OPENS_HAVE_NO_EGRESS');
    await reader().locator('[role="status"]').first().scrollIntoViewIfNeeded();
  });
}
