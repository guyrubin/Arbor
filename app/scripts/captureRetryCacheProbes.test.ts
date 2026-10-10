import { afterEach, describe, expect, it, vi } from 'vitest';
import { Session } from 'node:inspector';
import { readFileSync } from 'node:fs';
import { observeCurrentRetryCache, selectCurrentCoachRetryCache } from './capture/readiness-probes.mjs';

const secret = 'FAKE_PRIVATE_PROMISE_RESULT_never_export';
type Fiber = { tag: number; stateNode?: unknown; child?: Fiber; return?: Fiber; alternate?: Fiber; memoizedState?: unknown };
function fixture() {
  const cache = new WeakSet<object>();
  const actual: Fiber = { tag: 13, memoizedState: {}, stateNode: cache };
  const attached: Fiber = { tag: 13, alternate: actual };
  const current: Fiber = { tag: 3, child: actual };
  const host = { __reactFiber$test: { tag: 5, return: attached } };
  const app = { contains: (node: unknown) => node === host };
  const root = { current, containerInfo: app };
  attached.return = { tag: 3, stateNode: root };
  current.stateNode = root;
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:4805' });
  vi.stubGlobal('window', { __arborCaptureFixture: { connectivity: 'synthetic-online' } });
  vi.stubGlobal('document', { getElementById: () => app, querySelector: () => host });
  return { cache, actual, attached, current, root, app };
}
afterEach(() => { vi.unstubAllGlobals(); });

function protocolFixture({ failAt = '', count = 4 } = {}) {
  const resultGetter = vi.fn(() => { throw new Error(secret); });
  const states = ['pending', 'fulfilled', 'rejected', secret];
  const send = vi.fn(async (method: string, params: Record<string, unknown>): Promise<unknown> => {
    if (method === failAt) throw new Error(secret);
    if (method === 'Runtime.evaluate') return { result: { subtype: 'weakset', objectId: 'cache' } };
    if (method === 'Runtime.callFunctionOn') return { result: { subtype: 'object', objectId: 'sample' } };
    if (method === 'Runtime.releaseObjectGroup') return {};
    if (method !== 'Runtime.getProperties') throw new Error('UNEXPECTED_PROTOCOL_METHOD');
    if (params.objectId === 'cache') return { internalProperties: [{ name: '[[Entries]]', value: { subtype: 'array', objectId: 'entries' } }] };
    if (params.objectId === 'sample') return { result: [{ name: 'truncated', value: { type: 'boolean', value: count > 8 } }, { name: 'values', value: { subtype: 'array', objectId: 'values' } }] };
    if (params.objectId === 'values') return { result: Array.from({ length: count }, (_, n) => ({ name: String(n), value: { subtype: n === 3 ? 'object' : 'promise', objectId: `promise${n}` } })) };
    if (typeof params.objectId === 'string' && /^promise\d+$/.test(params.objectId)) {
      return { get result() { return resultGetter(); }, internalProperties: [
        { name: '[[PromiseResult]]', get value() { return resultGetter(); } },
        { name: '[[PromiseState]]', value: { type: 'string', value: states[Number(params.objectId.slice(7)) % 4] } },
      ] };
    }
    throw new Error('UNEXPECTED_REMOTE_HANDLE');
  });
  const detach = vi.fn(async () => {});
  const newCDPSession = vi.fn(async () => ({ send, detach }));
  const page = { context: () => ({ newCDPSession }) };
  return { page, send, detach, newCDPSession, resultGetter };
}

