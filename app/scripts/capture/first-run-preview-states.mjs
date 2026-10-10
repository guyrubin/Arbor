/** Real controls in the existing DEV preview. No auth, storage, CSS or handler replacement. */
import { BASE } from './config.mjs';
import { FIRST_RUN_PREVIEW_BOUNDARY, firstRunPreviewProfileFacts, firstRunPreviewText } from './first-run-preview-contract.mjs';

/** Browser observation only. A DOM presence check cannot establish visible destination content. */
export function observeFirstRunPreview({ selector, lang, waitUntilReady = false }) {
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
  const title = root?.querySelector('h1');
  const primary = root?.querySelector('.first-run-primary');
  const primaryRect = primary?.getBoundingClientRect();
  const hit = primaryRect ? document.elementFromPoint(primaryRect.x + primaryRect.width / 2, primaryRect.y + primaryRect.height / 2) : null;
  const main = document.querySelector('main');
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

export async function collectFirstRunPreviewStates({ page, viewport, screen, check, apiState }) {
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
  let baseline, childId;
  const today = new Date();
  const birthMonth = `${today.getFullYear() - 4}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const ready = async locator => { await locator.waitFor({ state: 'visible', timeout: 45_000 }); await page.evaluate(() => document.fonts.ready); };
  const facts = async () => firstRunPreviewProfileFacts(baseline, await profiles(), childId);
  const sameChild = async cell => check(cell, 'SAME_CHILD_NO_DUPLICATE', (await facts()).sameChild);
  const fill = async () => { await name().fill(text.name); await month().fill(birthMonth); await language().click(); };
  const step = async expected => {
    await page.waitForFunction(value => document.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow') === value, String(expected));
  };
  const run = (state, action, destination = false) => screen('onboarding-dev-preview', state, async cell => {
    cell.fixture = 'existing-dev-onboarding-preview';
    cell.firstRunPreview = FIRST_RUN_PREVIEW_BOUNDARY;
    await action(cell);
    const frameArgs = { selector: destination ? '[data-route="overview"]' : '.first-run', lang: viewport.lang };
    await page.waitForFunction(observeFirstRunPreview, { ...frameArgs, waitUntilReady: true }, { timeout: 15_000 });
    const frame = await page.evaluate(observeFirstRunPreview, frameArgs);
    cell.frames = [frame];
    check(cell, 'DEV_PREVIEW_BOUNDARY', cell.firstRunPreview.productionGateVerified === false && cell.firstRunPreview.remoteAcknowledgementVerified === false);
    check(cell, 'CONTENT_AND_TITLE_VISIBLE', frame.ready && !frame.horizontalOverflow);
    check(cell, 'DIRECTION_MATCHES_LOCALE', frame.directionMatches);
    check(cell, 'UNCHANGED_BASELINE_PROFILES', (await facts()).baselineUnchanged);
    check(cell, 'NO_REMOTE_OR_MODEL_WRITES', apiState.firstRunDeniedWrites === 0 && apiState.mockRequests === 0 && apiState.deniedExternal === 0);
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
  });
  await run('neutral-card', async cell => {
    const moving = worry().locator('[data-choice="moving"]');
    await moving.focus(); await page.keyboard.press('Space');
    check(cell, 'AREA_SELECTED_BY_REAL_KEYBOARD', await moving.getAttribute('aria-pressed') === 'true');
    await primary().click(); await step(3); await ready(card());
    check(cell, 'NEUTRAL_NOTICE_EXACT', await card().locator('.first-run-notice').innerText() === text.neutral);
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
    await sameChild(cell);
  });
  await run('local-completion-repeat', async cell => {
    await primary().click();
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('arbor.children') ?? '[]').some(child => child.id === id && child.onboardingComplete === true), childId);
    const accepted = await actions();
    check(cell, 'LOCAL_COMPLETION_RECORDED', (await profiles()).find(child => child.id === childId)?.onboardingComplete === true);
    check(cell, 'ONE_ACCEPTED_ACTION_EXACT', accepted.length === 1 && accepted[0].status === 'accepted' && accepted[0].recommendation === text.neutral && accepted[0].acceptanceKey?.startsWith(`onboarding-v1.${childId}.`));
    await primary().click();
    check(cell, 'REPEAT_DID_NOT_DUPLICATE', JSON.stringify(await actions()) === JSON.stringify(accepted) && (await facts()).sameChild);
    check(cell, 'FORCED_PREVIEW_STILL_MOUNTED', await card().isVisible() && new URL(page.url()).searchParams.has('onboarding'));
  });
  const now = async cell => {
    await ready(page.locator('[data-route="overview"] h1'));
    await ready(page.locator('[data-module="now-step"]'));
    check(cell, 'ACTUAL_NOW_DESTINATION', new URL(page.url()).hash === '#/overview' && await page.locator('.first-run').count() === 0);
    check(cell, 'ACCEPTED_STEP_VISIBLE', await page.locator('[data-module="now-step"] h2').innerText() === text.neutral);
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
}
