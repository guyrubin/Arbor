import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createFirstRunPreviewScope, firstRunNetworkSnapshot, installFirstRunPreviewBoundary } from './capture/first-run-preview-network.mjs';
import { validFirstRunNetworkEvidence } from './capture/first-run-preview-contract.mjs';
// Unit boundary only: no browser, token or account. The real source's request
// builder is invoked, with fetch connected to the actual capture route handler.
vi.mock('../src/lib/api', () => ({ authHeaders: async () => ({}) }));
import { ensureBookNarration, resetBookNarrationForTest } from '../src/components/kidmode/hero/buildBookNarration';
const BASE = 'http://127.0.0.1:4805';
const created = 'child-1791626400000';
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');
async function harness(record = true) {
  const scope = createFirstRunPreviewScope();
  if (record) expect(scope.recordCreatedChild(created)).toBe(true);
  const apiState: any = { firstRunDeniedWrites: 0, firstRunNarrationRefusals: 0, firstRunRequestDiagnostics: { counts: {}, recent: [] }, deniedActions: 0, deniedExternal: 0, mockRequests: 0 };
  let handler: any, matches: any;
  await installFirstRunPreviewBoundary({ route: async (predicate: any, callback: any) => { matches = predicate; handler = callback; } }, apiState, scope);
  const request = async (path: string, method = 'POST', metadata: any = {}) => {
    const url = new URL(path, BASE); const effects: string[] = []; let response: any = null;
    if (!matches(url)) return { effects: ['unmatched'], response };
    await handler({ request: () => ({ url: () => url.href, method: () => method, headers: () => ({}), allHeaders: async () => { if (metadata instanceof Error) throw metadata; return metadata; }, postData: () => { throw new Error('BODY_MUST_NOT_BE_READ'); } }),
      abort: () => effects.push('abort'), fallback: () => effects.push('fallback'), continue: () => { throw new Error('NO_DIRECT_CONTINUE'); },
      fulfill: (value: any) => { effects.push(`fulfill:${value.status}`); response = value; } });
    return { effects, response };
  };
  return { apiState, request, scope };
}
beforeEach(() => resetBookNarrationForTest());
afterEach(() => vi.unstubAllGlobals());
describe('observed first-run child narration refusal', () => {
  it('does not grant an exception before an actual created identity is recorded or let it expand later', async () => {
    const h = await harness(false);
    expect((await h.request(`/api/children/${created}/book-narration`)).effects).toEqual(['abort']);
    expect(h.scope.recordCreatedChild('fixture-child')).toBe(false);
    expect(h.scope.recordCreatedChild(created)).toBe(true);
    expect(h.scope.recordCreatedChild('child-1791626400001')).toBe(false);
    expect(h.scope.createdChildId()).toBe(created);
    expect(h.apiState.firstRunDeniedWrites).toBe(1);
  });
  it('returns only a labeled 409 for the exact observed child endpoint and counts no successful write', async () => {
    const h = await harness();
    const result = await h.request(`/api/children/${created}/book-narration`);
    expect(result.effects).toEqual(['fulfill:409']);
    expect(JSON.parse(result.response.body)).toEqual({ code: 'synthetic_capture_media_disabled' });
    expect(h.apiState).toMatchObject({ firstRunNarrationRefusals: 1, firstRunDeniedWrites: 0, deniedActions: 0, mockRequests: 0 });
    expect(validFirstRunNetworkEvidence(h.apiState)).toBe(true);
    expect(JSON.stringify(h.apiState)).not.toContain(created);
  });
  it('keeps other child IDs, suffixes, queries, methods, media and model requests denied', async () => {
    for (const [method, path] of [
      ['POST', '/api/children/other/book-narration'], ['POST', `/api/children/${created}/book-narration/extra`],
      ['POST', `/api/children/${created}/book-narration?private=do-not-retain`], ['PUT', `/api/children/${created}/book-narration`],
      ['POST', '/api/generate-avatar'], ['POST', '/api/chat'], ['POST', '/api/onboarding/family-child'], ['POST', '/webhooks/billing/revenuecat'],
    ]) {
      const h = await harness(); expect((await h.request(path, method)).effects).toEqual(['abort']);
      expect(h.apiState.firstRunNarrationRefusals).toBe(0); expect(h.apiState.firstRunDeniedWrites).toBe(1);
      expect(validFirstRunNetworkEvidence(h.apiState)).toBe(false);
      expect(JSON.stringify(h.apiState)).not.toContain('do-not-retain');
    }
    const h = await harness();
    expect((await h.request(`https://foreign.invalid/api/children/${created}/book-narration`)).effects).toEqual(['unmatched']);
    expect(h.apiState.firstRunNarrationRefusals).toBe(0);
  });
  it('denies cookies visible only through allHeaders before narration, demo, API or non-API reads', async () => {
    for (const [method, path] of [['POST', `/api/children/${created}/book-narration`], ['GET', '/sandbox/demo-family.json'], ['GET', '/api/live/availability'], ['GET', '/']]) {
      const h = await harness();
      expect((await h.request(path, method, { Cookie: 'synthetic-cookie-do-not-retain' })).effects).toEqual(['abort']);
      expect(h.apiState).toMatchObject({ firstRunNarrationRefusals: 0, firstRunDeniedWrites: 1, deniedActions: 1 });
      expect(validFirstRunNetworkEvidence(h.apiState)).toBe(false);
      expect(JSON.stringify(h.apiState)).not.toMatch(/Cookie|synthetic-cookie-do-not-retain/);
      expect(h.apiState.firstRunRequestDiagnostics.recent[0].disposition).toBe('denied-auth-or-metadata');
    }
  });
  it('fails closed on unreadable complete metadata and every credential header, without retaining values', async () => {
    for (const metadata of [new Error('do-not-retain-error'), null, [], 'invalid', ...['Authorization', 'proxy-authorization', 'cookie', 'X-API-Key', 'x-auth-token', 'x-goog-api-key', 'x-firebase-appcheck'].map(name => ({ [name]: 'do-not-retain-token' }))]) {
      const h = await harness();
      expect((await h.request(`/api/children/${created}/book-narration`, 'POST', metadata)).effects).toEqual(['abort']);
      expect(h.apiState.firstRunNarrationRefusals).toBe(0);
      expect(validFirstRunNetworkEvidence(h.apiState)).toBe(false);
      expect(JSON.stringify(h.apiState)).not.toMatch(/do-not-retain/);
    }
  });
  it('awaits complete metadata before admitting even the exact local narration refusal', async () => {
    const scope = createFirstRunPreviewScope(); scope.recordCreatedChild(created);
    const apiState: any = { firstRunDeniedWrites: 0, firstRunNarrationRefusals: 0, deniedActions: 0 };
    let handler: any, resolveMetadata: any;
    const metadata = new Promise(resolve => { resolveMetadata = resolve; });
    await installFirstRunPreviewBoundary({ route: async (_: any, callback: any) => { handler = callback; } }, apiState, scope);
    const effects: string[] = [];
    const pending = handler({ request: () => ({ url: () => `${BASE}/api/children/${created}/book-narration`, method: () => 'POST', headers: () => ({}), allHeaders: () => metadata }),
      abort: () => effects.push('abort'), fallback: () => effects.push('fallback'), fulfill: () => effects.push('fulfill') });
    await Promise.resolve(); expect(effects).toEqual([]); expect(apiState.firstRunNarrationRefusals).toBe(0);
    resolveMetadata({ cookie: 'do-not-retain' }); await pending;
    expect(effects).toEqual(['abort']); expect(apiState.firstRunNarrationRefusals).toBe(0);
  });
  it('keeps bounded immutable diagnostics and exact refusal accounting mandatory', async () => {
    const h = await harness();
    for (let n = 0; n < 12; n++) await h.request(`/api/children/${created}/book-narration`);
    const snapshot = firstRunNetworkSnapshot(h.apiState);
    expect(snapshot.firstRunRequestDiagnostics.recent).toHaveLength(8);
    expect(validFirstRunNetworkEvidence(h.apiState)).toBe(true);
    await h.request('/api/private/secret', 'DELETE');
    expect(snapshot.firstRunRequestDiagnostics.recent.every((row: any) => row.disposition === 'synthetic-409-refusal')).toBe(true);
    expect(Object.keys(snapshot.firstRunRequestDiagnostics.counts)).toEqual(['POST:CREATED_CHILD_BOOK_NARRATION:synthetic-409-refusal']);
    expect(validFirstRunNetworkEvidence(h.apiState)).toBe(false);
    const badCount = { ...h.apiState, deniedActions: 0, firstRunDeniedWrites: 0, ...snapshot, firstRunNarrationRefusals: 11 };
    expect(validFirstRunNetworkEvidence(badCount)).toBe(false);
  });
  it('executes the real shell narration builder endpoint and stops at the first 409 without storing media or completion', async () => {
    const h = await harness(); const observed: { method: string; pathname: string }[] = [];
    const storage = { getItem: () => null, setItem: vi.fn() };
    vi.stubGlobal('fetch', async (input: string, options: RequestInit) => {
      const url = new URL(input, BASE); observed.push({ method: options.method ?? 'GET', pathname: url.pathname });
      const result = await h.request(url.href, options.method ?? 'GET');
      expect(result.effects).toEqual(['fulfill:409']);
      return { ok: false, status: result.response.status, json: async () => JSON.parse(result.response.body) };
    });
    const result = await ensureBookNarration({ id: created, name: 'Preview Child' }, 'en', undefined, storage);
    expect(observed).toEqual([{ method: 'POST', pathname: `/api/children/${created}/book-narration` }]);
    expect(result).toMatchObject({ status: 'not-started', rendered: 0, stoppedBy: 'synthetic_capture_media_disabled' });
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(h.apiState).toMatchObject({ firstRunNarrationRefusals: 1, firstRunDeniedWrites: 0, mockRequests: 0 });
    expect(read('../src/components/layout/KidModeButton.tsx')).toContain('void ensureBookNarration(child, narrationVoice)');
    expect(read('../src/components/layout/Shell.tsx')).toContain('<KidModeButton compact />');
  });
  it('records the child scope only after real form, identity and unchanged-baseline assertions', () => {
    const source = read('./capture/first-run-preview-states.mjs');
    expect(source).toContain("check(cell, 'CREATED_CHILD_NARRATION_SCOPE', observed && recordCreatedChild(childId))");
    expect(source).toContain('cell.assertions.every(assertion => assertion.passed === true) && (await facts()).baselineUnchanged');
    expect(source.indexOf('recordCreatedChild(childId)')).toBeGreaterThan(source.indexOf("check(cell, 'LOCAL_ABOUT_FIELDS_MATCH'"));
    expect(source.indexOf('recordCreatedChild(childId)')).toBeGreaterThan(source.indexOf("check(cell, 'LOCAL_CHILD_SELECTED'"));
    expect(source).not.toMatch(/\.setItem\(|\.removeItem\(|force:\s*true/);
  });
});
