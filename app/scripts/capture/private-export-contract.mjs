/** Capture-only contract. Local sandbox exports are deliberately partial. */
export const PRIVATE_EXPORT_STATES = Object.freeze([
  'settings-entry', 'data-open', 'close-reopen', 'export-pending', 'partial-download',
  'repeat-export', 'receipt-reset', 'interrupted-pending', 'interrupted-closed', 'interrupted-reopened',
].map(state => ({ route: 'shell', state })));
export const PRIVATE_EXPORT_LIMITATIONS = Object.freeze([
  { state: 'authenticated-private-files', status: 'blocked-supported-owner-context', reason: 'AuthContext exposes local-sandbox without Firebase config. exportPrivateBookAssets explicitly rejects that identity; no supported demo Firebase User/token/emulator seam exists. No auth replacement, token, runtime patch or owner-check bypass is used. Complete/private-file downloads remain unverified.' },
  { state: 'confirmation', status: 'explicit-export-button-only', reason: 'The existing UI starts export from the explicit parent Export button. There is no export confirmation dialog. The typed-name confirmation belongs to destructive erase and is never opened or invoked.' },
  { state: 'interruption', status: 'local-sandbox-privacy-response-only', reason: 'A real local privacy GET response is held at the browser route boundary, then released after actual sheet close. No private-file response or production auth transition is fabricated. Cancellation is observed through response settlement, two real animation frames and reopen.' },
  { state: 'device-download', status: 'disposable-ci-chromium-only', reason: 'Actual app-produced partial JSON bytes are read and deleted inside the network-none container. Only a bounded validation/hash receipt leaves it. Native-device and real authenticated download acceptance remain pending.' },
]);

export function privateExportFixture(bundle, lang) {
  const parsed = JSON.parse(typeof bundle === 'string' ? bundle : JSON.stringify(bundle));
  const body = parsed?.locales?.[lang] ?? parsed;
  if (!['en', 'he'].includes(lang) || parsed?.parent?.demo !== true || body?.child?.demo !== true || !Array.isArray(body.collections?.milestones)) throw new Error('SYNTHETIC_EXPORT_FIXTURE_REQUIRED');
  const make = (id, name) => {
    const child = { ...body.child, id, name, age: 4, demo: true };
    for (const key of ['avatar', 'photoUrl', 'birthDate', 'ageMonths', 'ageMonthsAsOf', 'preterm']) delete child[key];
    return child;
  };
  const child = make('capture-private-export-a', lang === 'he' ? 'נועה' : 'Noa');
  const sibling = make('capture-private-export-b', lang === 'he' ? 'מירה' : 'Mira');
  const collections = Object.fromEntries(Object.keys(body.collections).map(key => [key, []]));
  collections.bookAssets = [{ id: 'capture-export-book', bookId: 'capture-export-book', files: ['manifest.json'], fixture: 'invented-private-export-metadata-only' }];
  collections.heroSheet = [{ id: 'capture-export-hero', fixture: 'invented-export-marker' }];
  const siblingMarker = 'capture-sibling-must-never-export';
  body.child = child; body.collections = collections;
  body.siblings = [{ child: sibling, collections: { ...structuredClone(collections), heroSheet: [{ id: siblingMarker }] } }];
  return { parsed, child, sibling, childId: child.id, collections, siblingMarker, filename: `arbor-${child.name.toLowerCase()}-data.partial.json` };
}

/** Match only the deliberate fixture resource; no suffix or origin aliases. */
export function isExactPrivateExportFixtureUrl(value, base) {
  try { const url = new URL(value); return url.origin === base && url.pathname === '/sandbox/demo-family.json'; }
  catch { return false; }
}

/** No arbitrary export, private file, mutation, generation or sharing route. */
export function privateExportApiDisposition(method, pathname, childId) {
  if (method === 'POST' && pathname === `/api/children/${encodeURIComponent(childId)}/book-narration`) return 'synthetic-narration-refusal';
  if (method === 'GET' && pathname === `/api/privacy/export/${encodeURIComponent(childId)}`) return 'local-privacy-read';
  if (/^\/api\/privacy(?:\/|$)/.test(pathname) || /\/book-assets(?:\/|$)/.test(pathname)) return 'deny';
  if (method !== 'GET' && !(method === 'POST' && ['/api/todays-focus', '/api/digest'].includes(pathname))) return 'deny';
  return 'read';
}

