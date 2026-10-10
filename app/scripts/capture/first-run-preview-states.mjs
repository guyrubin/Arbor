/** Real controls in the existing DEV preview. No auth, storage, CSS or handler replacement. */
import { firstRunObservationRecordMatches, observeFirstRunElement } from './first-run-observation-evidence.mjs';
import { BASE } from './config.mjs';
import { FIRST_RUN_PREVIEW_BOUNDARY, firstRunPreviewProfileFacts, firstRunPreviewText, validFirstRunNetworkEvidence } from './first-run-preview-contract.mjs';

/** Browser observation only. A DOM presence check cannot establish visible destination content. */
export function observeFirstRunPreview({ selector, lang, titleSelector = 'h1', waitUntilReady = false }) {
  const visible = el => {
    if (!el?.isConnected) return false;
    for (let node = el; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) < 0.99 || node.hidden || node.inert) return false;
    }
    const b = el.getBoundingClientRect();
    return b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1;
  };
  const root = document.querySelector(selector);
  const title = root?.querySelector(titleSelector);
  const primary = root?.querySelector('.first-run-primary');
  const primaryRect = primary?.getBoundingClientRect();
  const hit = primaryRect ? document.elementFromPoint(primaryRect.x + primaryRect.width / 2, primaryRect.y + primaryRect.height / 2) : null;
  const main = root?.closest?.('[dir]') ?? document.querySelector('main');
  const direction = main ? getComputedStyle(main).direction : null;
  const titleReady = visible(title) && !!title.textContent?.trim();
  const frame = { ready: !!root && titleReady, titleVisible: titleReady, title: title?.textContent?.trim() ?? '', direction,
    directionMatches: direction === (lang === 'he' ? 'rtl' : 'ltr'),
    primaryReachable: !!primary && visible(primary) && !!hit && (hit === primary || primary.contains(hit)),
    closeControls: root?.querySelectorAll('button[aria-label="Close"], button[aria-label="סגירה"], [data-testid="onboarding-close"]').length ?? 0,
    progress: root?.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') ?? null,
    hash: location.hash, previewQuery: new URLSearchParams(location.search).has('onboarding'),
    focus: { inForm: !!root?.contains(document.activeElement), tag: document.activeElement?.tagName ?? null },
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  return waitUntilReady ? frame.ready && !frame.horizontalOverflow : frame;
}

