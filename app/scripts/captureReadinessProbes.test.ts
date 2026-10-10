import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { lazy } from 'react';
import { installStylesheetObservation, observeAskDependency } from './capture/readiness-probes.mjs';

const secret = 'FAKE_API_KEY_sk_test_never_export_42';
const child = 'Synthetic Child Rowan Private';
const path = '/assets/CoachTab-testHash.js';
const origin = 'http://127.0.0.1:4805';
const deferred = <T = unknown>() => { let resolve!: (value: T | PromiseLike<T>) => void, reject!: (value: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

function fixture(payload: any = { _status: 0, _result: deferred().promise }) {
  const listeners = new Map<string, any>();
  const lazy = { $$typeof: Symbol.for('react.lazy'), _payload: payload, _init: vi.fn() };
  const boundary = { tag: 13, memoizedProps: { children: { type: lazy, props: { privateText: child, apiKey: secret } } }, memoizedState: { privateText: child } };
  const fallback = { __reactFiber$test: { tag: 5, return: { tag: 7, return: boundary } } };
  const links = [{ href: origin + path }];
  vi.stubGlobal('location', { origin });
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', { querySelector: () => fallback, querySelectorAll: () => links, addEventListener: (event: string, callback: any, options: any) => listeners.set(event, { callback, options }) });
  return { payload, lazy, boundary, links, listeners, fallback };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('bounded read-only Suspense dependency probes', () => {
  it('reads the actual lazy payload behind the visible fallback without invoking its initializer or exporting props', async () => {
    const f = fixture(); const importer = vi.fn();
    const result = await observeAskDependency({}, importer);
    expect(result).toMatchObject({ boundaryFound: true, lazyCount: 1, lazy: [{ status: 'pending', thenable: true }] });
    expect(importer).not.toHaveBeenCalled(); expect(f.lazy._init).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toMatch(/FAKE_API_KEY|Rowan|Private|privateText|apiKey|memoized|_result|promise/);
    expect(f.payload._status).toBe(0);
  });

  it.each([[-1, 'uninitialized'], [0, 'pending'], [1, 'resolved'], [2, 'rejected'], [99, 'unknown']])('reports lazy state %s as the closed enum %s', async (value, expected) => {
    fixture({ _status: value, _result: new Error(secret + child) });
    expect((await observeAskDependency()).lazy[0].status).toBe(expected);
  });

  it('retains local CSS load/error events but no query, external path, body or content', async () => {
    const f = fixture(); installStylesheetObservation();
    for (const type of ['load', 'error']) {
      expect(f.listeners.get(type).options).toEqual({ capture: true, passive: true });
      f.listeners.get(type).callback({ type, target: { tagName: 'LINK', rel: 'stylesheet', href: `${origin}/assets/companion-test.css?token=${secret}#${child}` } });
      f.listeners.get(type).callback({ type, target: { tagName: 'LINK', rel: 'stylesheet', href: `https://external.test/${secret}.css` } });
      f.listeners.get(type).callback({ type, target: { tagName: 'LINK', rel: 'stylesheet', href: `${origin}/api/chat?prompt=${child}` } });
      f.listeners.get(type).callback({ type, target: { tagName: 'IMG', rel: 'stylesheet', href: `${origin}/assets/private.css` } });
    }
    const result = await observeAskDependency();
    expect(result.cssEvents).toEqual({ counts: { load: 1, error: 1, omitted: 0 }, events: [{ path: '/assets/companion-test.css', event: 'load' }, { path: '/assets/companion-test.css', event: 'error' }] });
    expect(JSON.stringify(result)).not.toMatch(/FAKE_API_KEY|Rowan|Private|external|token=|prompt=|https?:/);
    for (let n = 0; n < 120; n++) f.listeners.get('load').callback({ type: 'load', target: { tagName: 'LINK', rel: 'stylesheet', href: `${origin}/assets/valid.css` } });
    expect((await observeAskDependency()).cssEvents).toMatchObject({ counts: { load: 121, error: 1, omitted: 22 } });
    expect((await observeAskDependency()).cssEvents.events).toHaveLength(100);
  });

  it('distinguishes a still-pending actual Vite/lazy promise from a fulfilled direct module import', async () => {
    vi.useFakeTimers(); const f = fixture();
    const importer = vi.fn(async () => ({ default: () => null, secret, child }));
    const pending = observeAskDependency({ probeModulePath: path }, importer);
    await vi.advanceTimersByTimeAsync(2001);
    const result = await pending;
    expect(importer).toHaveBeenCalledExactlyOnceWith(path);
    expect(result.probe).toEqual({ modulePath: path, deadlineMs: 2000, module: { state: 'fulfilled', defaultType: 'function' }, lazyWaits: [{ state: 'pending-at-probe-deadline' }] });
    expect(result.after.lazy).toEqual([{ status: 'pending', thenable: true }]);
    expect(f.lazy._init).not.toHaveBeenCalled(); expect(f.payload._status).toBe(0);
    expect(JSON.stringify(result)).not.toMatch(/FAKE_API_KEY|Rowan|Private|_result|privateText/);
  });

  it('observes settlement of the exact thrown thenable without calling React or retrying the loader', async () => {
    vi.useFakeTimers(); const wait = deferred(); const f = fixture({ _status: 0, _result: wait.promise });
    const importer = vi.fn(async () => ({ default: () => null }));
    const result = observeAskDependency({ probeModulePath: path }, importer);
    wait.resolve({ default: () => null, secret });
    expect((await result).probe.lazyWaits).toEqual([{ state: 'fulfilled' }]);
    expect(f.payload._status).toBe(0); // Only React itself may change its payload.
    expect(f.lazy._init).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('matches the installed React lazy payload and its real thrown promise', async () => {
    const wait = deferred<{ default: () => null }>();
    const component = lazy(() => wait.promise);
    // React intentionally leaves these runtime internals out of its public type.
    // Inspect their property descriptors, as the browser probe inspects the fiber.
    const payload = Object.getOwnPropertyDescriptor(component, '_payload')?.value;
    const initialize = Object.getOwnPropertyDescriptor(component, '_init')?.value;
    expect(typeof initialize).toBe('function');
    let thrown;
    try { initialize(payload); } catch (value) { thrown = value; }
    expect(thrown).toBe(wait.promise);
    fixture(payload);
    const result = observeAskDependency({ probeModulePath: path }, async () => ({ default: () => null }));
    wait.resolve({ default: () => null });
    expect((await result).before.lazy).toEqual([{ status: 'pending', thenable: true }]);
    expect((await result).probe.lazyWaits).toEqual([{ state: 'fulfilled' }]);
    expect((await result).after.lazy).toEqual([{ status: 'resolved', thenable: false }]);
  });

  it('keeps rejected import/thenable diagnostics to allowlisted exception names', async () => {
    const wait = deferred(); fixture({ _status: 0, _result: wait.promise });
    const result = observeAskDependency({ probeModulePath: path }, async () => { throw new TypeError(secret + child); });
    wait.reject({ name: secret, message: child, stack: secret });
    expect((await result).probe).toMatchObject({ module: { state: 'rejected', errorName: 'TypeError' }, lazyWaits: [{ state: 'rejected', errorName: 'OtherError' }] });
    expect(JSON.stringify(await result)).not.toMatch(/FAKE_API_KEY|Rowan|Private|message|stack/);
  });

  it.each([`https://external.test${path}`, `${path}?key=${secret}`, `/api/chat`, `/assets/NowView-test.js`, `/assets/CoachTab-notObserved.js`])('does not import an unverified target %s', async candidate => {
    fixture(); const importer = vi.fn();
    expect((await observeAskDependency({ probeModulePath: candidate }, importer)).probe.module).toBe('not-observed-local-coach-module');
    expect(importer).not.toHaveBeenCalled();
  });

  it('caps malformed fiber walks and wrapper depth without reading unrelated app props', async () => {
    const f = fixture(); f.fallback.__reactFiber$test.return = f.fallback.__reactFiber$test as any;
    expect(await observeAskDependency()).toMatchObject({ boundaryFound: false, lazyCount: 0 });
  });

  it('wires observation before startup and probes only after retaining the failed narrow composer verdict', () => {
    const source = readFileSync(new URL('./capture/release-interactions.mjs', import.meta.url), 'utf8');
    expect(source.indexOf('await context.addInitScript(installStylesheetObservation)')).toBeLessThan(source.indexOf('const page = await context.newPage()'));
    const screen = source.slice(source.indexOf('const screen = async'), source.indexOf("if (group === 'navigation')"));
    expect(screen).toContain("group === 'ask-diagnostic' && ['launcher-composer', 'direct-composer'].includes(state) && !cell.reached");
    expect(screen.indexOf('cell.reached =')).toBeLessThan(screen.indexOf('cell.postFailureProbe ='));
    expect(screen.slice(screen.indexOf('cell.postFailureProbe ='))).not.toContain('cell.reached =');
    expect(screen).toContain("item.state === 'finished' && item.status === 200 && item.mime === 'javascript'");
    expect(screen).not.toContain('waitForTimeout');
  });
});
