/**
 * STORE-4 — receipt-honesty guards for full account deletion.
 *
 * The regression class this pins: eraseEverything's old receipt "proceeds,
 * reports zeros" — a simulated delete failure must NEVER yield a clean
 * receipt, and the Auth user must survive any partial failure so the parent
 * keeps a sign-in that can retry.
 */
import { describe, expect, it, vi } from "vitest";
import { runAccountDeletion, type DeletionOps } from "./accountDeletion.js";

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
