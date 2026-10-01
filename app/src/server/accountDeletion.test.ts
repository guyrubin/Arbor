/**
 * STORE-4 — receipt-honesty guards for full account deletion.
 *
 * The regression class this pins: eraseEverything's old receipt "proceeds,
 * reports zeros" — a simulated delete failure must NEVER yield a clean
 * receipt, and the Auth user must survive any partial failure so the parent
 * keeps a sign-in that can retry.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// B-DATA-01: a fake top-level Firestore (collection/doc map) so the REAL
// createFirestoreDeletionOps executors and the REAL FirestoreDigestOptInStore
// can be driven end to end without a network or emulator.
const fake = vi.hoisted(() => {
  const docs = new Map<string, Record<string, unknown>>();
  const docRef = (path: string) => ({
    path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      docs.set(path, opts?.merge ? { ...(docs.get(path) ?? {}), ...data } : { ...data });
    },
    delete: async () => { docs.delete(path); },
  });
  const db = { collection: (name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }) };
  return { docs, db };
});
vi.mock("firebase-admin/app", () => ({ getApps: () => [{}], initializeApp: vi.fn(), applicationDefault: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => fake.db,
  FieldPath: { documentId: () => "__id__" },
  FieldValue: { arrayRemove: (v: unknown) => ({ __arrayRemove: v }) },
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: () => ({}) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({}) }));

import {
  createFirestoreDeletionOps,
  DELETION_CLASS_ORDER,
  runAccountDeletion,
  UID_KEYED_COLLECTIONS,
  type DeletionOps,
} from "./accountDeletion.js";
import { FirestoreDigestOptInStore } from "./digestOptIn.js";
import { createTestConfig } from "../testConfig.js";

const okOps = (): DeletionOps & { order: string[] } => {
  const order: string[] = [];
  const track = <T>(name: string, value: T) => async () => { order.push(name); return value; };
  return {
    order,
    revenuecat: track("revenuecat", { deleted: 1 }),
    entitlements: track("entitlements", 1),
    referral: track("referral", 2),
    pushTokens: track("pushTokens", 1),
    aiQuota: track("aiQuota", { deleted: 3 }),
    consultRequests: track("consultRequests", 0),
    waitlist: track("waitlist", { deleted: 1 }),
    shares: track("shares", 2),
    childData: track("childData", { deleted: 40, note: "2 child profile(s) erased" }),
    families: track("families", { deleted: 1 }),
    digestOptIn: track("digestOptIn", 1),
    retentionRollup: track("retentionRollup", 1),
    userTree: track("userTree", { deleted: 1 }),
    storageFiles: track("storageFiles", { deleted: 1 }),
    authUser: async () => { order.push("authUser"); },
  };
};

describe("full clean sweep", () => {
  it("runs every class, deletes Auth LAST, and reports complete", async () => {
    const ops = okOps();
    const receipt = await runAccountDeletion(ops, "uid-1", "parent@example.com");
    expect(receipt.complete).toBe(true);
    expect(receipt.authDeleted).toBe(true);
    expect(ops.order[0]).toBe("revenuecat"); // before entitlements — no late webhook rewrite
    expect(ops.order[1]).toBe("entitlements");
    expect(ops.order[ops.order.length - 1]).toBe("authUser");
    expect(receipt.classes.every((c) => c.failed === 0)).toBe(true);
    // Counts are the real ones, not fabricated zeros.
    expect(receipt.classes.find((c) => c.class === "childData")?.deleted).toBe(40);
  });
});

describe("honesty: a failure can never yield a clean receipt", () => {
  it("a class that keeps failing marks the receipt incomplete and SKIPS Auth deletion", async () => {
    const ops = okOps();
    ops.storageFiles = vi.fn(async () => { throw new Error("bucket unavailable"); });
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(receipt.complete).toBe(false);
    expect(receipt.authDeleted).toBe(false);
    expect(ops.order).not.toContain("authUser"); // account survives for retry
    const cls = receipt.classes.find((c) => c.class === "storageFiles");
    expect(cls?.failed).toBe(1);
    expect(cls?.error).toMatch(/bucket unavailable/);
  });

  it("child-data failure is reported with a real error, never zeros-as-success", async () => {
    const ops = okOps();
    ops.childData = async () => { throw new Error("firestore unavailable"); };
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(receipt.complete).toBe(false);
    const cls = receipt.classes.find((c) => c.class === "childData");
    expect(cls).toMatchObject({ attempted: true, deleted: 0, failed: 1 });
    expect(cls?.error).toMatch(/firestore unavailable/);
  });

  it("an Auth deletion failure after a clean sweep is itself surfaced, not swallowed", async () => {
    const ops = okOps();
    ops.authUser = async () => { throw new Error("auth backend down"); };
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(receipt.complete).toBe(false);
    expect(receipt.authDeleted).toBe(false);
    expect(receipt.classes.find((c) => c.class === "authUser")?.failed).toBe(1);
  });
});

describe("retry: one transient failure per class self-heals", () => {
  it("retries a class once and reports success when the retry lands", async () => {
    const ops = okOps();
    let calls = 0;
    ops.entitlements = async () => {
      calls += 1;
      if (calls === 1) throw new Error("transient");
      return 1;
    };
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(calls).toBe(2);
    expect(receipt.complete).toBe(true);
    expect(receipt.classes.find((c) => c.class === "entitlements")).toMatchObject({ deleted: 1, failed: 0 });
  });

  it("stops after the second failure — no infinite retry", async () => {
    const ops = okOps();
    const fn = vi.fn(async () => { throw new Error("hard down"); });
    ops.referral = fn;
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(receipt.complete).toBe(false);
  });
});

describe("skip semantics stay honest", () => {
  it("an unconfigured class reports its skip note in the receipt (never a silent zero)", async () => {
    const ops = okOps();
    ops.revenuecat = async () => ({ deleted: 0, note: "skipped: REVENUECAT_SECRET_API_KEY not configured" });
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(receipt.classes.find((c) => c.class === "revenuecat")?.note).toMatch(/skipped/);
    expect(receipt.complete).toBe(true); // configured-later cleanup, not a hidden failure
  });

  it("the account email reaches the email-keyed classes (waitlist + recipient shares)", async () => {
    const ops = okOps();
    const waitlist = vi.fn(async () => ({ deleted: 1 }));
    const shares = vi.fn(async () => 2);
    ops.waitlist = waitlist;
    ops.shares = shares;
    await runAccountDeletion(ops, "uid-1", "Parent@Example.com");
    expect(waitlist).toHaveBeenCalledWith("Parent@Example.com");
    expect(shares).toHaveBeenCalledWith("uid-1", "Parent@Example.com");
  });
});


describe("B-DATA-01 · digestOptIn and retentionRollups die with the account", () => {
  it("the receipt lists both classes, counted, before the users tree and Auth", async () => {
    const ops = okOps();
    const receipt = await runAccountDeletion(ops, "uid-1", "parent@example.com");
    const names = receipt.classes.map((c) => c.class);
    expect(names).toContain("digestOptIn");
    expect(names).toContain("retentionRollup");
    expect(receipt.classes.find((c) => c.class === "digestOptIn")?.deleted).toBe(1);
    expect(receipt.classes.find((c) => c.class === "retentionRollup")?.deleted).toBe(1);
    expect(ops.order.indexOf("digestOptIn")).toBeLessThan(ops.order.indexOf("authUser"));
  });

  it("a failing digest delete keeps the account alive (honest partial receipt)", async () => {
    const ops = okOps();
    ops.digestOptIn = vi.fn(async () => { throw new Error("firestore unavailable"); });
    const receipt = await runAccountDeletion(ops, "uid-1", null);
    expect(receipt.complete).toBe(false);
    expect(receipt.authDeleted).toBe(false);
    expect(receipt.classes.find((c) => c.class === "digestOptIn")?.failed).toBe(1);
  });

  it("fake Firestore: a synthetic opted-in user's digestOptIn and rollup docs are gone after the executors run", async () => {
    const config = createTestConfig({ memoryAdapter: "firestore" });
    const digest = new FirestoreDigestOptInStore(config);
    await digest.put("uid-opted", { email: "parent@example.com", language: "he", optedInAt: "2026-09-01T00:00:00.000Z", lastSentAt: null });
    fake.docs.set("retentionRollups/uid-opted", { firstSeenDay: "2026-09-01", activeDays: ["2026-09-01"] });
    fake.docs.set("digestOptIn/uid-other", { email: "other@example.com" });
    expect(fake.docs.has("digestOptIn/uid-opted")).toBe(true);
    const ops = createFirestoreDeletionOps(config, {
      memoryEraseChild: async () => 0,
      consentEraseByChild: async () => 0,
      shareEraseByChild: async () => 0,
      pushTokensRemove: async () => undefined,
      digestOptInRemove: (u) => digest.remove(u),
    });
    expect(await ops.digestOptIn("uid-opted")).toBe(1);
    expect(await ops.retentionRollup("uid-opted")).toBe(1);
    expect(fake.docs.has("digestOptIn/uid-opted")).toBe(false);
    expect(fake.docs.has("retentionRollups/uid-opted")).toBe(false);
    expect(await digest.get("uid-opted")).toBeNull();
    // Only the deleted user's rows go.
    expect(fake.docs.has("digestOptIn/uid-other")).toBe(true);
  });

  it("api.ts wires the digest store's remove into the deletion ops", () => {
    const api = readFileSync(resolve(__dirname, "../routes/api.ts"), "utf8");
    expect(api).toContain("digestOptInRemove: (u) => digestOptIns.remove(u),");
  });

  it("every top-level uid-keyed collection in firestore.rules has a deletion class", () => {
    const rules = readFileSync(resolve(__dirname, "../../../firestore.rules"), "utf8");
    // Top-level matches sit at 4-space indent inside `match /databases/.../documents`.
    const topLevel = [...rules.matchAll(/^ {4}match \/([A-Za-z]+)\/\{([A-Za-z]+)\}/gm)].map((m) => ({ name: m[1], wildcard: m[2] }));
    expect(topLevel.length).toBeGreaterThan(5);
    const uidKeyed = topLevel.filter((m) => /^(uid|userId)$/.test(m.wildcard)).map((m) => m.name).sort();
    expect(uidKeyed).toEqual(["digestOptIn", "entitlements", "retentionRollups", "users"]);
    for (const name of uidKeyed) {
      const cls = UID_KEYED_COLLECTIONS[name];
      expect(cls, `no deletion class for uid-keyed collection ${name}`).toBeTruthy();
      expect(DELETION_CLASS_ORDER, `${name} → ${cls} is not run`).toContain(cls);
    }
    // aiRuns / safetyReviews are rules-only (no writer in src) and not uid-keyed.
    expect(topLevel.map((m) => m.name)).toEqual(expect.arrayContaining(["aiRuns", "safetyReviews"]));
  });
});