describe('bounded current-boundary retry-cache observation', () => {
  it('selects only the verified current boundary cache without reading props or alternate caches', () => {
    const f = fixture();
    Object.defineProperty(f.actual, 'memoizedProps', { get() { throw new Error(secret); } });
    Object.defineProperty(f.attached, 'stateNode', { get() { throw new Error(secret); } });
    expect(selectCurrentCoachRetryCache()).toBe(f.cache);
    f.root.containerInfo = { contains: () => false };
    expect(selectCurrentCoachRetryCache()).toBe('not-current-coach-boundary');
  });

  it('refuses non-fixture, outside-root, detached, unsuspended and unsupported boundaries', () => {
    const f = fixture();
    vi.stubGlobal('location', { origin: 'https://external.invalid' });
    expect(selectCurrentCoachRetryCache()).toBe('not-isolated-fixture');
    vi.stubGlobal('location', { origin: 'http://127.0.0.1:4805' });
    f.app.contains = () => false;
    expect(selectCurrentCoachRetryCache()).toBe('not-current-coach-boundary');
    f.app.contains = () => true; f.current.child = { tag: 5 };
    expect(selectCurrentCoachRetryCache()).toBe('not-current-coach-boundary');
    f.current.child = f.actual; f.actual.memoizedState = null;
    expect(selectCurrentCoachRetryCache()).toBe('boundary-not-suspended');
    f.actual.memoizedState = {}; f.actual.stateNode = null;
    expect(selectCurrentCoachRetryCache()).toBe('retry-cache-absent');
    f.actual.stateNode = { secret };
    expect(selectCurrentCoachRetryCache()).toBe('unsupported-retry-cache');
  });

  it('does not attach or inspect without an explicitly retained failed attempt', async () => {
    const f = protocolFixture();
    expect((await observeCurrentRetryCache(f.page)).presence).toBe('not-requested');
    expect(f.newCDPSession).not.toHaveBeenCalled();
  });

  it('exports only closed state counts and releases handles without reading PromiseResult or props', async () => {
    const f = protocolFixture();
    const result = await observeCurrentRetryCache(f.page, { retainedFailure: true });
    expect(result).toEqual({ presence: 'weakset-present', examined: 4, truncated: false, states: { pending: 1, fulfilled: 1, rejected: 1, unknown: 1 } });
    expect(f.resultGetter).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/FAKE_PRIVATE|PromiseResult|objectId|description|value|props|stack/);
    expect(f.send).toHaveBeenLastCalledWith('Runtime.releaseObjectGroup', { objectGroup: 'arbor-capture-current-retry-cache' });
    expect(f.detach).toHaveBeenCalledOnce();
    for (const [method, params] of f.send.mock.calls) if (method !== 'Runtime.releaseObjectGroup') expect(params.generatePreview).toBe(false);
    expect(f.send.mock.calls.some(([method, params]) => method === 'Runtime.getProperties' && params.objectId === 'entries')).toBe(false);
  });

  it('inspects at most eight entries even if malformed protocol output contains more', async () => {
    const f = protocolFixture({ count: 12 });
    const result = await observeCurrentRetryCache(f.page, { retainedFailure: true });
    expect(result.examined).toBe(8); expect(result.truncated).toBe(true);
    expect(Object.values(result.states).reduce((a, b) => a + b, 0)).toBe(8);
    expect(f.send.mock.calls.filter(([method, params]) => method === 'Runtime.getProperties' && /^promise(?:8|9|10|11)$/.test(String(params.objectId)))).toEqual([]);
  });

  it.each(['not-current-coach-boundary', secret])('does not inspect absent/unverified handles or export an arbitrary selector value', async value => {
    const f = protocolFixture();
    f.send.mockImplementationOnce(async () => ({ result: { type: 'string', value } }));
    const result = await observeCurrentRetryCache(f.page, { retainedFailure: true });
    expect(result.presence).toBe(value === secret ? 'unsupported-retry-cache' : value);
    expect(result.examined).toBe(0);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(f.send.mock.calls.map(([method]) => method)).toEqual(['Runtime.evaluate', 'Runtime.releaseObjectGroup']);
    expect(f.detach).toHaveBeenCalledOnce();
  });

  it.each(['Runtime.evaluate', 'Runtime.getProperties', 'Runtime.callFunctionOn'])('cleans up and omits raw protocol failure for %s', async failAt => {
    const f = protocolFixture({ failAt });
    const result = await observeCurrentRetryCache(f.page, { retainedFailure: true });
    expect(result.presence).toBe('protocol-unavailable');
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(f.send).toHaveBeenLastCalledWith('Runtime.releaseObjectGroup', { objectGroup: 'arbor-capture-current-retry-cache' });
    expect(f.detach).toHaveBeenCalledOnce();
  });

  it('observes real V8 WeakSet promise states without settling the pending wakeable', async () => {
    const f = fixture();
    const pending = new Promise(() => {}), fulfilled = Promise.resolve(secret), rejected = Promise.reject(secret);
    void rejected.catch(() => {});
    for (const promise of [pending, fulfilled, rejected]) f.cache.add(promise);
    const session = new Session(); session.connect();
    const send = (method: string, params: object) => new Promise((resolve, reject) => session.post(method, params, (error, response) => error ? reject(error) : resolve(response)));
    const detach = vi.fn(async () => session.disconnect());
    const page = { context: () => ({ newCDPSession: async () => ({ send, detach }) }) };
    const result = await observeCurrentRetryCache(page, { retainedFailure: true });
    expect(result).toEqual({ presence: 'weakset-present', examined: 3, truncated: false, states: { pending: 1, fulfilled: 1, rejected: 1, unknown: 0 } });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(detach).toHaveBeenCalledOnce();
  });

  it('runs only after the saved failed verdict and before import, without promoting any cell', () => {
    const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
    const screen = source.slice(source.indexOf('const screen = async'), source.indexOf("if (group === 'navigation')"));
    const probe = screen.indexOf('cell.retryCache =');
    expect(probe).toBeGreaterThan(screen.indexOf('cell.reached ='));
    expect(screen.slice(screen.indexOf('cell.reached ='), probe)).toContain('save();');
    expect(screen.slice(screen.indexOf('cell.reached ='), probe)).toContain("group === 'ask-diagnostic' && ['launcher-composer', 'direct-composer'].includes(state) && !cell.reached");
    expect(probe).toBeLessThan(screen.indexOf('cell.postFailureProbe ='));
    expect(screen.slice(probe)).not.toMatch(/cell\.(?:reached|failures|readiness)\s*=/);
  });
});