export const EXPORT_DOWNLOAD_LIMIT = 256 * 1024;
export function validatePartialExport(text, filename, fixture) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > EXPORT_DOWNLOAD_LIMIT) return false;
  let data; try { data = JSON.parse(text); } catch { return false; }
  const collections = data?.collections, receipt = data?.exportReceipt, assets = data?.privateBookAssets;
  return Boolean(filename === fixture.filename && data?.profile?.id === fixture.child.id && data.profile.name === fixture.child.name && data.profile.demo === true
    && !text.includes(fixture.sibling.id) && !text.includes(fixture.siblingMarker)
    && typeof data.exportedAt === 'string' && Number.isFinite(Date.parse(data.exportedAt)) && typeof data.exportNote === 'string' && data.exportNote.length > 0
    && collections && Object.keys(collections).length === 43 && Object.values(collections).every(Array.isArray)
    && Object.entries(fixture.collections).every(([name, value]) => JSON.stringify(collections[name]) === JSON.stringify(value))
    && receipt?.status === 'incomplete' && receipt.serverData === 'included'
    && Object.keys(receipt.collections ?? {}).length === 43 && Object.keys(collections).every(name => receipt.collections[name] === 'included')
    && Array.isArray(data.serverData?.memoryEvents) && data.serverData.memoryEvents.length === 0 && Array.isArray(data.serverData?.shares) && data.serverData.shares.length === 0
    && assets?.format === 'arbor-private-book-assets-v1' && assets.status === 'incomplete' && assets.inventory === 'unavailable'
    && JSON.stringify(assets.issues) === '["unauthorized"]' && assets.includedFiles === 0 && assets.includedBytes === 0 && Array.isArray(assets.files) && assets.files.length === 0);
}

const common = ['FINAL_EXPORT_NETWORK_GUARD', 'CHILD_COLLECTIONS_UNCHANGED', 'SETTLED_REAL_SURFACE', 'SYNTHETIC_CHILD_SELECTED', 'NO_PRIVATE_OWNER_CLAIM', 'NO_MUTATION_OR_PRIVATE_FILE_REQUEST', 'SYNTHETIC_ONLINE', 'NO_PROHIBITED_ACTIONS'];
export const PRIVATE_EXPORT_REQUIRED_ASSERTIONS = Object.freeze({
  'settings-entry': ['REAL_SETTINGS_ENTRY', 'NO_EXPORT_ON_SETTINGS_OPEN'],
  'data-open': ['REAL_DATA_SHEET_OPEN', 'EXPLICIT_EXPORT_CONTROL_AND_LIMITS', 'NO_EXPORT_ON_DATA_OPEN', 'NO_ACCOUNT_DELETE_WITHOUT_FIREBASE'],
  'close-reopen': ['CLOSE_RETURNS_TO_DATA_OPENER', 'REOPEN_WITHOUT_EXPORT_OR_RECEIPT'],
  'export-pending': ['ONE_REQUEST_FROM_REPEATED_ACTIVATION', 'EXPORT_DISABLED_WHILE_PENDING', 'NO_DELIVERY_BEFORE_RESPONSE'],
  'partial-download': ['ACTUAL_PARTIAL_JSON_VALIDATED', 'LOCAL_RESPONSE_NOT_FABRICATED', 'VISIBLE_PARTIAL_RECEIPT', 'EXPORT_ENABLED_AFTER_DELIVERY'],
  'repeat-export': ['ACTUAL_PARTIAL_JSON_VALIDATED', 'SECOND_EXPLICIT_ACTIVATION', 'VISIBLE_PARTIAL_RECEIPT'],
  'receipt-reset': ['REOPEN_WITHOUT_EXPORT_OR_RECEIPT'],
  'interrupted-pending': ['EXPORT_DISABLED_WHILE_PENDING', 'NO_DELIVERY_BEFORE_RESPONSE'],
  'interrupted-closed': ['CLOSE_RETURNS_TO_DATA_OPENER', 'HELD_RESPONSE_RELEASED_AFTER_CLOSE', 'NO_LATE_DOWNLOAD_OR_RECEIPT'],
  'interrupted-reopened': ['ACTUAL_PARTIAL_JSON_VALIDATED', 'FRESH_EXPORT_AFTER_INTERRUPTION', 'VISIBLE_PARTIAL_RECEIPT'],
});
export function privateExportRequiredAssertions(state) {
  return Object.hasOwn(PRIVATE_EXPORT_REQUIRED_ASSERTIONS, state) ? [...common, ...PRIVATE_EXPORT_REQUIRED_ASSERTIONS[state]] : [];
}
/** Readiness/release receipts are facts, independent of assertion labels. */
export function validPrivacyResponseReady(receipt) {
  return receipt?.responseReady === true && receipt.responseStatus === 200 && receipt.released === false && receipt.outcome === 'pending';
}
export function validPrivacyResponseSettlement(receipt, reason) {
  return receipt?.responseReady === true && receipt.responseStatus === 200 && receipt.released === true && receipt.releasedAfterReady === true
    && receipt.releaseReason === reason && (receipt.outcome === 'fulfilled' || (reason === 'after-close' && receipt.outcome === 'browser-cancelled-after-close'));
}
export function validPrivateExportNetwork(evidence) {
  return Number.isInteger(evidence?.privateExportNarrationRefusals) && evidence.privateExportNarrationRefusals >= 0
    && ['privateExportDenied', 'privateExportPrivateReads', 'privateExportUnexpectedDownloads', 'privateExportAuthHeaders', 'deniedActions'].every(key => evidence?.[key] === 0);
}
export function validPrivateExportCell(cell) {
  const required = privateExportRequiredAssertions(cell?.state);
  const receipt = cell?.downloadReceipt;
  const needsDownload = PRIVATE_EXPORT_REQUIRED_ASSERTIONS[cell?.state]?.includes('ACTUAL_PARTIAL_JSON_VALIDATED');
  return required.length > 0 && required.every(id => cell.assertions?.some(a => a.id === id && a.passed === true))
    && cell.frames?.length > 0 && cell.frames.every(frame => frame.ready === true)
    && validPrivateExportNetwork(cell.networkEvidence)
    && (!['export-pending', 'interrupted-pending', 'interrupted-closed'].includes(cell.state) || validPrivacyResponseReady(cell.heldResponse?.ready))
    && (cell.state !== 'partial-download' || validPrivacyResponseSettlement(cell.heldResponse?.settled, 'deliver'))
    && (cell.state !== 'interrupted-closed' || (cell.heldResponse?.closedBeforeRelease === true && validPrivacyResponseSettlement(cell.heldResponse?.settled, 'after-close')))
    && (!needsDownload || (receipt?.passed === true && receipt.delivery === 'actual-browser-download' && receipt.syntheticOnly === true && receipt.deleted === true
      && receipt.status === 'incomplete' && receipt.privateFileStatus === 'unauthorized' && receipt.bytes > 0 && receipt.bytes <= EXPORT_DOWNLOAD_LIMIT && /^[a-f0-9]{64}$/.test(receipt.sha256 ?? '')
      && receipt.childId === 'capture-private-export-a' && receipt.filename === (cell.lang === 'he' ? 'arbor-נועה-data.partial.json' : 'arbor-noa-data.partial.json')));
}

