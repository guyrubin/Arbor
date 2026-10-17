import { describe, expect, it, vi } from 'vitest';
import { createSharedSubscription } from './sharedSubscription';
describe('read sharing is bounded by scope and lifetime', () => {
  it('opens once, replays the current snapshot and closes at the last subscriber', () => {
    const subscribe = createSharedSubscription<number>();
    let emit!: (value: number) => void;
    const close = vi.fn(), start = vi.fn(fn => { emit = fn; return close; });
    const a = vi.fn(), b = vi.fn();
    const offA = subscribe('owner:a', start, a); emit(7);
    const offB = subscribe('owner:a', start, b);
    expect(start).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledWith(7);
    offA(); emit(8); expect(a).toHaveBeenCalledTimes(1); expect(b).toHaveBeenLastCalledWith(8);
    expect(close).not.toHaveBeenCalled(); offB(); offB(); expect(close).toHaveBeenCalledOnce();
  });
  it('never shares between owners/children and never resurrects retired data', () => {
    const subscribe = createSharedSubscription<number>();
    const emits: ((value: number) => void)[] = [];
    const start = (fn: (value: number) => void) => { emits.push(fn); return () => {}; };
    const old = vi.fn(), other = vi.fn(), fresh = vi.fn();
    const stop = subscribe('a:child', start, old);
    const stopOther = subscribe('b:child', start, other);
    emits[0](1); expect(other).not.toHaveBeenCalled(); stop();
    const stopFresh = subscribe('a:child', start, fresh);
    expect(fresh).not.toHaveBeenCalled(); emits[0](2); expect(fresh).not.toHaveBeenCalled();
    emits[2](3); expect(fresh).toHaveBeenCalledWith(3); stopFresh(); stopOther();
  });
  it('accepts synchronous initial snapshots', () => {
    const subscribe = createSharedSubscription<number>(), listener = vi.fn();
    const stop = subscribe('a', emit => { emit(1); return () => {}; }, listener);
    expect(listener).toHaveBeenCalledWith(1); stop();
  });
});
