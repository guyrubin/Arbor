/** Real resolver/asset hooks with deterministic React slots and synthetic
 * subscriptions. Exercises stale snapshots and promises; no child data/models. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeroSheetDocs } from "../../../lib/heroSheetStore";
import type { HeroSheet } from "./heroSheet";

type Effect = () => void | (() => void);
type Slot = { value?: any; deps?: readonly unknown[]; cleanup?: () => void };
const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as Slot[], effects: [] as (() => void)[],
  auth: { currentUser: { uid: "owner-a" } as { uid: string } | null },
  subscriptions: [] as { childId: string; cb: (docs: HeroSheetDocs) => void; active: boolean }[],
  ownerListeners: new Set<() => void>(), proof: vi.fn(), device: vi.fn(), preload: vi.fn(),
  art: { source: "synthetic-art" },
}));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const equal = (a: readonly unknown[] | undefined, b: readonly unknown[]) => !!a && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const effect = (fn: Effect, deps: readonly unknown[]) => {
    const index = h.cursor++, old = h.slots[index];
    if (equal(old?.deps, deps)) return;
    const slot: Slot = h.slots[index] = { deps, cleanup: old?.cleanup };
    h.effects.push(() => { slot.cleanup?.(); slot.cleanup = fn() || undefined; });
  };
  return { ...actual,
    useState(initial: unknown) {
      const index = h.cursor++, slot = h.slots[index] ??= { value: typeof initial === "function" ? (initial as () => unknown)() : initial };
      return [slot.value, (next: any) => { slot.value = typeof next === "function" ? next(slot.value) : next; }];
    },
    useRef(initial: unknown) { return (h.slots[h.cursor++] ??= { value: { current: initial } }).value; },
    useMemo(factory: () => unknown, deps: readonly unknown[]) {
      const index = h.cursor++, old = h.slots[index];
      if (equal(old?.deps, deps)) return old!.value;
      const slot = h.slots[index] = { value: factory(), deps }; return slot.value;
    },
    useEffect: effect,
    useSyncExternalStore(subscribe: (changed: () => void) => () => void, snapshot: () => unknown) {
      effect(() => subscribe(() => {}), [subscribe]); return snapshot();
    },
  };
});
vi.mock("../../../lib/firebase", () => ({ firebaseEnabled: true, auth: h.auth, db: null }));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: () => void) => { h.ownerListeners.add(callback); return () => h.ownerListeners.delete(callback); },
}));
vi.mock("../../../lib/heroSheetStore", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../lib/heroSheetStore")>(),
  subscribeHeroSheetDocs(childId: string, cb: (docs: HeroSheetDocs) => void) {
    const subscription = { childId, cb, active: true }; h.subscriptions.push(subscription);
    return () => { subscription.active = false; };
  },
}));
vi.mock("./heroSheet", async (importOriginal) => ({
  ...await importOriginal<typeof import("./heroSheet")>(), loadProofHeroSheet: h.proof, readStoredHeroSheet: h.device,
}));
vi.mock("../proofAssets", async (importOriginal) => ({
  ...await importOriginal<typeof import("../proofAssets")>(), preloadImages: h.preload,
}));
vi.mock("../games/sneakFreeze/sneakArt", async (importOriginal) => ({
  ...await importOriginal<typeof import("../games/sneakFreeze/sneakArt")>(),
  readSneakArt: () => h.art, loadProofArt: async () => h.art, artUrls: () => [],
}));

import { heroAvatarHash } from "../../../lib/heroSheetContract";
import { parseHeroSheetDocs } from "../../../lib/heroSheetStore";
import { useHeroSheetState, type HeroChainChild } from "./useHeroSheet";
import { useSneakAssets } from "../games/sneakFreeze/SneakFreeze";

const AVATAR = "data:image/png;base64,QVBQUk9WRUQ=", OTHER = "data:image/png;base64,T1RIRVI=";
const child: HeroChainChild = { id: "child-a", photoUrl: AVATAR, avatar: { source: "descriptor" } };
const docs = (url = AVATAR, revision = "old"): HeroSheetDocs => {
  const hash = heroAvatarHash(url);
  return parseHeroSheetDocs([
    { id: "_meta", avatarHash: hash, heroId: hash, status: "complete", poses: ["idle", "cheer"] },
    ...["idle", "cheer"].map(pose => ({ id: pose, pose, avatarHash: hash, dataUrl: `data:image/webp;base64,${revision}-${pose}`, w: 100, h: 200,
      foot: { x: revision === "old" ? 40 : 50, y: 190 }, head: { x: 50, y: 30, r: 20 } })),
  ]);
};
const commit = () => { for (const effect of h.effects.splice(0)) effect(); };
const render = (c: HeroChainChild = child, commitNow = true) => { h.cursor = 0; const result = useHeroSheetState(c); if (commitNow) commit(); return result; };
const renderGame = (c: HeroChainChild = child, commitNow = true) => { h.cursor = 0; const result = useSneakAssets(c); if (commitNow) commit(); return result; };
const emit = (value: HeroSheetDocs) => h.subscriptions.filter(s => s.active).at(-1)!.cb(value);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const unmount = () => { for (const slot of h.slots) { slot.cleanup?.(); slot.cleanup = undefined; } };
const resolve = async (c = child) => { render(c); emit(docs(c.photoUrl!)); render(c); await flush(); return render(c); };

beforeEach(() => {
  vi.clearAllMocks(); h.cursor = 0; h.slots = []; h.effects = []; h.subscriptions = []; h.ownerListeners.clear();
  h.auth.currentUser = { uid: "owner-a" }; h.proof.mockResolvedValue(null); h.device.mockReturnValue(null); h.preload.mockResolvedValue(undefined);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe("hero resolver identity and snapshot lifetime", () => {
  it("first paint uses the approved portrait even when the device contains another hero", () => {
    h.device.mockReturnValue({ v: 1, heroId: "other", source: "proof", theme: "film3d", poses: {} });
    const result = render(); expect(result.ready).toBe(false); expect(result.from).toBe("avatar");
    expect(result.sheet.poses.idle?.url).toBe(AVATAR);
  });
  it("replaces changed pose pixels and anchors even when pose names/hash/status stay identical", async () => {
    const original = await resolve(); expect(original.from).toBe("child");
    emit(docs(AVATAR, "redrawn")); const pending = render();
    expect(pending.sheet).not.toBe(original.sheet); expect(pending.from).toBe("child"); expect(pending.ready).toBe(true);
    await flush(); const updated = render();
    expect(updated.sheet.poses.idle?.url).toBe("data:image/webp;base64,redrawn-idle");
    expect(updated.sheet.poses.idle?.foot.x).toBe(50);
  });
  it("review-only docs keep the exact live sheet without a loading or portrait flash", async () => {
    const original = await resolve(), reviewed = docs();
    reviewed.poses.idle!.review = "ok"; reviewed.meta!.updatedAt = "later";
    emit(reviewed); const next = render();
    expect(next.ready).toBe(true); expect(next.from).toBe("child"); expect(next.sheet).toBe(original.sheet);
  });
  it("drops old docs immediately when the child or profile avatar changes", async () => {
    const old = await resolve();
    const changed = render({ ...child, photoUrl: OTHER }, false);
    expect(changed.identityKey).not.toBe(old.identityKey); expect(changed.sheet.poses.idle?.url).toBe(OTHER);
    commit(); await flush(); expect(render({ ...child, photoUrl: OTHER }).from).toBe("avatar");
    const next = render({ ...child, id: "child-b", photoUrl: OTHER }, false);
    expect(next.ready).toBe(false); expect(next.sheet.poses.idle?.url).toBe(OTHER); commit();
  });
  it("changes comic identity even when photoUrl is unchanged", async () => {
    await resolve(); const result = render({ ...child, comicAvatarUrl: OTHER });
    expect(result.from).toBe("avatar"); expect(result.sheet.poses.idle?.url).toBe(OTHER);
  });
  it("scope includes owner; old subscription deliveries cannot revive another owner's docs", async () => {
    const old = await resolve(), stale = h.subscriptions.at(-1)!;
    h.auth.currentUser = { uid: "owner-b" };
    const next = render(child, false); expect(next.identityKey).not.toBe(old.identityKey);
    expect(next.ready).toBe(false); expect(next.from).toBe("avatar");
    stale.cb(docs(AVATAR, "wrong-owner")); commit(); await flush();
    expect(render().from).toBe("avatar"); expect(stale.active).toBe(false);
    emit(docs(AVATAR, "right-owner")); render(); await flush();
    expect(render().sheet.poses.idle?.url).toBe("data:image/webp;base64,right-owner-idle");
  });
  it("a Firebase build never loads the public proof sheet, for any child (B-BOOK-71)", async () => {
    const proofChild = { ...child, id: "proof-child" };
    render(proofChild); emit({ meta: null, poses: {} }); render(proofChild); await flush();
    expect(h.proof).not.toHaveBeenCalled();
    expect(render(proofChild).sheet.poses.idle?.url).toBe(AVATAR);
    unmount(); expect(h.subscriptions.every(s => !s.active)).toBe(true); expect(h.ownerListeners.size).toBe(0);
  });
});

describe("Sneak & Freeze settled assets follow the active identity", () => {
  const settleGame = async () => {
    renderGame(); emit(docs()); renderGame(); await flush(); renderGame(); await flush(); return renderGame();
  };
  it("invalidates a settled poster before effects when the avatar or child changes", async () => {
    vi.stubGlobal("window", {}); const previous = await settleGame(); expect(previous.ready).toBe(true);
    const changed = renderGame({ ...child, id: "child-b", photoUrl: OTHER }, false);
    expect(changed.ready).toBe(false); expect(changed.sheet).not.toBe(previous.sheet);
    expect(changed.sheet.poses.idle?.url).toBe(OTHER); commit();
  });
  it("invalidates settled assets on owner changes and same-identity pose redraws", async () => {
    vi.stubGlobal("window", {}); const previous = await settleGame(); expect(previous.ready).toBe(true);
    emit(docs(AVATAR, "redrawn")); expect(renderGame().sheet).not.toBe(previous.sheet);
    await flush(); renderGame(); await flush(); const redrawn = renderGame();
    expect(redrawn.ready).toBe(true); expect(redrawn.sheet.poses.idle?.url).toContain("redrawn-idle");
    h.auth.currentUser = { uid: "owner-b" }; const next = renderGame(child, false);
    expect(next.ready).toBe(false); expect(next.sheet).not.toBe(redrawn.sheet); commit();
  });
});
