/**
 * B-GA-09 round 5 (critic r4 P1-2) — an unfinished erase is kept for the
 * account that started it, holds no name, and leaves with sign-out.
 * Synthetic ids only.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PENDING_ERASE_KEY, finishPendingErases, forgetPendingErases, readPendingErases, receiptFinished, settlePendingErase,
} from "./pendingErase";
import { ACCOUNT_DEVICE_KEYS, childSinkIds } from "./childDataSinks";
import { CHILD_SUBCOLLECTIONS } from "./childData";
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

const ids = childSinkIds(CHILD_SUBCOLLECTIONS);
const receipt = (childId: string, reached: boolean): DeletionReceipt => ({
  childId,
  erasedAt: "2026-10-28T10:00:00.000Z",
  counts: { memoryEvents: 1, shares: 0, consents: 0, consultRequests: 0, storageFiles: 0, clientDocs: 2 },
  sinks: Object.fromEntries(ids.map((id, i) => [id, reached || i % 2 ? 0 : "not-reached"])),
});

describe("B-GA-09 · pending erases are per account and nameless", () => {
  it("an unfinished erase is kept for its account only; another account on the same device sees nothing", () => {
    const s = new MemStore() as unknown as Storage;
    expect(settlePendingErase("synthetic-a", receipt("kid-a", false), s)).toBe(false);
    expect(readPendingErases("synthetic-a", s).map((p) => p.childId)).toEqual(["kid-a"]);
    expect(readPendingErases("synthetic-b", s)).toEqual([]);
  });

  it("an entry holds the account, the child id and the receipt — no name, nothing else", () => {
    const s = new MemStore() as unknown as Storage;
    settlePendingErase("synthetic-a", receipt("kid-a", false), s);
    const raw = JSON.parse(s.getItem(PENDING_ERASE_KEY)!) as Array<Record<string, unknown>>;
    expect(Object.keys(raw[0]).sort()).toEqual(["childId", "receipt", "uid"]);
    expect(Object.keys(raw[0].receipt as object).sort()).toEqual(["childId", "counts", "erasedAt", "sinks"]);
  });

  it("a stored name (the round-4 shape) is never read back", () => {
    const s = new MemStore() as unknown as Storage;
    s.setItem(PENDING_ERASE_KEY, JSON.stringify([{ childId: "kid-a", name: "Synthetic", receipt: receipt("kid-a", false) }]));
    expect(readPendingErases("", s)).toEqual([]);
    s.setItem(PENDING_ERASE_KEY, JSON.stringify([{ uid: "synthetic-a", childId: "kid-a", name: "Synthetic", receipt: receipt("kid-a", false) }]));
    expect(readPendingErases("synthetic-a", s)[0]).not.toHaveProperty("name");
  });

  it("a finished erase is forgotten, and the key goes when nothing is left", () => {
    const s = new MemStore() as unknown as Storage;
    settlePendingErase("synthetic-a", receipt("kid-a", false), s);
    expect(settlePendingErase("synthetic-a", receipt("kid-a", true), s)).toBe(true);
    expect(s.getItem(PENDING_ERASE_KEY)).toBeNull();
    expect(receiptFinished(receipt("kid-a", true))).toBe(true);
  });

  it("sign-out purges the key, and AuthContext.signOut calls it", () => {
    const s = new MemStore() as unknown as Storage;
    settlePendingErase("synthetic-a", receipt("kid-a", false), s);
    forgetPendingErases(s);
    expect(s.getItem(PENDING_ERASE_KEY)).toBeNull();
    const auth = readFileSync(new URL("../context/AuthContext.tsx", import.meta.url), "utf8");
    const signOut = auth.slice(auth.indexOf("const signOut = async"), auth.indexOf("firebaseSignOut(auth)"));
    expect(signOut).toMatch(/forgetPendingErases\(\)/);
  });

  it("the app shell finishes this account's erases: a finished retry clears it, a failing one stays", async () => {
    const s = new MemStore() as unknown as Storage;
    settlePendingErase("synthetic-a", receipt("kid-a", false), s);
    settlePendingErase("synthetic-a", receipt("kid-b", false), s);
    settlePendingErase("synthetic-b", receipt("kid-c", false), s);
    const asked: string[] = [];
    await finishPendingErases("synthetic-a", async (childId) => {
      asked.push(childId);
      if (childId === "kid-b") throw new Error("synthetic offline");
      return receipt(childId, true);
    }, s);
    expect(asked).toEqual(["kid-a", "kid-b"]);
    expect(readPendingErases("synthetic-a", s).map((p) => p.childId)).toEqual(["kid-b"]);
    expect(readPendingErases("synthetic-b", s).map((p) => p.childId)).toEqual(["kid-c"]);
  });

  it("with no child left (onboarding), the app shell finishes them: Your data cannot be opened there", () => {
    const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    expect(app).toMatch(/if \(needsOnboarding \|\| forceOnboardingPreview\) return <><PendingEraseSettler \/><OnboardingFlow \/><\/>;/);
    expect(app).toMatch(/finishPendingErases\(uid, \(childId\) => eraseEverything\(uid \|\| undefined, childId\)\)/);
  });

  it("the registry describes the key as it is: per account, ids and counts only, purged at sign-out", () => {
    expect(ACCOUNT_DEVICE_KEYS[PENDING_ERASE_KEY]).toMatch(/uid/);
    expect(ACCOUNT_DEVICE_KEYS[PENDING_ERASE_KEY]).toMatch(/sign-out/);
    expect(ACCOUNT_DEVICE_KEYS[PENDING_ERASE_KEY]).not.toMatch(/name/);
  });
});
