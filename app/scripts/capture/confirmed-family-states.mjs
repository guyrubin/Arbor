/** Family starts run through the actual acknowledged action-loop writer. */
export async function collectConfirmedFamilyStates({ page, fixture, viewport, load, run, reset, frame, fault, storage, expose, childSwitch, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const turnId = 'truth-practice-weekly';
  const libraryId = 'family-story-canon';
  const receipts = () => page.locator('[data-testid^="ritual-receipt-"]');
  const receipt = id => byId(`ritual-receipt-${id}`);
  const libraryStart = () => byId(`ritual-start-${libraryId}`);
  const libraryDoor = () => page.locator(`button[aria-controls="ritual-${libraryId}"]`);
  let firstStep;
  const openLibrary = async () => { if (await libraryDoor().getAttribute('aria-expanded') !== 'true') await libraryDoor().click(); await libraryStart().waitFor({ state: 'visible' }); };
  const checkReceipt = async (cell, id) => {
    await visible(cell, 'ONE_ACKNOWLEDGED_RITUAL_RECEIPT', receipt(id));
    check(cell, 'SHARED_RITUAL_RECEIPT_POINTS_TO_NOW', await receipt(id).locator('a[href="#/overview"]').count() === 1 && await receipt(id).getAttribute('data-receipt') === 'muted');
    check(cell, 'LOCALIZED_RITUAL_FEEDBACK', await receipt(id).getAttribute('dir') === (he ? 'rtl' : 'ltr') && await receipt(id).getAttribute('lang') === viewport.lang);
    await expose(receipt(id));
  };
  await run('family', 'ritual-start-local-failure', async cell => {
    await reset('base', 'family'); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    await byId('ritual-turn-how').click();
    firstStep = (await byId('ritual-turn-steps').locator('li > span').nth(1).innerText()).trim();
    check(cell, 'REAL_RITUAL_FIRST_STEP_READ_BEFORE_START', firstStep.length > 20);
    await fault(cell, 'actionLoops', async () => {
      await byId('ritual-turn-start').click(); await byId(`ritual-retry-${turnId}`).waitFor({ state: 'visible' });
      check(cell, 'FAILED_START_SHOWS_RETRY_WITHOUT_SAVED_LABEL_OR_RECEIPT', await receipts().count() === 0 && await byId('ritual-turn-start').isEnabled() && await page.locator('[data-module="family-rituals"] [role="alert"]').count() === 1);
    });
    await frame(cell, 'RITUAL_RETRY_REACHABLE_44PX', byId(`ritual-retry-${turnId}`));
  });
  await run('family', 'ritual-start-local-saved', async cell => {
    await byId(`ritual-retry-${turnId}`).click(); await checkReceipt(cell, turnId);
    const rows = await storage('actionLoops');
    check(cell, 'FIRST_STEP_EXACTLY_ONCE_ON_LOCAL_ACTION_LEDGER', rows.length === 1 && rows[0].source === 'family-ritual' && rows[0].recommendation === firstStep && rows[0].capacity === 'tiny' && rows[0].status === 'accepted', rows);
    check(cell, 'REPEATED_START_DISABLED_AFTER_LOCAL_ACK', await byId('ritual-turn-start').isDisabled() && await receipts().count() === 1);
  });
  await run('overview', 'ritual-now-destination', async cell => {
    await receipt(turnId).locator('a[href="#/overview"]').click();
    await page.locator('[data-module="now-step"]').waitFor({ state: 'visible' });
    check(cell, 'RECEIPT_OPEN_ARRIVES_AT_ACTUAL_SAVED_NEXT_STEP', new URL(page.url()).hash === '#/overview' && await page.locator('[data-module="now-step"] h2').innerText() === firstStep);
    check(cell, 'OPEN_LINK_DID_NOT_CREATE_ANOTHER_ROW', (await storage('actionLoops')).length === 1);
    await frame(cell, 'DESTINATION_STEP_ACTION_REACHABLE', page.locator('[data-module="now-step"] .now-lead-actions button').first());
  });
  await run('family', 'ritual-reload-repeat', async cell => {
    await load('family'); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    check(cell, 'RELOAD_CONFIRMED_LOCAL_LEDGER_RESTORES_DISABLED_SAVED_LABEL', await byId('ritual-turn-start').isDisabled() && (await byId('ritual-turn-start').innerText()).includes(he ? 'ברשימה של היום' : 'On today’s list'));
    check(cell, 'RELOAD_DOES_NOT_REPLAY_ACTION_RECEIPT', await receipts().count() === 0 && (await storage('actionLoops')).length === 1);
    await expose(byId('ritual-turn-start'));
  });
  await run('family', 'ritual-library-start', async cell => {
    await reset('base', 'family'); await openLibrary();
    const expected = (await page.locator(`#ritual-${libraryId} ol li > span`).nth(1).innerText()).trim();
    await frame(cell, 'LIBRARY_START_REACHABLE_44PX', libraryStart()); await libraryStart().click(); await checkReceipt(cell, libraryId);
    const rows = await storage('actionLoops');
    check(cell, 'LIBRARY_USES_SAME_EXACT_FIRST_STEP_WRITER', rows.length === 1 && rows[0].source === 'family-ritual' && rows[0].recommendation === expected && rows[0].status === 'accepted');
    check(cell, 'LIBRARY_REPEAT_DISABLED', await libraryStart().isDisabled());
  });
  await run('family', 'ritual-failed-child-retirement', async cell => {
    await reset('base', 'family'); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    await fault(cell, 'actionLoops', async () => { await byId('ritual-turn-start').click(); await byId(`ritual-retry-${turnId}`).waitFor({ state: 'visible' }); });
    await childSwitch(cell, fixture.siblingId, fixture.siblingName); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    check(cell, 'SIBLING_HAS_NO_OLD_FAILURE_OR_RECEIPT', await byId(`ritual-retry-${turnId}`).count() === 0 && await receipts().count() === 0 && await byId('ritual-turn-start').isEnabled());
    await childSwitch(cell, fixture.childId, fixture.childName); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    check(cell, 'RETURN_RETIRES_FAILED_ATTEMPT_LIFETIME', await byId(`ritual-retry-${turnId}`).count() === 0 && await receipts().count() === 0 && (await storage('actionLoops')).length === 0);
    await frame(cell, 'FRESH_START_AVAILABLE_AFTER_CHILD_RETURN', byId('ritual-turn-start'));
    cell.lifecycleBoundary = 'settled-local-failure-then-actual-child-switch; delayed-Firestore-write-retirement-not-exercised';
  });
  await run('family', 'ritual-saved-child-return', async cell => {
    await byId('ritual-turn-start').click(); await checkReceipt(cell, turnId);
    await childSwitch(cell, fixture.siblingId, fixture.siblingName); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    check(cell, 'SIBLING_DOES_NOT_INHERIT_SAVED_RITUAL', await byId('ritual-turn-start').isEnabled() && await receipts().count() === 0);
    await childSwitch(cell, fixture.childId, fixture.childName); await byId('ritual-turn-start').waitFor({ state: 'visible' });
    check(cell, 'RETURN_USES_LOCAL_LEDGER_WITHOUT_REVIVING_RECEIPT', await byId('ritual-turn-start').isDisabled() && await receipts().count() === 0 && (await storage('actionLoops')).length === 1);
    await expose(byId('ritual-turn-start'));
  });
}
