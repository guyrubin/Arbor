/**
 * B-GA-09 round 7 — the ONE per-child server erase (server/childErase) that
 * /privacy/erase and account deletion both run. Pins its order (the erase
 * record first, the child doc that anchors the owner check last), that every
 * place is reached (consult requests included, which account deletion used to
 * skip), and that only account deletion drops the erase record. Synthetic ids.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const objects = vi.hoisted(() => new Set<string>());
vi.mock("firebase-admin/storage", () => {
  const file = (name: string) => ({ name, delete: async () => { calls.push(`storage:delete ${name.split("/").slice(0, 2).join("/")}`); objects.delete(name); } });
  const bucket = {
    file,
    getFiles: async ({ prefix }: { prefix: string }) => [[...objects].filter((n) => n.startsWith(prefix)).map(file)],
    deleteFiles: async ({ prefix }: { prefix: string }) => { calls.push("storage:photos"); for (const n of [...objects]) if (n.startsWith(prefix)) objects.delete(n); },
  };
  return { getStorage: () => ({ bucket: () => bucket }) };
});
const calls = vi.hoisted(() => [] as string[]);

import { childEraseTotal, eraseChildServerData, type ChildEraseStores } from "./childErase";

const stores = (over: Partial<ChildEraseStores> = {}): ChildEraseStores => ({
  memoryStore: {
    recordErase: async () => { calls.push("record"); },
    eraseChild: async () => { calls.push("ledger+anchor"); return 2; },
    dropEraseRecord: async () => { calls.push("drop-record"); },
  },
  shareStore: { eraseByChild: async () => { calls.push("shares"); return 1; } },
  consentStore: { eraseByChild: async () => { calls.push("consents"); return 1; } },
  consultStore: { eraseByChild: async () => { calls.push("consults"); return 3; } },
  ...over,
});

describe("B-GA-09 · the one per-child server erase", () => {
  it("runs the erase record first and the child doc last, and reaches every place, consult requests included", async () => {
    calls.length = 0;
    objects.clear();
    objects.add("users/u1/children/kid-a/photos/p1.jpg");
    objects.add("children/kid-a/books/b1/manifest.json");
    const r = await eraseChildServerData(stores({ storageBucket: "synthetic-bucket" }), "u1", "kid-a");
    expect(calls).toEqual(["record", "shares", "consents", "consults", "storage:photos", "storage:delete children/kid-a", "ledger+anchor"]);
    expect(r).toMatchObject({ memoryEvents: 2, shares: 1, consents: 1, consultRequests: 3, storageFiles: 2, storage: { photos: 1, books: 1 } });
    expect(childEraseTotal(r)).toBe(9);
    expect(objects.size).toBe(0);
  });

  it("the route keeps the erase record (a retry after a lost response); account deletion drops it", async () => {
    calls.length = 0;
    await eraseChildServerData(stores(), "u1", "kid-a");
    expect(calls).not.toContain("drop-record");
    calls.length = 0;
    await eraseChildServerData(stores(), "u1", "kid-a", { dropRecord: true });
    expect(calls.at(-1)).toBe("drop-record");
  });

  it("with no bucket the Storage step is skipped and claims no count", async () => {
    const r = await eraseChildServerData(stores(), "u1", "kid-a");
    expect(r.storage).toBeUndefined();
    expect(r.storageNote).toMatch(/no storage bucket/);
  });

  it("a failing step stops the erase before the anchor, so the owner can retry", async () => {
    calls.length = 0;
    const failing = stores({ consultStore: { eraseByChild: async () => { throw new Error("synthetic consult store failure"); } } });
    await expect(eraseChildServerData(failing, "u1", "kid-a")).rejects.toThrow(/synthetic/);
    expect(calls).toEqual(["record", "shares", "consents"]);
  });

  it("both callers run it: /privacy/erase, and account deletion for every child it finds", () => {
    const api = readFileSync(new URL("../routes/api.ts", import.meta.url), "utf8");
    const route = api.slice(api.indexOf('router.post("/privacy/erase"'), api.indexOf('router.post("/account/delete"'));
    expect(route).toContain("await eraseChildServerData(childEraseStores, uid, childId);");
    expect(route).not.toMatch(/consultStore\.eraseByChild|deleteFiles\(|memoryStore\.eraseChild\(/);
    expect(api).toMatch(/eraseChild: async \(ownerUid, childId\) => childEraseTotal\(await eraseChildServerData\(childEraseStores, ownerUid, childId, \{ dropRecord: true \}\)\)/);
    const deletion = readFileSync(new URL("./accountDeletion.ts", import.meta.url), "utf8");
    expect(deletion).not.toMatch(/eraseChildBookAssets|consentEraseByChild|memoryEraseChild/);
  });
});
