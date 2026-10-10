/** The practice baseline needs a morning with no open plan. The general demo
 * intentionally has a plan, so its valid record lead must remain untouched.
 * Only the existing synthetic child's plan storage and business Date change;
 * all controls, chooser logic, persistence, timers and animation clocks are real. */
import { installConfirmedDate, restoreConfirmedDate } from './confirmed-date-clock.mjs';

export const PRACTICE_FIXTURE = 'synthetic-morning-without-open-plan';

export function practiceClockScript(bundle) {
  const seededAt = Date.parse(bundle.seededAt);
  if (!Number.isFinite(seededAt)) throw new Error('SYNTHETIC_PRACTICE_DATE_REQUIRED');
  const day = new Date(seededAt);
  // 08:00 or 09:00 in the capture's Asia/Jerusalem timezone, on the seed day.
  const epoch = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 6);
  return `if (new URLSearchParams(location.search).get('capturePractice') === '1') { (${installConfirmedDate.toString()})(${epoch}); }`;
}

/** Run only after the real demo hydrator. [] suppresses the sandbox default
 * plan seed through its ordinary collection seam, without forcing a lead. */
export function preparePracticePlan({ childId }) {
  if (!/^[\w-]{1,100}$/.test(childId) || localStorage.getItem('arbor.activeChildId') !== childId) throw new Error('SYNTHETIC_PRACTICE_CHILD_REQUIRED');
  const key = `arbor.actionPlans.${childId}`;
  const previous = localStorage.getItem(key);
  localStorage.setItem(key, '[]');
  return { key, previous };
}

export function restorePracticePlan({ key, previous }) {
  if (!/^arbor\.actionPlans\.[\w-]{1,100}$/.test(key)) throw new Error('SYNTHETIC_PRACTICE_KEY_REQUIRED');
  if (previous === null) localStorage.removeItem(key);
  else localStorage.setItem(key, previous);
}

export async function collectPracticeStates({ page, fixture, load, screen, check, visible, byId }) {
  const practice = byId('practice-card');
  let practiceId, previousPlan;
  const run = (state, action) => screen('overview', state, async cell => {
    cell.fixture = PRACTICE_FIXTURE;
    await action(cell);
    const clock = await page.evaluate(() => window.__arborConfirmedDateClock?.snapshot() ?? null);
    check(cell, 'PRACTICE_DATE_ONLY_NATIVE_TIMING', clock?.nativeTimingPreserved === true, clock);
  });
  const dependent = reached => { if (!reached) throw new Error('DEPENDENT_STATE_UNREACHED'); };
  try {
    const ready = await run('practice-compact', async cell => {
      previousPlan = await page.evaluate(preparePracticePlan, { childId: fixture.childId });
      await load('overview', { practiceFixture: true });
      await visible(cell, 'PRACTICE_VISIBLE', practice);
      practiceId = await practice.getAttribute('data-practice-id');
      check(cell, 'PRACTICE_ACTION_FIRST', await practice.getAttribute('data-presentation') === 'action-first');
      check(cell, 'PRACTICE_DETAILS_CLOSED', !await byId('practice-details').evaluate(el => el.open));
      await visible(cell, 'PRACTICE_OUTCOMES_VISIBLE', byId('practice-answers'));
    });
    await run('practice-details', async cell => {
      dependent(ready); await byId('practice-details').locator('summary').click();
      check(cell, 'PRACTICE_DETAILS_OPEN', await byId('practice-details').evaluate(el => el.open));
      await byId('practice-details').scrollIntoViewIfNeeded();
      check(cell, 'PRACTICE_ID_UNCHANGED', await practice.getAttribute('data-practice-id') === practiceId);
    });
    const outcome = await run('practice-outcome', async cell => {
      dependent(ready); await byId('practice-answers').locator('[data-answer="did"]').click();
      await visible(cell, 'PRACTICE_RECEIPT_VISIBLE', byId('practice-receipt'));
      await visible(cell, 'PRACTICE_UNDO_VISIBLE', byId('practice-undo'));
      check(cell, 'PRACTICE_ANSWERS_REPLACED', await byId('practice-answers').count() === 0);
    });
    await run('practice-undo', async cell => {
      dependent(outcome); await byId('practice-undo').click();
      await visible(cell, 'PRACTICE_OUTCOMES_RESTORED', byId('practice-answers'));
      check(cell, 'PRACTICE_RECEIPT_REMOVED', await byId('practice-receipt').count() === 0);
      check(cell, 'PRACTICE_SAME_CARD', await practice.getAttribute('data-practice-id') === practiceId);
    });
  } finally {
    await page.evaluate(restoreConfirmedDate);
    if (previousPlan) await page.evaluate(restorePracticePlan, previousPlan);
  }
}
