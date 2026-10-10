/** Completion feedback from the real routine board and its existing local checklist. */
export async function collectConfirmedRoutineStates({ page, fixture, viewport, load, run, reset, frame, fault, storage, expose, childSwitch, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const board = () => page.locator('[data-module="routines-board"]');
  const steps = () => board().locator('[data-testid^="routine-step-"]');
  const receipt = () => byId('routines-completion-receipt');
  let keys;
  const currentKeys = () => steps().evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid').slice('routine-step-'.length)));
  const done = () => steps().evaluateAll(nodes => nodes.filter(node => node.getAttribute('aria-pressed') === 'true').map(node => node.getAttribute('data-testid').slice('routine-step-'.length)));
  const complete = async () => { for (const button of await steps().all()) if (await button.getAttribute('aria-pressed') !== 'true') await button.click(); };
  const assertReceipt = async (cell, saved) => {
    await visible(cell, saved ? 'LOCAL_COMPLETION_SAVED_RECEIPT' : 'LOCAL_COMPLETION_UNSAVED_RECEIPT', receipt());
    const text = await receipt().innerText();
    const expected = he ? (saved ? 'הרשימה נשמרה במכשיר הזה' : 'הרשימה לא נשמרה במכשיר הזה') : (saved ? 'Checklist saved on this device' : 'couldn’t be saved on this device');
    check(cell, 'TRUTHFUL_LOCAL_DEVICE_WORDING', text.includes(expected) && !/star|world|assigned|כוכב|בעולם|שויכה/i.test(text), text);
    check(cell, 'ONE_SHARED_LOCALE_RECEIPT', await receipt().count() === 1 && await receipt().getAttribute('data-receipt') === 'muted' && await receipt().getAttribute('dir') === (he ? 'rtl' : 'ltr') && await receipt().getAttribute('lang') === viewport.lang);
    await expose(receipt());
  };
  await run('routines', 'routine-partial', async cell => {
    await reset('base', 'routines'); await board().waitFor({ state: 'visible' }); keys = await currentKeys();
    check(cell, 'ACTUAL_NONEMPTY_MORNING_BOARD', keys.length > 1 && await byId('routine-tile-morning').getAttribute('aria-pressed') === 'true');
    for (const button of (await steps().all()).slice(0, -1)) await button.click();
    check(cell, 'PARTIAL_CHECKLIST_HAS_NO_COMPLETION_RECEIPT', await receipt().count() === 0 && JSON.stringify(await done()) === JSON.stringify(keys.slice(0, -1)));
    await frame(cell, 'FINAL_ROUTINE_STEP_REACHABLE_44PX', steps().last());
  });
  await run('routines', 'routine-complete', async cell => {
    await steps().last().click(); await assertReceipt(cell, true);
    check(cell, 'ACTUAL_CHECKLIST_PERSISTED_LOCALLY', JSON.stringify((await storage('routines.done')).morning) === JSON.stringify(keys));
    check(cell, 'ALL_STEPS_MARKED_WITHOUT_NEW_REWARD_LEDGER', JSON.stringify(await done()) === JSON.stringify(keys) && (await storage('actionLoops')).length === 0);
  });
  await run('routines', 'routine-repeat-toggle', async cell => {
    // Trusted double click delivers two real button clicks, not captured React callbacks.
    await steps().last().dblclick(); await assertReceipt(cell, true);
    check(cell, 'REPEATED_TOGGLE_USES_LATEST_CHECKLIST', JSON.stringify(await done()) === JSON.stringify(keys) && JSON.stringify((await storage('routines.done')).morning) === JSON.stringify(keys));
    await steps().last().click();
    check(cell, 'UNDO_FINAL_STEP_REMOVES_RECEIPT', await receipt().count() === 0 && JSON.stringify(await done()) === JSON.stringify(keys.slice(0, -1)));
    await steps().last().click(); await assertReceipt(cell, true);
  });
  await run('routines', 'routine-reload', async cell => {
    await load('routines'); await board().waitFor({ state: 'visible' });
    check(cell, 'RELOAD_RESTORES_CHECKLIST_WITHOUT_REPLAYING_RECEIPT', JSON.stringify(await done()) === JSON.stringify(keys) && await receipt().count() === 0);
    await expose(board());
  });
  await run('routines', 'routine-selection-return', async cell => {
    await byId('routine-tile-goodbye').click(); await steps().first().click();
    await byId('routine-tile-morning').click();
    check(cell, 'SELECTING_AWAY_AND_BACK_DOES_NOT_REVIVE_RECEIPT', await receipt().count() === 0 && JSON.stringify(await done()) === JSON.stringify(keys));
    check(cell, 'OTHER_ROUTINE_CHECKLIST_PRESERVED', JSON.stringify((await storage('routines.done')).goodbye) === '["g1"]');
    await expose(board());
  });
  await run('routines', 'routine-reset', async cell => {
    await byId('routines-reset').click();
    check(cell, 'RESET_CLEARS_ONLY_SELECTED_CHECKLIST_AND_FEEDBACK', (await done()).length === 0 && await receipt().count() === 0 && JSON.stringify(await storage('routines.done')) === '{"goodbye":["g1"]}');
    await complete(); await assertReceipt(cell, true);
    check(cell, 'RESET_PERMITS_TRUTHFUL_NEW_COMPLETION', JSON.stringify((await storage('routines.done')).morning) === JSON.stringify(keys));
  });
  await run('routines', 'routine-sibling-return', async cell => {
    await childSwitch(cell, fixture.siblingId, fixture.siblingName);
    await page.waitForFunction(() => {
      const nodes = [...document.querySelectorAll('[data-module="routines-board"] [data-testid^="routine-step-"]')];
      return nodes.length > 1 && nodes.every(node => node.getAttribute('aria-pressed') === 'false');
    });
    check(cell, 'SIBLING_GETS_EMPTY_BOARD_NO_OLD_RECEIPT', (await done()).length === 0 && await receipt().count() === 0);
    await childSwitch(cell, fixture.childId, fixture.childName);
    await page.waitForFunction(() => {
      const nodes = [...document.querySelectorAll('[data-module="routines-board"] [data-testid^="routine-step-"]')];
      return nodes.length > 1 && nodes.every(node => node.getAttribute('aria-pressed') === 'true');
    });
    check(cell, 'RETURN_RESTORES_OWN_CHECKLIST_NO_OLD_RECEIPT', JSON.stringify(await done()) === JSON.stringify(keys) && await receipt().count() === 0);
    await expose(board());
  });
  await run('routines', 'routine-local-failure', async cell => {
    await reset('base', 'routines'); await board().waitFor({ state: 'visible' });
    await fault(cell, 'routines.done', async () => { await complete(); await assertReceipt(cell, false); });
    check(cell, 'FAILED_STORAGE_KEEPS_IN_MEMORY_CHECKLIST_USABLE', JSON.stringify(await done()) === JSON.stringify(keys));
  });
  await run('routines', 'routine-local-retry', async cell => {
    await steps().last().click(); check(cell, 'RETRY_UNDO_RETIRES_FAILURE_RECEIPT', await receipt().count() === 0);
    await steps().last().click(); await assertReceipt(cell, true);
    check(cell, 'NEW_COMPLETION_PERSISTS_AFTER_FAULT_REMOVED', JSON.stringify((await storage('routines.done')).morning) === JSON.stringify(keys));
  });
}
