/**
 * B-GA-09 rounds 6–7 — sign-out keeps an unfinished child erase for the
 * account that started it (arbor.pendingErase: per uid, no name), because the
 * server still holds what the erase missed and the same account must find
 * "Finish deleting a child's data" again after signing back in. Behavioural:
 * the REAL AuthProvider's signOut runs against a stub localStorage, with
 * Firebase off and on; the device-local purges it owns still run. Synthetic ids.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ enabled: false, purged: [] as string[], firebaseSignOut: 0 }));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {}, signInWithPopup: vi.fn(), signInWithRedirect: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(), onAuthStateChanged: vi.fn(() => () => undefined),
  signOut: async () => { h.firebaseSignOut += 1; },
}));
vi.mock("../lib/firebase", () => ({ get auth() { return h.enabled ? { currentUser: null } : null; }, get firebaseEnabled() { return h.enabled; } }));
vi.mock("../lib/api", () => ({ setAuthTokenProvider: vi.fn() }));
vi.mock("../lib/naturalVoice", () => ({ initNaturalVoice: vi.fn(), resetNaturalVoice: vi.fn() }));
vi.mock("../lib/analytics", () => ({ setAnalyticsUser: vi.fn() }));
vi.mock("../lib/loopEvents", () => ({ trackSessionOpen: vi.fn() }));
vi.mock("../lib/retentionRollup", () => ({ recordRetentionSession: vi.fn() }));
vi.mock("../lib/comicPageStore", () => ({ purgeAllComicPages: async () => { h.purged.push("comicPages"); } }));
vi.mock("../lib/heroRenderStore", () => ({ purgeAllHeroRenders: async () => { h.purged.push("heroRenders"); } }));
vi.mock("../lib/bookAssetStore", () => ({ purgeBookAssets: async () => { h.purged.push("bookAssets"); } }));
vi.mock("../lib/comicPrewarm", () => ({ clearPrewarmedComic: () => { h.purged.push("prewarm"); } }));
vi.mock("../components/kidmode/parentGate", () => ({ clearMathExit: vi.fn() }));

import { AuthProvider, useAuth } from "./AuthContext";
import { PENDING_ERASE_KEY, readPendingErases, settlePendingErase } from "../lib/pendingErase";
import type { DeletionReceipt } from "../types";

class MemStore {
  map = new Map<string, string>();
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
  removeItem(k: string) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
const unfinished: DeletionReceipt = { childId: "kid-a", erasedAt: "2026-10-28T10:00:00.000Z", counts: { memoryEvents: 0, shares: 0 }, sinks: { "server:memoryEvents": "not-reached" } };

/** The real provider's signOut, captured from its context value. */
function realSignOut(): () => Promise<void> {
  let captured: (() => Promise<void>) | null = null;
  const Capture = () => { captured = useAuth().signOut; return null; };
  renderToStaticMarkup(<AuthProvider><Capture /></AuthProvider>);
  return captured!;
}

afterEach(() => { vi.unstubAllGlobals(); h.purged.length = 0; h.firebaseSignOut = 0; });

describe.each([false, true])("B-GA-09 · sign-out keeps this account's unfinished erase (Firebase %s)", (enabled) => {
  it("the entry survives sign-out; the same uid reads it back after signing in again, another uid never does", async () => {
    h.enabled = enabled;
    const device = new MemStore();
    vi.stubGlobal("localStorage", device as unknown as Storage);
    settlePendingErase("synthetic-a", unfinished);
    const before = device.getItem(PENDING_ERASE_KEY);
    expect(before).not.toBeNull();

    await realSignOut()();

    // sign-out did its own work…
    expect(h.purged).toEqual(["comicPages", "heroRenders", "bookAssets", "prewarm"]);
    expect(h.firebaseSignOut).toBe(enabled ? 1 : 0);
    // …and left the erase record exactly as it was
    expect(device.getItem(PENDING_ERASE_KEY)).toBe(before);
    expect(readPendingErases("synthetic-b")).toEqual([]);
    expect(readPendingErases("synthetic-a").map((p) => p.childId)).toEqual(["kid-a"]);
  });
});
