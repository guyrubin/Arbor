/** Actual AuthProvider callbacks with deterministic effect slots; Firebase,
 * analytics, billing and other device stores are synthetic. No rendered QA. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  owner: { uid: "owner-a" } as { uid: string } | null,
  observer: null as null | ((user: { uid: string } | null) => void),
  effects: [] as (() => void | (() => void))[], cleanups: [] as (() => void)[],
  comic: vi.fn(), logout: vi.fn(), unsub: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => { h.effects.push(effect); },
}));
vi.mock("../lib/firebase", () => ({ firebaseEnabled: true, auth: { get currentUser() { return h.owner; } } }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), signInWithEmailAndPassword: vi.fn(), sendPasswordResetEmail: vi.fn(), signOut: h.logout,
  onAuthStateChanged: (_auth: unknown, fn: typeof h.observer) => { h.observer = fn; return h.unsub; },
}));
vi.mock("../lib/api", () => ({ setAuthTokenProvider: vi.fn(), authHeaders: async () => ({ Authorization: "Bearer synthetic-token" }) }));
vi.mock("../lib/naturalVoice", () => ({ initNaturalVoice: vi.fn() }));
vi.mock("../lib/analytics", () => ({ setAnalyticsUser: vi.fn() }));
vi.mock("../lib/loopEvents", () => ({ trackSessionOpen: vi.fn() }));
vi.mock("../lib/retentionRollup", () => ({ recordRetentionSession: vi.fn() }));
vi.mock("../lib/comicPageStore", () => ({ purgeAllComicPages: h.comic }));
vi.mock("../lib/heroRenderStore", () => ({ purgeAllHeroRenders: vi.fn(async () => {}) }));
vi.mock("../lib/comicPrewarm", () => ({ clearPrewarmedComic: vi.fn() }));
vi.mock("../lib/nativeBilling", () => ({ syncNativeBillingUser: vi.fn() }));
vi.mock("../components/kidmode/parentGate", () => ({ clearMathExit: vi.fn() }));
import { AuthProvider } from "./AuthContext";
import { createBookAssetScope, setBookAssetBackend } from "../lib/bookAssetStore";
const mount = () => {
  const value = AuthProvider({ children: null }).props.value as { signOut: () => Promise<void> };
  for (const effect of h.effects.splice(0)) { const cleanup = effect(); if (cleanup) h.cleanups.push(cleanup); }
  return value;
};
beforeEach(() => { vi.clearAllMocks(); h.owner = { uid: "owner-a" }; h.effects = []; h.cleanups = []; h.comic.mockResolvedValue(undefined); h.logout.mockResolvedValue(undefined); setBookAssetBackend(null); });
afterEach(() => { h.cleanups.splice(0).forEach(fn => fn()); setBookAssetBackend(null); });
describe("auth private-cache retirement integration", () => {
  it("the registered passive observer synchronously retires A → signed out → B → A scopes", () => {
    mount(); const prior = h.owner; const scope = createBookAssetScope("kid-a");
    h.owner = null; h.observer!(null); expect(scope.signal.aborted).toBe(true);
    h.owner = { uid: "owner-b" }; h.observer!(h.owner); h.owner = prior; h.observer!(prior);
    expect(scope.current()).toBe(false); expect(createBookAssetScope("kid-a").current()).toBe(true);
  });
  it("explicit sign-out retires before waiting for any other device purge or SDK logout", async () => {
    let release!: () => void; h.comic.mockReturnValue(new Promise<void>(resolve => { release = resolve; }));
    const value = mount(); const scope = createBookAssetScope("kid-a"); const pending = value.signOut();
    expect(scope.signal.aborted).toBe(true); expect(createBookAssetScope("kid-a").current()).toBe(false); expect(h.logout).not.toHaveBeenCalled();
    release(); await pending; expect(h.logout).toHaveBeenCalledTimes(1);
  });
  it("provider unmount retires pending private reads and removes its observer", () => {
    mount(); const scope = createBookAssetScope("kid-a"); h.cleanups.splice(0).forEach(fn => fn());
    expect(scope.signal.aborted).toBe(true); expect(h.unsub).toHaveBeenCalledTimes(1);
  });
});
