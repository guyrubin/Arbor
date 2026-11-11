/**
 * B-AIOPS-01 regression (11 Nov 2026): the cost middleware must never fail the
 * paid request it decorates. It called the store's lookup detached from the
 * store, the Firestore store's `this.families` was undefined, the TypeError was
 * thrown synchronously (outside the promise) and every paid route for a
 * signed-in parent answered 500 — Ask Arbor, read-aloud, stories. The earlier
 * route tests stubbed the lookup with an arrow function, which has no `this`
 * to lose; these use a class instance exactly like FirestoreMemoryStore.
 */
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { bindFamilyForCost } from "./bindFamilyCost.js";
import { currentRequestContext, requestContextMiddleware } from "./requestContext.js";

class Families {
  calls: string[] = [];
  async ensureFamilyForUser(uid: string) { this.calls.push(uid); return { familyId: `fam-${uid}` }; }
}

/** Shaped like FirestoreMemoryStore: the lookup delegates through `this`. */
class ClassStore {
  constructor(readonly families = new Families()) {}
  ensureFamilyForUser(uid: string): Promise<{ familyId: string }> { return this.families.ensureFamilyForUser(uid); }
}

function run(store: Parameters<typeof bindFamilyForCost>[0], path: string, uid: string) {
  const req = { path, user: { uid }, arborRequestId: "req-1" } as unknown as Request;
  return new Promise<{ calls: number; familyId: string | null | undefined }>((resolve, reject) => {
    let calls = 0;
    requestContextMiddleware(req, {} as Response, () => {
      try {
        bindFamilyForCost(store)(req, {} as Response, () => {
          calls += 1;
          const familyId = currentRequestContext()?.familyId;
          // A second next() would show up as calls > 1 on the next tick.
          setTimeout(() => resolve({ calls, familyId }), 0);
        });
      } catch (error) { reject(error); }
    });
  });
}

describe("bindFamilyForCost", () => {
  it("calls a class-based store as a method and stamps the family on the paid request", async () => {
    const store = new ClassStore();
    const result = await run(store, "/chat", "uid-class-a");
    expect(result).toEqual({ calls: 1, familyId: "fam-uid-class-a" });
    expect(store.families.calls).toEqual(["uid-class-a"]);
  });

  it("serves the request when the lookup throws synchronously", async () => {
    const store = { ensureFamilyForUser(): Promise<{ familyId: string }> { throw new TypeError("Cannot read properties of undefined (reading 'families')"); } };
    await expect(run(store, "/tts", "uid-sync-throw")).resolves.toEqual({ calls: 1, familyId: null });
  });

  it("serves the request when the lookup rejects", async () => {
    const store = { ensureFamilyForUser: vi.fn(async () => { throw new Error("index missing"); }) };
    await expect(run(store, "/todays-focus", "uid-reject")).resolves.toEqual({ calls: 1, familyId: null });
  });

  it("leaves unpaid routes and stores without a lookup alone", async () => {
    const store = { ensureFamilyForUser: vi.fn(async () => ({ familyId: "fam-x" })) };
    await expect(run(store, "/entitlement", "uid-unpaid")).resolves.toEqual({ calls: 1, familyId: null });
    expect(store.ensureFamilyForUser).not.toHaveBeenCalled();
    await expect(run({}, "/chat", "uid-no-lookup")).resolves.toEqual({ calls: 1, familyId: null });
  });

  it("answers a repeat request from the cache without a second lookup", async () => {
    const store = new ClassStore();
    await run(store, "/chat", "uid-cached");
    const again = await run(store, "/tts", "uid-cached");
    expect(again).toEqual({ calls: 1, familyId: "fam-uid-cached" });
    expect(store.families.calls).toEqual(["uid-cached"]);
  });
});
