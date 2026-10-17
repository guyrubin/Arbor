import { afterEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'a' } as { uid: string } | null },
  authListeners: new Set<(user: { uid: string } | null) => void>(),
  reads: [] as { path: string; emit: (snap: any) => void; fail: () => void; stop: ReturnType<typeof vi.fn> }[],
}));
vi.mock('./firebase', () => ({ auth: h.auth, db: {}, firebaseEnabled: true }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_: unknown, fn: (u: {uid: string} | null) => void) => {
  h.authListeners.add(fn); fn(h.auth.currentUser); return () => h.authListeners.delete(fn);
} }));
vi.mock('firebase/firestore', () => ({
  collection: (_: unknown, path: string) => path,
  onSnapshot: (path: string, emit: (snap: any) => void, fail: () => void) => {
    const stop = vi.fn(); h.reads.push({ path, emit, fail, stop }); return stop;
  }, deleteDoc: vi.fn(), doc: vi.fn(), getDocs: vi.fn(), setDoc: vi.fn(),
}));
import { subscribeHeroSheetDocs } from './heroSheetStore';
const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); h.auth.currentUser = { uid: 'a' }; h.reads = []; h.authListeners.clear(); });
const snap = (id: string) => ({ docs: [{ id: '_meta', data: () => ({ avatarHash: id, heroId: id, poses: [], status: 'complete' }) }] });
const switchOwner = (uid: string | null) => { h.auth.currentUser = uid ? { uid } : null; [...h.authListeners].forEach(fn => fn(h.auth.currentUser)); };
describe('hero transport sharing keeps owner boundaries', () => {
  it('two figures share one Firestore subscription and parsed snapshot', () => {
    const a = vi.fn(), b = vi.fn();
    const offA = subscribeHeroSheetDocs('c', a); cleanup.push(offA);
    h.reads[0].emit(snap('avatar'));
    const offB = subscribeHeroSheetDocs('c', b); cleanup.push(offB);
    expect(h.reads).toHaveLength(1);
    expect(a.mock.calls[0][0]).toBe(b.mock.calls[0][0]);
    offA(); expect(h.reads[0].stop).not.toHaveBeenCalled();
    offB(); expect(h.reads[0].stop).toHaveBeenCalledOnce();
    h.reads[0].emit(snap('late')); expect(b).toHaveBeenCalledTimes(1);
  });
  it('owner change empties the old read and rejects late snapshots, including A-B-A', () => {
    const listener = vi.fn(); cleanup.push(subscribeHeroSheetDocs('c', listener));
    const old = h.reads[0]; old.emit(snap('old'));
    switchOwner('b'); old.emit(snap('wrong'));
    expect(listener).toHaveBeenLastCalledWith({ meta: null, poses: {} });
    expect(h.reads).toHaveLength(1); // Old A transport must not subscribe to B.
    switchOwner('a'); expect(h.reads).toHaveLength(2);
    h.reads[1].emit(snap('fresh')); old.emit(snap('obsolete'));
    expect(listener.mock.lastCall![0].meta.heroId).toBe('fresh');
  });
  it('same child id on different owners never reuses another owner snapshot', () => {
    cleanup.push(subscribeHeroSheetDocs('c', vi.fn())); h.reads[0].emit(snap('a'));
    switchOwner('b'); const b = vi.fn(); cleanup.push(subscribeHeroSheetDocs('c', b));
    expect(b).not.toHaveBeenCalled(); expect(h.reads[1].path).toContain('users/b/children/c/');
    h.reads[1].emit(snap('b')); expect(b.mock.lastCall![0].meta.heroId).toBe('b');
  });
});
