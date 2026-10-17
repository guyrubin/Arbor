import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedModule, scheduleModulePreload, speculationAllowed } from './modulePreload';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('navigator', { onLine: true });
  vi.stubGlobal('document', { visibilityState: 'visible' });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('module load ownership', () => {
  it('shares in-flight and fulfilled imports', async () => {
    let finish!: (value: string) => void;
    const source = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const load = cachedModule(source);
    const first = load(), second = load();
    expect(first).toBe(second);
    await Promise.resolve(); finish('ready');
    await expect(first).resolves.toBe('ready');
    await expect(load()).resolves.toBe('ready');
    expect(source).toHaveBeenCalledOnce();
  });
  it('a rejected warm-up does not poison a later explicit open', async () => {
    const source = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('ready');
    const load = cachedModule(source);
    await expect(load()).rejects.toThrow('offline');
    await expect(load()).resolves.toBe('ready');
    expect(source).toHaveBeenCalledTimes(2);
  });
});

describe('bounded, cancelable speculation', () => {
  it('starts only one module, then yields before the next', async () => {
    let finish!: () => void;
    const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const second = vi.fn(async () => {});
    scheduleModulePreload([first, second]);
    expect(first).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(first).toHaveBeenCalledOnce(); expect(second).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(second).not.toHaveBeenCalled();
    finish(); await vi.advanceTimersByTimeAsync(0);
    expect(second).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300); expect(second).toHaveBeenCalledOnce();
  });
  it('cancels before starting, and can schedule again after StrictMode cleanup', async () => {
    const load = vi.fn(async () => {});
    const cancel = scheduleModulePreload([load]); cancel(); cancel();
    await vi.runAllTimersAsync(); expect(load).not.toHaveBeenCalled();
    scheduleModulePreload([load]); await vi.runAllTimersAsync(); expect(load).toHaveBeenCalledOnce();
  });
  it('does not issue later work after cancellation during an import', async () => {
    let finish!: () => void;
    const first = () => new Promise<void>(resolve => { finish = resolve; });
    const second = vi.fn(async () => {});
    const cancel = scheduleModulePreload([first, second]);
    await vi.advanceTimersByTimeAsync(300); cancel(); finish();
    await vi.runAllTimersAsync(); expect(second).not.toHaveBeenCalled();
  });
  it('retains window receiver for idle scheduling and cancels the idle handle', () => {
    const host = { requestIdleCallback: vi.fn(function(this: unknown) { expect(this).toBe(host); return 19; }), cancelIdleCallback: vi.fn() };
    vi.stubGlobal('window', host);
    scheduleModulePreload([async () => {}])();
    expect(host.cancelIdleCallback).toHaveBeenCalledWith(19);
  });
  it.each([{ onLine: false }, { connection: { saveData: true } }, { connection: { effectiveType: '2g' } }])('skips constrained connections: %j', network => {
    vi.stubGlobal('navigator', network);
    expect(speculationAllowed()).toBe(false);
    scheduleModulePreload([async () => {}]); expect(vi.getTimerCount()).toBe(0);
  });
  it('checks visibility again before executing a queued callback', async () => {
    const load = vi.fn(async () => {}); scheduleModulePreload([load]);
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    await vi.runAllTimersAsync(); expect(load).not.toHaveBeenCalled();
  });
  it('a failed import does not block the remaining small shell warm-up', async () => {
    const next = vi.fn(async () => {});
    scheduleModulePreload([async () => { throw new Error('network'); }, next]);
    await vi.runAllTimersAsync(); expect(next).toHaveBeenCalledOnce();
  });
});