export async function collectFirstRunPreviewStates({ page, viewport, screen, check, apiState, recordCreatedChild }) {
  const text = firstRunPreviewText(viewport.lang);
  const previewUrl = `${BASE}/?onboarding=1&capture=first-run-dev-preview#/overview`;
  const nowUrl = `${BASE}/?capture=first-run-dev-preview-explicit-exit#/overview`;
  const about = () => page.locator('[data-testid="onboarding-about"]');
  const worry = () => page.locator('[data-testid="onboarding-worry"]');
  const card = () => page.locator('[data-testid="onboarding-card"]');
  const primary = () => page.locator('.first-run-primary');
  const name = () => about().locator('input').first();
  const month = () => page.locator('[data-testid="onboarding-birth-month"]');
  const consent = () => about().locator('input[type="checkbox"]');
  const language = () => about().locator('.first-run-languages button').nth(viewport.lang === 'he' ? 0 : 1);
  const back = () => page.locator('[data-testid="onboarding-back"]');
  const profiles = () => page.evaluate(() => JSON.parse(localStorage.getItem('arbor.children') ?? '[]'));
  const actions = () => page.evaluate(id => JSON.parse(localStorage.getItem(`arbor.actionLoops.${id}`) ?? '[]'), childId);
  let baseline, childId, acceptedAction, completedAction;
  const stepModule = () => page.locator('[data-module="now-step"]');
  const answer = () => page.locator('[data-testid="now-observation-answer"]');
  const save = () => stepModule().locator('button[type="submit"]');
  const element = async selector => {
    await page.waitForFunction(observeFirstRunElement, { selector, waitUntilReady: true }, { timeout: 15_000 });
    return page.evaluate(observeFirstRunElement, { selector });
  };
  const selection = async (cell, id, selector) => {
    const frame = await element(selector);
    check(cell, id, frame.visible && frame.reachable && frame.pressed === 'true' && frame.checkVisible && frame.glyph === 'check', frame);
  };
  const noEfficacy = async cell => check(cell, 'NO_EFFICACY_CONTROLS', await stepModule().locator('[role="group"], input[type="radio"], select').count() === 0
    && await stepModule().locator('button').count() === 1 && (await actions()).every(row => !Object.hasOwn(row, 'outcome') && !Object.hasOwn(row, 'outcomeAt')));
  const noReceipt = async cell => check(cell, 'NO_PREMATURE_RECEIPT', await page.locator('[data-testid="now-observation-receipt"]').count() === 0);
  const fullQuestion = async cell => {
    const frame = await element('[data-module="now-step"] h2');
    check(cell, 'FULL_QUESTION_AND_DETAILS_VISIBLE', frame.visible && frame.reachable && frame.text === text.recommendation, frame);
  };
  const oneMove = async cell => check(cell, 'ONE_OBSERVATION_MODULE_AND_PRIMARY', await stepModule().count() === 1 && await page.locator('[data-route="overview"] [data-primary-move]').count() === 1);
  const phones = async (cell, support) => check(cell, 'EXISTING_URGENT_PHONE_TARGETS', JSON.stringify(await support.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')).sort())) === JSON.stringify(['tel:100', 'tel:101', 'tel:118', 'tel:1201'].sort()));
  const today = new Date();
  const birthMonth = `${today.getFullYear() - 4}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const ready = async locator => { await locator.waitFor({ state: 'visible', timeout: 45_000 }); await page.evaluate(() => document.fonts.ready); };
  const facts = async () => firstRunPreviewProfileFacts(baseline, await profiles(), childId);
  const sameChild = async cell => check(cell, 'SAME_CHILD_NO_DUPLICATE', (await facts()).sameChild);
  const fill = async () => { await name().fill(text.name); await month().fill(birthMonth); await language().click(); await about().locator(`[data-language="${viewport.lang === 'he' ? 'English' : 'Hebrew'}"]`).click(); };
  const step = async expected => {
    await page.waitForFunction(value => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === value, String(expected));
  };
  const run = (state, action, destination = false) => screen('onboarding-dev-preview', state, async cell => {
    cell.fixture = 'existing-dev-onboarding-preview';
    cell.firstRunPreview = FIRST_RUN_PREVIEW_BOUNDARY;
    await action(cell);
    const frameArgs = { selector: destination ? '[data-route="overview"]' : '.first-run', lang: viewport.lang, ...(typeof destination === 'object' ? destination : {}) };
    await page.waitForFunction(observeFirstRunPreview, { ...frameArgs, waitUntilReady: true }, { timeout: 15_000 });
    const frame = await page.evaluate(observeFirstRunPreview, frameArgs);
    cell.frames = [frame];
    check(cell, 'DEV_PREVIEW_BOUNDARY', cell.firstRunPreview.productionGateVerified === false && cell.firstRunPreview.remoteAcknowledgementVerified === false);
    check(cell, 'CONTENT_AND_TITLE_VISIBLE', frame.ready && !frame.horizontalOverflow);
    check(cell, 'DIRECTION_MATCHES_LOCALE', frame.directionMatches);
    check(cell, 'UNCHANGED_BASELINE_PROFILES', (await facts()).baselineUnchanged);
    check(cell, 'NO_REMOTE_OR_MODEL_WRITES', validFirstRunNetworkEvidence(apiState));
  });
  await run('about-initial', async cell => {
    await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 }); await ready(about());
    baseline = await profiles();
    check(cell, 'INITIAL_BLANK_FORM', await name().inputValue() === '' && await month().inputValue() === '' && !await consent().isChecked());
    check(cell, 'INITIAL_CONTINUE_DISABLED', await primary().isDisabled());
    check(cell, 'THREE_STEP_PROGRESS', await page.locator('[role="progressbar"]').getAttribute('aria-valuemax') === '3');
    const frame = await page.evaluate(observeFirstRunPreview, { selector: '.first-run', lang: viewport.lang });
    check(cell, 'NO_CLOSE_CONTROL', frame.closeControls === 0 && await back().count() === 0);
    check(cell, 'ABOUT_TITLE_EXACT', frame.title === text.about);
  });
  await run('about-keyboard-escape', async cell => {
    await name().click(); await page.keyboard.press('Tab');
    check(cell, 'REAL_TAB_REACHES_FORM', await about().evaluate(el => el.contains(document.activeElement) && document.activeElement !== el.querySelector('input')));
    await page.keyboard.press('Escape');
    check(cell, 'ESCAPE_DOES_NOT_DISMISS', await about().isVisible());
    check(cell, 'NO_CLOSE_CONTROL', (await page.evaluate(observeFirstRunPreview, { selector: '.first-run', lang: viewport.lang })).closeControls === 0);
  });
  await run('about-consent-required', async cell => {
    await fill();
    check(cell, 'FORM_VALID_EXCEPT_CONSENT', await name().inputValue() === text.name && await month().inputValue() === birthMonth && await language().getAttribute('aria-pressed') === 'true');
    await selection(cell, 'ENGLISH_SELECTION_CHECK_VISIBLE', '.first-run-languages [data-language="English"]');
    await selection(cell, 'HEBREW_SELECTION_CHECK_VISIBLE', '.first-run-languages [data-language="Hebrew"]');
    check(cell, 'CONSENT_REQUIRED_TO_CONTINUE', !await consent().isChecked() && await primary().isDisabled());
    check(cell, 'NO_CHILD_CREATED', (await facts()).newCount === 0);
  });
  await run('about-unsaved-reload', async cell => {
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(about());
    check(cell, 'UNSAVED_FORM_RESET_ON_RELOAD', await name().inputValue() === '' && await month().inputValue() === '' && !await consent().isChecked());
    check(cell, 'NO_CHILD_CREATED', (await facts()).newCount === 0);
  });
  await run('worry-local-created', async cell => {
    await fill(); await consent().check(); await primary().click(); await step(2); await ready(worry());
    await page.waitForFunction(ids => {
      const added = JSON.parse(localStorage.getItem('arbor.children') ?? '[]').filter(child => !ids.includes(child.id));
      return added.length === 1 && localStorage.getItem('arbor.activeChildId') === added[0].id;
    }, baseline.map(child => child.id));
    const current = await profiles();
    const added = current.filter(item => !baseline.some(prior => prior.id === item.id));
    childId = added.length === 1 ? added[0].id : null;
    check(cell, 'ONE_LOCAL_CHILD_CREATED', added.length === 1);
    check(cell, 'LOCAL_ABOUT_FIELDS_MATCH', added[0]?.name === text.name && added[0]?.birthMonth === birthMonth && added[0]?.onboardingComplete === false && added[0]?.languages?.includes(viewport.lang === 'he' ? 'Hebrew' : 'English'));
    check(cell, 'LOCAL_CHILD_SELECTED', childId && await page.evaluate(() => localStorage.getItem('arbor.activeChildId')) === childId);
    check(cell, 'WORRY_STEP_VISIBLE', await worry().isVisible());
    const observed = cell.assertions.every(assertion => assertion.passed === true) && (await facts()).baselineUnchanged;
    check(cell, 'CREATED_CHILD_NARRATION_SCOPE', observed && recordCreatedChild(childId));
  });
  await run('about-back-retained', async cell => {
    await back().click(); await step(1); await ready(about());
    check(cell, 'REAL_BACK_TO_ABOUT', await about().isVisible());
    check(cell, 'FORM_VALUES_RETAINED', await name().inputValue() === text.name && await month().inputValue() === birthMonth && await consent().isChecked() && await language().getAttribute('aria-pressed') === 'true');
    await sameChild(cell);
  });
  await run('worry-repeat-same-child', async cell => {
    await primary().click(); await step(2); await ready(worry());
    await sameChild(cell); check(cell, 'WORRY_STEP_VISIBLE', await worry().isVisible());
    await selection(cell, 'NOTHING_SELECTION_CHECK_VISIBLE', '[data-choice="nothing"]');
  });
  await run('worry-moving-selected', async cell => {
    const moving = worry().locator('[data-choice="moving"]');
    await moving.focus(); await page.keyboard.press('Space');
    check(cell, 'AREA_SELECTED_BY_REAL_KEYBOARD', await moving.getAttribute('aria-pressed') === 'true');
    await selection(cell, 'MOVING_SELECTION_CHECK_VISIBLE', '[data-choice="moving"]');
    check(cell, 'NOTHING_DESELECTED', await worry().locator('[data-choice="nothing"]').getAttribute('aria-pressed') === 'false' && await worry().locator('[data-choice="nothing"] [data-selection-check]').count() === 0);
  });
  await run('neutral-card', async cell => {
    check(cell, 'AREA_SELECTED_BY_REAL_KEYBOARD', await worry().locator('[data-choice="moving"]').getAttribute('aria-pressed') === 'true');
    await primary().click(); await step(3); await ready(card());
    check(cell, 'NEUTRAL_NOTICE_EXACT', await card().locator('.first-run-notice').innerText() === text.neutral);
    check(cell, 'NOTICING_CTA_EXACT', await primary().innerText() === text.notice);
    check(cell, 'LOCAL_DRAFT_CHECKPOINTED', (await profiles()).find(child => child.id === childId)?.onboardingDraft?.step === 3);
    check(cell, 'PRIMARY_ACTION_REACHABLE', (await page.evaluate(observeFirstRunPreview, { selector: '.first-run', lang: viewport.lang })).primaryReachable);
  });
  await run('worry-card-back', async cell => {
    await back().click(); await step(2); await ready(worry());
    check(cell, 'REAL_BACK_TO_WORRY', await worry().isVisible());
    check(cell, 'CHOICE_RETAINED', await worry().locator('[data-choice="moving"]').getAttribute('aria-pressed') === 'true');
    await sameChild(cell);
  });
  await run('neutral-checkpoint-reload', async cell => {
    await primary().click(); await step(3);
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('arbor.children') ?? '[]').some(child => child.id === id && child.onboardingDraft?.step === 3), childId);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(card()); await step(3);
    check(cell, 'RELOAD_RESUMES_LOCAL_STEP_THREE', await card().isVisible());
    check(cell, 'NEUTRAL_NOTICE_EXACT', await card().locator('.first-run-notice').innerText() === text.neutral);
    check(cell, 'NOTICING_CTA_EXACT', await primary().innerText() === text.notice);
    await sameChild(cell);
  });
  await run('hard-moment-card', async cell => {
    await back().click(); await step(2); await worry().locator('[data-choice="hard-moment"]').click();
    const guides = worry().locator('select'); await ready(guides);
    await guides.selectOption({ index: 1 }); await primary().click(); await step(3); await ready(card());
    check(cell, 'HARD_MOMENT_GUIDE_VISIBLE', await card().locator('.first-run-say').isVisible() && await card().locator('[data-testid="onboarding-escalation"]').isVisible() && await card().locator('details summary').count() === 1);
    check(cell, 'HARD_MOMENT_CTA_UNCHANGED', await primary().innerText() === text.try);
    check(cell, 'NO_ACTION_ACCEPTED', (await actions()).length === 0);
  });
  await run('urgent-card', async cell => {
    await back().click(); await step(2); await worry().locator('[data-choice="nothing"]').click();
    await worry().locator('textarea').fill('He wants to hurt himself'); await primary().click(); await step(3); await ready(card());
    const support = card().locator('[data-testid="onboarding-urgent-support"]'); await ready(support);
    check(cell, 'EXISTING_URGENT_SUPPORT_VISIBLE', await support.isVisible()); await phones(cell, support);
    check(cell, 'NO_ACTION_ACCEPTED', (await actions()).length === 0);
  });
  await run('talking-say-back-card', async cell => {
    await back().click(); await step(2); await worry().locator('textarea').fill('');
    await worry().locator('[data-choice="talking"]').click(); await primary().click(); await step(3); await ready(card());
    await card().locator('input').fill(text.quote);
    await page.waitForFunction(() => !!document.querySelector('[data-testid="onboarding-card"] .first-run-say'));
    check(cell, 'NEUTRAL_NOTICE_EXACT', await card().locator('.first-run-notice').innerText() === text.neutral);
    const detail = await element('[data-testid="onboarding-card"] .first-run-say');
    check(cell, 'FULL_SAY_BACK_VISIBLE', detail.visible && (await card().locator('.first-run-say').innerText()).replace(/\s+/g, ' ') === text.sayBack, detail);
    check(cell, 'NOTICING_CTA_EXACT', await primary().innerText() === text.notice); await sameChild(cell);
  });
  await run('local-completion-repeat', async cell => {
    await primary().click();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('arbor.children') ?? '[]').some(child => child.id === id && child.onboardingComplete === true), childId);
    const accepted = await actions();
    check(cell, 'LOCAL_COMPLETION_RECORDED', (await profiles()).find(child => child.id === childId)?.onboardingComplete === true);
    check(cell, 'ONE_ACCEPTED_ACTION_EXACT', accepted.length === 1 && accepted[0].status === 'accepted' && accepted[0].recommendation === text.recommendation && accepted[0].acceptanceKey?.startsWith(`onboarding-v1.${childId}.`));
    acceptedAction = accepted[0];
    check(cell, 'OBSERVATION_ACCEPTED_WITHOUT_EFFICACY', acceptedAction.observation === true && !Object.hasOwn(acceptedAction, 'outcome') && !Object.hasOwn(acceptedAction, 'outcomeAt'));
    check(cell, 'NOTICING_CTA_EXACT', await primary().innerText() === text.notice);
    await primary().click();
    check(cell, 'REPEAT_DID_NOT_DUPLICATE', JSON.stringify(await actions()) === JSON.stringify(accepted) && (await facts()).sameChild);
    check(cell, 'FORCED_PREVIEW_STILL_MOUNTED', await card().isVisible() && new URL(page.url()).searchParams.has('onboarding'));
  });
  const now = async cell => {
    await ready(page.locator('[data-route="overview"] h1'));
    await ready(page.locator('[data-module="now-step"]'));
    check(cell, 'ACTUAL_NOW_DESTINATION', new URL(page.url()).hash === '#/overview' && await page.locator('.first-run').count() === 0);
    check(cell, 'ACCEPTED_STEP_VISIBLE', await page.locator('[data-module="now-step"] h2').innerText() === text.recommendation);
    await sameChild(cell);
  };
  await run('explicit-preview-exit-now', async cell => {
    await page.goto(nowUrl, { waitUntil: 'domcontentloaded', timeout: 90_000 });
    check(cell, 'EXPLICIT_PREVIEW_REMOVAL', !new URL(page.url()).searchParams.has('onboarding'));
    await now(cell);
  }, true);
  await run('browser-back-preview', async cell => {
    await page.goBack({ waitUntil: 'domcontentloaded' }); await ready(about());
    check(cell, 'REAL_BROWSER_BACK', new URL(page.url()).searchParams.has('onboarding'));
    check(cell, 'COMPLETED_CHILD_NOT_REOPENED', await name().inputValue() === '' && (await profiles()).find(child => child.id === childId)?.onboardingComplete === true);
    await sameChild(cell);
  });
  await run('browser-forward-now', async cell => {
    await page.goForward({ waitUntil: 'domcontentloaded' });
    check(cell, 'REAL_BROWSER_FORWARD', !new URL(page.url()).searchParams.has('onboarding'));
    await now(cell);
  }, true);
  const observationFrame = { selector: '[data-module="now-step"]', titleSelector: 'h2' };
  await run('observation-blank', async cell => {
    await stepModule().scrollIntoViewIfNeeded(); await fullQuestion(cell);
    check(cell, 'OBSERVATION_PURPOSE_EXACT', await stepModule().locator('form > p').innerText() === text.purpose);
    const initiallyBlank = await answer().inputValue() === '' && await save().isDisabled();
    await answer().fill('   '); const whitespaceDisabled = await save().isDisabled(); await answer().fill('');
    check(cell, 'BLANK_SUBMISSION_DISABLED', initiallyBlank && whitespaceDisabled && await save().isDisabled());
    await oneMove(cell); await noEfficacy(cell); await noReceipt(cell);
  }, observationFrame);
  await run('observation-urgent-text', async cell => {
    await answer().fill('He wants to hurt himself');
    const support = page.locator('[data-testid="now-observation-urgent-support"]'); await ready(support); await support.scrollIntoViewIfNeeded();
    const frame = await element('[data-testid="now-observation-urgent-support"]');
    check(cell, 'EXISTING_OBSERVATION_URGENT_SUPPORT_VISIBLE', frame.visible && frame.reachable, frame);
    await phones(cell, support); await noReceipt(cell);
    check(cell, 'NO_OBSERVATION_SAVED', JSON.stringify(await actions()) === JSON.stringify([acceptedAction]));
  }, { selector: '[data-testid="now-observation-urgent-support"]', titleSelector: 'p' });
  await run('observation-multiline', async cell => {
    await answer().fill(text.words); await answer().focus(); await page.keyboard.press('Tab');
    const frame = await element('[data-module="now-step"] button[type="submit"]');
    check(cell, 'REAL_TAB_REACHES_SAVE', frame.focused && !await save().isDisabled(), frame);
    check(cell, 'OBSERVATION_SAVE_REACHABLE', frame.reachable && frame.text.endsWith(text.keep), frame);
    check(cell, 'MULTILINE_WORDS_RETAINED', await answer().inputValue() === text.words && text.words.includes('\n'));
    await fullQuestion(cell); await oneMove(cell); await noEfficacy(cell); await noReceipt(cell);
  }, observationFrame);
  await run('observation-local-receipt', async cell => {
    // The prior cell established actual Tab focus. One genuine keyboard submit;
    // remote pending/double-submit races remain the source tests' evidence.
    await page.keyboard.press('Enter');
    const receipt = page.locator('[data-testid="now-observation-receipt"]'); await ready(receipt);
    const rows = await actions(); completedAction = rows[0];
    check(cell, 'EXACT_COMPLETED_OBSERVATION', firstRunObservationRecordMatches(rows, acceptedAction, text.words));
    check(cell, 'LOCAL_HANDLER_RECEIPT_ONLY', FIRST_RUN_PREVIEW_BOUNDARY.remoteAcknowledgementVerified === false
      && (await receipt.innerText()).endsWith(text.receipt) && firstRunObservationRecordMatches(rows, acceptedAction, text.words));
    await stepModule().scrollIntoViewIfNeeded(); await fullQuestion(cell);
    const words = await element('[data-module="now-step"] > .now-lead-body');
    check(cell, 'SAVED_WORDS_VISIBLE', words.visible && words.reachable && words.text === text.words, words);
    check(cell, 'ONE_RECEIPT', await receipt.count() === 1 && await answer().count() === 0);
    await oneMove(cell); await noEfficacy(cell);
    const open = await element('[data-module="now-step"] button[data-primary-move]');
    check(cell, 'OPEN_RECORD_REACHABLE', open.reachable && open.text.startsWith(text.open), open);
  }, observationFrame);
  const rowSelector = () => `[id="journal-signal-action-${acceptedAction?.id ?? 'missing-observation'}"]`;
  const historyUnchanged = async cell => check(cell, 'HISTORY_RECORD_UNCHANGED', JSON.stringify(await actions()) === JSON.stringify([completedAction]));
  const noHistoryGrade = async (cell, selector) => {
    const content = await page.locator(selector).innerText();
    check(cell, 'NO_HISTORY_EFFICACY_OR_DURATION', !/it helped|didn.t help|not today|זה עזר|לא היום|2 min|2 דקות/i.test(content)
      && firstRunObservationRecordMatches(await actions(), acceptedAction, text.words));
  };
  await run('observation-history-row', async cell => {
    await stepModule().getByRole('button', { name: text.open, exact: false }).click();
    await ready(page.locator(rowSelector()));
    const frame = await element(rowSelector());
    check(cell, 'EXACT_HISTORY_ROUTE_AND_ROW', new URL(page.url()).hash === '#/journal?view=all'
      && await page.locator('[id^="journal-signal-action-"]').count() === 1 && frame.visible && frame.reachable, frame);
    check(cell, 'FACTUAL_OBSERVATION_HISTORY_TITLE', await page.locator(rowSelector()).getAttribute('aria-label') === text.history);
    await historyUnchanged(cell); await noHistoryGrade(cell, rowSelector());
  }, { selector: rowSelector(), titleSelector: 'p' });
  await run('observation-history-details', async cell => {
    await page.locator(rowSelector()).click(); const dialog = page.getByRole('dialog'); await ready(dialog);
    const content = await dialog.innerText();
    const detail = await element('[role="dialog"] p[dir="auto"]:nth-of-type(2)');
    check(cell, 'REAL_ROW_OPENED_DETAILS', await dialog.count() === 1 && content.includes(text.history));
    check(cell, 'FULL_HISTORY_QUESTION_AND_WORDS_VISIBLE', detail.visible && detail.reachable
      && detail.text === `${text.recommendation}\n\n${text.words}`, detail);
    await noHistoryGrade(cell, '[role="dialog"]');
  }, { selector: '[role="dialog"]', titleSelector: 'h3' });
  await run('observation-details-close', async cell => {
    await page.getByRole('dialog').locator('button[aria-label]').first().click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    check(cell, 'REAL_DETAILS_CLOSE', await page.getByRole('dialog').count() === 0 && new URL(page.url()).hash === '#/journal?view=all');
    check(cell, 'FOCUS_RESTORED_TO_EXACT_ROW', (await element(rowSelector())).focused);
    await historyUnchanged(cell);
  }, { selector: rowSelector(), titleSelector: 'p' });
  await run('observation-completed-reload', async cell => {
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await ready(page.locator('[data-route="overview"] h1'));
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page.locator('[data-route="overview"] h1'));
    check(cell, 'COMPLETED_ROW_SURVIVES_RELOAD', JSON.stringify(await actions()) === JSON.stringify([completedAction]));
    check(cell, 'NO_REPEATED_OBSERVATION_TASK', new URL(page.url()).hash === '#/overview' && await answer().count() === 0 && await stepModule().count() === 0);
    check(cell, 'NO_STALE_RECEIPT', await page.locator('[data-testid="now-observation-receipt"]').count() === 0);
    await sameChild(cell);
  }, true);

}
