/** Actual Plans disclosure and registered routine records. The retired route stays retired. */
export async function collectConfirmedRoutineStates({ page, fixture, viewport, load, run, reset, frame, fault, storage, expose, childSwitch, check, visible, byId }) {
  const he = viewport.lang === 'he';
  const primary = fixture.routineRows[0], other = fixture.routineRows[1];
  const row = (id = primary.id) => byId(`routine-row-${id}`);
  const steps = (id = primary.id) => row(id).locator(`[data-testid^="routine-step-${id}-"]`);
  const receipt = (id = primary.id) => byId(`routine-receipt-${id}`);
  const failure = () => byId(`routine-failed-${primary.id}`);
  const read = async (id = primary.id) => (await storage('routines')).find(value => value.id === id);
  const done = () => steps().evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed') === 'true'));
  const open = async () => {
    const disclosure = byId('plans-routines-row'); await disclosure.waitFor({ state: 'visible' });
    if (!await disclosure.evaluate(node => node.open)) await disclosure.locator(':scope > summary').click();
    await byId('routines-card').waitFor({ state: 'visible' });
  };
  const clickStep = async (index, selected, id = primary.id) => {
    const button = byId(`routine-step-${id}-${index}`); await button.click();
    await page.waitForFunction(({ id, index, selected }) => document.querySelector(`[data-testid="routine-step-${id}-${index}"]`)?.getAttribute('aria-pressed') === String(selected), { id, index, selected });
  };
  const complete = async () => { for (let index = 0; index < primary.steps.length; index++) if (await byId(`routine-step-${primary.id}-${index}`).getAttribute('aria-pressed') !== 'true') await clickStep(index, true); };
  const assertReceipt = async cell => {
    await visible(cell, 'LOCAL_COMPLETION_SAVED_RECEIPT', receipt());
    const text = await receipt().innerText();
    check(cell, 'TRUTHFUL_LOCAL_DEVICE_WORDING', text.includes(he ? 'נשמרה במכשיר הזה' : 'saved on this device') && !/star|world|assigned|כוכב|בעולם|שויכה/i.test(text), text);
    check(cell, 'ONE_SHARED_LOCALE_RECEIPT', await receipt().count() === 1 && await receipt().getAttribute('data-receipt') === 'muted' && await receipt().getAttribute('dir') === (he ? 'rtl' : 'ltr') && await receipt().getAttribute('lang') === viewport.lang);
    await expose(receipt());
  };
  await run('plans', 'routine-partial', async cell => {
    await reset('routines', 'plans'); await open(); await row().waitFor({ state: 'visible' });
    check(cell, 'ACTUAL_LIVE_PLANS_ROUTINES_COLLECTION', new URL(page.url()).hash === '#/plans' && await steps().count() === primary.steps.length && await row(other.id).count() === 1);
    for (let index = 0; index < primary.steps.length - 1; index++) await clickStep(index, true);
    check(cell, 'PARTIAL_CHECKLIST_HAS_NO_COMPLETION_RECEIPT', await receipt().count() === 0 && JSON.stringify(await done()) === '[true,true,false]');
    await frame(cell, 'FINAL_ROUTINE_STEP_REACHABLE_44PX', steps().last());
  });
  await run('plans', 'routine-complete', async cell => {
    await clickStep(primary.steps.length - 1, true); await assertReceipt(cell);
    check(cell, 'ACTUAL_REGISTERED_CHECKLIST_PERSISTED_LOCALLY', (await read()).steps.every(step => step.done));
    check(cell, 'COMPLETION_HAS_NO_NEW_REWARD_LEDGER', (await storage('actionLoops')).length === 0);
  });
  await run('plans', 'routine-repeat-toggle', async cell => {
    // Settle each real acknowledgement; a disabled pending control need not accept two clicks.
    await clickStep(primary.steps.length - 1, false);
    check(cell, 'UNDO_FINAL_STEP_REMOVES_RECEIPT', await receipt().count() === 0 && JSON.stringify(await done()) === '[true,true,false]');
    await clickStep(primary.steps.length - 1, true); await assertReceipt(cell);
    check(cell, 'REPEATED_TOGGLE_USES_LATEST_CHECKLIST', (await read()).steps.every(step => step.done) && (await storage('routines')).length === 2);
  });
  await run('plans', 'routine-reload', async cell => {
    await load('plans'); await open(); await row().waitFor({ state: 'visible' });
    check(cell, 'RELOAD_RESTORES_CHECKLIST_WITHOUT_REPLAYING_RECEIPT', (await done()).every(Boolean) && (await done()).length === primary.steps.length && await receipt().count() === 0);
    await expose(row());
  });
  await run('plans', 'routine-card-isolation', async cell => {
    await clickStep(0, true, other.id);
    check(cell, 'SECOND_CARD_DOES_NOT_CHANGE_FIRST_OR_REVIVE_RECEIPT', (await read()).steps.every(step => step.done) && await receipt().count() === 0);
    check(cell, 'OTHER_ROUTINE_OWNS_ITS_CHECKLIST', JSON.stringify((await read(other.id)).steps.map(step => step.done)) === '[true,false]' && await receipt(other.id).count() === 0);
    await expose(row(other.id));
  });
  await run('plans', 'routine-reset', async cell => {
    await byId(`routine-reset-${primary.id}`).click();
    await page.waitForFunction(id => { const buttons = [...document.querySelectorAll(`[data-testid^="routine-step-${id}-"]`)].filter(node => node.tagName === 'BUTTON'); return buttons.length === 3 && buttons.every(node => node.getAttribute('aria-pressed') === 'false'); }, primary.id);
    check(cell, 'RESET_CLEARS_ONLY_OWN_CHECKLIST_AND_FEEDBACK', JSON.stringify(await done()) === '[false,false,false]' && await receipt().count() === 0 && JSON.stringify((await read(other.id)).steps.map(step => step.done)) === '[true,false]');
    await complete(); await assertReceipt(cell);
    check(cell, 'RESET_PERMITS_TRUTHFUL_NEW_COMPLETION', (await read()).steps.every(step => step.done));
  });
  await run('plans', 'routine-sibling-return', async cell => {
    await childSwitch(cell, fixture.siblingId, fixture.siblingName); await open();
    check(cell, 'SIBLING_GETS_OWN_EMPTY_ROUTINES_NO_OLD_RECEIPT', await row().count() === 0 && await row(other.id).count() === 0 && await receipt().count() === 0);
    await childSwitch(cell, fixture.childId, fixture.childName); await open(); await row().waitFor({ state: 'visible' });
    check(cell, 'RETURN_RESTORES_OWN_CHECKLIST_NO_OLD_RECEIPT', JSON.stringify(await done()) === '[true,true,true]' && await receipt().count() === 0);
    await expose(row());
  });
  await run('plans', 'routine-local-failure', async cell => {
    await reset('routines', 'plans'); await open(); await row().waitFor({ state: 'visible' });
    await clickStep(0, true); await clickStep(1, true);
    const before = await storage('routines');
    await fault(cell, 'routines', async () => {
      await steps().last().click(); await failure().waitFor({ state: 'visible' });
      check(cell, 'FAILED_COMPLETION_HAS_ERROR_AND_NO_FALSE_SAVED_RECEIPT', await receipt().count() === 0 && (await failure().innerText()).includes(he ? 'במכשיר הזה' : 'couldn’t be saved on this device'));
      check(cell, 'FAILED_LOCAL_WRITE_LEAVES_FINAL_STEP_UNCOMPLETED', JSON.stringify(await done()) === '[true,true,false]' && JSON.stringify(await storage('routines')) === JSON.stringify(before));
    });
    await frame(cell, 'ACTUAL_ROUTINE_RETRY_REACHABLE', byId(`routine-retry-${primary.id}`));
  });
  await run('plans', 'routine-local-retry', async cell => {
    await byId(`routine-retry-${primary.id}`).click(); await assertReceipt(cell);
    check(cell, 'RETRY_PERSISTS_INTENDED_COMPLETION_AFTER_FAULT_REMOVED', (await read()).steps.every(step => step.done) && await failure().count() === 0 && (await storage('routines')).length === 2);
    cell.persistenceBoundary = 'registered-routines-localStorage-acknowledgement-not-Firestore';
  });
}
