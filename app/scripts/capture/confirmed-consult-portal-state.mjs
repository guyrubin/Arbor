/** Portal regression: a hidden Consult subtree must not leave PDF approval usable. */
import { CONFIRMED_ACTIONS_NOW, CONFIRMED_ACTIONS_EXPIRED } from './confirmed-actions-contract.mjs';

export async function collectConfirmedConsultPortalState({ page, fixture, viewport, apiState, run, frame, check, byId }) {
  const he = viewport.lang === 'he';
  const unexpected = { downloads: 0, popups: 0 };
  const closedPopups = [];
  const onDownload = () => { unexpected.downloads++; }; // existing runner guard cancels it
  const onPopup = popup => {
    unexpected.popups++; apiState.deniedActions++;
    closedPopups.push(popup.close().catch(() => {}));
  };
  let previousApproval, teacherDraft;
  const editor = () => byId('consult-teacher-branch').locator('textarea');
  page.on('download', onDownload); page.on('popup', onPopup);
  try {
    await run('consult', 'consult-teacher-review-retirement', async cell => {
      await byId('consult-audience-row').getByRole('radio', { name: he ? 'גננת או מורה' : 'Teacher or gan', exact: true }).click();
      await byId('consult-teacher-branch').waitFor({ state: 'visible' });
      await byId('school-brief-edit').click(); await editor().fill(fixture.words.draft);
      teacherDraft = await editor().elementHandle();
      check(cell, 'ACTUAL_UNSAVED_TEACHER_DRAFT_TYPED', !!teacherDraft && await editor().inputValue() === fixture.words.draft);
      await byId('school-brief-review-open').click();
      await byId('school-brief-review-approve').waitFor({ state: 'visible' });
      previousApproval = await byId('school-brief-review-approve').elementHandle();
      check(cell, 'ACTUAL_TEACHER_PDF_REVIEW_OPENED', !!previousApproval && await page.getByRole('dialog').filter({ has: byId('school-brief-review-approve') }).count() === 1);
      await frame(cell, 'TEACHER_APPROVAL_REACHABLE_BEFORE_EXPIRY', byId('school-brief-review-approve'));
      await page.clock.setFixedTime(new Date(CONFIRMED_ACTIONS_EXPIRED));
      await page.evaluate(id => { location.hash = `#/consult?appointment=${id}&captureEligibility=teacher-expired`; }, fixture.visit.id);
      await byId('consult-visit-unavailable').waitFor({ state: 'visible' });
      await byId('school-brief-review-approve').waitFor({ state: 'hidden' });
      check(cell, 'NO_ACTIONABLE_APPROVAL_PORTAL_AFTER_EXPIRY', !await byId('school-brief-review-approve').isVisible());
      check(cell, 'TEACHER_DRAFT_RETAINED_HIDDEN_AND_INERT', !!teacherDraft && await teacherDraft.evaluate((node, expected) => node.isConnected && !!node.closest('[hidden][inert]') && node.value === expected, fixture.words.draft));
      let oldClickRejected = false;
      try { await previousApproval.click({ timeout: 500 }); } catch { oldClickRejected = true; }
      check(cell, 'OLD_APPROVAL_ELEMENT_CANNOT_BE_CLICKED', oldClickRejected);
      check(cell, 'NO_EXPORT_AT_BLOCKED_REVIEW', unexpected.downloads === 0 && unexpected.popups === 0, unexpected);
      cell.capturePhase = 'expired-target-unavailable-no-actionable-approval-portal';
      cell.persistenceBoundary = 'synthetic-clock-eligibility-retirement-not-Firestore';
    }, async cell => {
      // Preserve the expired/no-portal pixels before this bounded recovery check.
      await page.clock.setFixedTime(new Date(CONFIRMED_ACTIONS_NOW));
      await page.evaluate(id => { location.hash = `#/consult?appointment=${id}&captureEligibility=teacher-restored`; }, fixture.visit.id);
      await byId('school-brief-review-open').waitFor({ state: 'visible' });
      check(cell, 'ELIGIBILITY_RECOVERY_DOES_NOT_REVIVE_OLD_REVIEW', await byId('school-brief-review-approve').count() === 0);
      check(cell, 'SAME_TEACHER_DRAFT_SURVIVES_RECOVERY', !!teacherDraft && await editor().evaluate((node, old) => node === old, teacherDraft) && await editor().inputValue() === fixture.words.draft);
      await byId('school-brief-review-open').click(); await byId('school-brief-review-approve').waitFor({ state: 'visible' });
      check(cell, 'RECOVERY_REQUIRES_FRESH_REVIEW_ELEMENT', await byId('school-brief-review-approve').evaluate((node, old) => node !== old, previousApproval));
      const dialog = page.getByRole('dialog').filter({ has: byId('school-brief-review-approve') });
      await dialog.getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
      await byId('school-brief-review-approve').waitFor({ state: 'detached' });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check(cell, 'NO_EXPORT_DOWNLOAD_OR_PRINT_POPUP', unexpected.downloads === 0 && unexpected.popups === 0, unexpected);
      await frame(cell, 'FRESH_REVIEW_DOOR_REMAINS_REACHABLE', byId('school-brief-review-open'));
      cell.recoveryValidatedAfterCapture = true;
    });
  } finally {
    page.off('download', onDownload); page.off('popup', onPopup);
    await Promise.all(closedPopups); await previousApproval?.dispose(); await teacherDraft?.dispose();
    await page.clock.setFixedTime(new Date(CONFIRMED_ACTIONS_NOW));
  }
}
