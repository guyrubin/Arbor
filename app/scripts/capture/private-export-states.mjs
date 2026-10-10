/** Actual Settings/Your data actions; no erase, app callbacks or auth mutation. */
import { observeExportSurface, observeExportRecords, validPrivacyResponseReady, validPrivacyResponseSettlement } from './private-export-contract.mjs';
import { inspectPartialDownload } from './private-export-download.mjs';

const bounded = async promise => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('EXPORT_CAPTURE_TIMEOUT')), 15000); })]); }
  finally { clearTimeout(timer); }
};

/** A post-timeout observation explains failure; it never replaces ready evidence. */
export async function waitForExportSurface(page, cell, { selector, childId }) {
  let handle;
  try {
    handle = await page.waitForFunction(observeExportSurface, { selector, childId, waitUntilReady: true });
    return await handle.jsonValue();
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      try {
        const frame = await page.evaluate(observeExportSurface, { selector, childId });
        cell.surfaceReadinessTimeout = { observedAfterTimeout: true, frame };
      } catch {
        cell.surfaceReadinessTimeout = { observedAfterTimeout: true, unavailable: true };
      }
    }
    throw error;
  } finally {
    await handle?.dispose();
  }
}

export async function collectPrivateExportStates({ page, fixture, viewport, apiState, privacyGate, load, screen, check, byId }) {
  const he = viewport.lang === 'he';
  const sheet = () => byId('your-data-sheet');
  const sheetDialog = () => page.getByRole('dialog').filter({ has: sheet() });
  const exportButton = () => byId('your-data-export');
  const receipt = () => byId('your-data-export-receipt');
  const opener = () => byId('settings-open-your-data');
  const settingsSelector = '[data-testid="settings-data-row"]';
  const sheetSelector = '[data-testid="your-data-sheet"]';
  let held = null;
  let downloadPromise = null;
  let downloadsBefore = 0;
  let interruptedReads = 0;
  let baselineRecords = null;
  const records = () => page.evaluate(observeExportRecords, [fixture.child.id, fixture.sibling.id]);
  const waitFrame = async (cell, selector = sheetSelector) => {
    const frame = await waitForExportSurface(page, cell, { selector, childId: fixture.childId });
    (cell.frames ??= []).push(frame);
    check(cell, 'CHILD_COLLECTIONS_UNCHANGED', baselineRecords !== null && await records() === baselineRecords);
    check(cell, 'SETTLED_REAL_SURFACE', frame.ready);
    check(cell, 'SYNTHETIC_CHILD_SELECTED', frame.activeChildId === fixture.childId);
    check(cell, 'NO_PRIVATE_OWNER_CLAIM', await byId('your-data-delete-account').count() === 0 && apiState.privateExportAuthHeaders === 0);
    check(cell, 'NO_MUTATION_OR_PRIVATE_FILE_REQUEST', apiState.privateExportDenied === 0 && apiState.privateExportPrivateReads === 0);
  };
  const close = async cell => {
    await sheetDialog().getByRole('button', { name: he ? 'סגור' : 'Close', exact: true }).click();
    await sheet().waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'settings-open-your-data');
    check(cell, 'CLOSE_RETURNS_TO_DATA_OPENER', await opener().evaluate(el => document.activeElement === el));
  };
  const open = async () => { await opener().click(); await sheet().waitFor({ state: 'visible' }); };
  const reset = async cell => {
    const before = apiState.privateExportReads;
    await close(cell); await open();
    check(cell, 'REOPEN_WITHOUT_EXPORT_OR_RECEIPT', apiState.privateExportReads === before && await receipt().count() === 0 && await exportButton().isEnabled());
    await waitFrame(cell);
  };
  const finishDownload = async (cell, promise) => {
    const download = await promise;
    apiState.privateExportExpectedDownload = false;
    cell.downloadReceipt = await inspectPartialDownload(download, fixture);
    check(cell, 'ACTUAL_PARTIAL_JSON_VALIDATED', cell.downloadReceipt.passed && cell.downloadReceipt.deleted);
    await receipt().waitFor({ state: 'visible' });
    check(cell, 'VISIBLE_PARTIAL_RECEIPT', (await receipt().textContent()).startsWith(he ? 'הוכן ייצוא חלקי.' : 'Partial export prepared.'));
    await waitFrame(cell);
  };
  const armDownload = () => {
    apiState.privateExportExpectedDownload = true;
    const pending = page.waitForEvent('download', { timeout: 60000 });
    // Preserve the rejection for the awaited consumer, without an unhandled
    // promise if a preceding state fails before it reaches that consumer.
    pending.catch(() => undefined);
    return pending;
  };
  try {
    await screen('shell', 'settings-entry', async cell => {
      await load('overview');
      await page.waitForFunction(id => localStorage.getItem('arbor.activeChildId') === id, fixture.childId);
      if (viewport.w < 1024) {
        await page.locator('nav button[aria-expanded]').last().click();
        await page.getByRole('button', { name: he ? 'הגדרות' : 'Settings', exact: true }).click();
      } else {
        await page.locator('aside button[aria-haspopup="menu"]').click();
        await page.getByRole('menuitem', { name: he ? 'הגדרות' : 'Settings', exact: true }).click();
      }
      await opener().scrollIntoViewIfNeeded();
      baselineRecords = await records();
      check(cell, 'REAL_SETTINGS_ENTRY', await opener().isVisible());
      check(cell, 'NO_EXPORT_ON_SETTINGS_OPEN', apiState.privateExportReads === 0 && apiState.privateExportDownloads === 0);
      await waitFrame(cell, settingsSelector);
    });
    await screen('shell', 'data-open', async cell => {
      await open();
      check(cell, 'REAL_DATA_SHEET_OPEN', await sheet().isVisible());
      const text = await sheet().textContent();
      check(cell, 'EXPLICIT_EXPORT_CONTROL_AND_LIMITS', await exportButton().isEnabled() && (await exportButton().textContent()).includes(fixture.child.name) && ['256', '8 MiB', '32 MiB'].every(value => text.includes(value)));
      check(cell, 'NO_EXPORT_ON_DATA_OPEN', apiState.privateExportReads === 0 && apiState.privateExportDownloads === 0 && await receipt().count() === 0);
      check(cell, 'NO_ACCOUNT_DELETE_WITHOUT_FIREBASE', await byId('your-data-delete-account').count() === 0);
      await waitFrame(cell);
    });
    await screen('shell', 'close-reopen', reset);
    await screen('shell', 'export-pending', async cell => {
      held = privacyGate.pause();
      downloadPromise = armDownload();
      await exportButton().dblclick();
      cell.heldResponse = { ready: await bounded(held.responseReady) };
      if (!validPrivacyResponseReady(cell.heldResponse.ready)) throw new Error('EXPORT_RESPONSE_NOT_READY');
      check(cell, 'ONE_REQUEST_FROM_REPEATED_ACTIVATION', apiState.privateExportReads === 1);
      check(cell, 'EXPORT_DISABLED_WHILE_PENDING', await exportButton().isDisabled());
      check(cell, 'NO_DELIVERY_BEFORE_RESPONSE', apiState.privateExportDownloads === 0 && await receipt().count() === 0);
      await waitFrame(cell);
    });
    await screen('shell', 'partial-download', async cell => {
      if (!held || !downloadPromise) throw new Error('DEPENDENT_STATE_UNREACHED');
      held.release('deliver'); cell.heldResponse = { settled: await bounded(held.settled) }; held = null;
      if (!validPrivacyResponseSettlement(cell.heldResponse.settled, 'deliver')) throw new Error('EXPORT_RESPONSE_DELIVERY_FAILED');
      await finishDownload(cell, downloadPromise); downloadPromise = null;
      check(cell, 'LOCAL_RESPONSE_NOT_FABRICATED', apiState.privateExportResponses === 1 && apiState.privateExportLastStatus === 200);
      check(cell, 'EXPORT_ENABLED_AFTER_DELIVERY', await exportButton().isEnabled());
    });
    await screen('shell', 'repeat-export', async cell => {
      downloadPromise = armDownload(); await exportButton().click();
      await finishDownload(cell, downloadPromise); downloadPromise = null;
      check(cell, 'SECOND_EXPLICIT_ACTIVATION', apiState.privateExportReads === 2 && apiState.privateExportDownloads === 2);
    });
    await screen('shell', 'receipt-reset', reset);
    await screen('shell', 'interrupted-pending', async cell => {
      downloadsBefore = apiState.privateExportDownloads;
      interruptedReads = apiState.privateExportReads;
      held = privacyGate.pause();
      await exportButton().click();
      cell.heldResponse = { ready: await bounded(held.responseReady) };
      if (!validPrivacyResponseReady(cell.heldResponse.ready)) throw new Error('EXPORT_RESPONSE_NOT_READY');
      check(cell, 'EXPORT_DISABLED_WHILE_PENDING', await exportButton().isDisabled() && apiState.privateExportReads === interruptedReads + 1);
      check(cell, 'NO_DELIVERY_BEFORE_RESPONSE', apiState.privateExportDownloads === downloadsBefore && await receipt().count() === 0);
      await waitFrame(cell);
    });
    await screen('shell', 'interrupted-closed', async cell => {
      if (!held) throw new Error('DEPENDENT_STATE_UNREACHED');
      cell.heldResponse = { ready: await bounded(held.responseReady) };
      if (!validPrivacyResponseReady(cell.heldResponse.ready)) throw new Error('EXPORT_RESPONSE_NOT_READY');
      await close(cell);
      cell.heldResponse.closedBeforeRelease = await sheet().count() === 0;
      if (!cell.heldResponse.closedBeforeRelease) throw new Error('EXPORT_SHEET_NOT_CLOSED');
      held.release('after-close'); cell.heldResponse.settled = await bounded(held.settled); held = null;
      if (!validPrivacyResponseSettlement(cell.heldResponse.settled, 'after-close')) throw new Error('EXPORT_RESPONSE_DELIVERY_FAILED');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)))));
      check(cell, 'HELD_RESPONSE_RELEASED_AFTER_CLOSE', await sheet().count() === 0 && apiState.privateExportReads === interruptedReads + 1);
      check(cell, 'NO_LATE_DOWNLOAD_OR_RECEIPT', apiState.privateExportDownloads === downloadsBefore && await receipt().count() === 0 && apiState.privateExportUnexpectedDownloads === 0);
      await waitFrame(cell, settingsSelector);
    });
    await screen('shell', 'interrupted-reopened', async cell => {
      await open();
      const fresh = await receipt().count() === 0 && await exportButton().isEnabled();
      downloadPromise = armDownload(); await exportButton().click();
      await finishDownload(cell, downloadPromise); downloadPromise = null;
      check(cell, 'FRESH_EXPORT_AFTER_INTERRUPTION', fresh && apiState.privateExportDownloads === downloadsBefore + 1 && apiState.privateExportReads === interruptedReads + 2);
    });
  } finally {
    apiState.privateExportExpectedDownload = false;
    held?.release(); privacyGate.releasePending();
  }
}
