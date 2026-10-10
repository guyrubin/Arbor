import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { PRIVATE_EXPORT_STATES, PRIVATE_EXPORT_LIMITATIONS, privateExportFixture, isExactPrivateExportFixtureUrl, privateExportApiDisposition, validatePartialExport, privateExportRequiredAssertions, validPrivateExportCell, validPrivateExportNetwork, validPrivacyResponseReady, validPrivacyResponseSettlement, EXPORT_DOWNLOAD_LIMIT } from './capture/private-export-contract.mjs';
import { createPrivacyResponseGate, inspectPartialDownload } from './capture/private-export-download.mjs';
import { releaseMatrix, releaseCell, RELEASE_MATRIX } from './capture/release-config.mjs';
import { missingReleaseInteractionEvidence, expectedReleaseInteractionStates } from './capture/release-interactions.mjs';
import { summarizeRelease } from './capture/release-summary.mjs';
import { ROUTE_IDS } from '../src/lib/routes';
import { SURFACE_CONTRACTS } from '../src/lib/surfaceContract';

const read = (name: string) => readFileSync(path.resolve(__dirname, '..', name), 'utf8');
const seed = { version: 'capture', seededAt: '2026-10-10T00:00:00.000Z', parent: { demo: true }, child: { id: 'seed', name: 'Invented', demo: true, avatar: 'excluded', photoUrl: 'excluded' }, collections: { milestones: [], keepsakes: [] } };
const identity = { sourceSha: 'a'.repeat(40), sourceTreeSha: 'b'.repeat(40) };
const collectionNames = [...read('src/lib/childData.ts').split('export const CHILD_SUBCOLLECTIONS = [')[1].split('];')[0].replace(/\/\/[^\n]*/g, '').matchAll(/"([^"]+)"/g)].map(item => item[1]);
const dataFor = (fixture: any) => ({
  exportedAt: '2026-10-10T00:00:00.000Z', profile: fixture.child, exportNote: 'Invented private export note.',
  collections: { ...Object.fromEntries(collectionNames.map(name => [name, []])), ...fixture.collections },
  serverData: { memoryEvents: [], shares: [] },
  exportReceipt: { status: 'incomplete', serverData: 'included', collections: Object.fromEntries(collectionNames.map(name => [name, 'included'])) },
  privateBookAssets: { format: 'arbor-private-book-assets-v1', status: 'incomplete', inventory: 'unavailable', issues: ['unauthorized'], includedFiles: 0, includedBytes: 0, files: [] },
});
const receiptFor = (lang: string) => ({ passed: true, delivery: 'actual-browser-download', syntheticOnly: true, deleted: true, status: 'incomplete', privateFileStatus: 'unauthorized', bytes: 1000, sha256: 'c'.repeat(64), childId: 'capture-private-export-a', filename: lang === 'he' ? 'arbor-נועה-data.partial.json' : 'arbor-noa-data.partial.json' });
const readyReceipt = () => ({ responseReady: true, responseStatus: 200, released: false, releasedAfterReady: false, releaseReason: null, outcome: 'pending' });
const settledReceipt = (reason = 'deliver') => ({ ...readyReceipt(), released: true, releasedAfterReady: true, releaseReason: reason, outcome: 'fulfilled' });
const safeNetwork = () => ({ privateExportDenied: 0, privateExportPrivateReads: 0, privateExportUnexpectedDownloads: 0, privateExportAuthHeaders: 0, deniedActions: 0, privateExportNarrationRefusals: 0 });
const cellFor = (state: string, viewport: any) => ({ route: 'shell', state, group: 'private-export', ...identity, viewport: `${viewport.w}x${viewport.h}`, lang: viewport.lang, reached: true,
  shot: `shots/${viewport.id}.${state}.png`, failures: [], frames: [{ ready: true }], assertions: privateExportRequiredAssertions(state).map((id: string) => ({ id, passed: true })),
  networkEvidence: safeNetwork(), heldResponse: { ready: readyReceipt(), closedBeforeRelease: true, settled: settledReceipt(state === 'interrupted-closed' ? 'after-close' : 'deliver') }, downloadReceipt: receiptFor(viewport.lang) });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('bounded private export capture contract, no browser or sockets', () => {
  it('adds only forty private-export cells and leaves existing release matrices unchanged', () => {
    expect(PRIVATE_EXPORT_STATES).toHaveLength(10);
    expect(new Set(PRIVATE_EXPORT_STATES.map(row => row.state)).size).toBe(10);
    expect(releaseMatrix('private-export-only')).toHaveLength(4);
    expect(RELEASE_MATRIX).toHaveLength(8);
    expect(releaseMatrix('confirmed-actions-release')).toHaveLength(16);
    expect(releaseMatrix('kid-entry-release')).toHaveLength(20);
    for (const spec of releaseMatrix('private-export-only')) expect(expectedReleaseInteractionStates(spec.group, releaseCell(spec).viewport)).toHaveLength(10);
  });
  it.each(['en', 'he'])('uses supported demo hydration with invented child-specific markers (%s)', lang => {
    const before = JSON.stringify(seed); const fixture = privateExportFixture(seed, lang);
    expect(JSON.stringify(seed)).toBe(before);
    expect(fixture.child.id).toBe('capture-private-export-a');
    expect(fixture.child.demo).toBe(true); expect(fixture.child.avatar).toBeUndefined(); expect(fixture.child.photoUrl).toBeUndefined();
    expect(fixture.parsed.siblings[0].collections.heroSheet[0].id).toBe(fixture.siblingMarker);
    expect(fixture.filename).toBe(lang === 'he' ? 'arbor-נועה-data.partial.json' : 'arbor-noa-data.partial.json');
    expect(fixture.collections.bookAssets).toEqual([{ id: 'capture-export-book', bookId: 'capture-export-book', files: ['manifest.json'], fixture: 'invented-private-export-metadata-only' }]);
    const localized = { ...seed, locales: { he: { child: seed.child, collections: seed.collections } } };
    expect(privateExportFixture(localized, 'he').parsed.locales.he.child.name).toBe('נועה');
  });
  it('refuses a non-demo or unsupported locale fixture', () => {
    for (const bad of [{ ...seed, parent: {} }, { ...seed, child: { id: 'real' } }, { ...seed, collections: {} }]) expect(() => privateExportFixture(bad, 'en')).toThrow('SYNTHETIC_EXPORT_FIXTURE_REQUIRED');
    expect(() => privateExportFixture(seed, 'fr')).toThrow();
  });
  it('keeps the real owner boundary and limitations explicit', () => {
    expect(read('src/lib/bookAssetExport.ts')).toContain('if (!uid || uid === "local-sandbox") { out.issues.push("unauthorized"); return out; }');
    expect(read('src/context/AuthContext.tsx')).toContain('uid: "local-sandbox"');
    expect(read('src/lib/childExportSession.ts')).toContain('const local = !firebaseEnabled && (!uid || uid === "local-sandbox")');
    expect(PRIVATE_EXPORT_LIMITATIONS.map(item => item.status)).toEqual(['blocked-supported-owner-context', 'explicit-export-button-only', 'local-sandbox-privacy-response-only', 'disposable-ci-chromium-only']);
    const states = read('scripts/capture/private-export-states.mjs');
    expect(states).not.toMatch(/force:\s*true|dispatchEvent|\.evaluate\([^\n]*\.click\(|setAuthTokenProvider|currentUser\s*=|localStorage\.setItem|delete-child-btn|delete-confirm-btn|confirmDelete|downloadJson\(/);
    expect(states).toContain('await exportButton().dblclick()'); expect(states).toContain('await exportButton().click()');
    expect(states).toContain('await sheetDialog().getByRole');
  });
  it('matches the exact fixture origin and pathname, never foreign/private suffix routes', () => {
    const base = 'http://127.0.0.1:4810';
    expect(isExactPrivateExportFixtureUrl(`${base}/sandbox/demo-family.json`, base)).toBe(true);
    expect(isExactPrivateExportFixtureUrl(new URL(`${base}/sandbox/demo-family.json?capture=1`), base)).toBe(true);
    for (const value of ['https://example.test/sandbox/demo-family.json', `${base}/api/children/capture-private-export-a/book-assets/sandbox/demo-family.json`, `${base}/sandbox/demo-family.json/other`, 'invalid']) expect(isExactPrivateExportFixtureUrl(value, base)).toBe(false);
    const interactions = read('scripts/capture/release-interactions.mjs');
    expect(interactions).toContain("context.route(privateExport ? url => isExactPrivateExportFixtureUrl(url, BASE) : '**/sandbox/demo-family.json'");
  });
  it('allows only the exact current child read and safe existing reads', () => {
    const id = 'capture-private-export-a';
    expect(privateExportApiDisposition('GET', `/api/privacy/export/${id}`, id)).toBe('local-privacy-read');
    for (const [method, url] of [['POST', '/api/privacy/erase'], ['GET', '/api/privacy/export/sibling'], ['POST', `/api/privacy/export/${id}`], ['GET', `/api/children/${id}/book-assets/export-manifest`], ['GET', `/api/children/${id}/book-assets/book/file`], ['POST', '/api/chat'], ['POST', '/api/consent'], ['DELETE', '/api/children/x'], ['POST', '/api/children/x/book-narration']]) expect(privateExportApiDisposition(method, url, id)).toBe('deny');
    expect(privateExportApiDisposition('POST', `/api/children/${id}/book-narration`, id)).toBe('synthetic-narration-refusal');
    expect(privateExportApiDisposition('GET', `/api/children/${id}/book-narration`, id)).toBe('read');
    expect(privateExportApiDisposition('POST', `/api/children/${id}/book-narration/other`, id)).toBe('deny');
    expect(privateExportApiDisposition('GET', '/api/entitlement', id)).toBe('read');
    expect(privateExportApiDisposition('POST', '/api/todays-focus', id)).toBe('read');
  });
  it.each(['en', 'he'])('validates exact partial bytes, identity, filename, registered collections and absence of sibling data (%s)', lang => {
    expect(collectionNames).toHaveLength(43);
    const fixture = privateExportFixture(seed, lang); const data = dataFor(fixture);
    expect(validatePartialExport(JSON.stringify(data), fixture.filename, fixture)).toBe(true);
    const mutate = (change: (data: any) => void) => { const copy = structuredClone(data); change(copy); expect(validatePartialExport(JSON.stringify(copy), fixture.filename, fixture)).toBe(false); };
    mutate(d => { d.profile.id = fixture.sibling.id; });
    mutate(d => { d.profile.name = fixture.sibling.name; });
    mutate(d => { d.profile.demo = false; });
    mutate(d => { d.exportReceipt.status = 'complete'; });
    mutate(d => { d.exportReceipt.serverData = 'unavailable'; });
    mutate(d => { d.exportReceipt.collections.bookAssets = 'unavailable'; });
    mutate(d => { delete d.collections.heroSheet; });
    mutate(d => { d.collections.heroSheet.push({ id: fixture.siblingMarker }); });
    mutate(d => { d.privateBookAssets.includedFiles = 1; });
    mutate(d => { d.privateBookAssets.files = [{ data: 'ZmFrZQ==' }]; });
    mutate(d => { d.privateBookAssets.status = 'complete'; });
    mutate(d => { d.privateBookAssets.issues = []; });
    mutate(d => { d.serverData.memoryEvents = [{ unrelated: true }]; });
    mutate(d => { d.exportNote = ''; });
    expect(validatePartialExport(JSON.stringify(data), fixture.filename.replace('.partial', ''), fixture)).toBe(false);
    expect(validatePartialExport('{}', fixture.filename, fixture)).toBe(false);
    expect(validatePartialExport('x'.repeat(EXPORT_DOWNLOAD_LIMIT + 1), fixture.filename, fixture)).toBe(false);
  });
  it('reads the real delivery stream and deletes the payload; artifacts receive only bounded receipts', async () => {
    const fixture = privateExportFixture(seed, 'en'); const text = JSON.stringify(dataFor(fixture));
    const download = { url: () => 'blob:http://127.0.0.1:4805/id', suggestedFilename: () => fixture.filename, createReadStream: async () => Readable.from([Buffer.from(text)]), delete: vi.fn(async () => {}) };
    const receipt = await inspectPartialDownload(download, fixture);
    expect(receipt).toMatchObject({ passed: true, deleted: true, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex'), status: 'incomplete', includedPrivateFiles: 0 });
    expect(JSON.stringify(receipt)).not.toContain('exportNote'); expect(download.delete).toHaveBeenCalledOnce();
    for (const failed of [{ ...download, suggestedFilename: () => 'other.json' }, { ...download, url: () => 'https://unrelated.invalid/file' }, { ...download, createReadStream: async () => Readable.from([Buffer.alloc(EXPORT_DOWNLOAD_LIMIT + 1)]) }, { ...download, createReadStream: async () => Readable.from([Buffer.from('{}')]) }]) {
      failed.delete.mockClear(); await expect(inspectPartialDownload(failed, fixture)).rejects.toThrow(); expect(failed.delete).toHaveBeenCalledOnce();
    }
  });
  it('does not call request arrival a ready response; holds the unchanged HTTP-200 response until release', async () => {
    const state: any = { privateExportReads: 0, privateExportResponses: 0 };
    const controller = createPrivacyResponseGate(state); const pause = controller.pause();
    expect(() => controller.pause()).toThrow('EXPORT_GATE_ALREADY_PENDING');
    let resolveFetch: (value: any) => void = () => {};
    const response = { status: () => 200 };
    const route = { fetch: vi.fn(() => new Promise(resolve => { resolveFetch = resolve; })), fulfill: vi.fn(async () => {}), abort: vi.fn(async () => {}), request: () => ({ failure: () => null }) };
    let responseReady = false; pause.responseReady.then(() => { responseReady = true; });
    const work = controller.route(route); await pause.entered; await flush();
    expect(responseReady).toBe(false); expect(state.privateExportResponses).toBe(0); expect(route.fulfill).not.toHaveBeenCalled();
    resolveFetch(response); const ready = await pause.responseReady;
    expect(validPrivacyResponseReady(ready)).toBe(true); expect(route.fulfill).not.toHaveBeenCalled();
    pause.release('deliver'); const settled = await pause.settled; await work;
    expect(validPrivacyResponseSettlement(settled, 'deliver')).toBe(true);
    expect(ready).toEqual(readyReceipt()); // earlier snapshot is not overwritten
    expect(route.fulfill).toHaveBeenCalledExactlyOnceWith({ response }); expect(route.abort).not.toHaveBeenCalled();
  });
  it.each(['fetch-failure', 'http-503'])('rejects pre-response failure as held-response interruption evidence: %s', async kind => {
    const controller = createPrivacyResponseGate({ privateExportReads: 0, privateExportResponses: 0 });
    const pause = controller.pause();
    const route = { fetch: vi.fn(async () => { if (kind === 'fetch-failure') throw new Error('failed'); return { status: () => 503 }; }), fulfill: vi.fn(async () => {}), abort: vi.fn(async () => {}), request: () => ({ failure: () => ({ errorText: 'net::ERR_ABORTED' }) }) };
    const work = controller.route(route); await pause.entered;
    await expect(pause.responseReady).rejects.toThrow();
    const settled = await pause.settled; await work;
    expect(validPrivacyResponseReady(settled)).toBe(false);
    expect(validPrivacyResponseSettlement(settled, 'after-close')).toBe(false);
    expect(settled.outcome).toBe(kind === 'fetch-failure' ? 'response-fetch-failed' : 'non-200-response');
    expect(settled.released).toBe(false);
  });
  it.each(['net::ERR_ABORTED', 'net::ERR_FAILED', null])('retains and classifies after-close settlement using browser failure facts: %s', async errorText => {
    const controller = createPrivacyResponseGate({ privateExportReads: 0, privateExportResponses: 0 });
    const pause = controller.pause();
    const route = { fetch: vi.fn(async () => ({ status: () => 200 })), fulfill: vi.fn(async () => { throw new Error('delivery failed'); }), abort: vi.fn(async () => {}), request: () => ({ failure: () => errorText ? { errorText } : null }) };
    const work = controller.route(route);
    expect(validPrivacyResponseReady(await pause.responseReady)).toBe(true);
    pause.release('after-close'); const settled = await pause.settled; await work;
    expect(validPrivacyResponseSettlement(settled, 'after-close')).toBe(errorText === 'net::ERR_ABORTED');
    expect(settled.outcome).toBe(errorText === 'net::ERR_ABORTED' ? 'browser-cancelled-after-close' : 'response-delivery-failed');
  });
  it('rejects early release and makes cleanup release already consumed gates', async () => {
    const controller = createPrivacyResponseGate({ privateExportReads: 0, privateExportResponses: 0 });
    const pause = controller.pause(); pause.release('after-close');
    const response = { status: () => 200 };
    const route = { fetch: vi.fn(async () => response), fulfill: vi.fn(async () => {}), abort: vi.fn(async () => {}), request: () => ({ failure: () => null }) };
    await controller.route(route);
    expect(validPrivacyResponseReady(await pause.responseReady)).toBe(false);
    expect(validPrivacyResponseSettlement(await pause.settled, 'after-close')).toBe(false);
    const cleanup = controller.pause(); const work = controller.route(route);
    await cleanup.responseReady; controller.releasePending();
    const settled = await cleanup.settled; await work;
    expect(settled.releaseReason).toBe('cleanup'); expect(validPrivacyResponseSettlement(settled, 'after-close')).toBe(false);
  });
  it('requires every assertion, settled frame, safe network facts and validated partial download receipt', () => {
    const viewport = releaseCell(releaseMatrix('private-export-only')[0]).viewport;
    const cells = PRIVATE_EXPORT_STATES.map(({ state }) => cellFor(state, viewport));
    expect(missingReleaseInteractionEvidence(cells, { group: 'private-export', viewport, ...identity })).toEqual([]);
    for (const cell of cells) {
      expect(validPrivateExportCell(cell)).toBe(true);
      for (const assertion of cell.assertions) expect(validPrivateExportCell({ ...cell, assertions: cell.assertions.filter(a => a !== assertion) })).toBe(false);
      for (const patch of [{ frames: [] }, { frames: [{ ready: false }] }, { networkEvidence: {} }, { networkEvidence: { privateExportDenied: 1, privateExportPrivateReads: 0 } }]) expect(validPrivateExportCell({ ...cell, ...patch })).toBe(false);
    }
    expect(validPrivateExportNetwork({ ...safeNetwork(), privateExportNarrationRefusals: 2 })).toBe(true);
    for (const invalid of [-1, 0.5, '0', undefined]) expect(validPrivateExportNetwork({ ...safeNetwork(), privateExportNarrationRefusals: invalid })).toBe(false);
    for (const key of Object.keys(safeNetwork()).filter(key => key !== 'privateExportNarrationRefusals')) {
      const afterScreenshot = { ...cells[0], networkEvidence: { ...safeNetwork(), [key]: 1 } };
      // Every named assertion still says passed, including the pre-shot guard.
      expect(validPrivateExportCell(afterScreenshot)).toBe(false);
      expect(missingReleaseInteractionEvidence([afterScreenshot, ...cells.slice(1)], { group: 'private-export', viewport, ...identity })).toHaveLength(1);
      const absent: any = safeNetwork(); delete absent[key];
      expect(validPrivateExportNetwork(absent)).toBe(false); expect(validPrivateExportNetwork({ ...safeNetwork(), [key]: '0' })).toBe(false);
    }
    for (const state of ['export-pending', 'interrupted-pending', 'interrupted-closed']) {
      const original = cells.find(cell => cell.state === state)!;
      expect(validPrivateExportCell({ ...original, heldResponse: undefined })).toBe(false);
      for (const patch of [{ responseReady: false }, { responseStatus: 503 }, { released: true }]) expect(validPrivateExportCell({ ...original, heldResponse: { ...original.heldResponse, ready: { ...readyReceipt(), ...patch } } })).toBe(false);
    }
    const closed = cells.find(cell => cell.state === 'interrupted-closed')!;
    for (const patch of [{ outcome: 'response-fetch-failed' }, { outcome: 'response-delivery-failed' }, { releasedAfterReady: false }, { released: false }, { releaseReason: 'cleanup' }]) expect(validPrivateExportCell({ ...closed, heldResponse: { ...closed.heldResponse, settled: { ...settledReceipt('after-close'), ...patch } } })).toBe(false);
    expect(validPrivateExportCell({ ...closed, heldResponse: { ...closed.heldResponse, closedBeforeRelease: false } })).toBe(false);
    const delivered = cells.find(cell => cell.state === 'partial-download')!;
    for (const patch of [{ passed: false }, { deleted: false }, { status: 'complete' }, { privateFileStatus: 'included' }, { bytes: 0 }, { sha256: '' }, { childId: 'other' }, { filename: 'arbor-נועה-data.partial.json' }]) expect(validPrivateExportCell({ ...delivered, downloadReceipt: { ...delivered.downloadReceipt, ...patch } })).toBe(false);
  });
  it('aggregates exactly four partial-only source-bound shards and rejects missing evidence', () => {
    const records = releaseMatrix('private-export-only').map(spec => {
      const cell = releaseCell(spec); const cells = PRIVATE_EXPORT_STATES.map(({ state }) => cellFor(state, cell.viewport));
      return { capture: { ...identity, cell, completed: true, fontMode: 'exact', runtimeNetwork: 'none', fixture: { browserConnectivity: 'synthetic-online' } },
        inventory: { ...identity, routeIds: ROUTE_IDS, contracts: SURFACE_CONTRACTS }, evidence: { ...identity, completed: true, cells },
        fonts: { mode: 'exact', deniedFontRequests: 0, shots: cells.map(row => ({ shot: row.shot.split('/').pop(), passed: true, rendered: [{ custom: true }] })) }, shotNames: cells.map(row => row.shot.split('/').pop()) };
    });
    const result = summarizeRelease(records, identity, 'private-export-only');
    expect(result).toMatchObject({ completed: true, expectedShards: 4, baseCells: 0, interactionCells: 40, screenshots: 40 });
    expect(result.note).toContain('Complete authenticated private-file export and native-device download remain unverified');
    records[0].evidence.cells[4].downloadReceipt.deleted = false;
    expect(summarizeRelease(records, identity, 'private-export-only').completed).toBe(false);
  });
  it('keeps disposable isolation/font prep and excludes raw download payloads from artifacts', () => {
    const workflow = read('../.github/workflows/arbor-parent-release-capture.yml');
    expect(workflow).toContain('codex/private-export-release'); expect(workflow).toContain('scope=private-export-only');
    expect(workflow).toContain('docker create --network none'); expect(workflow).toContain('prepare-font-cache.mjs');
    expect(workflow).not.toMatch(/private-export\/\*|downloads\/\*|export\.json/);
    const download = read('scripts/capture/private-export-download.mjs');
    expect(download).not.toMatch(/writeFile|saveAs|setContent|authHeaders|downloadJson/);
    expect(download).toContain('await download.delete()');
    const interactions = read('scripts/capture/release-interactions.mjs');
    expect(interactions.indexOf("check(cell, 'FINAL_EXPORT_NETWORK_GUARD'")).toBeGreaterThan(interactions.indexOf('await captureScreenshot(page'));
    expect(interactions.indexOf("check(cell, 'FINAL_EXPORT_NETWORK_GUARD'")).toBeGreaterThan(interactions.indexOf('cell.runtimeDiagnostics = diagnostics.snapshot()'));
    const states = read('scripts/capture/private-export-states.mjs');
    const interrupted = states.slice(states.indexOf("'interrupted-closed'"));
    expect(interrupted.indexOf('await bounded(held.responseReady)')).toBeLessThan(interrupted.indexOf('await close(cell)'));
    expect(interrupted.indexOf('await close(cell)')).toBeLessThan(interrupted.indexOf("held.release('after-close')"));
    const runner = read('scripts/capture/run-release.mjs');
    expect(runner.indexOf('assertLoopbackOnly(networkInterfaces())')).toBeLessThan(runner.indexOf("await import('tsx/esm/api')"));
  });
});
