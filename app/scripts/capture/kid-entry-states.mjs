/** Actual controls only; no app callbacks, generation, state reset or forced click. */
import { observeKidEntry, kidEntryHomeFacts, compareKidEntryProfiles } from './kid-entry-contract.mjs';

export async function collectKidEntryStates({ page, fixture, viewport, load, screen, check, byId, apiState }) {
  const he = viewport.lang === 'he';
  const parentSelector = '#main [data-route="overview"]';
  const overlaySelector = '[data-kid-mode-layer][role="dialog"]';
  const heroSelector = '[role="dialog"]:has([data-testid="hero-step-continue"])';
  const creatorSelector = '[role="dialog"]:has([data-testid="avatar-character-princess"])';
  const challengeSelector = '[role="dialog"][aria-labelledby="parent-challenge-title"]';
  const door = () => page.getByRole('button', { name: he ? /^(כניסה למצב ילדים|מצב ילדים) —/ : /^(Launch Kid Mode|Kid Mode) —/ }).filter({ visible: true }).first();
  const hero = () => page.locator(heroSelector);
  const overlay = () => page.locator(overlaySelector);
  const challenge = () => page.locator(challengeSelector);
  let profilesBefore, earliestStampMs, collectionsBefore, opener, stepNode, creatorNode;
  const visitedChildIds = new Set([fixture.child.id]);
  let profileFieldsIntact = true, profileVisitsIntact = true;
  const profileSnapshot = () => page.evaluate(() => ({ profiles: JSON.parse(localStorage.getItem('arbor.children') ?? 'null'), atMs: Date.now() }));
  const collections = () => page.evaluate(({ childIds, collectionNames }) => JSON.stringify(childIds.flatMap(id => collectionNames.map(name => [id, name, localStorage.getItem(`arbor.${name}.${id}`)]))), fixture);
  const wait = async (cell, selector, childId = fixture.child.id, outgoing = null) => {
    const contentSelector = selector === parentSelector ? 'h1' : selector === overlaySelector ? '[data-kid-view="home"] > div > header' : null;
    const handle = await page.waitForFunction(observeKidEntry, { selector, contentSelector, childId, outgoing, waitUntilReady: true }, { timeout: 12000 });
    try { const observed = await handle.jsonValue(); (cell.frames ??= []).push(observed); check(cell, 'ACTUAL_SETTLED_DESTINATION_BODY', observed.ready, observed); return observed; }
    finally { await handle.dispose(); }
  };
  const run = (state, action) => screen('shell', state, async cell => {
    cell.fixture = 'synthetic-kid-entry-actual-controls-no-generation';
    await action(cell);
    const snapshot = await profileSnapshot();
    cell.profileComparison = compareKidEntryProfiles({ previous: profilesBefore, current: snapshot.profiles, allowedChildIds: fixture.childIds, visitedChildIds: [...visitedChildIds], earliestStampMs, observedAtMs: snapshot.atMs });
    // Latch violations: advancing the transition baseline cannot turn a
    // forbidden mutation into a later passing state.
    profileFieldsIntact &&= cell.profileComparison.identitiesMatch && cell.profileComparison.fieldsUnchanged;
    profileVisitsIntact &&= cell.profileComparison.visitTransitionsValid;
    check(cell, 'PROFILE_IDENTITY_AGE_HERO_AND_OTHER_FIELDS_UNCHANGED', profileFieldsIntact, cell.profileComparison);
    check(cell, 'VISIT_STAMP_TRANSITIONS_ACCOUNTED', profileVisitsIntact, cell.profileComparison);
    profilesBefore = snapshot.profiles;
    check(cell, 'CHILD_COLLECTIONS_UNCHANGED', await collections() === collectionsBefore);
    check(cell, 'NO_GENERATION_OR_MUTATION_DISPATCH', apiState.kidEntryDeniedMutations === 0, apiState.kidEntryDeniedMutations);
  });
  const parent = async (cell, child = fixture.child, outgoing = null) => {
    await overlay().waitFor({ state: 'detached' });
    const frame = await wait(cell, parentSelector, child.id, outgoing);
    check(cell, 'PARENT_BODY_UNLOCKED_WITHOUT_RETIRED_MODAL', frame.hash === '#/overview' && !frame.state.open && !frame.mainInert && frame.heroStepCount === 0 && frame.creatorCount === 0 && frame.challengeCount === 0);
    check(cell, 'PARENT_HEADING_NAMES_CURRENT_CHILD', frame.text === (he ? `היום עם ${child.name}` : `Today with ${child.name}`), frame.text);
    return frame;
  };
  const entered = async (cell, child = fixture.child) => {
    const frame = await wait(cell, overlaySelector, child.id);
    const observation = { phase: 'first-ready-home-body', frame }; (cell.lockObservations ??= []).push(observation);
    await overlay().getByRole('button', { name: he ? 'החזיקו כדי לחזור להורה' : 'Hold to go back to parent', exact: true }).waitFor({ state: 'visible' });
    check(cell, 'ACTUAL_HOME_GREETING_NAMES_CURRENT_CHILD', frame.text.includes(he ? `היי ${child.name}!` : `Hi ${child.name}!`), frame.text);
    const facts = kidEntryHomeFacts(frame);
    check(cell, 'EXACT_CURRENT_CHILD_HOME_AND_PARENT_SHIELD', Object.values(facts).every(Boolean), facts);
    check(cell, 'NO_RETIRED_STEP_OR_CREATOR', frame.heroStepCount === 0 && frame.creatorCount === 0);
    (cell.lockObservations ??= []).push({ phase: 'after-exit-control-visible', frame: await page.evaluate(observeKidEntry, { selector: overlaySelector, contentSelector: '[data-kid-view="home"] > div > header', childId: child.id }) });
    await page.keyboard.press('Tab');
    (cell.lockObservations ??= []).push({ phase: 'after-real-tab', frame: await page.evaluate(observeKidEntry, { selector: overlaySelector, contentSelector: '[data-kid-view="home"] > div > header', childId: child.id }) });
    check(cell, 'KEYBOARD_FOCUS_INSIDE_KID_OVERLAY', await overlay().evaluate(el => el.contains(document.activeElement)));
    return frame;
  };
  const hold = async (cell, child = fixture.child) => {
    const control = overlay().getByRole('button', { name: he ? 'החזיקו כדי לחזור להורה' : 'Hold to go back to parent', exact: true });
    await control.scrollIntoViewIfNeeded();
    const box = await control.boundingBox();
    if (!box) throw new Error('KID_EXIT_CONTROL_MISSING');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try { await challenge().waitFor({ state: 'visible', timeout: 6000 }); }
    finally { await page.mouse.up(); }
    const frame = await wait(cell, challengeSelector, child.id);
    check(cell, 'REAL_HOLD_OPENS_CHALLENGE_WITHOUT_UNLOCK', frame.state.open && frame.mainInert && frame.challengeCount === 1);
    check(cell, 'CHALLENGE_INPUT_HAS_FOCUS', await challenge().locator('input').evaluate(el => document.activeElement === el));
  };
  const answer = async (cell, child = fixture.child) => {
    const text = await challenge().locator('form [dir="ltr"] > span').innerText();
    const numbers = /^(\d+)\s*\+\s*(\d+)\s*=/.exec(text);
    if (!numbers) throw new Error('VISIBLE_SYNTHETIC_MATH_QUESTION_MISSING');
    await challenge().locator('input').fill(String(Number(numbers[1]) + Number(numbers[2])));
    await challenge().locator('button[type="submit"]').click();
    await parent(cell, child);
    await page.keyboard.press('Tab');
    check(cell, 'PARENT_KEYBOARD_FOCUS_REACHABLE_AFTER_GATE', await page.evaluate(() => document.activeElement !== document.body && !document.activeElement?.closest('[inert], [data-kid-mode-layer]')));
  };
  const select = async (child, settle, cell) => {
    // Normal switches require retirement of the actual outgoing keyed body.
    // Rapid ABA may legitimately retain A's DOM; do not manufacture a remount.
    const outgoing = settle === true ? await page.locator(parentSelector).elementHandle() : null;
    try {
      await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
      await page.getByRole('listbox').getByRole('option').filter({ hasText: child.name }).click();
      await page.waitForFunction(id => localStorage.getItem('arbor.activeChildId') === id, child.id);
      visitedChildIds.add(child.id);
      if (settle) {
        const frame = await parent(cell, child, outgoing);
        check(cell, 'ACTUAL_VISIBLE_CHILD_IDENTITY', frame.childIdentities.includes(child.id), frame.childIdentities);
      }
    } finally { await outgoing?.dispose(); }
  };
  try {
    await run('hero-first', async cell => {
      earliestStampMs = await page.evaluate(() => Date.now());
      await load('overview'); profilesBefore = (await profileSnapshot()).profiles; collectionsBefore = await collections();
      await parent(cell); opener = await door().elementHandle(); await door().click();
      const frame = await wait(cell, heroSelector); stepNode = await hero().elementHandle();
      check(cell, 'CURRENT_CHILD_HERO_FIRST_BEFORE_ENTRY', frame.text.includes(fixture.child.name) && !frame.state.open && frame.offered.length === 1 && frame.offered[0] === fixture.child.id);
      check(cell, 'FOCUS_TRAPPED_IN_PARENT_HERO_MODAL', frame.focus.insideTarget && !frame.focus.insideInert);
    });
    await run('creator-open', async cell => {
      await hero().getByRole('button', { name: he ? `צרו את הגיבור של ${fixture.child.name}` : `Create ${fixture.child.name}'s hero`, exact: true }).click();
      const frame = await wait(cell, creatorSelector); creatorNode = await page.locator(creatorSelector).elementHandle();
      check(cell, 'ACTUAL_DESCRIPTOR_CREATOR_WITHOUT_GENERATION', frame.text.includes(fixture.child.name) && !frame.state.open && frame.focus.insideTarget);
    });
    await run('creator-cancel', async cell => {
      await page.locator(creatorSelector).getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
      await page.locator(creatorSelector).waitFor({ state: 'detached' });
      const frame = await wait(cell, heroSelector);
      check(cell, 'CREATOR_REMOVED_PARENT_STEP_RESTORED', creatorNode && !await creatorNode.evaluate(el => el.isConnected) && frame.creatorCount === 0 && frame.heroStepCount === 1 && !frame.state.open);
    });
    await run('step-cancel', async cell => {
      // The creator's temporary hide replaced the original Modal DOM. Capture
      // the actual current step before cancellation, not its retired first node.
      await stepNode?.dispose(); stepNode = await hero().elementHandle();
      await hero().getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
      await parent(cell);
      check(cell, 'CANCEL_REMOVES_CURRENT_STEP_AND_RESTORES_DOOR_FOCUS', stepNode && !await stepNode.evaluate(el => el.isConnected) && opener && await opener.evaluate(el => el.isConnected && document.activeElement === el));
    });
    await run('same-session-entry', async cell => { await door().click(); const frame = await entered(cell); check(cell, 'CANCELLED_OFFER_NOT_REPEATED_THIS_SESSION', frame.offered.length === 1 && frame.offered[0] === fixture.child.id); });
    await run('lock-escape', async cell => { await page.keyboard.press('Escape'); await entered(cell); });
    await run('lock-reload', async cell => {
      await page.reload({ waitUntil: 'domcontentloaded' }); await entered(cell);
      check(cell, 'REAL_RELOAD_RETAINS_EXISTING_OPEN_LOCK', await page.evaluate(() => JSON.parse(localStorage.getItem('arbor.kidmode.active')).open) === true);
    });
    await run('gate-hold', async cell => { await hold(cell); await page.keyboard.press('Escape'); const frame = await wait(cell, challengeSelector); check(cell, 'ESCAPE_CANNOT_DISMISS_OR_UNLOCK_CHALLENGE', frame.challengeCount === 1 && frame.state.open === true && frame.mainInert === true); });
    await run('gate-wrong', async cell => {
      await challenge().locator('input').fill('0'); await challenge().locator('button[type="submit"]').click();
      await page.waitForFunction(() => document.querySelector('[aria-labelledby="parent-challenge-title"] input')?.getAttribute('aria-invalid') === 'true');
      const frame = await wait(cell, challengeSelector); check(cell, 'WRONG_ANSWER_REMAINS_LOCKED_WITH_FOCUSED_RETRY', frame.state.open && frame.mainInert && await challenge().locator('input').inputValue() === '' && await challenge().locator('input').evaluate(el => document.activeElement === el));
    });
    await run('gate-dismiss', async cell => { await challenge().locator(':scope > button').click(); await challenge().waitFor({ state: 'detached' }); await entered(cell); });
    await run('gate-return', async cell => { await hold(cell); await answer(cell); });
    await run('same-session-reload-entry', async cell => { await page.reload({ waitUntil: 'domcontentloaded' }); await parent(cell); await door().click(); await entered(cell); });
    await run('sibling-hero-first', async cell => {
      await hold(cell); await answer(cell); await select(fixture.sibling, true, cell);
      await door().click(); const frame = await wait(cell, heroSelector, fixture.sibling.id);
      check(cell, 'FRESH_ELIGIBLE_SIBLING_GETS_OWN_OFFER', frame.text.includes(fixture.sibling.name) && !frame.text.includes(fixture.child.name) && !frame.state.open && frame.offered.length === 2 && frame.offered.includes(fixture.sibling.id));
    });
    await run('sibling-sprout-entry', async cell => { await byId('hero-step-continue').click(); await entered(cell, fixture.sibling); });
    await run('sibling-parent-return', async cell => { await hold(cell, fixture.sibling); await answer(cell, fixture.sibling); await select(fixture.child, true, cell); });
    await run('under-three-child-switch', async cell => {
      await select(fixture.younger, true, cell);
      check(cell, 'UNDER_THREE_HAS_NO_ENTRY_DOOR_OR_OLD_MODAL', await door().count() === 0 && await hero().count() === 0);
      const frame = await wait(cell, parentSelector, fixture.younger.id);
      check(cell, 'INELIGIBLE_CHILD_NOT_MARKED_OFFERED', !frame.offered.includes(fixture.younger.id));
    });
    await run('child-aba-return', async cell => {
      await select(fixture.child, true, cell);
      const persistentDoor = await door().elementHandle();
      try {
        await select(fixture.sibling, false, cell); await select(fixture.child, 'rapid', cell);
        check(cell, 'SAME_PERSISTENT_DOOR_AFTER_ELIGIBLE_A_B_A', persistentDoor && await door().evaluate((el, previous) => el === previous, persistentDoor));
        await select(fixture.younger, false, cell); await select(fixture.child, 'rapid', cell);
        const frame = await wait(cell, parentSelector);
        check(cell, 'A_UNDER_THREE_A_DOES_NOT_REVIVE_CANCELLED_STEP', frame.heroStepCount === 0 && frame.creatorCount === 0 && !frame.state.open && frame.offered.length === 2);
      } finally { await persistentDoor?.dispose(); }
      cell.transitionScope = 'actual-switcher-after-cancel-and-parent-return; no pending-modal switch';
    });
    await run('current-child-entry', async cell => { await door().click(); await entered(cell); });
  } finally { await opener?.dispose(); await stepNode?.dispose(); await creatorNode?.dispose(); }
}
