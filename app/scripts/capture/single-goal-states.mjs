/** Actual current controls only. No application patch, callback or forced action. */
import { observeSingleGoalControls, singleGoalFailureCode } from './single-goal-diagnostics.mjs';
import { probeSingleGoalKeyboard } from './single-goal-keyboard.mjs';
import { SINGLE_GOAL_ROUTES, SINGLE_GOAL_DOORS, SINGLE_GOAL_SURFACES, observeSingleGoalFrame, compareGoalSave } from './single-goal-contract.mjs';

export async function collectSingleGoalStates({ page, fixture, viewport, load, screen, check, byId, apiState }) {
  // Expected labels/catalogue come from this exact source; importing this file
  // alone executes no application, browser, package, socket or provider work.
  const { tsImport } = await import('tsx/esm/api');
  const { goalLabel, focusGoal, GOAL_TILES } = await tsImport(new URL('../../src/practice/goalBuilder.ts', import.meta.url).href, import.meta.url);
  const { translate } = await tsImport(new URL('../../src/lib/i18n.ts', import.meta.url).href, import.meta.url);
  const t = (key, vars) => translate(viewport.lang, key, vars);
  const label = goal => goalLabel(goal, t);
  const dialogSelector = '[role="dialog"][aria-modal="true"]:has([data-testid="goal-current"], [data-testid="goal-confirm"], [data-testid^="goal-choice-"])';
  const dialog = () => page.locator(dialogSelector);
  let child = fixture.children[0], route = 'profile', opener;
  const expectedGoals = new Map(fixture.children.map(item => [item.id, structuredClone(item.activeGoals)]));
  const snapshot = () => page.evaluate(({ children, collectionNames }) => ({
    profiles: JSON.parse(localStorage.getItem('arbor.children') ?? 'null'),
    collections: children.flatMap(child => collectionNames.map(name => [child.id, name, localStorage.getItem(`arbor.${name}.${child.id}`)])),
  }), fixture);
  const stripGoals = profiles => profiles?.map(({ activeGoals, ...rest }) => rest);
  const baselineProfiles = stripGoals(fixture.children);
  const fixtureCollections = (fixture.parsed.locales?.[viewport.lang] ?? fixture.parsed).collections;
  const baselineCollections = fixture.children.flatMap(child => fixture.collectionNames.map(name => [child.id, name, JSON.stringify(fixtureCollections[name])]));
  const goals = () => expectedGoals.get(child.id);
  const current = () => focusGoal(goals());
  const selector = () => SINGLE_GOAL_DOORS[route] ? `[data-testid="${SINGLE_GOAL_DOORS[route]}"]` : `#main [data-route="${route}"] h1`;
  let activeCell;
  const step = (code, selector = null) => { if (activeCell) activeCell.attempt = { step: code, targetSelector: selector }; };
  const loadRoute = async () => { step('load-route'); await load(route); };
  const waitFrame = async (cell, target = selector(), expectedText = null, outgoing = null) => {
    step('fonts', target);
    await page.evaluate(async () => { await document.fonts.ready; });
    step('settled-frame', target);
    const handle = await page.waitForFunction(observeSingleGoalFrame, { route, childId: child.id, selector: target, expectedText, outgoing, waitUntilReady: true }, { timeout: 12000 });
    try { const frame = await handle.jsonValue(); (cell.frames ??= []).push(frame); return frame; }
    finally { await handle.dispose(); }
  };
  const persist = async cell => {
    step('storage-read');
    const state = await snapshot();
    const historyIntact = Array.isArray(state.profiles) && state.profiles.length === fixture.children.length && state.profiles.every(profile => expectedGoals.has(profile.id) && JSON.stringify(profile.activeGoals ?? []) === JSON.stringify(expectedGoals.get(profile.id)));
    check(cell, 'GOAL_HISTORY_EXACT', historyIntact);
    check(cell, 'CHILD_COLLECTIONS_UNCHANGED', JSON.stringify(state.collections) === JSON.stringify(baselineCollections));
    check(cell, 'ONLY_APPROVED_PROFILE_CHANGE', JSON.stringify(stripGoals(state.profiles)) === JSON.stringify(baselineProfiles));
    check(cell, 'NO_GOAL_MUTATION_DISPATCH', apiState.singleGoalDeniedMutations === 0);
    cell.storageReceipt = { childId: child.id, goalIds: state.profiles?.find(profile => profile.id === child.id)?.activeGoals?.map(goal => goal.goalId) ?? [], fixtureMethod: fixture.fixtureMethod, persistence: 'observed-local-sandbox-only' };
  };
  const run = (destination, state, action) => screen(destination, state, async cell => {
    cell.fixture = 'synthetic-single-goal-actual-controls-local-only';
    activeCell = cell; step('action');
    try {
      await action(cell);
      const target = await dialog().count() ? dialogSelector : selector();
      const frame = await waitFrame(cell, target);
      check(cell, 'ACTUAL_SETTLED_GOAL_FRAME', frame.ready && frame.direction === (viewport.lang === 'he' ? 'rtl' : 'ltr'), frame);
      check(cell, 'FOUR_ROUTE_VOCABULARY', !/\bfocus(?:es)?\b|מיקוד|elev\.goal\.|companion\./i.test(frame.mainText + ' ' + frame.targetText));
      const contract = SINGLE_GOAL_SURFACES[route];
      check(cell, 'ONE_PRIMARY_WITHIN_MODULE_BUDGET', frame.primary.length === 1 && frame.primary[0] === contract.primary && frame.modules.length > 0 && frame.modules.length <= contract.budget, { primary: frame.primary, modules: frame.modules, contract });
      check(cell, 'NO_HORIZONTAL_OVERFLOW', frame.pageWidth <= frame.viewportWidth + 1 && frame.mainScrollWidth <= frame.mainClientWidth + 1 && frame.targetScrollWidth <= frame.targetClientWidth + 1, frame);
      await persist(cell);
    } catch (error) {
      cell.interactionFailure = { step: cell.attempt?.step ?? 'action', code: singleGoalFailureCode(error) };
      cell.controlDiagnostics = await page.evaluate(observeSingleGoalControls, { childIds: fixture.children.map(item => item.id), targetSelector: cell.attempt?.targetSelector ?? dialogSelector }).catch(() => ({ unavailable: true }));
      throw error;
    }
  });
  const targets = async (cell, controls) => {
    const measurements = [];
    for (const control of controls) {
      measurements.push(await control.evaluate(node => { const box = node.getBoundingClientRect(); return { id: node.getAttribute('data-testid') ?? node.tagName, width: box.width, height: box.height }; }));
    }
    check(cell, 'GOAL_TARGETS_44PX', measurements.length > 0 && measurements.every(box => box.width >= 43.99 && box.height >= 43.99), measurements);
  };
  const line = async cell => {
    if (!SINGLE_GOAL_DOORS[route]) { check(cell, 'ACTUAL_SINGLE_CURRENT_LINE', await page.locator('[data-testid$="goals-edit"]').count() === 0); return; }
    const door = byId(SINGLE_GOAL_DOORS[route]);
    const expected = current() ? label(current()) : t('elev.goal.profile.empty');
    await waitFrame(cell, selector(), expected);
    const bdi = await door.locator('bdi').allTextContents();
    check(cell, 'ACTUAL_SINGLE_CURRENT_LINE', await door.count() === 1 && (current() ? bdi.length === 1 && bdi[0] === expected : bdi.length === 0 && (await door.innerText()).includes(expected)), { currentId: current()?.goalId ?? null, displayed: bdi });
    await targets(cell, [door]);
  };
  const close = async (cell, escape = false, assertId = null) => {
    step(escape ? 'escape-key' : 'close-click', dialogSelector + ' button[aria-label]');
    if (escape) await page.keyboard.press('Escape'); else await dialog().getByRole('button', { name: t('aria.close'), exact: true }).click();
    step('dialog-detached', dialogSelector);
    await dialog().waitFor({ state: 'detached' });
    if (assertId) {
      step('opener-focus', selector());
      await page.waitForFunction(node => node?.isConnected && document.activeElement === node, opener);
      check(cell, assertId, await opener.evaluate(node => node.isConnected && document.activeElement === node));
    }
  };
  const open = async cell => {
    await opener?.dispose();
    if (await dialog().count()) throw new Error('SINGLE_GOAL_PICKER_MUST_BE_CLOSED');
    step('open-focus', selector());
    const door = byId(SINGLE_GOAL_DOORS[route]); await door.scrollIntoViewIfNeeded(); await door.focus();
    opener = await door.elementHandle(); step('open-enter', selector()); await page.keyboard.press('Enter');
    await waitFrame(cell, dialogSelector, t('elev.goal.profile.title'));
  };
  const choose = async (cell, id, earlier = false) => {
    step('choice-click', `[data-testid="${earlier ? 'goal-earlier-' : 'goal-choice-'}${id}"]`);
    await byId(`${earlier ? 'goal-earlier-' : 'goal-choice-'}${id}`).click();
    await waitFrame(cell, '[data-testid="goal-confirm"]', label(goals().find(goal => goal.goalId === id) ?? { goalId: id, label: GOAL_TILES.find(tile => tile.id === id)?.label }));
    check(cell, 'CONFIRMATION_FOCUS', await byId('goal-confirm').evaluate(node => document.activeElement === node));
    const question = current() ? t('elev.goal.modal.replace', { goal: label(current()) }) : t('elev.goal.modal.keepNotes');
    check(cell, current() ? 'EXPLICIT_REPLACEMENT_QUESTION' : 'EMPTY_CHOICE_PRESERVES_NOTES', (await byId('goal-confirm').innerText()).includes(question));
  };
  const cancel = async cell => {
    step('cancel-click', '[data-testid="goal-cancel"]');
    await byId('goal-cancel').click(); step('confirmation-detached', '[data-testid="goal-confirm"]'); await byId('goal-confirm').waitFor({ state: 'detached' });
    check(cell, 'CANCEL_RESTORES_CHOICES_AND_DIALOG_FOCUS', await dialog().evaluate(node => document.activeElement === node) && await page.locator('[data-testid^="goal-choice-"]').count() > 0);
  };
  const earlier = async cell => {
    step('earlier-click', '[data-testid="goal-earlier"] summary');
    await byId('goal-earlier').locator('summary').click();
    const ids = goals().filter(goal => goal.goalId !== current()?.goalId).map(goal => goal.goalId);
    const actual = await byId('goal-earlier').locator('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-testid').replace('goal-earlier-', '')));
    check(cell, 'EARLIER_LIST_COMPLETE', await byId('goal-earlier').evaluate(node => node.open) && JSON.stringify(actual) === JSON.stringify(ids), { expected: ids, actual });
  };
  const save = async (cell, id) => {
    const before = structuredClone(goals()); step('save-click', '[data-testid="goal-save"]'); await byId('goal-save').click();
    step('dialog-detached', dialogSelector); await dialog().waitFor({ state: 'detached' });
    step('stored-selection');
    await page.waitForFunction(({ childId, selectedId }) => {
      const profile = JSON.parse(localStorage.getItem('arbor.children') ?? '[]').find(profile => profile.id === childId);
      return profile?.activeGoals?.at(-1)?.goalId === selectedId;
    }, { childId: child.id, selectedId: id });
    step('storage-read');
    const after = (await snapshot()).profiles.find(profile => profile.id === child.id).activeGoals;
    const tile = GOAL_TILES.find(tile => tile.id === id);
    const newGoal = tile ? { goalId: tile.id, label: tile.label, domainId: tile.domainId } : null;
    const valid = compareGoalSave(before, after, id, newGoal);
    check(cell, 'LOCAL_SAVE_PRESERVES_EVERY_RECORD', valid, { beforeIds: before.map(goal => goal.goalId), afterIds: after.map(goal => goal.goalId), selectedId: id, localOnly: true });
    if (!valid) throw new Error('GOAL_SAVE_HISTORY_MISMATCH');
    expectedGoals.set(child.id, after);
    await line(cell);
  };
  const reopen = async (cell, id = 'REOPEN_SHOWS_SAVED_CURRENT') => {
    await open(cell);
    const expected = current() ? label(current()) : null;
    check(cell, id, await byId('goal-confirm').count() === 0 && (!expected || (await byId('goal-current').innerText()).includes(expected)) && await page.locator('[data-testid^="goal-choice-"]').count() > 0);
  };
  const selectChild = async (cell, next) => {
    if (await dialog().count()) await close(cell);
    const picker = page.locator('button[aria-haspopup="listbox"]:visible').first();
    step('child-picker-focus', 'button[aria-haspopup="listbox"]'); await picker.focus();
    if (!await picker.evaluate(node => document.activeElement === node && !node.closest('[inert]'))) throw new Error('CHILD_PICKER_FOCUS_MISSING');
    step('child-picker-enter'); await page.keyboard.press('Enter'); await page.getByRole('listbox').waitFor({ state: 'visible' });
    step('child-picker-option'); await page.getByRole('listbox').getByRole('option').filter({ hasText: next.name }).click(); child = next;
    step('child-identity'); await page.waitForFunction(id => localStorage.getItem('arbor.activeChildId') === id, child.id);
    await waitFrame(cell, selector(), route === 'plans' ? null : current() ? label(current()) : t('elev.goal.profile.empty'));
    (cell.childSwitches ??= []).push({ selectedId: child.id, method: 'actual-keyboard-picker-and-visible-option' });
  };
  try {
    for (const destination of SINGLE_GOAL_ROUTES) await run(destination, `history-${destination}`, async cell => { route = destination; await loadRoute(); await line(cell); });
    await run('development', 'profile-door-arrival', async cell => {
      route = 'profile'; await loadRoute(); await line(cell); const outgoing = await byId('profile-goals-edit').elementHandle();
      try { await byId('profile-goals-edit').click(); route = 'development'; const frame = await waitFrame(cell, selector(), label(current()), outgoing); check(cell, 'PROFILE_DOOR_ACTUAL_ARRIVAL', frame.hash === '#/development' && frame.outgoingRetired && frame.dialogCount === 0); }
      finally { await outgoing?.dispose(); }
    });
    await run('development', 'picker-history', async cell => { await open(cell); check(cell, 'THREE_STORED_ONE_CURRENT', goals().length === 3 && await byId('goal-current').count() === 1 && (await byId('goal-current').locator('bdi').innerText()) === label(current())); await targets(cell, [dialog().getByRole('button', { name: t('aria.close'), exact: true }), byId('goal-choice-big-feelings'), byId('goal-earlier').locator('summary')]); });
    await run('development', 'picker-keyboard', async cell => {
      step('keyboard', dialogSelector); const receipt = await probeSingleGoalKeyboard({ page, dialog: dialog() });
      cell.keyboardReceipt = receipt; check(cell, 'REAL_TAB_WRAPS_BOTH_DIRECTIONS', receipt.passed, receipt);
    });
    await run('development', 'replacement-question', async cell => { await choose(cell, 'big-feelings'); await targets(cell, [byId('goal-save'), byId('goal-cancel')]); });
    await run('development', 'replacement-cancel', cancel);
    await run('development', 'picker-close', cell => close(cell, false, 'CLOSE_RETURNS_OPENER_FOCUS'));
    await run('development', 'picker-reopen', cell => reopen(cell, 'REOPEN_NO_STALE_CHOICE'));
    await run('development', 'replacement-save', async cell => { await choose(cell, 'big-feelings'); await save(cell, 'big-feelings'); });
    await run('development', 'saved-reopen', reopen);
    await run('development', 'earlier-open', earlier);
    await run('development', 'earlier-question', cell => choose(cell, 'transitions', true));
    await run('development', 'earlier-save', cell => save(cell, 'transitions'));
    await run('development', 'earlier-reopen', reopen);
    await run('profile', 'browser-back', async cell => {
      const outgoing = await dialog().elementHandle();
      try { step('back'); await page.goBack({ waitUntil: 'domcontentloaded' }); route = 'profile'; const frame = await waitFrame(cell, selector(), label(current()), outgoing); check(cell, 'ACTUAL_BACK_RETIRES_PICKER', frame.hash === '#/profile' && frame.dialogCount === 0 && frame.outgoingRetired); }
      finally { await outgoing?.dispose(); }
    });
    await run('development', 'browser-forward', async cell => { step('forward'); await page.goForward({ waitUntil: 'domcontentloaded' }); route = 'development'; const frame = await waitFrame(cell, selector(), label(current())); check(cell, 'ACTUAL_FORWARD_NO_STALE_PICKER', frame.hash === '#/development' && frame.dialogCount === 0); });
    await run('development', 'forward-reopen', cell => reopen(cell, 'REOPEN_NO_STALE_CHOICE'));
    await run('daily-play', 'daily-picker', async cell => { await close(cell); route = 'daily-play'; await loadRoute(); await open(cell); check(cell, 'SAME_PROVIDER_PICKER', (await byId('goal-current').locator('bdi').innerText()) === label(current()) && await byId('goal-earlier').count() === 1); });
    await run('daily-play', 'daily-question', cell => choose(cell, 'taking-turns'));
    await run('daily-play', 'daily-cancel', cancel);
    await run('daily-play', 'daily-save', async cell => { await choose(cell, 'taking-turns'); await save(cell, 'taking-turns'); });
    await run('daily-play', 'daily-reopen', reopen);
    await run('daily-play', 'daily-escape', cell => close(cell, true, 'ESCAPE_RETURNS_OPENER_FOCUS'));
    for (const [kind, next] of [['empty', fixture.children[1]], ['long', fixture.children[2]]]) {
      for (const destination of SINGLE_GOAL_ROUTES) await run(destination, `${kind}-${destination}`, async cell => {
        route = destination; await loadRoute(); if (child.id !== next.id) await selectChild(cell, next); await line(cell);
      });
      // Only the real switcher changed child identity; reload never replaces data.
      route = 'development';
      if (kind === 'empty') {
        await run(route, 'empty-picker', async cell => { await loadRoute(); await open(cell); check(cell, 'EMPTY_NO_CURRENT_OR_EARLIER', await byId('goal-current').count() === 0 && await byId('goal-earlier').count() === 0 && await page.locator('[data-testid^="goal-choice-"]').count() === GOAL_TILES.length); });
        await run(route, 'empty-question', cell => choose(cell, 'big-feelings'));
        await run(route, 'empty-cancel', cancel);
        await run(route, 'empty-save', async cell => { await choose(cell, 'big-feelings'); await save(cell, 'big-feelings'); });
        await run(route, 'empty-reopen', reopen);
      } else {
        await run(route, 'long-picker', async cell => { await loadRoute(); await open(cell); check(cell, 'FULL_LONG_LABEL_RETAINED', await byId('goal-current').locator('bdi').innerText() === current().label); await targets(cell, [dialog().getByRole('button', { name: t('aria.close'), exact: true }), byId('goal-earlier').locator('summary')]); });
        await run(route, 'long-earlier', async cell => { await earlier(cell); check(cell, 'FULL_LONG_LABEL_RETAINED', (await byId('goal-earlier').innerText()).includes(goals()[0].label)); });
        await run(route, 'long-question', cell => choose(cell, 'capture-retired-long-earlier', true));
        await run(route, 'long-cancel', cancel);
        await run(route, 'long-save', async cell => { await earlier(cell); await choose(cell, 'capture-retired-long-earlier', true); await save(cell, 'capture-retired-long-earlier'); });
        await run(route, 'long-reopen', reopen);
      }
      // The next named route cell performs its real full load. No unrecorded
      // cleanup may abort the remaining long-label/watch evidence states.
    }
    await run('development', 'history-child-return', async cell => { await selectChild(cell, fixture.children[0]); await open(cell); check(cell, 'ACTUAL_CHILD_RETURN_PRESERVES_GOALS', goals().length === 5 && await byId('goal-current').locator('bdi').innerText() === label(current()) && await byId('goal-confirm').count() === 0); await close(cell); step('reload'); await page.reload({ waitUntil: 'domcontentloaded' }); await line(cell); });
    const watchKey = `arbor.screen.watch.${child.id}`; let watchTitle;
    await run('development', 'watch-chosen', async cell => { await byId('portrait-unwatch').waitFor({ state: 'visible' }); await byId('portrait-watch').scrollIntoViewIfNeeded(); watchTitle = await page.locator('#portrait-watch-title').innerText(); check(cell, 'ACTUAL_CHOSEN_WATCH', await byId('portrait-watch-details').evaluate(node => node.open) && await page.evaluate(key => localStorage.getItem(key), watchKey) === JSON.stringify(fixture.watch)); await targets(cell, [byId('portrait-unwatch')]); });
    await run('development', 'watch-cleared', async cell => { await byId('portrait-unwatch').click(); await byId('portrait-watch-undo').waitFor({ state: 'visible' }); const receipt = await page.locator('.portrait-watch-undo').innerText(); check(cell, 'ACTUAL_CLEAR_RECEIPT_AND_STORAGE', await page.evaluate(key => localStorage.getItem(key), watchKey) === null && receipt.includes(viewport.lang === 'he' ? 'הבחירה שלכם במה לשים לב אליו נוקתה.' : 'Your watch choice was cleared.') && !/\bfocus(?:es)?\b|מיקוד/i.test(receipt)); cell.watchReceipt = receipt; await targets(cell, [byId('portrait-watch-undo')]); });
    await run('development', 'watch-undo', async cell => { await byId('portrait-watch-undo').click(); await byId('portrait-unwatch').waitFor({ state: 'visible' }); check(cell, 'ACTUAL_UNDO_RESTORES_WATCH', await page.evaluate(key => localStorage.getItem(key), watchKey) === JSON.stringify(fixture.watch) && await page.locator('#portrait-watch-title').innerText() === watchTitle && await byId('portrait-watch-undo').count() === 0); await targets(cell, [byId('portrait-unwatch')]); });
  } finally { await opener?.dispose(); }
}