/** Passive observations only, no DOM/auth/storage writes or event dispatch. */
export function observeExportSurface({ selector, childId, waitUntilReady = false }) {
  const nodes = [...document.querySelectorAll(selector)];
  const node = nodes.length === 1 ? nodes[0] : null;
  const rect = node?.getBoundingClientRect();
  const ancestors = [];
  for (let el = node; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    ancestors.push({ opacity: Number(style.opacity), transform: style.transform, display: style.display, visibility: style.visibility });
  }
  const dialog = node?.closest('[role="dialog"]');
  const frame = { selector, count: nodes.length, activeChildId: localStorage.getItem('arbor.activeChildId'), text: node?.textContent?.trim() ?? '',
    focusInsideDialog: !!dialog?.contains(document.activeElement), pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
    width: rect?.width ?? 0, height: rect?.height ?? 0, ancestors, inert: !!node?.closest('[inert]'), connected: !!node?.isConnected };
  frame.ready = frame.count === 1 && frame.connected && !frame.inert && frame.width > 0 && frame.height > 0 && frame.text.length > 0
    && frame.activeChildId === childId && frame.pageWidth <= frame.viewportWidth + 1 && frame.focusInsideDialog
    && ancestors.every(style => style.opacity >= 0.999 && ['none', 'matrix(1, 0, 0, 1, 0, 0)', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)'].includes(style.transform) && style.display !== 'none' && style.visibility !== 'hidden');
  return waitUntilReady && !frame.ready ? false : frame;
}

/** Comparison-only storage snapshot, never written into retained evidence. */
export function observeExportRecords(childIds) {
  return JSON.stringify(Object.keys(localStorage).filter(key => childIds.some(id => key.startsWith('arbor.') && key.endsWith(`.${id}`))).sort().map(key => [key, localStorage.getItem(key)]));
}
