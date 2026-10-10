/** Mounted UI flows only. Storage fixtures and egress faults are explicitly labeled. */
import { CONFIRMED_ACTIONS_NOW, CONFIRMED_ACTIONS_EXPIRED, confirmedActionVariant,
  installConfirmedStorageFault, restoreConfirmedStorageFault, validConfirmedActionFrame } from './confirmed-actions-contract.mjs';
import { collectConfirmedMilestoneStates } from './confirmed-milestone-states.mjs';
import { collectConfirmedRoutineStates } from './confirmed-routine-states.mjs';
import { collectConfirmedFamilyStates } from './confirmed-family-states.mjs';
import { collectConfirmedConsultPortalState } from './confirmed-consult-portal-state.mjs';
import { observeConfirmedFrame, waitConfirmedFrame } from './confirmed-frame.mjs';
import { installConfirmedDate, changeConfirmedDate, restoreConfirmedDate, observeConfirmedClock } from './confirmed-date-clock.mjs';

export async function collectConfirmedActionStates(helpers) {
  const { page, fixture, viewport, load: loadRoute, screen, check, visible, byId, captureDiagnostics = () => null, recordBootstrapClock = () => {} } = helpers;
  const waitFrame = (cell, args, label) => waitConfirmedFrame(page, cell, args, label, captureDiagnostics);
  let activeCell = null;
  const load = async route => {
    const clock = () => page.evaluate(observeConfirmedClock);
    const trace = { requestedRoute: route, before: await clock() };
    if (activeCell) (activeCell.reloadClockObservations ??= []).push(trace);
    else recordBootstrapClock(trace);
    try { await loadRoute(route); }
    finally {
      trace.after = await clock().catch(() => ({ unavailable: true }));
      if (!activeCell) recordBootstrapClock(trace);
    }
  };
  const he = viewport.lang === 'he';
  const module = name => page.locator(`[data-module="${name}"]`);
  const storage = name => page.evaluate(({ id, name }) => JSON.parse(localStorage.getItem(`arbor.${name}.${id}`) ?? '[]'), { id: fixture.childId, name });
  const sink = () => page.evaluate(() => ({ ...window.__arborRecordShareSink }));
  const expose = locator => locator.scrollIntoViewIfNeeded();
  const frame = async (cell, id, locator) => {
    await expose(locator);
    const element = await locator.elementHandle();
    try { await waitFrame(cell, { element }, id); }
    finally { await element?.dispose(); }
    const observed = await locator.evaluate(el => {
      const box = el.getBoundingClientRect(), main = el.closest('#main')?.getBoundingClientRect();
      const x = box.x + box.width / 2, y = box.y + box.height / 2, hit = document.elementFromPoint(x, y);
      return { visible: box.width > 0 && box.height > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
        hit: !!hit && (hit === el || el.contains(hit)), inMain: !main || (y >= main.top && y <= main.bottom), enabled: !el.disabled,
        width: box.width, height: box.height, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
    });
    check(cell, id, validConfirmedActionFrame(observed), observed);
  };
  const reset = async (variant = 'base', route = 'overview', { settleRoute = true } = {}) => {
    await page.evaluate(restoreConfirmedStorageFault);
    await page.evaluate(changeConfirmedDate, Date.parse(CONFIRMED_ACTIONS_NOW));
    const collections = confirmedActionVariant(fixture, variant);
    await page.evaluate(({ id, siblingId, collections }) => {
      for (const [name, values] of Object.entries(collections)) {
        localStorage.setItem(`arbor.${name}.${id}`, JSON.stringify(values));
        localStorage.setItem(`arbor.${name}.${siblingId}`, '[]');
      }
      localStorage.removeItem('arbor.familyRituals.practised');
      for (const childId of [id, siblingId]) {
        localStorage.removeItem(`arbor.familyTopic.${childId}`);
        localStorage.removeItem(`arbor.offer.ledger.${childId}`);
        localStorage.removeItem(`arbor.routines.done.${childId}`);
        for (const key of Object.keys(localStorage)) if (key.startsWith(`arbor.practicePin.${childId}.`) || key.startsWith(`arbor.practiceShown.${childId}.`)) localStorage.removeItem(key);
      }
      localStorage.setItem('arbor.activeChildId', id);
    }, { id: fixture.childId, siblingId: fixture.siblingId, collections });
    await load(route);
    if (settleRoute) await waitFrame(null, { routeName: route, childId: fixture.childId }, 'reset-route-ready');
  };
  const fault = async (cell, kind, action) => {
    await page.evaluate(installConfirmedStorageFault, { childId: fixture.childId, kind });
    try { await action(); }
    finally {
      const observed = await page.evaluate(restoreConfirmedStorageFault);
      cell.localStorageFault = observed;
      check(cell, 'SCOPED_STORAGE_REJECTED_BEFORE_WRITE_AND_RESTORED', !!observed && observed.rejected > 0 && observed.unchanged, observed);
    }
    cell.persistenceBoundary = 'synthetic-localStorage-quota-failure-not-Firestore';
  };
  const singleLead = async (cell, expected, primary = true) => {
    await module(expected).waitFor({ state: 'visible' });
    const found = await page.locator('.now-main-column > [data-module]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-module')).filter(name => ['now-record', 'now-visit', 'now-step', 'today-practice', 'today-tonight', 'now-program', 'now-recommendation'].includes(name)));
    check(cell, 'EXACT_SINGLE_EXPECTED_LEAD', found.length === 1 && found[0] === expected, found);
    if (primary) check(cell, 'ONE_CURRENT_PRIMARY_MOVE', await page.locator('#main [data-primary-move]').count() === 1);
  };
  const childSwitch = async (cell, childId, name, { settleBefore = true } = {}) => {
    const routeName = await page.locator('#main [data-route]').first().getAttribute('data-route');
    if (settleBefore) await waitFrame(cell, { routeName }, 'before-child-switch');
    else cell.unsettledChildStart = await page.evaluate(observeConfirmedFrame, { routeName });
    const outgoing = await page.locator('#main [data-route]').first().elementHandle();
    if (!outgoing) throw new Error('CONFIRMED_ACTION_OUTGOING_FRAME_MISSING');
    try {
      cell.actionStage = 'open-actual-child-switcher';
      await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
      cell.actionStage = 'select-actual-child-option';
      await page.getByRole('listbox').getByRole('option').filter({ hasText: name }).click();
      cell.actionStage = 'wait-child-route-replacement';
      await waitFrame(cell, { outgoing, routeName, childId }, 'after-child-switch');
    } finally { await outgoing.dispose(); }
    check(cell, 'ACTUAL_CHILD_SWITCHER_SELECTED_TARGET', await page.evaluate(() => localStorage.getItem('arbor.activeChildId')) === childId);
  };
  const rapidChildRoundTrip = async cell => {
    const routeName = await page.locator('#main [data-route]').first().getAttribute('data-route');
    const outgoing = await page.locator('#main [data-route]').first().elementHandle();
    if (!outgoing) throw new Error('RAPID_CHILD_OUTGOING_FRAME_MISSING');
    const observe = childId => page.evaluate(observeConfirmedFrame, { outgoing, routeName, childId });
    cell.rapidChildTransition = { before: await observe(fixture.childId), diagnosticsBefore: captureDiagnostics(),
      sequence: 'actual-A-to-B-to-A-without-waiting-for-B-body-or-animation' };
    const select = async (id, name) => {
      await page.locator('button[aria-haspopup="listbox"]:visible').first().click();
      await page.getByRole('listbox').getByRole('option').filter({ hasText: name }).click();
      // Observe the actual profile selection only, never wait for its route body.
      await page.waitForFunction(id => localStorage.getItem('arbor.activeChildId') === id, id, { timeout: 8_000 });
    };
    try {
      cell.actionStage = 'rapid-select-sibling';
      await select(fixture.siblingId, fixture.siblingName);
      cell.rapidChildTransition.afterSiblingSelection = await observe(fixture.siblingId);
      cell.actionStage = 'rapid-return-before-sibling-body-settles';
      await select(fixture.childId, fixture.childName);
      cell.rapidChildTransition.afterReturnSelection = await observe(fixture.childId);
      // AnimatePresence may legitimately retain A's original DOM during A-B-A.
      // Require the actual final body, not a fabricated replacement identity.
      await waitFrame(cell, { routeName, childId: fixture.childId }, 'rapid-child-final-body');
      cell.rapidChildTransition.final = await page.evaluate(observeConfirmedFrame, { routeName, childId: fixture.childId });
      cell.rapidChildTransition.originalFrameRetained = await outgoing.evaluate(node => node.isConnected);
      check(cell, 'RAPID_CHILD_RETURN_HAS_NONBLANK_SETTLED_BODY', cell.rapidChildTransition.final.ready);
    } catch (error) {
      cell.rapidChildTransition.lastObserved = await observe(fixture.childId).catch(() => ({ unavailable: true }));
      throw error;
    } finally {
      cell.rapidChildTransition.diagnosticsAfter = captureDiagnostics();
      await outgoing.dispose();
    }
  };
  const modalClose = async id => {
    const dialog = page.getByRole('dialog').filter({ has: byId(id) }).last();
    await dialog.getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
    await byId(id).waitFor({ state: 'detached' });
  };
  const run = (route, state, action, afterCapture) => screen(route, state, async cell => {
    activeCell = cell;
    cell.fixture = 'synthetic-confirmed-actions-local-persistence-only';
    try {
      await action(cell);
      cell.actionStage = 'wait-settled-frame-before-screenshot';
      const settledFrame = await waitFrame(cell, { routeName: route }, 'before-screenshot');
      check(cell, 'DATE_ONLY_FIXTURE_PRESERVES_NATIVE_TIMING', settledFrame.clock.fixture?.nativeTimingPreserved === true, settledFrame.clock);
      for (const dialog of await page.getByRole('dialog').all()) {
        const element = await dialog.elementHandle();
        try { await waitFrame(cell, { element }, 'dialog-before-screenshot'); }
        finally { await element?.dispose(); }
      }
    } catch (error) {
      cell.failureDiagnostics = captureDiagnostics();
      cell.failureFrame = await page.evaluate(observeConfirmedFrame, { routeName: route }).catch(() => ({ unavailable: true }));
      throw error;
    } finally { activeCell = null; }
  }, afterCapture);
  await page.addInitScript(installConfirmedDate, Date.parse(CONFIRMED_ACTIONS_NOW));
  try {
    await load('overview'); // real hydrator, before any direct setup writes or faults
    for (const source of ['parent', 'step']) await run('overview', `record-${source}-source`, async cell => {
      await reset(`record-${source}`); await singleLead(cell, 'now-record');
      check(cell, 'EXACT_SAVED_SOURCE_WORDS', await byId('today-record-quote').innerText() === fixture.words[source]);
      const expected = source === 'parent' ? (he ? 'כתבתם את זה' : 'You wrote this') : (he ? 'צעד שניסיתם' : 'A step you tried');
      check(cell, 'SOURCE_ATTRIBUTION_MATCHES_PARENT_OR_TRIED_STEP', (await byId('today-record-meta').innerText()).includes(expected));
      check(cell, 'THREE_RECORD_ANSWERS_AND_NO_SAVED_RECEIPT', await byId('today-record-answers').locator('button').count() === 3 && await byId('today-record-receipt').count() === 0);
      await frame(cell, 'RECORD_ANSWER_REACHABLE_44PX', byId('today-record-answers').locator('button').first());
    });
    await run('overview', 'record-local-failure', async cell => {
      await reset('record-parent'); await singleLead(cell, 'now-record');
      await fault(cell, 'actionLoops', async () => {
        await byId('today-record-answers').locator('[data-answer="easier"]').click();
        await module('now-record').getByRole('alert').waitFor({ state: 'visible' });
        check(cell, 'RECORD_FAILURE_RETAINS_WORDS_AND_NO_FALSE_RECEIPT', await byId('today-record-quote').innerText() === fixture.words.parent && await byId('today-record-receipt').count() === 0);
      });
      await frame(cell, 'RECORD_RETRY_REACHABLE', byId('today-record-answers').locator('[data-answer="easier"]'));
    });
    await run('overview', 'record-local-retry', async cell => {
      await byId('today-record-answers').locator('[data-answer="easier"]').click();
      await visible(cell, 'RECORD_RECEIPT_AFTER_SUCCESSFUL_LOCAL_WRITE', byId('today-record-receipt'));
      const saved = (await storage('actionLoops')).filter(row => row.source === 'from-record');
      check(cell, 'ONE_EXACT_DAILY_REFLECTION', saved.length === 1 && saved[0].id === `record.${fixture.childId}.2026-10-10` && saved[0].recordKey === `plan:${fixture.plan.id}` && saved[0].recommendation === fixture.words.parent && saved[0].reflection === 'easier' && saved[0].sayBack === undefined, saved);
      await load('overview'); await visible(cell, 'RECORD_RECEIPT_SURVIVES_REAL_RELOAD', byId('today-record-receipt'));
      check(cell, 'NO_REPEAT_ANSWER_AFTER_RELOAD', await byId('today-record-answers').count() === 0);
      cell.persistenceBoundary = 'verified-browser-localStorage-and-reload-not-Firestore';
    });
    await run('overview', 'chosen-tonight-override', async cell => {
      await reset('chosen'); await singleLead(cell, 'now-step');
      await frame(cell, 'EXPLICIT_TONIGHT_POINTER_REACHABLE', byId('today-tonight-pointer'));
      await byId('today-tonight-pointer').click(); await singleLead(cell, 'today-tonight');
      await visible(cell, 'ACTUAL_TONIGHT_FLOW_AFTER_EXPLICIT_CHOICE', byId('tonight-flow'));
      check(cell, 'CHOSEN_STEP_REMAINS_UNANSWERED', (await storage('actionLoops')).find(row => row.id === fixture.chosen.id)?.status === 'accepted');
    });
    await run('overview', 'visit-lead', async cell => {
      await reset('visit'); await singleLead(cell, 'now-visit');
      const text = await module('now-visit').innerText();
      check(cell, 'CONFIRMED_VISIT_USES_SAVED_PROFESSION', text.includes(he ? 'קלינאי' : 'Speech therapist') && !text.includes(fixture.visit.role));
      check(cell, 'REQUESTED_OR_ELAPSED_VISIT_NOT_PROMOTED', !text.includes(he ? 'רופא ילדים' : 'Pediatrician') && !text.includes(he ? 'גננת' : 'Teacher'));
      await frame(cell, 'VISIT_PREPARE_REACHABLE_44PX', module('now-visit').locator('[data-primary-move]'));
    });
    await run('overview', 'visit-tonight-override', async cell => {
      await byId('today-tonight-pointer').click(); await singleLead(cell, 'today-tonight');
      await visible(cell, 'TONIGHT_OVERRIDES_AUTOMATIC_VISIT', byId('tonight-flow'));
      check(cell, 'VISIT_SOURCE_NOT_CHANGED_BY_TONIGHT', JSON.stringify(await storage('appointments')) === JSON.stringify(fixture.appointments));
    });
    let visitHistoryLength;
    await run('consult', 'visit-target-arrival', async cell => {
      // Preserve the first run's rapid fresh-Now → Consult sequence: no added
      // route-animation settlement before the real Prepare click.
      await reset('visit', 'overview', { settleRoute: false }); await module('now-visit').waitFor({ state: 'visible' });
      cell.rapidSequence = 'fresh-Now-load-visible-visit-then-Prepare-without-added-settlement';
      visitHistoryLength = await page.evaluate(() => history.length);
      const outgoing = await page.locator('#main [data-route="overview"]').elementHandle();
      try {
        cell.visitTransitionBefore = await page.evaluate(observeConfirmedFrame, { outgoing, routeName: 'overview', childId: fixture.childId });
        cell.actionStage = 'click-actual-visit-prepare';
        await module('now-visit').locator('[data-primary-move]').click();
        cell.actionStage = 'wait-actual-consult-destination';
        await waitFrame(cell, { outgoing, routeName: 'consult', childId: fixture.childId }, 'visit-target-arrival');
      } finally { await outgoing?.dispose(); }
      await visible(cell, 'EXACT_TARGET_CONSULT_MOUNTED', byId('consult-h1'));
      check(cell, 'EXACT_APPOINTMENT_DEEP_LINK_ONE_HISTORY_ENTRY', new URL(page.url()).hash === `#/consult?appointment=${fixture.visit.id}` && await page.evaluate(() => history.length) === visitHistoryLength + 1);
      check(cell, 'VISIT_PROFESSION_AND_PRESET_MATCH', (await byId('consult-h1').innerText()).includes(he ? 'קלינאי' : 'Speech therapist') && (await byId('consult-audience-row').locator('[aria-checked="true"]').innerText()).includes(he ? 'קלינאי' : 'Speech'));
      check(cell, 'NO_EGRESS_ON_ARRIVAL', (await sink()).calls === 0 && (await sink()).clipboardCalls === 0);
      await frame(cell, 'CONSULT_BUILD_REACHABLE', byId('consult-build'));
    });
    await run('consult', 'visit-history-return', async cell => {
      await page.goBack(); await module('now-visit').waitFor({ state: 'visible' });
      check(cell, 'ONE_BACK_RETURNS_TO_NOW_NOT_UNTARGETED_CONSULT', new URL(page.url()).hash === '#/overview');
      await page.goForward(); await byId('consult-h1').waitFor({ state: 'visible' });
      check(cell, 'FORWARD_RETURNS_TO_SAME_VISIT', new URL(page.url()).hash === `#/consult?appointment=${fixture.visit.id}`);
    });
    let draftNode;
    await run('consult', 'consult-typed-draft', async cell => {
      await byId('consult-reason-input').fill(fixture.words.draft);
      draftNode = await byId('consult-reason-input').elementHandle();
      check(cell, 'ACTUAL_EDITABLE_DRAFT_TYPED', !!draftNode && await byId('consult-reason-input').inputValue() === fixture.words.draft);
      check(cell, 'DRAFT_TYPING_DOES_NOT_SHARE', (await sink()).calls === 0);
      await frame(cell, 'DRAFT_INPUT_REACHABLE', byId('consult-reason-input'));
    });
    await run('consult', 'consult-expired-inert', async cell => {
      await page.evaluate(changeConfirmedDate, Date.parse(CONFIRMED_ACTIONS_EXPIRED));
      await page.evaluate(id => { location.hash = `#/consult?appointment=${id}&captureEligibility=expired`; }, fixture.visit.id);
      await visible(cell, 'EXPIRED_TARGET_NOTICE', byId('consult-visit-unavailable'));
      const retained = draftNode && await draftNode.evaluate(el => ({ connected: el.isConnected, value: el.value, hiddenInert: !!el.closest('[hidden][inert]'), height: el.getBoundingClientRect().height }));
      check(cell, 'SAME_DRAFT_NODE_RETAINED_HIDDEN_AND_INERT', retained?.connected && retained.hiddenInert && retained.height === 0 && retained.value === fixture.words.draft, retained);
      check(cell, 'NO_VISIBLE_PACKET_OR_EXPORT_CONTROLS', await module('consult-packet').isVisible() === false && await byId('consult-copy').isVisible() === false && await byId('consult-send-trusted').isVisible() === false);
      await page.keyboard.press('Tab');
      check(cell, 'KEYBOARD_FOCUS_STAYS_OUTSIDE_BLOCKED_EDITOR', await page.evaluate(() => !document.activeElement?.closest('[hidden][inert]')));
      cell.persistenceBoundary = 'browser-clock-expiry-with-same-target-hash-rerender-not-Firestore-source-loss';
    });
    await run('consult', 'consult-restored-draft', async cell => {
      await page.evaluate(changeConfirmedDate, Date.parse(CONFIRMED_ACTIONS_NOW));
      await page.evaluate(id => { location.hash = `#/consult?appointment=${id}&captureEligibility=restored`; }, fixture.visit.id);
      await byId('consult-reason-input').waitFor({ state: 'visible' });
      check(cell, 'EXACT_DOM_EDITOR_IDENTITY_AND_TYPED_DRAFT_SURVIVE', !!draftNode && await byId('consult-reason-input').evaluate((el, previous) => el === previous, draftNode) && await byId('consult-reason-input').inputValue() === fixture.words.draft);
      check(cell, 'RESTORED_EDITOR_IS_EDITABLE_AND_NO_EGRESS', await byId('consult-reason-input').isEditable() && (await sink()).calls === 0);
      await frame(cell, 'RESTORED_DRAFT_REACHABLE', byId('consult-reason-input'));
      await draftNode?.dispose(); draftNode = null;
    });
    await collectConfirmedConsultPortalState({ ...helpers, run, frame });
    await run('consult', 'consult-missing-target', async cell => {
      await page.evaluate(() => { location.hash = '#/consult?appointment=capture-missing-visit'; });
      await visible(cell, 'MISSING_TARGET_NOTICE', byId('consult-visit-unavailable'));
      check(cell, 'NO_OTHER_VALID_VISIT_SUBSTITUTED', await module('consult-packet').count() === 0 && await byId('consult-h1').count() === 0 && await byId('consult-reason-input').count() === 0);
    });
    await run('consult', 'consult-child-target-isolation', async cell => {
      await page.evaluate(id => { location.hash = `#/consult?appointment=${id}`; }, fixture.visit.id);
      await byId('consult-reason-input').waitFor({ state: 'visible' }); await byId('consult-reason-input').fill(fixture.words.draft);
      await childSwitch(cell, fixture.siblingId, fixture.siblingName);
      await byId('consult-visit-unavailable').waitFor({ state: 'visible' });
      check(cell, 'SIBLING_CANNOT_OPEN_OR_BORROW_VISIT_DRAFT', await module('consult-packet').count() === 0 && await byId('consult-reason-input').count() === 0);
      await childSwitch(cell, fixture.childId, fixture.childName); await byId('consult-reason-input').waitFor({ state: 'visible' });
      check(cell, 'CHILD_RETURN_RETIRES_OLD_DRAFT', await byId('consult-reason-input').inputValue() === '');
    });
    for (const answer of ['yes', 'not_today']) {
      await run('overview', `sayback-${answer}-failure`, async cell => {
        await reset('sayback'); await byId('today-door').locator('summary').click();
        const line = byId('today-door-saidback'); await line.waitFor({ state: 'visible' });
        check(cell, 'SAYBACK_STAYS_IN_MORE_FOR_TODAY', await line.evaluate(el => !!el.closest('[data-testid="today-door"]')) && await byId('today-record-card').count() === 0);
        await fault(cell, 'actionLoops', async () => {
          await line.locator(`[data-answer="${answer}"]`).click(); await line.getByRole('alert').waitFor({ state: 'visible' });
          check(cell, 'FAILED_SAYBACK_HAS_NO_FALSE_SAVED_OR_RECORD_RECEIPT', await byId('today-door-saidback-receipt').count() === 0 && await byId('today-record-receipt').count() === 0 && await line.locator('[data-answer]').count() === 2);
        });
        await frame(cell, 'SAYBACK_RETRY_REACHABLE', line.locator(`[data-answer="${answer}"]`));
      });
      await run('overview', `sayback-${answer}-saved`, async cell => {
        await byId('today-door-saidback').locator(`[data-answer="${answer}"]`).click();
        await byId('today-door-saidback-receipt').waitFor({ state: 'visible' });
        const rows = (await storage('actionLoops')).filter(row => row.source === 'from-record');
        check(cell, 'EXACT_ONE_PARENT_ACT_WITHOUT_REFLECTION_OR_CHILD_OUTCOME', rows.length === 1 && rows[0].sayBack === answer && rows[0].recordKey === 'said:capture-confirmed-sayback' && rows[0].reflection === undefined && rows[0].outcome === undefined, rows);
        await load('overview'); await byId('today-door').locator('summary').click(); await visible(cell, 'SAYBACK_LOCAL_RECEIPT_SURVIVES_RELOAD', byId('today-door-saidback-receipt'));
        check(cell, 'SAYBACK_DOES_NOT_BECOME_RECORD_LEAD', await byId('today-door-saidback').getAttribute('data-answered') === answer && await byId('today-record-receipt').count() === 0);
        await expose(byId('today-door-saidback'));
      });
    }
    for (const outcome of ['helped', 'not_today']) {
      const action = () => module('now-step').locator('.now-lead-actions button').nth(outcome === 'helped' ? 0 : 1);
      await run('overview', `chosen-${outcome}-failure`, async cell => {
        await reset('chosen'); await singleLead(cell, 'now-step');
        await fault(cell, 'actionLoops', async () => {
          await action().click(); await module('now-step').getByRole('alert').waitFor({ state: 'visible' });
          check(cell, 'CHOSEN_FAILURE_RETAINS_ORIGINAL_STEP_NO_SAVED_STATUS', (await module('now-step').locator('h2').innerText()) === fixture.words.chosen && await module('now-step').locator('[role="status"]').count() === 0);
        });
        await singleLead(cell, 'now-step');
        check(cell, 'RETRY_RETAINS_STEP_OVER_AUTOMATIC_VISIT', await module('now-visit').count() === 0);
        await frame(cell, 'CHOSEN_RETRY_REACHABLE', action());
      });
      await run('overview', `chosen-${outcome}-saved`, async cell => {
        await action().click(); await module('now-step').locator('[role="status"]').waitFor({ state: 'visible' });
        const rows = await storage('actionLoops');
        check(cell, 'EXACT_LOCAL_CHOSEN_OUTCOME_AFTER_ACK', rows.length === 1 && rows[0].id === fixture.chosen.id && rows[0].status === 'completed' && rows[0].outcome === outcome && rows[0].recommendation === fixture.words.chosen, rows);
        check(cell, 'CHOSEN_RECEIPT_ONCE_NO_REPEAT_ANSWER', await module('now-step').locator('[role="status"]').count() === 1 && await module('now-step').locator('.now-lead-actions button').count() === 0);
        await expose(module('now-step'));
      });
    }
    const shared = { ...helpers, load, run, reset, frame, fault, storage, sink, expose, childSwitch, rapidChildRoundTrip, modalClose };
    await collectConfirmedMilestoneStates(shared);
    await collectConfirmedRoutineStates(shared);
    await collectConfirmedFamilyStates(shared);
  } finally {
    await page.evaluate(restoreConfirmedStorageFault).catch(() => null);
    await page.evaluate(restoreConfirmedDate).catch(() => null);
  }
}
